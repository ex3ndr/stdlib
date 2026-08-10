import type { Context } from "../context/Context.js";
import type { DerivedContext } from "../context/ContextNamespace.js";
import type { Logger } from "./Logger.js";
import { ContextLog } from "./impl/ContextLog.js";

export function withLogger<Source extends Context>(
    ctx: Source,
    logger: Logger,
): DerivedContext<Source> {
    const current = ContextLog.get(ctx);
    return ContextLog.set(ctx, { logger, context: current.context });
}
