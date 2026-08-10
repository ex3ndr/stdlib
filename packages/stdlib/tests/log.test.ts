import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    createRootContext,
    logger as ContextLogger,
    withLogContext,
    withLogger,
    type LogContext,
    type Logger,
    type LoggerMethod,
} from "../sources/index.js";

interface LogCall {
    readonly level: keyof Logger;
    readonly context: LogContext;
    readonly args: readonly unknown[];
    readonly receiver: Logger;
}

function createRecordingLogger(calls: LogCall[]): Logger {
    const method = (level: keyof Logger): LoggerMethod =>
        function (this: Logger, context, ...args) {
            calls.push({ level, context, args, receiver: this });
        };

    return {
        trace: method("trace"),
        debug: method("debug"),
        info: method("info"),
        warn: method("warn"),
        error: method("error"),
        fatal: method("fatal"),
    };
}

describe("log", () => {
    it("passes accumulated context to the original logger", () => {
        const calls: LogCall[] = [];
        const logger = createRecordingLogger(calls);
        const root = withLogger(createRootContext(), logger);
        const appCtx = root.named("api");
        const requestCtx = withLogContext(appCtx, { requestId: "request-42" });
        const operationCtx = withLogContext(requestCtx, {
            operation: "load-user",
            requestId: "request-43",
        });
        const error = new Error("failed");

        assert.equal(ContextLogger.get(root), logger);
        assert.equal(ContextLogger.get(operationCtx), logger);

        operationCtx.log.info("user:load userId=user-1");
        operationCtx.log.error(error, "user:load userId=user-1 failed");

        assert.deepEqual(calls[0], {
            level: "info",
            context: { requestId: "request-43", operation: "load-user" },
            args: ["user:load userId=user-1"],
            receiver: logger,
        });
        assert.deepEqual(calls[1], {
            level: "error",
            context: { requestId: "request-43", operation: "load-user" },
            args: [error, "user:load userId=user-1 failed"],
            receiver: logger,
        });
    });

    it("fails clearly when no logger has been installed", () => {
        const ctx = createRootContext().named("unconfigured");

        assert.equal(ContextLogger.get(ctx), undefined);
        assert.throws(() => ctx.log.info("test:write"), /Context has no logger/);
    });
});
