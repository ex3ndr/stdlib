import type { ContextNamespace } from "./ContextNamespace.js";
import { ContextNamespaceImpl } from "./impl/ContextNamespaceImpl.js";

export function createContextNamespace<Value>(
    name: string,
    defaultValue: Value,
): ContextNamespace<Value> {
    return new ContextNamespaceImpl(name, defaultValue);
}
