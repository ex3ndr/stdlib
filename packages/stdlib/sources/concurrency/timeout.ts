import type { Context } from "../context/Context.js";
import { withLifetime } from "./withLifetime.js";

export interface TimeoutOptions {
    ms: number;
}

export async function timeout<Result>(
    ctx: Context,
    options: TimeoutOptions,
    callback: (ctx: Context) => Result | PromiseLike<Result>,
): Promise<Awaited<Result>> {
    if (!Number.isFinite(options.ms) || options.ms < 0) {
        throw new RangeError("Timeout must be a finite, non-negative number of milliseconds");
    }

    const controller = new AbortController();
    const childContext = withLifetime(ctx, controller.signal);
    const timer = setTimeout(() => {
        controller.abort(
            new DOMException(`Context timed out after ${options.ms} ms`, "TimeoutError"),
        );
    }, options.ms);

    try {
        return await callback(childContext);
    } finally {
        clearTimeout(timer);
        if (!controller.signal.aborted) {
            controller.abort(new DOMException("Context scope completed", "AbortError"));
        }
    }
}
