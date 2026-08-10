# Steve's stdlib

This is a my personal stdlib - a set of verified code that agents can use to write typescript. It is mostly copy of existing code or wrappers. It is mostly a single library and i expect compilers to strip down when building for web.

`Context` is passed explicitly as the first argument to every function that
needs it. That argument is always named `ctx`, including in callback APIs.

## Context

The context module provides immutable, explicitly passed context values. Create
a namespace to read and update a value:

```typescript
import { EmptyContext, createContextNamespace } from "@steve.kite/stdlib";

const requestId = createContextNamespace("request-id", "unknown");
const ctx = requestId.set(EmptyContext, "request-42");

requestId.get(ctx); // "request-42"
```

Named contexts store their value in the built-in `ContextName` namespace and
expose it through the direct `ctx.name` getter.

Context objects can be extended globally with typed getters and setters. Declare
the properties once in an ambient TypeScript file, then register their runtime
behavior during application startup:

```typescript
import { registerContextExtension } from "@steve.kite/stdlib";

declare global {
    namespace stdlib {
        interface ContextExtensions {
            requestId: string;
            priority: number;
        }
    }
}

registerContextExtension("requestId", (ctx) => requestId.get(ctx));
registerContextExtension("priority", {
    get: () => 0,
    set: (ctx, value) => {
        console.log("New priority", value, ctx);
    },
});
```

After registration, every `Context` has typed `requestId` and `priority`
properties. Setters perform the registered action; they do not replace the
immutable context. Use `ContextNamespace.set` when you need a derived context.

### Lifetime

A context can carry an optional abort signal in the `ContextLifetime` namespace.
The built-in `ctx.lifetime` getter reads that namespace directly.
`withLifetime` returns a derived context whose lifetime ends when either the
parent lifetime or the supplied signal aborts:

```typescript
import { EmptyContext, timeout, withLifetime } from "@steve.kite/stdlib";

const controller = new AbortController();
const ctx = withLifetime(EmptyContext, controller.signal);

await timeout(ctx, { ms: 10_000 }, async (ctx) => {
    await fetch("https://example.com", { signal: ctx.lifetime });
});
```

The timeout signal also aborts when the callback settles, preventing work
started inside that scope from accidentally outliving it. Cancellation is
cooperative: operations inside the callback must observe `ctx.lifetime`.

## Concurrency

Concurrency primitives carry `Context` instead of accepting separate abort
signals. The context is always first and every work callback receives it first:

```typescript
import { EmptyContext, asyncLock, backoff, forever, gracefulShutdown } from "@steve.kite/stdlib";

const lock = asyncLock();
await backoff(EmptyContext, async (ctx, attempt) => {
    await lock.runInLock(ctx, async (ctx) => {
        // Perform one attempt while holding the lock. Throw to retry.
    });
});

const shutdown = gracefulShutdown(EmptyContext);
const loop = forever(shutdown.ctx, { name: "poller", delay: 15_000 }, async (ctx) => {
    // Poll using ctx; its lifetime ends when shutdown begins.
});
await shutdown.shutdown();
await loop;
```

Retries should almost always wrap lock acquisition as shown above. This releases
the lock before each backoff delay, allowing unrelated callers to make progress.
Only put a retry inside `runInLock` when excluding every other caller for the
entire retry window is an intentional requirement.

`gracefulShutdown(ctx)` installs itself as `shutdown.ctx.shutdown`. A `forever`
started with that context automatically registers under its required `name`, so
shutdown can report and await the loop without a separate registration call.

The concurrency module also exports `asyncQueue`, `delay`, `retry`,
`AbortedError`, and abort helpers. `gracefulShutdown` reports named handlers
that fail or do not finish before its timeout.

# License

Apache 2.0
