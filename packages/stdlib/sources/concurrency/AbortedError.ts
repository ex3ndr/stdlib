import type { Context } from "../context/Context.js";

export class AbortedError extends Error {
    constructor(message = "The operation was aborted.") {
        super(message);
        this.name = "AbortedError";
    }
}

export function isAbortedError(error: unknown): error is AbortedError {
    return error instanceof AbortedError;
}

export function throwIfAborted(ctx: Context): void {
    if (ctx.lifetime?.aborted === true) {
        throw new AbortedError();
    }
}
