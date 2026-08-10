/**
 * Removes blank boundary lines and the indentation shared by every content line.
 *
 * The name preserves the spelling used by Happy's existing utility.
 */
export function trimIdent(text: string): string {
    const lines = text.split(/\r?\n/u);

    while (lines[0]?.trim() === "") lines.shift();
    while (lines.at(-1)?.trim() === "") lines.pop();

    if (lines.length === 0) return "";

    const minimumIndent = Math.min(...lines.filter((line) => line.trim() !== "").map(indentWidth));

    return lines.map((line) => (line.trim() === "" ? "" : line.slice(minimumIndent))).join("\n");
}

function indentWidth(line: string): number {
    const contentStart = line.search(/\S/u);
    return contentStart === -1 ? line.length : contentStart;
}
