import type { Log } from "../log/Log.js";
import type { ContextSpan } from "../telemetry/span.js";
import type { Context } from "./Context.js";
import { ContextDeriveSymbol, ContextSymbol } from "./Context.js";

// The merged interface describes properties installed on this prototype by
// registerContextExtension at runtime.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export abstract class BaseContext {
    abstract readonly [ContextSymbol]: Context;
    abstract [ContextDeriveSymbol](values: Record<string, unknown>): Context;
}

export interface BaseContext extends stdlib.ContextExtensions {
    readonly lifetime: AbortSignal | undefined;
    readonly log: Log;
    readonly name: string;
    readonly span: ContextSpan;
}
