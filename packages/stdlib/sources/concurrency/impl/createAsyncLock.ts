import type { Context } from "../../context/Context.js";
import type { AsyncLock } from "../asyncLock.js";

export function createAsyncLock(waitSpanName: string): AsyncLock {
    let tail: Promise<unknown> = Promise.resolve();
    let pending = 0;

    return {
        runInLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>) {
            const previous = tail;
            const waits = pending > 0;
            pending += 1;

            const result = run(previous, waits, ctx, work);
            tail = result.catch(() => undefined);
            return result;
        },
    };

    async function run<Result>(
        previous: Promise<unknown>,
        waits: boolean,
        ctx: Context,
        work: (ctx: Context) => Promise<Result>,
    ): Promise<Result> {
        try {
            if (waits) {
                await ctx.span(waitSpanName, async (ctx) => {
                    void ctx;
                    await previous;
                });
            } else {
                await previous;
            }
            return await work(ctx);
        } finally {
            pending -= 1;
        }
    }
}
