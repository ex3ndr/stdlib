import { BaseContext } from "./BaseContext.js";
import type { Context } from "./Context.js";
import { ContextDeriveSymbol, ContextSymbol } from "./Context.js";

export abstract class ContextWrapper extends BaseContext {
    readonly [ContextSymbol]: Context;

    constructor(ctx: Context) {
        super();
        this[ContextSymbol] = ctx;
        Object.freeze(this);
    }

    [ContextDeriveSymbol](values: Record<string, unknown>): Context {
        return this[ContextSymbol][ContextDeriveSymbol](values);
    }
}
