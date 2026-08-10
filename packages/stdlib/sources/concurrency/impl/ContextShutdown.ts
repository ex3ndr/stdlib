import { BaseContext } from "../../context/BaseContext.js";
import type { Context } from "../../context/Context.js";
import { createContextNamespace } from "../../context/createContextNamespace.js";
import type { GracefulShutdown } from "../gracefulShutdown.js";

const ContextShutdownKey = "stdlib.shutdown";

export const ContextShutdown = createContextNamespace<GracefulShutdown | undefined>(
    ContextShutdownKey,
    undefined,
);

Object.defineProperty(BaseContext.prototype, "shutdown", {
    get(this: Context) {
        return ContextShutdown.get(this);
    },
});
