import type { Context } from "../Context.js";
import type { ContextNamespace } from "../ContextNamespace.js";
import { ContextImpl } from "./ContextImpl.js";
import { getContextValues } from "./getContextValues.js";

export class ContextNamespaceImpl<Value> implements ContextNamespace<Value> {
    readonly name: string;
    readonly defaultValue: Value;

    constructor(name: string, defaultValue: Value) {
        this.name = name;
        this.defaultValue = defaultValue;
        Object.freeze(this);
    }

    get(ctx: Context): Value {
        const values = getContextValues(ctx);

        if (Object.hasOwn(values, this.name)) {
            return values[this.name] as Value;
        }
        return this.defaultValue;
    }

    set(ctx: Context, value: Value): Context {
        const values = { ...getContextValues(ctx) };
        values[this.name] = value;
        return new ContextImpl(values);
    }
}
