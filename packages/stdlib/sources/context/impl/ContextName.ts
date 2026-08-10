import { BaseContext } from "../BaseContext.js";
import type { Context } from "../Context.js";
import { createContextNamespace } from "../createContextNamespace.js";

const ContextNameKey = "stdlib.name";

export const ContextName = createContextNamespace<string>(ContextNameKey, "<root>");

Object.defineProperty(BaseContext.prototype, "name", {
    get(this: Context) {
        return ContextName.get(this);
    },
});
