import type { Context } from "../context/Context.js";
import { ContextAsyncLocks, type AsyncLockOwner } from "./impl/ContextAsyncLocks.js";
import { createAsyncLock } from "./impl/createAsyncLock.js";

export interface AsyncLock {
    runInLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result>;
}

export interface AsyncLockOptions {
    readonly reentry?: "allow" | "block" | "ignore";
}

export function asyncLock(options: AsyncLockOptions = {}): AsyncLock {
    const reentry = options.reentry ?? "ignore";
    const lock = createAsyncLock("asyncLock.wait");
    if (reentry === "ignore") return lock;

    const id = Symbol("asyncLock");

    return {
        runInLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>) {
            const owner = ContextAsyncLocks.get(ctx).get(id);
            if (owner?.active === true) {
                if (reentry === "allow") return work(ctx);
                return Promise.reject(new Error("AsyncLock reentry is blocked"));
            }

            return lock.runInLock(ctx, async (ctx) => {
                const owner: AsyncLockOwner = { active: true };
                const owners = new Map(ContextAsyncLocks.get(ctx));
                owners.set(id, owner);
                const lockCtx = ContextAsyncLocks.set(ctx, owners);

                try {
                    return await work(lockCtx);
                } finally {
                    owner.active = false;
                }
            });
        },
    };
}
