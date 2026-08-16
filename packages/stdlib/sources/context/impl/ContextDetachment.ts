import type { Context } from "../Context.js";
import { getContextValues } from "./getContextValues.js";

const nonDetachableKeys = new Set<string>();

export function registerNonDetachableContextValue(key: string): void {
    nonDetachableKeys.add(key);
}

export function getDetachableContextValues(ctx: Context): Record<string, unknown> {
    const values = { ...getContextValues(ctx) };
    for (const key of nonDetachableKeys) {
        delete values[key];
    }
    return values;
}
