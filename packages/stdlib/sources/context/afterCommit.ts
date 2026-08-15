import { BaseContext } from "./BaseContext.js";
import type { Context } from "./Context.js";
import { enqueueAfterCommit, type AfterCommitWork } from "./impl/ContextAfterCommit.js";

export type AfterCommitCallback = AfterCommitWork;
export type ContextAfterCommit = (callback: AfterCommitCallback) => void;

Object.defineProperty(BaseContext.prototype, "afterCommit", {
    value(this: Context, callback: AfterCommitCallback) {
        afterCommit(this, callback);
    },
});

export function afterCommit(ctx: Context, callback: AfterCommitCallback): void {
    enqueueAfterCommit(ctx, callback);
}
