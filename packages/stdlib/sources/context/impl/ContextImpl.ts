import { BaseContext } from "../BaseContext.js";
import type { Context } from "../Context.js";
import { ContextDeriveSymbol, ContextSymbol, ContextValuesSymbol } from "../Context.js";

export class ContextImpl extends BaseContext {
    readonly [ContextSymbol]: Context;
    readonly [ContextValuesSymbol]: Record<string, unknown>;

    constructor(values: Record<string, unknown>) {
        super();
        this[ContextValuesSymbol] = values;
        this[ContextSymbol] = this;
        Object.freeze(this);
    }

    [ContextDeriveSymbol](values: Record<string, unknown>): Context {
        return new ContextImpl(values);
    }
}
