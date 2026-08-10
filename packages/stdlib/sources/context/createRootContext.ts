import type { RootContext } from "./RootContext.js";
import { RootContextImpl } from "./impl/RootContextImpl.js";

export function createRootContext(): RootContext {
    return new RootContextImpl();
}
