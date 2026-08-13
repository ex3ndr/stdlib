import type { Context } from "../context/Context.js";
import { withLifetime } from "./withLifetime.js";

export async function scoped<Result>(
    ctx: Context,
    work: (ctx: Context) => Result | PromiseLike<Result>,
): Promise<Awaited<Result>> {
    const controller = new AbortController();
    const scopedCtx = withLifetime(ctx, controller.signal);

    try {
        return await work(scopedCtx);
    } finally {
        controller.abort(new DOMException("Context scope completed", "AbortError"));
    }
}
