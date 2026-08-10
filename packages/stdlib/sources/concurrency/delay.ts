import type { Context } from "../context/Context.js";
import { AbortedError, throwIfAborted } from "./AbortedError.js";

export async function delay(ctx: Context, ms: number): Promise<void> {
    throwIfAborted(ctx);

    return new Promise<void>((resolve, reject) => {
        const signal = ctx.lifetime;
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
        }, ms);

        function onAbort(): void {
            clearTimeout(timer);
            reject(new AbortedError());
        }

        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
