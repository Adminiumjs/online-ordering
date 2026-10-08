/**
 * The order, its lines, its codes and its gift card payments are the parts
 * Offers & gift cards defines, spelled out on this app's own tables under its
 * own column names. The add-on is only suggested, so nothing is built ON its
 * shapes; this check holds the two together instead: Offers' own fit check
 * (`src/testing/shapes/fit.ts`, a copy) over the four shape files it ships.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { shapeFit, type Pairing, type Shape } from "../testing/shapes/fit.ts";
import { buildManifest } from "./build.ts";

const shape = (name: string): Shape => JSON.parse(readFileSync(new URL(`../testing/shapes/${name}.json`, import.meta.url), "utf8")) as Shape;
const SHAPES = ["discountable", "card-payment", "card-sale", "voucher-sale"].map(shape);

const PAIRINGS: Pairing[] = [
  {
    table: "orders",
    shape: "discountable@1",
    part: "order",
    tables: { lines: "order_items", codes: "order_codes" },
    // No reduction is given by hand here, so none of the four staff columns; the order says when it is paid and cancelled by its status.
    columns: { discount_kind: null, discount_value: null, discount_reason: null, discount_by: null, paid_at: null, cancelled_at: null },
  },
  { table: "order_items", shape: "discountable@1", part: "lines", tables: { order: "orders" }, columns: { item: null, amount: "line_total" } },
  { table: "order_codes", shape: "discountable@1", part: "codes", tables: { order: "orders" } },
  // The order's cancel gives a card its money back: a payment has no "voided" of its own.
  { table: "payments", shape: "card-payment@1", part: "payments", tables: { order: "orders" }, columns: { voided_at: null } },
];

describe("the order, its lines, its codes and its payments fit Offers' parts", () => {
  const said = (manifest: Record<string, unknown>) => shapeFit(manifest as never, PAIRINGS, SHAPES).map((issue) => `${issue.table} as ${issue.shape}/${issue.part}: ${issue.message}`);

  it("as the manifest is written", () => {
    expect(said(buildManifest())).toEqual([]);
  });

  it("and would not with what a card holds after paying in a diner's read", () => {
    const manifest = JSON.parse(JSON.stringify(buildManifest())) as { publicAccess: { table: string; methods: string[]; writable?: string[]; children?: Record<string, { writable: string[] }> }[] };
    const place = manifest.publicAccess.find((entry) => entry.table === "orders" && entry.methods.includes("POST"))!;
    place.children!["payments"]!.writable.push("card_balance_after");
    expect(said(manifest).join("\n")).toContain("card_balance_after");
  });
});
