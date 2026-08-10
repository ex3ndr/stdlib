import type { Context } from "../context/Context.js";
import { isAbortedError, throwIfAborted } from "./AbortedError.js";
import { delay } from "./delay.js";

export interface BackoffOptions {
    initialDelay?: number;
    maxDelay?: number;
    timeout?: number;
    onError?: (ctx: Context, error: unknown, attempt: number) => void;
    now?: () => number;
}

const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 60_000;

export async function backoff<Result>(
    ctx: Context,
    work: (ctx: Context, attempt: number) => Promise<Result>,
    options: BackoffOptions = {},
): Promise<Result> {
    const now = options.now ?? Date.now;
    const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY_MS;
    const deadline = options.timeout === undefined ? undefined : now() + options.timeout;
    let wait = options.initialDelay ?? DEFAULT_INITIAL_DELAY_MS;

    for (let attempt = 1; ; attempt += 1) {
        throwIfAborted(ctx);
        try {
            return await work(ctx, attempt);
        } catch (error) {
            if (isAbortedError(error) || ctx.lifetime?.aborted === true) {
                throw error;
            }
            options.onError?.(ctx, error, attempt);

            if (deadline !== undefined && now() + wait >= deadline) {
                throw error;
            }

            await delay(ctx, wait);
            wait = Math.min(wait * 2, maxDelay);
        }
    }
}
