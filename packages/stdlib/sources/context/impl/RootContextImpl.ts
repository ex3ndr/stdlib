import { BaseContext } from "../BaseContext.js";
import type { Context } from "../Context.js";
import { ContextDeriveSymbol, ContextSymbol, ContextValuesSymbol } from "../Context.js";
import type { RootContext } from "../RootContext.js";
import { ContextImpl } from "./ContextImpl.js";
import { ContextName } from "./ContextName.js";
import { getContextValues } from "./getContextValues.js";

export class RootContextImpl extends BaseContext implements RootContext {
    readonly [ContextSymbol]: Context;
    readonly [ContextValuesSymbol]: Record<string, unknown>;

    constructor(values: Record<string, unknown> = {}) {
        super();
        this[ContextValuesSymbol] = values;
        this[ContextSymbol] = this;
        Object.freeze(this);
    }

    [ContextDeriveSymbol](values: Record<string, unknown>): RootContext {
        return new RootContextImpl(values);
    }

    named(name: string): Context {
        return new ContextImpl(getContextValues(ContextName.set(this, name)));
    }
}
