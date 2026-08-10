import type { Context } from "./Context.js";
import { EmptyContext } from "./EmptyContext.js";
import { ContextName } from "./impl/ContextName.js";

export function createNamedContext(name: string): Context {
    return ContextName.set(EmptyContext, name);
}
