import type { GracefulShutdown } from "../concurrency/gracefulShutdown.js";
import type { Context } from "./Context.js";
import { ContextSymbol } from "./Context.js";

// The merged interface describes properties installed on this prototype by
// registerContextExtension at runtime.
// oxlint-disable-next-line typescript/no-unsafe-declaration-merging
export abstract class BaseContext {
    abstract readonly [ContextSymbol]: Context;
}

export interface BaseContext extends stdlib.ContextExtensions {
    readonly lifetime: AbortSignal | undefined;
    readonly name: string;
    readonly shutdown: GracefulShutdown | undefined;
}
