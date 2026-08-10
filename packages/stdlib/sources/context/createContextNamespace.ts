import type { ContextNamespace, ContextNamespaceOptions } from "./ContextNamespace.js";
import { ContextNamespaceImpl } from "./impl/ContextNamespaceImpl.js";

export function createContextNamespace<Value>(
    name: string,
    defaultValue: Value,
    options: ContextNamespaceOptions<Value> = {},
): ContextNamespace<Value> {
    return new ContextNamespaceImpl(name, defaultValue, options);
}
