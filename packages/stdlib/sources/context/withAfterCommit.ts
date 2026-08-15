import type { Context } from "./Context.js";
import type { DerivedContext } from "./ContextNamespace.js";
import {
    createAfterCommitState,
    runAfterCommit,
    setAfterCommitState,
} from "./impl/ContextAfterCommit.js";

export type RunAfterCommit = () => Promise<void>;
export type AfterCommitContext<Source extends Context> = readonly [
    ctx: DerivedContext<Source>,
    run: RunAfterCommit,
];

export function withAfterCommit<Source extends Context>(ctx: Source): AfterCommitContext<Source> {
    const state = createAfterCommitState();
    const afterCommitCtx = setAfterCommitState(ctx, state);
    return [afterCommitCtx, () => runAfterCommit(state)];
}
