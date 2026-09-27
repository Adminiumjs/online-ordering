/**
 * The demo's kitchen: the app's REAL sample — the very bundle an operator
 * adds from Adminium (`seeds/ordering.sample.json`) — resolved at the demo's
 * moment by the same loader the tests hold to Adminium's, held in memory.
 *
 * The sample's numbers carry an `S` (`S2108`) and no running number, so a
 * real kitchen's first order is never one of them. The demo shows them as a
 * real install would number them (`#2108`), and its own new orders go on
 * from where the sample leaves off (`#2118`, `LG-0099`).
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import bundleJson from "../../seeds/ordering.sample.json" with { type: "json" };
import { resolveSample, type SampleBundleRows } from "../data/sampleRows.ts";
import type { Id, LiveFrame, Row } from "../data/wire.ts";

export const DEMO_BUNDLE = bundleJson as unknown as SampleBundleRows;

/** Tuesday 28 July 2026, 11:40 in Riverside. */
export const DEMO_START = Date.parse("2026-07-28T18:40:00Z");
export const DEMO_ZONE = "America/Los_Angeles";
export const DEMO_CURRENCY = "USD";

/** Every table the app declares, in the order a sample loads them. */
export const TABLES = [
  "settings",
  "hours",
  "closures",
  "slot_pauses",
  "menu_categories",
  "menu_items",
  "modifier_groups",
  "modifiers",
  "customers",
  "orders",
  "order_items",
  "order_item_modifiers",
  "enquiries",
  "messages",
] as const;
export type Table = (typeof TABLES)[number];

/** Strip a sample number's `S`: `S2108` → 2108, `LG-S0097` → 97. */
const sampleNumber = (text: unknown): number | null => {
  const match = typeof text === "string" ? /S(\d+)$/.exec(text) : null;
  return match === null ? null : Number(match[1]);
};

export class World {
  now: number;
  readonly zone = DEMO_ZONE;
  readonly currency = DEMO_CURRENCY;
  private rows: Record<Table, Row[]>;
  private nextIds: Record<Table, number>;
  private listeners = new Set<(frame: LiveFrame) => void>();

  constructor(now = DEMO_START) {
    this.now = now;
    const resolved = resolveSample(DEMO_BUNDLE, { now, zone: DEMO_ZONE, locale: "en-US", currency: DEMO_CURRENCY });
    this.rows = Object.fromEntries(TABLES.map((t) => [t, ((resolved[t] ?? []) as Row[]).map((row) => ({ ...row }))])) as Record<Table, Row[]>;
    // Numbered as a real install numbers them, and the series going on from the sample's last.
    for (const order of this.rows.orders) {
      const n = sampleNumber(order["number"]);
      if (n !== null) Object.assign(order, { number_seq: n, number: String(n) });
    }
    for (const enquiry of this.rows.enquiries) {
      const n = sampleNumber(enquiry["ref"]);
      if (n !== null) Object.assign(enquiry, { ref_seq: n, ref: `LG-${String(n).padStart(4, "0")}` });
    }
    this.nextIds = Object.fromEntries(TABLES.map((t) => [t, Math.max(0, ...this.rows[t].map((r) => r.id)) + 1])) as Record<Table, number>;
  }

  all(table: Table): Row[] {
    return this.rows[table];
  }

  get(table: Table, id: Id): Row | undefined {
    return this.rows[table].find((row) => row.id === id);
  }

  where(table: Table, test: (row: Row) => boolean): Row[] {
    return this.rows[table].filter(test);
  }

  /** The one settings row. */
  settings(): Row {
    return this.rows.settings[0]!;
  }

  /** The next number of a running series: one past the largest there is. */
  nextNumber(table: Table, column: string): number {
    return Math.max(0, ...this.rows[table].map((row) => Number(row[column] ?? 0))) + 1;
  }

  insert(table: Table, values: Record<string, unknown>): Row {
    const row = { ...values, id: this.nextIds[table]++ } as Row;
    this.rows[table].push(row);
    this.emit({ table, id: row.id, op: "insert" });
    return row;
  }

  update(table: Table, id: Id, values: Record<string, unknown>): Row {
    const row = this.get(table, id);
    if (row === undefined) throw new Error(`no ${table} ${String(id)}`);
    Object.assign(row, values);
    this.emit({ table, id, op: "update" });
    return row;
  }

  remove(table: Table, id: Id): void {
    this.rows[table] = this.rows[table].filter((row) => row.id !== id);
    this.emit({ table, id, op: "delete" });
  }

  on(listener: (frame: LiveFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(frame: LiveFrame): void {
    for (const listener of this.listeners) listener(frame);
  }
}
