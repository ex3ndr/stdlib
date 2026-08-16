import type { Context } from "./Context.js";
import type { RootContext } from "./RootContext.js";
import { getDetachableContextValues } from "./impl/ContextDetachment.js";
import { RootContextImpl } from "./impl/RootContextImpl.js";

export function detach(ctx: Context): RootContext {
    return new RootContextImpl(getDetachableContextValues(ctx));
}
