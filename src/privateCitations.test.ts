/**
 * No tracked file may point at a document a reader cannot open.
 *
 * The notes this app was planned from live outside the repository, so a
 * comment or a string that cites them (a section sign, a task id, a numbered
 * decision) is a dead end for everyone else. A comment either states its reason
 * inline or it says nothing.
 *
 * This is a ratchet, the same as the product's own gate: a file with no entry in
 * the baseline must be clean, and an entry may only shrink. When a file gets
 * cleaner, record it with `UPDATE_CITATIONS=1 npx vitest run src/privateCitations.test.ts`.
 * An entry for a file that is now clean, or gone, fails too, so the list never
 * turns into an exemption list.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "private-citations-baseline.json");

/** Built, not written, so this file holds none of the forms it looks for. */
const SEC = String.fromCharCode(0xa7);
const POINTER = new RegExp(
  [
    String.raw`\d{2}[a-z]?-[a-z0-9-]+\.md`,
    String.raw`designs\/[^'"\x60)\n]*\.dc\.html`,
    String.raw`(?<![\w-])\d{2}[a-z]?(?=\s(?:` + SEC + String.raw`|D\d|O\d))`,
    SEC + String.raw`\d*(?:\.\d+)*`,
    String.raw`(?<![\w-])\d{1,2}[a-z]?-T\d{1,3}\b`,
    String.raw`\bM\d{1,2}-T\d{1,3}\b`,
    String.raw`\bplan \d{2}\b`,
    String.raw`\b(?:BN|DP|FIX|CD|OE|OW|OU|OF)-\d{1,3}\b`,
  ].join("|"),
  "gi",
);

function tracked(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 1 << 26 })
    .toString()
    .split("\0")
    .filter((file) => file.length > 0 && file !== "scripts/private-citations-baseline.json");
}

function count(file: string): number {
  let text: string;
  try {
    text = readFileSync(join(root, file), "utf8");
  } catch {
    return 0;
  }
  if (text.includes("\0")) return 0;
  return [...text.matchAll(POINTER)].length;
}

describe("private citations", () => {
  const counts = new Map<string, number>();
  for (const file of tracked()) {
    const n = count(file);
    if (n > 0) counts.set(file, n);
  }

  if (process.env.UPDATE_CITATIONS === "1") {
    const files = Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : 1)));
    writeFileSync(baselinePath, `${JSON.stringify({ files }, null, 2)}\n`, "utf8");
  }
  const recorded = (JSON.parse(readFileSync(baselinePath, "utf8")) as { files: Record<string, number> }).files;

  it("appear in no file the baseline does not list, and never grow", () => {
    const grew = [...counts]
      .filter(([file, n]) => n > (recorded[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} (recorded ${recorded[file] ?? 0})`);
    expect(grew).toEqual([]);
  });

  it("are recorded as they shrink, and no entry outlives its file", () => {
    const stale = Object.entries(recorded)
      .filter(([file, was]) => (counts.get(file) ?? 0) !== was)
      .map(([file, was]) => `${file}: ${counts.get(file) ?? 0} now, ${was} recorded`);
    expect(stale).toEqual([]);
  });
});
