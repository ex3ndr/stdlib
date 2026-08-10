import type { Context } from "../context/Context.js";
import type { DerivedContext } from "../context/ContextNamespace.js";
import type { Tracer } from "./Tracer.js";
import { ContextTrace } from "./impl/ContextTrace.js";

export function withTracer<Source extends Context>(
    ctx: Source,
    tracer: Tracer,
): DerivedContext<Source> {
    const current = ContextTrace.get(ctx);
    return ContextTrace.set(ctx, { tracer, span: current.span });
}
