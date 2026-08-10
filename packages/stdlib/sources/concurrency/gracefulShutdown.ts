import type { Context } from "../context/Context.js";
import { ContextShutdown } from "./impl/ContextShutdown.js";
import { withLifetime } from "./withLifetime.js";

export interface GracefulShutdown {
    readonly ctx: Context;
    readonly shuttingDown: boolean;
    register(name: string, handler: (ctx: Context) => Promise<void>): () => void;
    pending(): readonly string[];
    shutdown(options?: { timeout?: number }): Promise<GracefulShutdownReport>;
}

export interface GracefulShutdownReport {
    timedOut: readonly string[];
    failed: readonly { name: string; error: unknown }[];
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

export function gracefulShutdown(ctx: Context): GracefulShutdown {
    const handlers = new Map<string, (ctx: Context) => Promise<void>>();
    const running = new Set<string>();
    const controller = new AbortController();
    let shutdownCtx: Context;
    let started: Promise<GracefulShutdownReport> | undefined;

    const shutdown: GracefulShutdown = {
        get ctx() {
            return shutdownCtx;
        },
        get shuttingDown() {
            return shutdownCtx.lifetime?.aborted === true;
        },
        register(name, handler) {
            handlers.set(name, handler);
            return () => {
                if (handlers.get(name) === handler) {
                    handlers.delete(name);
                }
            };
        },
        pending() {
            return [...running];
        },
        shutdown(options = {}) {
            started ??= runShutdown(
                shutdownCtx,
                handlers,
                running,
                controller,
                options.timeout ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
            );
            return started;
        },
    };

    shutdownCtx = ContextShutdown.set(withLifetime(ctx, controller.signal), shutdown);
    return shutdown;
}

async function runShutdown(
    ctx: Context,
    handlers: ReadonlyMap<string, (ctx: Context) => Promise<void>>,
    running: Set<string>,
    controller: AbortController,
    timeout: number,
): Promise<GracefulShutdownReport> {
    const failed: { name: string; error: unknown }[] = [];
    controller.abort();

    const entries = [...handlers.entries()];
    for (const [name] of entries) {
        running.add(name);
    }

    const settled = entries.map(async ([name, handler]) => {
        try {
            await handler(ctx);
        } catch (error) {
            failed.push({ name, error });
        } finally {
            running.delete(name);
        }
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeout);
    });

    try {
        const outcome = await Promise.race([Promise.all(settled).then(() => "done"), expired]);
        return {
            timedOut: outcome === "timeout" ? [...running] : [],
            failed,
        };
    } finally {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
    }
}
