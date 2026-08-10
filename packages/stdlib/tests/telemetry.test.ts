import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    createRootContext,
    span,
    traceSpan,
    tracer as ContextTracer,
    withTracer,
    type TraceSpan,
    type Tracer,
} from "../sources/index.js";

class RecordingSpan implements TraceSpan {
    readonly name: string;
    readonly parent: TraceSpan | undefined;
    readonly exceptions: unknown[] = [];
    ended = false;

    constructor(name: string, parent: TraceSpan | undefined) {
        this.name = name;
        this.parent = parent;
    }

    end(): void {
        this.ended = true;
    }

    recordException(error: unknown): void {
        this.exceptions.push(error);
    }
}

class RecordingTracer implements Tracer {
    readonly spans: RecordingSpan[] = [];

    startSpan(name: string, parent: TraceSpan | undefined): RecordingSpan {
        const result = new RecordingSpan(name, parent);
        this.spans.push(result);
        return result;
    }
}

describe("telemetry", () => {
    it("creates root spans for named contexts and child spans for work", async () => {
        const tracer = new RecordingTracer();
        const root = withTracer(createRootContext(), tracer);
        const ctx = root.named("worker");
        const rootSpan = traceSpan.get(ctx);

        assert.equal(ContextTracer.get(ctx), tracer);
        assert.equal(rootSpan, tracer.spans[0]);
        assert.equal(traceSpan.get(ctx), rootSpan);
        assert.equal(tracer.spans[0]?.name, "worker");
        assert.equal(tracer.spans[0]?.parent, undefined);

        const result = await ctx.span("job:run", async (ctx) => {
            const childSpan = traceSpan.get(ctx);
            assert.equal(childSpan, tracer.spans[1]);
            assert.equal(traceSpan.get(ctx), childSpan);
            assert.equal(tracer.spans[1]?.parent, rootSpan);
            assert.equal(tracer.spans[1]?.ended, false);
            return "done";
        });

        assert.equal(result, "done");
        assert.equal(tracer.spans[1]?.ended, true);
        assert.equal(rootSpan?.ended, false);
    });

    it("records failures and ends failed spans", async () => {
        const tracer = new RecordingTracer();
        const ctx = withTracer(createRootContext(), tracer).named("worker");
        const failure = new Error("failed");

        await assert.rejects(
            span(ctx, "job:fail", () => Promise.reject(failure)),
            /failed/,
        );

        assert.deepEqual(tracer.spans[1]?.exceptions, [failure]);
        assert.equal(tracer.spans[1]?.ended, true);
    });

    it("uses the original context and does no tracing without a provider", () => {
        const ctx = createRootContext().named("unconfigured");

        const result = span(ctx, "job:run", (childCtx) => {
            assert.equal(childCtx, ctx);
            return 42;
        });

        assert.equal(result, 42);
        assert.equal(ContextTracer.get(ctx), undefined);
        assert.equal(traceSpan.get(ctx), undefined);
        assert.equal(
            ctx.span("job:bound", (childCtx) => childCtx),
            ctx,
        );
    });
});
