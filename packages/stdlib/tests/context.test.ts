import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    ContextLifetime,
    ContextName,
    ContextWrapper,
    EmptyContext,
    createContextNamespace,
    createNamedContext,
    isContext,
    registerContextExtension,
    timeout,
    type Context,
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
}
void assertContextExtensionTypes;

const labelNamespace = createContextNamespace("context-test-label", "default");
const valueWrites: Array<{ ctx: Context; value: number }> = [];

registerContextExtension("contextTestLabel", (ctx) => labelNamespace.get(ctx));
registerContextExtension("contextTestValue", {
    get: () => valueWrites.at(-1)?.value ?? 0,
    set: (ctx, value) => {
        valueWrites.push({ ctx, value });
    },
});

describe("context", () => {
    it("creates immutable contexts and updates namespace values", () => {
        const ctx = labelNamespace.set(EmptyContext, "request");

        assert.equal(labelNamespace.get(EmptyContext), "default");
        assert.equal(labelNamespace.get(ctx), "request");
        assert.equal(ctx.contextTestLabel, "request");
        assert.equal(isContext(ctx), true);
        assert.equal(isContext({}), false);
    });

    it("creates named contexts", () => {
        const ctx = createNamedContext("worker");

        assert.equal(EmptyContext.name, "<noname>");
        assert.equal(ctx.name, "worker");
        assert.equal(ContextName.get(ctx), "worker");
        assert.equal(ctx.contextTestLabel, "default");
        assert.equal(isContext(ctx), true);
    });

    it("runs globally registered typed setters", () => {
        const ctx = EmptyContext;

        ctx.contextTestValue = 42;

        const typedValue: number = ctx.contextTestValue;
        assert.equal(typedValue, 42);
        assert.deepEqual(valueWrites.at(-1), { ctx, value: 42 });
    });

    it("resolves extensions through context wrappers", () => {
        class WrappedContext extends ContextWrapper {}

        const wrapped: Context = new WrappedContext(labelNamespace.set(EmptyContext, "wrapped"));

        assert.equal(wrapped.contextTestLabel, "wrapped");
    });

    it("derives contexts with optional lifetimes", () => {
        const parentController = new AbortController();
        const childController = new AbortController();
        const parent = withLifetime(EmptyContext, parentController.signal);
        const child = withLifetime(parent, childController.signal);
        const namespacedChild = labelNamespace.set(child, "child");

        assert.equal(EmptyContext.lifetime, undefined);
        assert.equal(ContextLifetime.get(EmptyContext), undefined);
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
            timeout(EmptyContext, { ms: 0 }, async (ctx) => {
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

        const result = await timeout(EmptyContext, { ms: 60_000 }, (ctx) => {
            callbackLifetime = ctx.lifetime;
            return "done";
        });

        assert.equal(result, "done");
        assert.equal(callbackLifetime?.aborted, true);
        assert.equal(callbackLifetime?.reason.name, "AbortError");
    });

    it("rejects duplicate extension registrations", () => {
        assert.throws(
            () => registerContextExtension("contextTestLabel", () => "duplicate"),
            /Extension already registered: contextTestLabel/,
        );
    });
});
