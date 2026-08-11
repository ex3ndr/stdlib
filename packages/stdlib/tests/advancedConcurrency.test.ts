import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    createRootContext,
    mapAsyncLock,
    mapReadWriteLock,
    readWriteLock,
    semaphore,
} from "../sources/index.js";

const testCtx = createRootContext().named("advanced-concurrency-tests");

function deferred(): { readonly promise: Promise<void>; resolve(): void } {
    let resolvePromise: (() => void) | undefined;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: () => resolvePromise?.() };
}

async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe("semaphore", () => {
    it("limits concurrent work and serves waiters in order", async () => {
        const permits = semaphore(2);
        const gate = deferred();
        const starts: number[] = [];
        let active = 0;
        let maximumActive = 0;

        const run = (id: number) =>
            permits.run(testCtx, async (ctx) => {
                assert.equal(ctx, testCtx);
                starts.push(id);
                active += 1;
                maximumActive = Math.max(maximumActive, active);
                await gate.promise;
                active -= 1;
            });
        const running = [run(1), run(2), run(3), run(4)];

        await flush();
        assert.deepEqual(starts, [1, 2]);

        gate.resolve();
        await Promise.all(running);
        assert.deepEqual(starts, [1, 2, 3, 4]);
        assert.equal(maximumActive, 2);
    });

    it("rejects invalid permit counts", () => {
        assert.throws(() => semaphore(0), /positive integer/);
        assert.throws(() => semaphore(1.5), /positive integer/);
    });
});

describe("mapAsyncLock", () => {
    it("serializes matching keys while allowing different keys", async () => {
        const locks = mapAsyncLock<string>();
        const gate = deferred();
        const events: string[] = [];
        const first = locks.runInLock(testCtx, "a", async () => {
            events.push("a:first:start");
            await gate.promise;
            events.push("a:first:end");
        });
        const second = locks.runInLock(testCtx, "a", async () => {
            events.push("a:second");
        });
        const independent = locks.runInLock(testCtx, "b", async () => {
            events.push("b");
        });

        await flush();
        assert.deepEqual(events, ["a:first:start", "b"]);

        gate.resolve();
        await Promise.all([first, second, independent]);
        assert.deepEqual(events, ["a:first:start", "b", "a:first:end", "a:second"]);
    });
});

describe("readWriteLock", () => {
    it("allows readers together and gives queued writers priority", async () => {
        const lock = readWriteLock();
        const readersGate = deferred();
        const writerGate = deferred();
        const writerStarted = deferred();
        const events: string[] = [];
        const firstReader = lock.runInReadLock(testCtx, async () => {
            events.push("reader:one:start");
            await readersGate.promise;
            events.push("reader:one:end");
        });
        const secondReader = lock.runInReadLock(testCtx, async () => {
            events.push("reader:two:start");
            await readersGate.promise;
            events.push("reader:two:end");
        });

        await flush();
        const writer = lock.runInWriteLock(testCtx, async () => {
            events.push("writer:start");
            writerStarted.resolve();
            await writerGate.promise;
            events.push("writer:end");
        });
        const lateReader = lock.runInReadLock(testCtx, async () => {
            events.push("reader:late");
        });

        await flush();
        assert.deepEqual(events, ["reader:one:start", "reader:two:start"]);

        readersGate.resolve();
        await writerStarted.promise;
        assert.deepEqual(events, [
            "reader:one:start",
            "reader:two:start",
            "reader:one:end",
            "reader:two:end",
            "writer:start",
        ]);

        writerGate.resolve();
        await Promise.all([firstReader, secondReader, writer, lateReader]);
        assert.equal(events.at(-1), "reader:late");
    });
});

describe("mapReadWriteLock", () => {
    it("isolates read/write exclusion by key", async () => {
        const locks = mapReadWriteLock<string>();
        const gate = deferred();
        const events: string[] = [];
        const writer = locks.runInWriteLock(testCtx, "a", async () => {
            events.push("a:write:start");
            await gate.promise;
            events.push("a:write:end");
        });
        const blockedReader = locks.runInReadLock(testCtx, "a", async () => {
            events.push("a:read");
        });
        const independentReader = locks.runInReadLock(testCtx, "b", async () => {
            events.push("b:read");
        });

        await flush();
        assert.deepEqual(events, ["a:write:start", "b:read"]);

        gate.resolve();
        await Promise.all([writer, blockedReader, independentReader]);
        assert.deepEqual(events, ["a:write:start", "b:read", "a:write:end", "a:read"]);
    });
});
