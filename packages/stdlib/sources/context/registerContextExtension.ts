import { BaseContext } from "./BaseContext.js";
import type { Context } from "./Context.js";

type ContextExtensionValue<Name extends string> = Name extends keyof stdlib.ContextExtensions
    ? stdlib.ContextExtensions[Name]
    : unknown;

export interface ContextExtensionDescriptor<Value> {
    get(ctx: Context): Value;
    set?(ctx: Context, value: Value): void;
}

const registeredExtensions = new Set<string>();

export function registerContextExtension<Name extends string>(
    name: Name,
    get: (ctx: Context) => ContextExtensionValue<Name>,
    set?: (ctx: Context, value: ContextExtensionValue<Name>) => void,
): void;
export function registerContextExtension<Name extends string>(
    name: Name,
    descriptor: ContextExtensionDescriptor<ContextExtensionValue<Name>>,
): void;
export function registerContextExtension<Name extends string>(
    name: Name,
    extension:
        | ((ctx: Context) => ContextExtensionValue<Name>)
        | ContextExtensionDescriptor<ContextExtensionValue<Name>>,
    set?: (ctx: Context, value: ContextExtensionValue<Name>) => void,
): void {
    if (registeredExtensions.has(name)) {
        throw new Error(`Extension already registered: ${name}`);
    }

    const descriptor = typeof extension === "function" ? { get: extension, set } : extension;

    registeredExtensions.add(name);
    Object.defineProperty(BaseContext.prototype, name, {
        get(this: Context) {
            return descriptor.get(this);
        },
        set: descriptor.set
            ? function setExtension(this: Context, value: ContextExtensionValue<Name>) {
                  descriptor.set?.(this, value);
              }
            : undefined,
    });
}
