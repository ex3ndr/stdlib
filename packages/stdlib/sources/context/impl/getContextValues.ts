import type { Context } from "../Context.js";
import { ContextSymbol, ContextValuesSymbol } from "../Context.js";

interface ContextStorage {
    readonly [ContextSymbol]: Context;
    readonly [ContextValuesSymbol]?: Record<string, unknown>;
}

export function getContextValues(ctx: Context): Record<string, unknown> {
    let current = ctx as Context & ContextStorage;

    while (true) {
        const values = current[ContextValuesSymbol];
        if (values) {
            return values;
        }

        const next = current[ContextSymbol] as Context & ContextStorage;
        if (!next || next === current) {
            throw new Error("Invalid context object");
        }
        current = next;
    }
}
