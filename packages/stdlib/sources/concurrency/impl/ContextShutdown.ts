import { createContextNamespace } from "../../context/createContextNamespace.js";
import type { GracefulShutdown } from "../gracefulShutdown.js";

const ContextShutdownKey = "stdlib.shutdown";

export const shutdown = createContextNamespace<GracefulShutdown | undefined>(
    ContextShutdownKey,
    undefined,
);
