import type { GracefulShutdown } from "../concurrency/gracefulShutdown.js";

declare global {
    namespace stdlib {
        interface ContextExtensions {}
    }
}

export interface Context extends stdlib.ContextExtensions {
    readonly lifetime: AbortSignal | undefined;
    readonly name: string;
    readonly shutdown: GracefulShutdown | undefined;
}

export const ContextSymbol = Symbol("Context");
export const ContextValuesSymbol = Symbol("ContextValues");

export function isContext(source: unknown): source is Context {
    return typeof source === "object" && source !== null && ContextValuesSymbol in source;
}
