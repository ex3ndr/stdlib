import type { Context } from "../context/Context.js";
import { createReadWriteLock } from "./impl/createReadWriteLock.js";

export interface ReadWriteLock {
    runInReadLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result>;
    runInWriteLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result>;
}

export function readWriteLock(): ReadWriteLock {
    return createReadWriteLock({
        read: "readWriteLock.read.wait",
        write: "readWriteLock.write.wait",
    });
}
