/**
 * THE DEMO PLAYS THE MANIFEST'S RULES, AND SAYS WHICH IT PLAYS AHEAD OF IT.
 *
 * `rules.ts` is the manifest's limits, states, public entries, roles'
 * limits and email producers, written out for the demo (`npm run
 * demo-rules`); it fails here the moment the manifest moves without it.
 *
 * `AHEAD` lists what the demo plays that the manifest does not declare yet —
 * each waits for the Adminium that reads it. The day one of them lands in the
 * manifest, the check below fails, and the demo stops carrying its own copy.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { demoRulesText } from "../../scripts/write-demo-rules.ts";
import { AHEAD } from "./engine.ts";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const manifest = JSON.parse(read("../../manifest.json")) as Record<string, unknown> & {
  requiredSchema: { tables: { ref: string; states?: { moves: Record<string, unknown[]>; timed?: { from: string; to: string }[] } }[] };
  publicAccess: { table: string; kind?: string }[];
  outbox: { producers: Record<string, unknown>[] };
};
const orders = manifest.requiredSchema.tables.find((t) => t.ref === "orders")!.states!;
const moveTo = (from: string, to: string) => (orders.moves[from] ?? []).some((m) => (typeof m === "string" ? m : (m as { to: string }).to) === to);

describe("the demo's rules are the manifest's", () => {
  it("is what `npm run demo-rules` writes from manifest.json", () => {
    expect(read("./rules.ts") === demoRulesText(manifest)).toBe(true);
  });
});

describe("what the demo plays ahead of the manifest is not in it yet", () => {
  it("cancels unfinished orders at closing (the manifest times only not-collected)", () => {
    for (const from of AHEAD.closingCancel.from) expect(orders.timed?.some((t) => t.from === from), from).toBe(false);
  });

  it("undoes a move, and puts back a hand-off", () => {
    for (const [from, to] of Object.entries(AHEAD.undo.moves)) expect(moveTo(from, to), `${from} → ${to}`).toBe(false);
    expect(moveTo(AHEAD.handOffBack.from, AHEAD.handOffBack.to)).toBe(false);
  });

  it("holds the ready and receipt emails", () => {
    for (const producer of manifest.outbox.producers) expect(Object.keys(producer)).not.toContain("holdSeconds");
  });

  it("answers the two availability questions of the order page", () => {
    expect(manifest.publicAccess.filter((e) => e.kind === "availability").map((e) => e.table)).toEqual([]);
    expect(AHEAD.availability).toEqual(["orders", "order_items"]);
  });
});
