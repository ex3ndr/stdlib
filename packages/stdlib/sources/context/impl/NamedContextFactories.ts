import type { RootContext } from "../RootContext.js";

type NamedContextFactory = (ctx: RootContext, name: string, value: unknown) => unknown;

interface NamedContextFactoryRegistration {
    readonly defaultValue: unknown;
    readonly factory: NamedContextFactory;
}

const registrations = new Map<string, NamedContextFactoryRegistration>();

export function registerNamedContextFactory<Value>(
    key: string,
    defaultValue: Value,
    factory: (ctx: RootContext, name: string, value: Value) => Value,
): void {
    registrations.set(key, {
        defaultValue,
        factory: factory as NamedContextFactory,
    });
}

export function applyNamedContextFactories(
    ctx: RootContext,
    values: Record<string, unknown>,
    name: string,
): Record<string, unknown> {
    const result = { ...values };
    for (const [key, registration] of registrations) {
        const value = Object.hasOwn(result, key) ? result[key] : registration.defaultValue;
        result[key] = registration.factory(ctx, name, value);
    }
    return result;
}
