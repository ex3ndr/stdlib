export type HashEncoding = "base64" | "base64url" | "hex";

/** Computes a SHA-256 digest using the Web Crypto API available in browsers and Node. */
export async function sha256(
    value: string | Uint8Array,
    encoding: HashEncoding = "hex",
): Promise<string> {
    const bytes =
        typeof value === "string" ? new TextEncoder().encode(value) : Uint8Array.from(value);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));

    switch (encoding) {
        case "base64":
            return toBase64(digest);
        case "base64url":
            return toBase64(digest).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
        case "hex":
            return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
}

function toBase64(value: Uint8Array): string {
    return btoa(String.fromCharCode(...value));
}
