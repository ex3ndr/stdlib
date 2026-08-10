import { BaseContext } from "../../context/BaseContext.js";
import type { Context } from "../../context/Context.js";
import { createContextNamespace } from "../../context/createContextNamespace.js";

const ContextLifetimeKey = "stdlib.lifetime";

export const ContextLifetime = createContextNamespace<AbortSignal | undefined>(
    ContextLifetimeKey,
    undefined,
);

Object.defineProperty(BaseContext.prototype, "lifetime", {
    get(this: Context) {
        return ContextLifetime.get(this);
    },
});
