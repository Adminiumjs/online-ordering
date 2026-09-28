/**
 * THE DEMO PLAYS THE MANIFEST'S RULES.
 *
 * `rules.ts` is the manifest's limits, states, public entries, roles'
 * limits and email producers, written out for the demo (`npm run
 * demo-rules`); it fails here the moment the manifest moves without it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { demoRulesText } from "../../scripts/write-demo-rules.ts";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const manifest = JSON.parse(read("../../manifest.json")) as Record<string, unknown>;

describe("the demo's rules are the manifest's", () => {
  it("is what `npm run demo-rules` writes from manifest.json", () => {
    expect(read("./rules.ts") === demoRulesText(manifest)).toBe(true);
  });
});
