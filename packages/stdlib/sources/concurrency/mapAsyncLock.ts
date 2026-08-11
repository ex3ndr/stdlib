import type { Context } from "../context/Context.js";
import type { AsyncLock } from "./asyncLock.js";
import { createAsyncLock } from "./impl/createAsyncLock.js";

export interface MapAsyncLock<Key> {
    runInLock<Result>(
        ctx: Context,
        key: Key,
        work: (ctx: Context) => Promise<Result>,
    ): Promise<Result>;
}

interface LockEntry {
    readonly lock: AsyncLock;
    references: number;
}

export function mapAsyncLock<Key>(): MapAsyncLock<Key> {
    const entries = new Map<Key, LockEntry>();

    return {
        async runInLock<Result>(ctx: Context, key: Key, work: (ctx: Context) => Promise<Result>) {
            let entry = entries.get(key);
            if (entry === undefined) {
                entry = { lock: createAsyncLock("mapAsyncLock.wait"), references: 0 };
                entries.set(key, entry);
            }
            entry.references += 1;

            try {
                return await entry.lock.runInLock(ctx, work);
            } finally {
                entry.references -= 1;
                if (entry.references === 0 && entries.get(key) === entry) {
                    entries.delete(key);
                }
            }
        },
    };
}
