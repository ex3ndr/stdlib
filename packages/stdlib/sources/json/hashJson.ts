import { sha256, type HashEncoding } from "../hash/index.js";
import { deterministicStringify, normalizeJson } from "./deterministicStringify.js";

/** Hashes a value after deterministic JSON serialization. */
export function hashObject(value: unknown, encoding: HashEncoding = "hex"): Promise<string> {
    return sha256(deterministicStringify(value), encoding);
}

/** Hashes JSON text independently of whitespace and object-key order. */
export function hashJson(json: string, encoding: HashEncoding = "hex"): Promise<string> {
    return sha256(normalizeJson(json), encoding);
}
