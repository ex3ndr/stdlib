import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    deterministicStringify,
    hashJson,
    hashObject,
    normalizeJson,
    sha256,
    trimIdent,
} from "../sources/index.js";

describe("trimIdent", () => {
    it("removes blank boundary lines and common indentation", () => {
        assert.equal(
            trimIdent(`
                first
                    second

                third
            `),
            "first\n    second\n\nthird",
        );
    });

    it("normalizes line endings and handles blank input", () => {
        assert.equal(trimIdent("\r\n\tvalue\r\n"), "value");
        assert.equal(trimIdent("\n  \n"), "");
    });
});

describe("deterministic JSON", () => {
    it("sorts object keys recursively while preserving array order", () => {
        assert.equal(
            deterministicStringify({ z: 1, nested: { b: 2, a: 1 }, values: [3, 1] }),
            '{"nested":{"a":1,"b":2},"values":[3,1],"z":1}',
        );
    });

    it("normalizes differently formatted JSON idempotently", () => {
        const compact = normalizeJson('{ "b": 2, "a": { "d": 4, "c": 3 } }');

        assert.equal(compact, '{"a":{"c":3,"d":4},"b":2}');
        assert.equal(normalizeJson(compact), compact);
    });
});

describe("hashes", () => {
    it("computes known SHA-256 encodings", async () => {
        assert.equal(
            await sha256("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
        assert.equal(
            await sha256("abc", "base64url"),
            "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0",
        );
    });

    it("gives equivalent JSON and object forms the same hash", async () => {
        const left = await hashJson('{\n  "b": 2,\n  "a": 1\n}');
        const right = await hashJson('{"a":1,"b":2}');

        assert.equal(left, right);
        assert.equal(left, await hashObject({ b: 2, a: 1 }));
    });
});
