import type { Context } from "../Context.js";
import { ContextDeriveSymbol } from "../Context.js";
import type {
    ContextNamespace,
    ContextNamespaceOptions,
    DerivedContext,
} from "../ContextNamespace.js";
import { getContextValues } from "./getContextValues.js";
import { registerNamedContextFactory } from "./NamedContextFactories.js";

export class ContextNamespaceImpl<Value> implements ContextNamespace<Value> {
    readonly name: string;
    readonly defaultValue: Value;

    constructor(name: string, defaultValue: Value, options: ContextNamespaceOptions<Value>) {
        this.name = name;
        this.defaultValue = defaultValue;
        if (options.onNamedContextCreated !== undefined) {
            registerNamedContextFactory(name, defaultValue, options.onNamedContextCreated);
        }
        Object.freeze(this);
    }

    get(ctx: Context): Value {
        const values = getContextValues(ctx);

        if (Object.hasOwn(values, this.name)) {
            return values[this.name] as Value;
        }
        return this.defaultValue;
    }

    set<Source extends Context>(ctx: Source, value: Value): DerivedContext<Source> {
        const values = { ...getContextValues(ctx) };
        values[this.name] = value;
        return ctx[ContextDeriveSymbol](values) as DerivedContext<Source>;
    }
}
