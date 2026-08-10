import { BaseContext } from "../../context/BaseContext.js";
import type { Context } from "../../context/Context.js";
import { createContextNamespace } from "../../context/createContextNamespace.js";
import type { Log } from "../Log.js";
import type { LogContext, Logger } from "../Logger.js";

export interface ContextLogValue {
    readonly logger: Logger | undefined;
    readonly context: LogContext;
}

const ContextLogKey = "stdlib.log";
const EmptyLogContext = Object.freeze({});

export const ContextLog = createContextNamespace<ContextLogValue>(ContextLogKey, {
    logger: undefined,
    context: EmptyLogContext,
});

Object.defineProperty(BaseContext.prototype, "log", {
    get(this: Context) {
        return createLog(this);
    },
});

function createLog(ctx: Context): Log {
    return {
        trace: (...args) => write(ctx, "trace", args),
        debug: (...args) => write(ctx, "debug", args),
        info: (...args) => write(ctx, "info", args),
        warn: (...args) => write(ctx, "warn", args),
        error: (...args) => write(ctx, "error", args),
        fatal: (...args) => write(ctx, "fatal", args),
    };
}

function write(ctx: Context, level: keyof Logger, args: unknown[]): void {
    const value = ContextLog.get(ctx);
    if (value.logger === undefined) {
        throw new Error("Context has no logger");
    }
    value.logger[level].call(value.logger, value.context, ...args);
}
