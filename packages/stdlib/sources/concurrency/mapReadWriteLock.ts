import type { Context } from "../context/Context.js";
import { createReadWriteLock } from "./impl/createReadWriteLock.js";
import type { ReadWriteLock } from "./readWriteLock.js";

export interface MapReadWriteLock<Key> {
    runInReadLock<Result>(
        ctx: Context,
        key: Key,
        work: (ctx: Context) => Promise<Result>,
    ): Promise<Result>;
    runInWriteLock<Result>(
        ctx: Context,
        key: Key,
        work: (ctx: Context) => Promise<Result>,
    ): Promise<Result>;
}

interface LockEntry {
    readonly lock: ReadWriteLock;
    references: number;
}

export function mapReadWriteLock<Key>(): MapReadWriteLock<Key> {
    const entries = new Map<Key, LockEntry>();

    return {
        runInReadLock(ctx, key, work) {
            return run(key, (lock) => lock.runInReadLock(ctx, work));
        },
        runInWriteLock(ctx, key, work) {
            return run(key, (lock) => lock.runInWriteLock(ctx, work));
        },
    };

    async function run<Result>(
        key: Key,
        work: (lock: ReadWriteLock) => Promise<Result>,
    ): Promise<Result> {
        let entry = entries.get(key);
        if (entry === undefined) {
            entry = {
                lock: createReadWriteLock({
                    read: "mapReadWriteLock.read.wait",
                    write: "mapReadWriteLock.write.wait",
                }),
                references: 0,
            };
            entries.set(key, entry);
        }
        entry.references += 1;

        try {
            return await work(entry.lock);
        } finally {
            entry.references -= 1;
            if (entry.references === 0 && entries.get(key) === entry) {
                entries.delete(key);
            }
        }
    }
}
