import type { Log } from "../log/Log.js";
import type { ContextSpan } from "../telemetry/span.js";

declare global {
    namespace stdlib {
        interface ContextExtensions {}
    }
}

export const ContextSymbol = Symbol("Context");
export const ContextDeriveSymbol = Symbol("ContextDerive");
export const ContextValuesSymbol = Symbol("ContextValues");

export interface Context extends stdlib.ContextExtensions {
    [ContextDeriveSymbol](values: Record<string, unknown>): Context;
    readonly lifetime: AbortSignal | undefined;
    readonly log: Log;
    readonly name: string;
    readonly span: ContextSpan;
}

export function isContext(source: unknown): source is Context {
    return typeof source === "object" && source !== null && ContextValuesSymbol in source;
}
