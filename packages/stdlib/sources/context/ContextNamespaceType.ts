import type { ContextNamespace } from "./ContextNamespace.js";

export type ContextNamespaceType<Namespace extends ContextNamespace<unknown>> =
    Namespace extends ContextNamespace<infer Value> ? Value : never;
