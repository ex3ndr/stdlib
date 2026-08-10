import type { Context } from "../context/Context.js";
import type { DerivedContext } from "../context/ContextNamespace.js";
import { ContextLifetime } from "./impl/ContextLifetime.js";

export function withLifetime<Source extends Context>(
    ctx: Source,
    lifetime: AbortSignal,
): DerivedContext<Source> {
    return ContextLifetime.set(ctx, combineLifetimes(ctx.lifetime, lifetime));
}

function combineLifetimes(parent: AbortSignal | undefined, child: AbortSignal): AbortSignal {
    if (!parent || parent === child) {
        return child;
    }
    return AbortSignal.any([parent, child]);
}
