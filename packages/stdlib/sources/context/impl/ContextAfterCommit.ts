import type { Context } from "../Context.js";
import type { DerivedContext } from "../ContextNamespace.js";
import { createContextNamespace } from "../createContextNamespace.js";
import { getContextValues } from "./getContextValues.js";

export type AfterCommitWork = (ctx: Context) => void | PromiseLike<void>;

interface AfterCommitEntry {
    readonly ctx: Context;
    readonly work: AfterCommitWork;
}

export interface AfterCommitState {
    readonly automatic: boolean;
    readonly entries: AfterCommitEntry[];
    tail: Promise<void>;
    scheduled: boolean;
}

const ContextAfterCommitKey = "stdlib.afterCommit";

const ContextAfterCommit = createContextNamespace<AfterCommitState | undefined>(
    ContextAfterCommitKey,
    undefined,
    { detachable: false },
);

const defaultStates = new WeakMap<Record<string, unknown>, AfterCommitState>();

export function createAfterCommitState(automatic = false): AfterCommitState {
    return {
        automatic,
        entries: [],
        tail: Promise.resolve(),
        scheduled: false,
    };
}

export function setAfterCommitState<Source extends Context>(
    ctx: Source,
    state: AfterCommitState,
): DerivedContext<Source> {
    return ContextAfterCommit.set(ctx, state);
}

export function enqueueAfterCommit(ctx: Context, work: AfterCommitWork): void {
    const state = getAfterCommitState(ctx);
    state.entries.push({ ctx, work });

    scheduleAfterCommit(state);
}

export function runAfterCommit(state: AfterCommitState): Promise<void> {
    const result = state.tail.then(() => drainAfterCommit(state));
    state.tail = result.catch(() => {});
    return result;
}

function scheduleAfterCommit(state: AfterCommitState): void {
    if (!state.automatic || state.scheduled || state.entries.length === 0) return;

    state.scheduled = true;
    queueMicrotask(() => {
        void runAfterCommit(state).finally(() => {
            state.scheduled = false;
            scheduleAfterCommit(state);
        });
    });
}

function getAfterCommitState(ctx: Context): AfterCommitState {
    const configured = ContextAfterCommit.get(ctx);
    if (configured !== undefined) return configured;

    const values = getContextValues(ctx);
    let state = defaultStates.get(values);
    if (state === undefined) {
        state = createAfterCommitState(true);
        defaultStates.set(values, state);
    }
    return state;
}

async function drainAfterCommit(state: AfterCommitState): Promise<void> {
    const errors: unknown[] = [];

    try {
        while (state.entries.length > 0) {
            const entry = state.entries.shift();
            if (entry === undefined) continue;

            try {
                await entry.work(entry.ctx);
            } catch (error) {
                errors.push(error);
            }
        }
    } finally {
        state.scheduled = false;
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
        throw new AggregateError(errors, "Multiple after-commit callbacks failed");
    }
}
