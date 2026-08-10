import type { Context } from "./Context.js";

export interface ContextNamespace<Value> {
    get(ctx: Context): Value;
    set(ctx: Context, value: Value): Context;
}
