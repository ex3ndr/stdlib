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
import { createRootContext, scoped, timeout, withLifetime } from "@steve.kite/stdlib";

const ctx = createRootContext().named("api");
const controller = new AbortController();
const operationCtx = withLifetime(ctx, controller.signal);

await timeout(operationCtx, { ms: 10_000 }, async (ctx) => {
    await fetch("https://example.com", { signal: ctx.lifetime });
});

await scoped(operationCtx, async (ctx) => {
    // ctx.lifetime remains active only until this callback settles.
});
```

The timeout signal also aborts when the callback settles, preventing work
started inside that scope from accidentally outliving it. Cancellation is
cooperative: operations inside the callback must observe `ctx.lifetime`.
`scoped` provides the same callback-bound lifetime without adding a deadline and
inherits cancellation from its parent context.

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
Without an installed logger, every `ctx.log` method is a no-op.

## Telemetry

Install an OpenTelemetry-style tracer adapter on the root before creating named
contexts. Naming a context carries the tracer but does not create a span:

```typescript
import { createRootContext, traceSpan, withTracer, type Tracer } from "@steve.kite/stdlib";

declare const tracer: Tracer;

let root = createRootContext();
root = withTracer(root, tracer);

const ctx = root.named("worker");
traceSpan.get(ctx); // undefined

await ctx.span("job:run", async (ctx) => {
    traceSpan.get(ctx); // The child "job:run" span.
    // Perform traced work with ctx.
});
```

`ctx.span(name, work)` is the convenience form of `span(ctx, name, work)`. It
records thrown or rejected failures, ends its child span when the work settles,
and returns the work's result. Without an installed tracer it calls `work(ctx)`
directly and performs no tracing. `tracer.get(ctx)` returns the installed tracer
and `traceSpan.get(ctx)` returns the current span.

The tracer adapter creates spans with
`startSpan(name, parentSpan)`; spans provide `end()` and may provide
`recordException(error)`.

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

`asyncLock()` ignores reentry detection by default, preserving ordinary lock
contention (and deadlocking if an outer callback awaits its own nested
acquisition). Use `asyncLock({ reentry: "allow" })` to let nested calls run
immediately while the context owns that lock, or `reentry: "block"` to reject a
detected nested call with an error. Ownership expires when the outer callback
settles, even if its context escapes.

Retries should almost always wrap lock acquisition as shown above. This releases
the lock before each backoff delay, allowing unrelated callers to make progress.
Only put a retry inside `runInLock` when excluding every other caller for the
entire retry window is an intentional requirement.

Locks and queues are not bound to a context when created. `runInLock(ctx, work)`
uses its caller's context to create `asyncLock.wait` and `asyncQueue.wait` spans
when acquisition is contended. Each wait span ends when that caller acquires the
lock, before its protected work starts; uncontended acquisition creates no wait
span.

Additional coordination primitives follow the same context-first callback
shape:

```typescript
import { mapAsyncLock, mapReadWriteLock, readWriteLock, semaphore } from "@steve.kite/stdlib";

const permits = semaphore(4);
await permits.run(ctx, async (ctx) => {
    // At most four permit holders run concurrently.
});

const users = mapAsyncLock<string>();
await users.runInLock(ctx, userId, async (ctx) => {
    // Serialized only with callers using the same userId.
});

const state = readWriteLock();
await state.runInReadLock(ctx, async (ctx) => {
    // Readers may run together.
});
await state.runInWriteLock(ctx, async (ctx) => {
    // Writers are exclusive.
});

const records = mapReadWriteLock<string>();
await records.runInWriteLock(ctx, recordId, async (ctx) => {
    // Read/write exclusion is isolated to recordId.
});
```

Read/write locks give queued writers priority over new readers. Keyed locks
discard an entry once it has no active or waiting callers. Contended waits emit
`semaphore.wait`, `mapAsyncLock.wait`, `readWriteLock.{read,write}.wait`, or
`mapReadWriteLock.{read,write}.wait` spans from the caller's context.

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
