import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    afterCommit,
    ContextLifetime,
    ContextWrapper,
    createContextNamespace,
    createRootContext,
    detach,
    isContext,
    registerContextExtension,
    scoped,
    timeout,
    type Context,
    withAfterCommit,
    withLifetime,
} from "../sources/index.js";

declare global {
    namespace stdlib {
        interface ContextExtensions {
            contextTestLabel: string;
            contextTestValue: number;
        }
    }
}

function assertContextExtensionTypes(ctx: Context): void {
    const label: string = ctx.contextTestLabel;
    void label;

    // @ts-expect-error String values are rejected by the augmented number setter.
    ctx.contextTestValue = "invalid";
    // @ts-expect-error The registered getter must match the augmented type.
    registerContextExtension("contextTestValue", () => "invalid");
    // @ts-expect-error Only a root context can create a named context.
    ctx.named("child");
}
void assertContextExtensionTypes;

const labelNamespace = createContextNamespace("context-test-label", "default");
const valueWrites: Array<{ ctx: Context; value: number }> = [];
const testRoot = createRootContext();
const testCtx = testRoot.named("context-tests");

registerContextExtension("contextTestLabel", (ctx) => labelNamespace.get(ctx));
registerContextExtension("contextTestValue", {
    get: () => valueWrites.at(-1)?.value ?? 0,
    set: (ctx, value) => {
        valueWrites.push({ ctx, value });
    },
});

