import type { Context } from "../../context/Context.js";
import { createContextNamespace } from "../../context/createContextNamespace.js";
import type { TraceSpan, Tracer } from "../Tracer.js";

export interface ContextTraceValue {
    readonly tracer: Tracer | undefined;
    readonly span: TraceSpan | undefined;
}

const ContextTraceKey = "stdlib.trace";

export const ContextTrace = createContextNamespace<ContextTraceValue>(ContextTraceKey, {
    tracer: undefined,
    span: undefined,
});

export const tracer = Object.freeze({
    get(ctx: Context): Tracer | undefined {
        return ContextTrace.get(ctx).tracer;
    },
});

export const traceSpan = Object.freeze({
    get(ctx: Context): TraceSpan | undefined {
        return ContextTrace.get(ctx).span;
    },
});
