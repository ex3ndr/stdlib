import type { Context } from "../context/Context.js";
import type { TraceSpan } from "./Tracer.js";
import { ContextTrace } from "./impl/ContextTrace.js";

export function span<Result>(ctx: Context, name: string, work: (ctx: Context) => Result): Result {
    const current = ContextTrace.get(ctx);
    if (current.tracer === undefined) return work(ctx);

    const childSpan = current.tracer.startSpan(name, current.span);
    const childCtx = ContextTrace.set(ctx, {
        tracer: current.tracer,
        span: childSpan,
    });

    try {
        const result = work(childCtx);
        if (isPromiseLike(result)) {
            return Promise.resolve(result).then(
                (value) => {
                    childSpan.end();
                    return value;
                },
                (error: unknown) => {
                    recordException(childSpan, error);
                    childSpan.end();
                    throw error;
                },
            ) as Result;
        }
        childSpan.end();
        return result;
    } catch (error) {
        recordException(childSpan, error);
        childSpan.end();
        throw error;
    }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        ((typeof value === "object" && value !== null) || typeof value === "function") &&
        "then" in value
    );
}

function recordException(span: TraceSpan, error: unknown): void {
    span.recordException?.(error);
}
