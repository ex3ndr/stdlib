# Steve's stdlib

This is a my personal stdlib - a set of verified code that agents can use to write typescript. It is mostly copy of existing code or wrappers. It is mostly a single library and i expect compilers to strip down when building for web.

`Context` is passed explicitly as the first argument to every function that
needs it. That argument is always named `ctx`, including in callback APIs.

## Context

Create one root context before starting the rest of the application. It begins
with the reserved name `<root>`. Only a root context has `named`, and it can be
used to create any number of named contexts, including contexts with the same
name. Every context used after that point is derived from the root:

```typescript
import { createContextNamespace, createRootContext } from "@steve.kite/stdlib";

const root = createRootContext();
root.name; // "<root>"

const ctx = root.named("api");
ctx.name; // "api"

const requestId = createContextNamespace("request-id", "unknown");
const requestCtx = requestId.set(ctx, "request-42");

requestId.get(requestCtx); // "request-42"
```

The returned `Context` cannot itself be renamed and does not expose `named`;
namespaces, lifetimes, and other operations derive new contexts from it while
retaining its name.

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
import { createRootContext, timeout, withLifetime } from "@steve.kite/stdlib";

const ctx = createRootContext().named("api");
const controller = new AbortController();
const operationCtx = withLifetime(ctx, controller.signal);

await timeout(operationCtx, { ms: 10_000 }, async (ctx) => {
    await fetch("https://example.com", { signal: ctx.lifetime });
});
```

The timeout signal also aborts when the callback settles, preventing work
started inside that scope from accidentally outliving it. Cancellation is
cooperative: operations inside the callback must observe `ctx.lifetime`.

## Logging

Install a Pino-compatible logger on the root before deriving application
contexts. The logger reference is stored and invoked as-is:

```typescript
import pino from "pino";
import {
    createRootContext,
    logger as contextLogger,
    withLogContext,
    withLogger,
} from "@steve.kite/stdlib";

let root = createRootContext();
const logger = pino();
root = withLogger(root, logger);
contextLogger.get(root); // logger

const ctx = root.named("api");
const requestCtx = withLogContext(ctx, {
    requestId: "request-42",
    operation: "load-user",
});

requestCtx.log.info("user:load userId=user-1");
```

`logger.get(ctx)` returns the original logger reference, or `undefined` when no
logger is installed. `withLogContext(ctx, fields)` returns a derived context and
shallow-merges its fields with existing log context. Each
`ctx.log.<level>(...)` call passes those fields as the first argument to the
original logger method, followed by the provided arguments. The exported levels
are `trace`, `debug`, `info`, `warn`, `error`, and `fatal`.

## Concurrency

Concurrency primitives carry `Context` instead of accepting separate abort
signals. The context is always first and every work callback receives it first:

```typescript
import {
    GracefulShutdown,
    asyncLock,
    backoff,
    createRootContext,
    forever,
    shutdown,
    withShutdown,
} from "@steve.kite/stdlib";

let root = createRootContext();
const appShutdown = new GracefulShutdown();
root = withShutdown(root, appShutdown);

const ctx = root.named("worker");
shutdown.get(ctx); // appShutdown

const lock = asyncLock();
await backoff(ctx, async (ctx, attempt) => {
    await lock.runInLock(ctx, async (ctx) => {
        // Perform one attempt while holding the lock. Throw to retry.
    });
});

const loop = forever(ctx, { name: "poller", delay: 15_000 }, async (ctx) => {
    // Poll using ctx; its lifetime ends when shutdown begins.
});
await appShutdown.shutdown();
await loop;
```

Retries should almost always wrap lock acquisition as shown above. This releases
the lock before each backoff delay, allowing unrelated callers to make progress.
Only put a retry inside `runInLock` when excluding every other caller for the
entire retry window is an intentional requirement.

Create the application's `GracefulShutdown` before deriving named contexts and
install it on the root with `withShutdown(root, appShutdown)`. Read it later with
`shutdown.get(ctx)`; shutdown is not a field on `Context`. A `forever` started
with a derived context automatically registers under its required `name`, so
the coordinator can report and await the loop without a separate registration
call.

The concurrency module also exports `asyncQueue`, `delay`, `retry`,
`AbortedError`, and abort helpers. `GracefulShutdown` reports named handlers that
fail or do not finish before its timeout.

# License

Apache 2.0
