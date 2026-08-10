import { asyncLock, type AsyncLock } from "./asyncLock.js";

export type AsyncQueue = AsyncLock;

export function asyncQueue(): AsyncQueue {
    return asyncLock();
}
