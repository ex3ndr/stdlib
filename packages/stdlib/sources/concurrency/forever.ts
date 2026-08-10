import type { Context } from "../context/Context.js";
import { isAbortedError } from "./AbortedError.js";
import { backoff } from "./backoff.js";
import { delay } from "./delay.js";

export interface ForeverOptions {
    delay: number;
    name: string;
    delayFirst?: boolean;
    onError?: (ctx: Context, error: unknown, attempt: number) => void;
}

export function forever(
    ctx: Context,
    options: ForeverOptions,
    work: (ctx: Context) => Promise<void>,
): Promise<void> {
    const loop = runForever(ctx, options, work);
    const unregister = ctx.shutdown?.register(options.name, (ctx) => {
        void ctx;
        return loop;
    });

    return loop.finally(() => unregister?.());
}

async function runForever(
    ctx: Context,
    options: ForeverOptions,
    work: (ctx: Context) => Promise<void>,
): Promise<void> {
    try {
        if (options.delayFirst === true) {
            await delay(ctx, options.delay);
        }
        while (ctx.lifetime?.aborted !== true) {
            await backoff(
                ctx,
                (ctx) => work(ctx),
                options.onError === undefined ? {} : { onError: options.onError },
            );
            await delay(ctx, options.delay);
        }
    } catch (error) {
        if (!isAbortedError(error)) {
            throw error;
        }
    }
}
