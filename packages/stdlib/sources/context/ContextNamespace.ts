import type { Context } from "./Context.js";
import type { RootContext } from "./RootContext.js";

export type DerivedContext<Source extends Context> = Source extends RootContext
    ? RootContext
    : Context;

export interface ContextNamespaceOptions<Value> {
    readonly detachable?: boolean;
    readonly onNamedContextCreated?: (ctx: RootContext, name: string, value: Value) => Value;
}

export interface ContextNamespace<Value> {
    get(ctx: Context): Value;
    set<Source extends Context>(ctx: Source, value: Value): DerivedContext<Source>;
}
