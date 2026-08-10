import type { Context } from "../context/Context.js";
import { backoff, type BackoffOptions } from "./backoff.js";

export interface RetryOptions extends Omit<BackoffOptions, "timeout"> {
    timeout?: number;
}

const DEFAULT_RETRY_TIMEOUT_MS = 30_000;

export function retry<Result>(
    ctx: Context,
    work: (ctx: Context, attempt: number) => Promise<Result>,
    options: RetryOptions = {},
): Promise<Result> {
    return backoff(ctx, work, {
        ...options,
        timeout: options.timeout ?? DEFAULT_RETRY_TIMEOUT_MS,
    });
}
