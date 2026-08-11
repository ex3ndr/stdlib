import type { Context } from "../context/Context.js";

export interface Semaphore {
    run<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result>;
}

export function semaphore(permits: number): Semaphore {
    if (!Number.isInteger(permits) || permits < 1) {
        throw new RangeError("Semaphore permits must be a positive integer");
    }

    let available = permits;
    const waiters: Array<() => void> = [];

    return {
        async run<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>) {
            await acquire(ctx);
            try {
                return await work(ctx);
            } finally {
                release();
            }
        },
    };

    async function acquire(ctx: Context): Promise<void> {
        if (available > 0) {
            available -= 1;
            return;
        }
        await ctx.span(
            "semaphore.wait",
            (ctx) =>
                new Promise<void>((resolve) => {
                    void ctx;
                    waiters.push(resolve);
                }),
        );
    }

    function release(): void {
        const next = waiters.shift();
        if (next !== undefined) {
            next();
        } else {
            available += 1;
        }
    }
}
