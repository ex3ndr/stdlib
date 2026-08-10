/**
 * Serializes a value as canonical JSON, sorting object keys at every depth.
 *
 * Values first pass through the platform JSON serializer, retaining its handling
 * of `toJSON`, undefined properties, non-finite numbers, and invalid JSON values.
 */
export function deterministicStringify(value: unknown): string {
    const json = JSON.stringify(value);
    if (json === undefined) throw new TypeError("Value cannot be represented as JSON.");
    return stringifyJsonValue(JSON.parse(json) as JsonValue);
}

/** Normalizes JSON text independently of whitespace and object-key order. */
export function normalizeJson(json: string): string {
    return stringifyJsonValue(JSON.parse(json) as JsonValue);
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function stringifyJsonValue(value: JsonValue): string {
    if (Array.isArray(value)) return `[${value.map(stringifyJsonValue).join(",")}]`;

    if (value !== null && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stringifyJsonValue(value[key]!)}`)
            .join(",")}}`;
    }

    return JSON.stringify(value);
}
