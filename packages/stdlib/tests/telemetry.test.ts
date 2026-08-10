import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    asyncLock,
    asyncQueue,
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
    it("creates spans only when traced work starts", async () => {
        const tracer = new RecordingTracer();
        const root = withTracer(createRootContext(), tracer);
        const ctx = root.named("worker");

        assert.equal(ContextTracer.get(ctx), tracer);
        assert.equal(traceSpan.get(ctx), undefined);
        assert.equal(tracer.spans.length, 0);

        const result = await ctx.span("job:run", async (ctx) => {
            const parentSpan = traceSpan.get(ctx);
            assert.equal(parentSpan, tracer.spans[0]);
            assert.equal(traceSpan.get(ctx), parentSpan);
            assert.equal(tracer.spans[0]?.parent, undefined);
            assert.equal(tracer.spans[0]?.ended, false);
            return ctx.span("job:step", async (ctx) => {
                assert.equal(traceSpan.get(ctx), tracer.spans[1]);
                assert.equal(tracer.spans[1]?.parent, parentSpan);
                return "done";
            });
        });

        assert.equal(result, "done");
        assert.equal(tracer.spans[0]?.ended, true);
        assert.equal(tracer.spans[1]?.ended, true);
    });

    it("records failures and ends failed spans", async () => {
        const tracer = new RecordingTracer();
        const ctx = withTracer(createRootContext(), tracer).named("worker");
        const failure = new Error("failed");

        await assert.rejects(
            span(ctx, "job:fail", () => Promise.reject(failure)),
            /failed/,
        );

        assert.deepEqual(tracer.spans[0]?.exceptions, [failure]);
        assert.equal(tracer.spans[0]?.ended, true);
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

    it("traces only the contended wait before lock work starts", async () => {
        const tracer = new RecordingTracer();
        const ctx = withTracer(createRootContext(), tracer).named("locks");
        const lock = asyncLock();
        let release: (() => void) | undefined;
        const blocked = new Promise<void>((resolve) => {
            release = resolve;
        });
        const first = lock.runInLock(ctx, async () => blocked);
        let waitEndedWhenWorkStarted = false;
        const second = lock.runInLock(ctx, async () => {
            waitEndedWhenWorkStarted = tracer.spans[0]?.ended === true;
        });

        assert.equal(tracer.spans[0]?.name, "asyncLock.wait");
        assert.equal(tracer.spans[0]?.parent, undefined);
        assert.equal(tracer.spans[0]?.ended, false);

        release?.();
        await Promise.all([first, second]);

        assert.equal(tracer.spans[0]?.ended, true);
        assert.equal(waitEndedWhenWorkStarted, true);
        assert.equal(tracer.spans.length, 1);
    });

    it("uses a distinct wait span name for async queues", async () => {
        const tracer = new RecordingTracer();
        const ctx = withTracer(createRootContext(), tracer).named("queues");
        const queue = asyncQueue();
        let release: (() => void) | undefined;
        const blocked = new Promise<void>((resolve) => {
            release = resolve;
        });
        const first = queue.runInLock(ctx, async () => blocked);
        const second = queue.runInLock(ctx, async () => undefined);

        assert.equal(tracer.spans[0]?.name, "asyncQueue.wait");

        release?.();
        await Promise.all([first, second]);
        assert.equal(tracer.spans[0]?.ended, true);
    });
});
