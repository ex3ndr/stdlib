import { createContextNamespace } from "../../context/createContextNamespace.js";

export interface AsyncLockOwner {
    active: boolean;
}

export type AsyncLockId = symbol;

const ContextAsyncLocksKey = "stdlib.asyncLocks";

export const ContextAsyncLocks = createContextNamespace<ReadonlyMap<AsyncLockId, AsyncLockOwner>>(
    ContextAsyncLocksKey,
    new Map(),
);
