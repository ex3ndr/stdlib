import type { Context } from "../context/Context.js";
import type { DerivedContext } from "../context/ContextNamespace.js";
import { shutdown as ShutdownContext } from "./impl/ContextShutdown.js";
import { withLifetime } from "./withLifetime.js";

export interface GracefulShutdownReport {
    timedOut: readonly string[];
    failed: readonly { name: string; error: unknown }[];
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

interface GracefulShutdownState {
    readonly handlers: Map<string, (ctx: Context) => Promise<void>>;
    readonly running: Set<string>;
    readonly controller: AbortController;
    ctx: Context | undefined;
    started: Promise<GracefulShutdownReport> | undefined;
}

const states = new WeakMap<GracefulShutdown, GracefulShutdownState>();

export class GracefulShutdown {
    constructor() {
        states.set(this, {
            handlers: new Map(),
            running: new Set(),
            controller: new AbortController(),
            ctx: undefined,
            started: undefined,
        });
    }

    get ctx(): Context {
        return getState(this).ctx ?? missingContext();
    }

    get shuttingDown(): boolean {
        return getState(this).controller.signal.aborted;
    }

    register(name: string, handler: (ctx: Context) => Promise<void>): () => void {
        const { handlers } = getState(this);
        handlers.set(name, handler);
        return () => {
            if (handlers.get(name) === handler) {
                handlers.delete(name);
            }
        };
    }

    pending(): readonly string[] {
        return [...getState(this).running];
    }

    shutdown(options: { timeout?: number } = {}): Promise<GracefulShutdownReport> {
        const state = getState(this);
        const ctx = state.ctx ?? missingContext();
        state.started ??= runShutdown(
            ctx,
            state.handlers,
            state.running,
            state.controller,
            options.timeout ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
        );
        return state.started;
    }
}

export function withShutdown<Source extends Context>(
    ctx: Source,
    value: GracefulShutdown,
): DerivedContext<Source> {
    const state = getState(value);
    if (state.ctx !== undefined) {
        throw new Error("GracefulShutdown is already attached to a context");
    }

    const shutdownCtx = ShutdownContext.set(withLifetime(ctx, state.controller.signal), value);
    state.ctx = shutdownCtx;
    return shutdownCtx as unknown as DerivedContext<Source>;
}

function getState(value: GracefulShutdown): GracefulShutdownState {
    const state = states.get(value);
    if (state === undefined) {
        throw new TypeError("Invalid GracefulShutdown object");
    }
    return state;
}

function missingContext(): never {
    throw new Error("GracefulShutdown is not attached to a context");
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