describe("context", () => {
    it("creates immutable contexts and updates namespace values", () => {
        const ctx = labelNamespace.set(testCtx, "request");

        assert.equal(labelNamespace.get(testCtx), "default");
        assert.equal(labelNamespace.get(ctx), "request");
        assert.equal(ctx.contextTestLabel, "request");
        assert.equal(isContext(ctx), true);
        assert.equal(isContext({}), false);
    });

    it("creates named contexts only from a root", () => {
        const root = createRootContext();

        assert.equal(root.name, "<root>");
        const ctx = root.named("worker");
        const anotherCtx = root.named("worker");
        assert.equal(ctx.name, "worker");
        assert.equal(anotherCtx.name, "worker");
        assert.notEqual(anotherCtx, ctx);
        assert.equal(ctx.contextTestLabel, "default");
        assert.equal(isContext(ctx), true);
        assert.equal("named" in ctx, false);
    });

    it("preserves root contexts when namespaces derive values", () => {
        const root = labelNamespace.set(createRootContext(), "root-value");
        const ctx = root.named("worker");

        assert.equal(root.name, "<root>");
        assert.equal(labelNamespace.get(ctx), "root-value");
        assert.equal(ctx.name, "worker");
    });

    it("derives namespace values when a named context is created", () => {
        const calls: Array<{ ctx: Context; name: string; value: number }> = [];
        const sequence = createContextNamespace("context-test-sequence", 0, {
            onNamedContextCreated(ctx, name, value) {
                calls.push({ ctx, name, value });
                return value + 1;
            },
        });
        const root = sequence.set(createRootContext(), 41);
        const first = root.named("worker");
        const second = root.named("worker");

        assert.equal(sequence.get(root), 41);
        assert.equal(sequence.get(first), 42);
        assert.equal(sequence.get(second), 42);
        assert.deepEqual(
            calls.map(({ ctx, name, value }) => ({ sameRoot: ctx === root, name, value })),
            [
                { sameRoot: true, name: "worker", value: 41 },
                { sameRoot: true, name: "worker", value: 41 },
            ],
        );
    });

    it("detaches a context into a root while omitting non-detachable values", () => {
        const retained = createContextNamespace("context-test-detach-retained", "default");
        const omitted = createContextNamespace("context-test-detach-omitted", "default", {
            detachable: false,
        });
        const original = omitted.set(
            retained.set(createRootContext().named("request"), "retained"),
            "omitted",
        );

        const detached = detach(original);
        const renamed = detached.named("worker");

        assert.equal(original.name, "request");
        assert.equal(detached.name, "<root>");
        assert.equal(retained.get(detached), "retained");
        assert.equal(omitted.get(detached), "default");
        assert.equal(renamed.name, "worker");
        assert.equal(retained.get(renamed), "retained");
        assert.equal(omitted.get(renamed), "default");
    });

    it("runs globally registered typed setters", () => {
        const ctx = testCtx;

        ctx.contextTestValue = 42;

        const typedValue: number = ctx.contextTestValue;
        assert.equal(typedValue, 42);
        assert.deepEqual(valueWrites.at(-1), { ctx, value: 42 });
    });

    it("resolves extensions through context wrappers", () => {
        class WrappedContext extends ContextWrapper {}

        const wrapped: Context = new WrappedContext(labelNamespace.set(testCtx, "wrapped"));

        assert.equal(wrapped.contextTestLabel, "wrapped");
    });

    it("runs after-commit callbacks on the next tick in registration order", async () => {
        const ctx = createRootContext().named("after-commit");
        const calls: string[] = [];
        const completed = Promise.withResolvers<void>();

        ctx.afterCommit(async (callbackCtx) => {
            assert.equal(callbackCtx, ctx);
            calls.push("first:start");
            await Promise.resolve();
            calls.push("first:end");
        });
        afterCommit(ctx, () => {
            calls.push("second");
            completed.resolve();
        });

        assert.deepEqual(calls, []);
        await completed.promise;
        assert.deepEqual(calls, ["first:start", "first:end", "second"]);
    });

    it("returns a context and function for deferred after-commit callbacks", async () => {
        const [ctx, runAfterCommit] = withAfterCommit(createRootContext().named("transaction"));
        const calls: string[] = [];

        ctx.afterCommit(async () => {
            calls.push("first:start");
            await Promise.resolve();
            calls.push("first:end");
        });
        ctx.afterCommit(() => {
            calls.push("second");
        });

        assert.deepEqual(calls, []);

        await runAfterCommit();
        assert.deepEqual(calls, ["first:start", "first:end", "second"]);
    });

    it("preserves root contexts and their queue in an after-commit scope", async () => {
        const [root, runAfterCommit] = withAfterCommit(createRootContext());
        const ctx = root.named("worker");
        let called = false;

        ctx.afterCommit(() => {
            called = true;
        });

        assert.equal(ctx.name, "worker");
        assert.equal(called, false);
        await runAfterCommit();
        assert.equal(called, true);
    });

    it("does not carry an after-commit transaction through detach", async () => {
        const [transactionCtx, runAfterCommit] = withAfterCommit(
            createRootContext().named("transaction"),
        );
        const detachedCtx = detach(transactionCtx).named("detached");
        const detachedCompleted = Promise.withResolvers<void>();
        let transactionCalled = false;

        transactionCtx.afterCommit(() => {
            transactionCalled = true;
        });
        detachedCtx.afterCommit(() => {
            detachedCompleted.resolve();
        });

        await detachedCompleted.promise;
        assert.equal(transactionCalled, false);

        await runAfterCommit();
        assert.equal(transactionCalled, true);
    });

    it("does not carry a lifetime through detach", () => {
        const controller = new AbortController();
        const original = withLifetime(testCtx, controller.signal);
        const detached = detach(original);

        assert.equal(original.lifetime, controller.signal);
        assert.equal(detached.lifetime, undefined);
        assert.equal(detached.named("worker").lifetime, undefined);
    });

    it("derives contexts with optional lifetimes", () => {
        const parentController = new AbortController();
        const childController = new AbortController();
        const parent = withLifetime(testCtx, parentController.signal);
        const child = withLifetime(parent, childController.signal);
        const namespacedChild = labelNamespace.set(child, "child");

        assert.equal(testCtx.lifetime, undefined);
        assert.equal(ContextLifetime.get(testCtx), undefined);
        assert.equal(parent.lifetime, parentController.signal);
        assert.equal(ContextLifetime.get(parent), parentController.signal);
        assert.equal(child.lifetime?.aborted, false);
        assert.equal(namespacedChild.lifetime, child.lifetime);

        parentController.abort("parent completed");

        assert.equal(child.lifetime?.aborted, true);
        assert.equal(child.lifetime?.reason, "parent completed");
        assert.equal(childController.signal.aborted, false);
    });

    it("limits callback context lifetime with a timeout", async () => {
        let callbackLifetime: AbortSignal | undefined;

        await assert.rejects(
            timeout(testCtx, { ms: 0 }, async (ctx) => {
                callbackLifetime = ctx.lifetime;
                await new Promise<never>((_, reject) => {
                    ctx.lifetime?.addEventListener("abort", () => reject(ctx.lifetime?.reason), {
                        once: true,
                    });
                });
            }),
            (error: unknown) => error instanceof DOMException && error.name === "TimeoutError",
        );
        assert.equal(callbackLifetime?.aborted, true);
    });

    it("ends a timeout context when its callback settles", async () => {
        let callbackLifetime: AbortSignal | undefined;

        const result = await timeout(testCtx, { ms: 60_000 }, (ctx) => {
            callbackLifetime = ctx.lifetime;
            return "done";
        });

        assert.equal(result, "done");
        assert.equal(callbackLifetime?.aborted, true);
        assert.equal(callbackLifetime?.reason.name, "AbortError");
    });

    it("limits a context lifetime to a callback scope", async () => {
        let callbackLifetime: AbortSignal | undefined;

        const result = await scoped(testCtx, async (ctx) => {
            callbackLifetime = ctx.lifetime;
            assert.equal(callbackLifetime?.aborted, false);
            await Promise.resolve();
            return "done";
        });

        assert.equal(result, "done");
        assert.equal(callbackLifetime?.aborted, true);
        assert.equal(callbackLifetime?.reason.name, "AbortError");
    });

    it("ends a scoped context when its callback rejects", async () => {
        let callbackLifetime: AbortSignal | undefined;
        const failure = new Error("failed");

        await assert.rejects(
            scoped(testCtx, (ctx) => {
                callbackLifetime = ctx.lifetime;
                throw failure;
            }),
            failure,
        );

        assert.equal(callbackLifetime?.aborted, true);
    });

    it("inherits the parent lifetime in a callback scope", async () => {
        const parentController = new AbortController();
        const parent = withLifetime(testCtx, parentController.signal);

        await scoped(parent, (ctx) => {
            assert.equal(ctx.lifetime?.aborted, false);
            parentController.abort("parent completed");
            assert.equal(ctx.lifetime?.aborted, true);
            assert.equal(ctx.lifetime?.reason, "parent completed");
        });
    });

    it("rejects duplicate extension registrations", () => {
        assert.throws(
            () => registerContextExtension("contextTestLabel", () => "duplicate"),
            /Extension already registered: contextTestLabel/,
        );
    });
});
