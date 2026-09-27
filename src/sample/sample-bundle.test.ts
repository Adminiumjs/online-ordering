/**
 * THE SAMPLE FILE, ITS SOURCE, THE BROWSER'S LOADER AND THE MANIFEST AGREE.
 *
 * `seeds/ordering.sample.json` is what an operator adds from Adminium and
 * what the website's demo resolves in the browser. It is written from
 * `juniper.ts` (`npm run sample`); this fails when the two drift, puts the
 * file through the checks Adminium runs when it is added (vendored with the
 * rest of the manifest checks), holds the loader's written part to
 * manifest.json, and then checks what a sample load cannot: every row is one
 * the product could have made.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { sampleText } from "../../scripts/write-sample.ts";
import { withWrittenPart, type ManifestForSample } from "../../scripts/write-sample-columns.ts";
import { sampleBundleIssues, sampleBundleSchema } from "../testing/manifest/sample.ts";
import type { Manifest } from "../testing/manifest/schema.ts";
import { resolveSample, type SampleBundleRows } from "../data/sampleRows.ts";
import { DEMO_ZONE } from "./juniper.ts";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const manifest = JSON.parse(read("../../manifest.json")) as Manifest & ManifestForSample & { sampleData: { file: string } };
const text = read("../../seeds/ordering.sample.json");
const bundle = JSON.parse(text) as SampleBundleRows;
const rowsOf = (ref: string) => bundle.tables.find((t) => t.ref === ref)?.rows ?? [];

describe("the sample file is what its source writes", () => {
  it("is byte for byte `juniper.ts`'s bundle — run `npm run sample` after changing it", () => {
    expect(text === sampleText()).toBe(true);
  });

  it("is the file the manifest names", () => {
    expect(manifest.sampleData.file).toBe("seeds/ordering.sample.json");
  });

  it("holds the loader's columns and rules to manifest.json — run `npm run sample` after changing the manifest", () => {
    const source = read("../data/sampleRows.ts");
    expect(withWrittenPart(source, manifest) === source).toBe(true);
  });
});

describe("Adminium would add it", () => {
  it("is a well-formed adminium.sample/1 bundle", () => {
    expect(sampleBundleSchema.safeParse(bundle).success).toBe(true);
  });

  it("passes the checks Adminium runs before it adds a bundle", () => {
    expect(sampleBundleIssues(bundle as never, manifest)).toEqual([]);
  });

  it("resolves at any moment of the day, not only at 11:40", () => {
    for (const iso of ["2026-07-28T15:00:00Z", "2026-07-28T18:40:00Z", "2026-07-29T03:10:00Z", "2026-12-24T20:00:00Z"]) {
      expect(() => resolveSample(bundle, { now: Date.parse(iso), zone: DEMO_ZONE, locale: "en-US", currency: "USD" })).not.toThrow();
    }
  });
});

describe("every row is one the product could have made", () => {
  it("mails nobody real: every address is on a reserved .example domain", () => {
    const addresses = [...JSON.stringify(bundle).matchAll(/"(?:email|to_address)":\s*"([^"]+)"/g)].map((m) => m[1]!);
    expect(addresses.length).toBeGreaterThan(20);
    for (const address of addresses) expect(address, address).toMatch(/\.example$/);
  });

  it("spells its numbers with an S and off the running series, so a kitchen's own #1001 is never one of them", () => {
    for (const row of rowsOf("orders")) {
      expect(row["number"]).toMatch(/^S\d{4}$/);
      expect(row["number_seq"]).toBeNull();
    }
    for (const row of rowsOf("enquiries")) {
      expect(row["ref"]).toMatch(/^LG-S\d{4}$/);
      expect(row["ref_seq"]).toBeNull();
    }
  });

  it("gives a cancel its reason and a hand-over how it was paid", () => {
    for (const row of rowsOf("orders")) {
      if (row["status"] === "cancelled") expect(row["cancel_code"], String(row["number"])).not.toBeNull();
      if (row["status"] === "picked_up") expect(row["paid_method"], String(row["number"])).toMatch(/^(cash|card)$/);
    }
  });

  it("chooses only options of the dish on the line, at most a group's maximum", () => {
    const resolved = resolveSample(bundle, { now: Date.parse("2026-07-28T18:40:00Z"), zone: DEMO_ZONE, locale: "en-US", currency: "USD" });
    const groups = resolved["modifier_groups"]!;
    const modifiers = resolved["modifiers"]!;
    const items = resolved["order_items"]!;
    const chosenByLine = new Map<unknown, unknown[]>();
    for (const chosen of resolved["order_item_modifiers"]!) chosenByLine.set(chosen["order_item_id"], [...(chosenByLine.get(chosen["order_item_id"]) ?? []), chosen["modifier_id"]]);
    for (const line of items) {
      const chosen = chosenByLine.get(line["id"]) ?? [];
      const own = groups.filter((g) => g["item_id"] === line["menu_item_id"]);
      for (const group of own) {
        const picked = chosen.filter((m) => modifiers.find((x) => x["id"] === m)!["group_id"] === group["id"]).length;
        expect(picked, `line ${String(line["id"])} ${String(group["name"])}`).toBeGreaterThanOrEqual(Number(group["min"]));
        expect(picked, `line ${String(line["id"])} ${String(group["name"])}`).toBeLessThanOrEqual(Number(group["max"]));
      }
      for (const m of chosen) {
        const group = groups.find((g) => g["id"] === modifiers.find((x) => x["id"] === m)!["group_id"])!;
        expect(group["item_id"]).toBe(line["menu_item_id"]);
      }
    }
  });

  it("says nothing the product never says", () => {
    const words = JSON.stringify(bundle).toLowerCase();
    for (const banned of ["free", "upgrade", "tier", "pricing", "gift card", "demo", "lorem"]) expect(words, banned).not.toContain(banned);
    expect(words).not.toMatch(/\bplans?\b/);
  });
});
