import type { Context } from "./Context.js";

export interface RootContext extends Context {
    named(name: string): Context;
}
