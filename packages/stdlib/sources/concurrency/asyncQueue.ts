import type { AsyncLock } from "./asyncLock.js";
import { createAsyncLock } from "./impl/createAsyncLock.js";

export type AsyncQueue = AsyncLock;

export function asyncQueue(): AsyncQueue {
    return createAsyncLock("asyncQueue.wait");
}
