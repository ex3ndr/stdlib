import type { Context } from "../context/Context.js";

export interface AsyncLock {
    runInLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result>;
}

export function asyncLock(): AsyncLock {
    let tail: Promise<unknown> = Promise.resolve();

    return {
        runInLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result> {
            const run = () => work(ctx);
            const result = tail.then(run, run);
            tail = result.catch(() => undefined);
            return result;
        },
    };
}
