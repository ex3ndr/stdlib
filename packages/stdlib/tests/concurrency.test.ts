import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    AbortedError,
    GracefulShutdown,
    asyncLock,
    asyncQueue,
    backoff,
    createRootContext,
    delay,
    forever,
    retry,
    shutdown as ShutdownContext,
    withLifetime,
    withShutdown,
} from "../sources/index.js";

const testRoot = createRootContext();
const testCtx = testRoot.named("concurrency-tests");

describe("asyncLock", () => {
    it("runs work in arrival order without overlapping", async () => {
        const lock = asyncLock();
        const events: string[] = [];

        const run = (name: string, ms: number) =>
            lock.runInLock(testCtx, async (ctx) => {
                assert.equal(ctx, testCtx);
                events.push(`${name}:start`);
                await delay(ctx, ms);
                events.push(`${name}:end`);
            });

        await Promise.all([run("a", 20), run("b", 1), run("c", 1)]);

        assert.deepEqual(events, ["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
    });

    it("keeps serving callers after one throws", async () => {
        const lock = asyncLock();

        await assert.rejects(
            lock.runInLock(testCtx, () => Promise.reject(new Error("boom"))),
            /boom/,
        );
        await assert.doesNotReject(lock.runInLock(testCtx, () => Promise.resolve("ok")));
        assert.equal(await asyncQueue().runInLock(testCtx, () => Promise.resolve(42)), 42);
    });

    it("blocks reentry when requested", async () => {
        const lock = asyncLock({ reentry: "block" });

        await lock.runInLock(testCtx, async (ctx) => {
            await assert.rejects(
                lock.runInLock(ctx, () => Promise.resolve()),
                /AsyncLock reentry is blocked/,
            );
        });
    });

    it("allows reentry through the lock context", async () => {
        const lock = asyncLock({ reentry: "allow" });
        const events: string[] = [];

        await lock.runInLock(testCtx, async (ctx) => {
            events.push("outer:start");
            await lock.runInLock(ctx, async (ctx) => {
                events.push("inner");
                await lock.runInLock(ctx, async () => {
                    events.push("nested");
                });
            });
            events.push("outer:end");
        });

        assert.deepEqual(events, ["outer:start", "inner", "nested", "outer:end"]);
    });

    it("ignores reentry detection by default", async () => {
        const lock = asyncLock();
        let nested: Promise<void> | undefined;
        let nestedRan = false;

        await lock.runInLock(testCtx, async (ctx) => {
            nested = lock.runInLock(ctx, async () => {
                nestedRan = true;
            });
            await Promise.resolve();
            assert.equal(nestedRan, false);
        });

        await nested;
        assert.equal(nestedRan, true);
    });

    it("does not treat an escaped inactive lock context as an owner", async () => {
        const lock = asyncLock({ reentry: "allow" });
        let escapedCtx = testCtx;

        await lock.runInLock(testCtx, async (ctx) => {
            escapedCtx = ctx;
        });

        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const holder = lock.runInLock(testCtx, async () => gate);
        let staleContextRan = false;
        const fromStaleContext = lock.runInLock(escapedCtx, async () => {
            staleContextRan = true;
        });

        await Promise.resolve();
        assert.equal(staleContextRan, false);
        release?.();
        await Promise.all([holder, fromStaleContext]);
        assert.equal(staleContextRan, true);
    });
});

describe("delay", () => {
    it("waits without a lifetime", async () => {
        const start = Date.now();
        await delay(testCtx, 15);
        assert.ok(Date.now() - start >= 10);
    });

    it("throws AbortedError when the context lifetime ends", async () => {
        const controller = new AbortController();
        const ctx = withLifetime(testCtx, controller.signal);
        const waiting = delay(ctx, 5_000);

        controller.abort();

        await assert.rejects(waiting, AbortedError);
        await assert.rejects(delay(ctx, 1), AbortedError);
    });
});

describe("backoff and retry", () => {
    it("retries in context until work succeeds", async () => {
        let attempts = 0;
        const value = await backoff(
            testCtx,
            (ctx, attempt) => {
                assert.equal(ctx, testCtx);
                attempts = attempt;
                if (attempt < 3) {
                    throw new Error("not yet");
                }
                return Promise.resolve("done");
            },
            { initialDelay: 1 },
        );

        assert.equal(value, "done");
        assert.equal(attempts, 3);
    });

    it("reports failures with context and attempt number", async () => {
        const reports: Array<{ attempt: number; error: unknown }> = [];
        let attempts = 0;

        await backoff(
            testCtx,
            () => {
                attempts += 1;
                if (attempts < 2) {
                    throw new Error("first");
                }
                return Promise.resolve();
            },
            {
                initialDelay: 1,
                onError: (ctx, error, attempt) => {
                    assert.equal(ctx, testCtx);
                    reports.push({ attempt, error });
                },
            },
        );

        assert.equal(reports.length, 1);
        assert.equal(reports[0]?.attempt, 1);
    });

    it("stops when the context is aborted", async () => {
        const controller = new AbortController();
        const ctx = withLifetime(testCtx, controller.signal);
        let attempts = 0;

        const running = backoff(
            ctx,
            () => {
                attempts += 1;
                controller.abort();
                throw new Error("failed");
            },
            { initialDelay: 1 },
        );

        await assert.rejects(running, /failed/);
        assert.equal(attempts, 1);
    });

    it("bounds retry by time and throws the last failure", async () => {
        await assert.rejects(
            retry(
                testCtx,
                () => {
                    throw new Error("always fails");
                },
                { initialDelay: 1, timeout: 20 },
            ),
            /always fails/,
        );
    });
});

describe("forever", () => {
    it("repeats until the context lifetime ends", async () => {
        const controller = new AbortController();
        const ctx = withLifetime(testCtx, controller.signal);
        let passes = 0;

        await forever(ctx, { name: "counter", delay: 1 }, async (ctx) => {
            assert.equal(ctx.lifetime, controller.signal);
            passes += 1;
            if (passes >= 3) {
                controller.abort();
            }
        });

        assert.equal(passes, 3);
    });

    it("does not start when the context is already aborted", async () => {
        const ctx = withLifetime(testCtx, AbortSignal.abort());
        let ran = false;

        await forever(ctx, { name: "idle", delay: 1 }, async () => {
            ran = true;
        });

        assert.equal(ran, false);
    });
});

describe("gracefulShutdown", () => {
    it("aborts its derived context and waits for named handlers", async () => {
        const shutdown = new GracefulShutdown();
        const ctx = withShutdown(testCtx, shutdown);
        const finished: string[] = [];

        assert.equal("shutdown" in testCtx, false);
        assert.equal("shutdown" in ctx, false);
        assert.equal(ShutdownContext.get(testCtx), undefined);
        assert.equal(ShutdownContext.get(ctx), shutdown);
        shutdown.register("first", async (ctx) => {
            assert.equal(ctx, shutdown.ctx);
            assert.equal(ctx.lifetime?.aborted, true);
            finished.push("first");
        });
        shutdown.register("second", async () => {
            finished.push("second");
        });

        const report = await shutdown.shutdown();

        assert.equal(shutdown.shuttingDown, true);
        assert.deepEqual(finished.sort(), ["first", "second"]);
        assert.deepEqual(report, { timedOut: [], failed: [] });
    });

    it("provides the context that unwinds a registered forever loop", async () => {
        const shutdown = new GracefulShutdown();
        const ctx = withShutdown(testCtx, shutdown);
        let passes = 0;
        const loop = forever(ctx, { name: "poller", delay: 1 }, async () => {
            passes += 1;
        });

        await delay(testCtx, 10);
        await shutdown.shutdown();
        await loop;

        assert.ok(passes > 0);
        assert.equal(shutdown.pending().length, 0);
    });

    it("reports timed-out and failed handlers by name", async () => {
        const shutdown = new GracefulShutdown();
        withShutdown(testCtx, shutdown);
        shutdown.register("stuck", () => new Promise<void>(() => {}));
        shutdown.register("bad", () => Promise.reject(new Error("handler failed")));

        const report = await shutdown.shutdown({ timeout: 20 });

        assert.deepEqual(report.timedOut, ["stuck"]);
        assert.equal(report.failed.length, 1);
        assert.equal(report.failed[0]?.name, "bad");
    });

    it("runs once and supports unregistering handlers", async () => {
        const shutdown = new GracefulShutdown();
        withShutdown(testCtx, shutdown);
        let calls = 0;
        const unregister = shutdown.register("temporary", async () => {
            calls += 1;
        });
        unregister();

        await Promise.all([shutdown.shutdown(), shutdown.shutdown()]);

        assert.equal(calls, 0);
    });

    it("can be installed on a root before named contexts are created", () => {
        const shutdown = new GracefulShutdown();
        const root = withShutdown(createRootContext(), shutdown);
        const first = root.named("worker");
        const second = root.named("worker");

        assert.equal(ShutdownContext.get(root), shutdown);
        assert.equal(ShutdownContext.get(first), shutdown);
        assert.equal(ShutdownContext.get(second), shutdown);
        assert.notEqual(first, second);
    });
});
