import type { Context } from "../context/Context.js";
import { createAsyncLock } from "./impl/createAsyncLock.js";

export interface AsyncLock {
    runInLock<Result>(ctx: Context, work: (ctx: Context) => Promise<Result>): Promise<Result>;
}

export function asyncLock(): AsyncLock {
    return createAsyncLock("asyncLock.wait");
}
