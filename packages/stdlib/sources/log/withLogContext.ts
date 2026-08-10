import type { Context } from "../context/Context.js";
import type { DerivedContext } from "../context/ContextNamespace.js";
import type { LogContext } from "./Logger.js";
import { ContextLog } from "./impl/ContextLog.js";

export function withLogContext<Source extends Context>(
    ctx: Source,
    context: LogContext,
): DerivedContext<Source> {
    const current = ContextLog.get(ctx);
    return ContextLog.set(ctx, {
        logger: current.logger,
        context: { ...current.context, ...context },
    });
}
