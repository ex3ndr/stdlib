import type { Context } from "../context/Context.js";
import { ContextLifetime } from "./impl/ContextLifetime.js";

export function withLifetime(ctx: Context, lifetime: AbortSignal): Context {
    return ContextLifetime.set(ctx, combineLifetimes(ctx.lifetime, lifetime));
}

function combineLifetimes(parent: AbortSignal | undefined, child: AbortSignal): AbortSignal {
    if (!parent || parent === child) {
        return child;
    }
    return AbortSignal.any([parent, child]);
}
