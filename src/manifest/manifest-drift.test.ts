/**
 * `manifest.json` is written from `src/manifest/` (`npm run manifest`), and
 * this is what keeps the two from drifting: an edit to a module that was not
 * written out, or a hand edit to the file, fails here with the fix named.
 *
 * It also holds the manifest's own promises that the product's validator
 * cannot see: the menu is Point of Sale's, column for column; a diner reads
 * nothing of anyone else's and nothing the kitchen keeps to itself; the
 * kitchen writes only what it needs; and the rules an order depends on are on
 * the tables they guard.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import POS_MENU from "./vendored/pos-menu-0.2.2.json" with { type: "json" };
import { buildManifest, manifestText } from "./build.ts";
import { KITCHEN_CANCEL_CODES } from "./tables.ts";

const FILE = join(__dirname, "..", "..", "manifest.json");

type Json = Record<string, unknown>;
type Entry = Json & { table: string; methods: string[]; key?: string; select?: string[]; kind?: string };
const manifest = buildManifest() as Json & {
  requiredSchema: { tables: (Json & { ref: string; columns: (Json & { ref: string })[] })[] };
  publicAccess: Entry[];
  roles: (Json & { key: string; permissions: string[]; limits?: Record<string, Json> })[];
};
const table = (ref: string) => manifest.requiredSchema.tables.find((t) => t.ref === ref)!;
const column = (t: string, c: string) => table(t).columns.find((col) => col.ref === c)!;
const rules = (t: string, c: string) => (column(t, c)["rules"] ?? {}) as Json;
const role = (key: string) => manifest.roles.find((r) => r.key === key)!;
const states = () => table("orders")["states"] as Json & { moves: Record<string, (string | Json)[]> };

describe("manifest.json is what src/manifest/ writes", () => {
  it("is byte for byte the modules' output — run `npm run manifest` after changing them", () => {
    expect(readFileSync(FILE, "utf8") === manifestText()).toBe(true);
  });
});

describe("the menu is Point of Sale's menu@1, column for column", () => {
  const PRODUCT = process.env.ADMINIUM_REPO || fileURLToPath(new URL("../../../adminium", import.meta.url));
  const RELEASED = join(PRODUCT, "packages", "manifest", "test", "fixtures", "released", "point-of-sale-0.2.2.manifest.json");

  it.skipIf(!existsSync(RELEASED))("vendors the released tables unchanged", () => {
    const pos = JSON.parse(readFileSync(RELEASED, "utf8")) as { requiredSchema: { tables: Json[] } };
    const released = pos.requiredSchema.tables.filter((t) => (POS_MENU.tables as Json[]).some((v) => v["ref"] === t["ref"]));
    expect(POS_MENU.tables).toEqual(released);
  });

  it("keeps every menu@1 column, adding only columns that refuse nothing the till writes", () => {
    for (const vendored of POS_MENU.tables as (Json & { ref: string; columns: Json[] })[]) {
      const ours = table(vendored.ref);
      expect(ours["shape"]).toBe("menu@1");
      expect(ours.columns.slice(0, vendored.columns.length)).toEqual(vendored.columns);
      for (const extra of ours.columns.slice(vendored.columns.length)) {
        expect(extra["nullable"] === true || extra["default"] !== undefined, String(extra["ref"])).toBe(true);
      }
    }
    expect(column("menu_items", "online")).toMatchObject({ type: "bool", default: true });
    expect(column("menu_items", "online")["nullable"]).toBeUndefined();
  });
});

describe("a diner reads nothing of anyone else's, and nothing the kitchen keeps", () => {
  const NEVER = ["confirmed_by", "ready_by", "picked_up_by", "cancelled_by", "stock_today", "stock_on", "client_key", "link_token", "slot_capacity", "first_order_number", "staff_note", "customer_id", "number_seq"];

  it("never selects a stamp of who, the portions, a link code or a retry key", () => {
    const selects = (e: Entry): string[] => [
      ...(e.select ?? []),
      ...Object.values((e["children"] ?? {}) as Record<string, Json>).flatMap((child) => [
        ...((child["select"] as string[] | undefined) ?? []),
        ...Object.values((child["children"] ?? {}) as Record<string, Json>).flatMap((grand) => (grand["select"] as string[] | undefined) ?? []),
      ]),
    ];
    for (const entry of manifest.publicAccess) {
      for (const name of NEVER) expect(selects(entry), `${entry.table} ${entry.methods.join(",")}`).not.toContain(name);
    }
  });

  it("reads orders only through a signed-in diner, or one order by its own link", () => {
    for (const entry of manifest.publicAccess.filter((e) => e.table === "orders" && e.methods.includes("GET") && e.kind !== "availability")) {
      const claimed = entry["claimedBy"] !== undefined && entry["level"] === "verified";
      const own = entry.key === "link" && (entry["claim"] as Json | undefined)?.["own"] === true;
      expect(claimed || own).toBe(true);
    }
  });

  it("opens an order's own link only for 30 days after pickup, and emails it only to the order's address", () => {
    const link = manifest.publicAccess.find((e) => e.key === "link" && e.table === "orders")!;
    expect(link["claim"]).toEqual({ by: "token", column: "link_token", expires: "link_expires", stopped: "link_stopped", own: true, address: "email" });
    expect(rules("orders", "link_expires")["stamp"]).toMatchObject({ set: { moment: { column: "pickup_at", plus: { days: 30 } } } });
  });

  it("lists only dishes that are on and sold online, and options that are on", () => {
    const menu = manifest.publicAccess.find((e) => e.table === "menu_items")!;
    expect(menu["filters"]).toEqual([
      { column: "available", op: "eq", value: true },
      { column: "online", op: "eq", value: true },
    ]);
    expect(manifest.publicAccess.find((e) => e.table === "modifiers")!["filters"]).toEqual([{ column: "available", op: "eq", value: true }]);
  });

  it("shows the kitchen's own phone and address on its page: a business's, not a person's", () => {
    expect(rules("settings", "phone")["personal"]).toBe(false);
    expect(rules("settings", "address")["personal"]).toBe(false);
  });
});

describe("the diner's writes are the few the page needs", () => {
  const post = () => manifest.publicAccess.find((e) => e.table === "orders" && e.methods.includes("POST"))!;

  it("places an order only while the kitchen takes online orders — the switch binds the diner, never the kitchen's phone orders", () => {
    expect(post()["requireSetting"]).toEqual([{ table: "settings", column: "online_on" }]);
    const others = manifest.publicAccess.filter((e) => e !== post() && e["requireSetting"] !== undefined);
    expect(others).toEqual([]);
  });

  it("caps what nobody signed in for may send, and keeps what a stranger types plain text", () => {
    expect(post()["anonymous"]).toEqual({ perValue: { columns: ["email"], n: 10 }, perKeyHour: 300, plainText: ["name", "note"] });
    const enquiry = manifest.publicAccess.find((e) => e.table === "enquiries")!;
    expect((enquiry["anonymous"] as Json)["plainText"]).toEqual(["name", "notes"]);
  });

  it("lets a diner cancel their own order only to cancelled, only while it is new, and marks the reason as theirs", () => {
    for (const entry of manifest.publicAccess.filter((e) => e.table === "orders" && e.methods.includes("PATCH"))) {
      expect(entry["writable"]).toEqual(["status"]);
      expect(entry["writableValues"]).toEqual({ status: ["cancelled"] });
      expect(entry["writableWhen"]).toEqual({ status: ["placed"] });
      expect(entry["defaults"]).toEqual({ cancel_code: "self" });
    }
  });
});

describe("the order's life is Adminium's", () => {
  it("moves one step at a time, refuses a second screen's repeat, and locks a finished order with its lines", () => {
    expect(states()["strict"]).toBe(true);
    expect(states()["lock"]).toEqual({ when: ["picked_up", "cancelled", "not_collected"], except: ["link_stopped"] });
    expect(states()["children"]).toEqual({ order_items: { via: "order_id", lock: true } });
  });

  it("cancels only with a reason, and holds no role on the cancel the diner makes too", () => {
    for (const [from, moves] of Object.entries(states().moves)) {
      const cancel = moves.find((m) => typeof m === "object" && m["to"] === "cancelled") as Json | undefined;
      expect(cancel, from).toBeDefined();
      expect(cancel!["requires"], from).toEqual({ where: [{ column: "cancel_code", isNull: false }] });
      expect(cancel!["roles"], from).toBeUndefined();
    }
  });

  it("hands over only with how it was paid, and lets only the clock or a manager mark it not collected", () => {
    const ready = states().moves["ready"]!;
    expect(ready).toContainEqual({ to: "picked_up", requires: { where: [{ column: "paid_method", isNull: false }] } });
    expect(ready).toContainEqual({ to: "not_collected", roles: ["manager"] });
    expect(states()["timed"]).toContainEqual(expect.objectContaining({ from: "ready", to: "not_collected" }));
  });

  it("works out every price, number and total on the server", () => {
    expect(rules("orders", "number_seq")["sequence"]).toEqual({ gapless: true, startSetting: { table: "settings", column: "first_order_number" } });
    expect(rules("order_items", "unit_price")["copy"]).toEqual({ via: "menu_item_id", from: "price", mode: "always" });
    expect(rules("order_item_modifiers", "price_delta")["copy"]).toEqual({ via: "modifier_id", from: "price_delta", mode: "always" });
    for (const [t, c] of [["orders", "subtotal"], ["orders", "item_count"], ["order_items", "options_total"]] as const) expect(rules(t, c)["rollup"], c).toBeDefined();
    for (const [t, c] of [["orders", "tax"], ["orders", "total"], ["order_items", "unit_total"], ["order_items", "line_total"]] as const) expect(rules(t, c)["formula"], c).toBeDefined();
  });
});

describe("the kitchen writes only what running the day needs", () => {
  it("reads the diner's phone and email, to call them", () => {
    expect(role("kitchen").permissions).toContain("table:@orders:read_pii");
    expect(role("kitchen")["screensOnly"]).toBe(true);
  });

  it("moves, cancels with its own reasons, and records how an order was paid — nothing else of an order", () => {
    expect(role("kitchen").limits!["orders"]).toEqual({
      writable: ["status", "cancel_code", "cancel_dish", "cancel_note", "paid_method"],
      writableValues: { status: ["confirmed", "preparing", "ready", "picked_up", "cancelled"], cancel_code: KITCHEN_CANCEL_CODES },
    });
    expect(KITCHEN_CANCEL_CODES).not.toContain("self");
    expect(KITCHEN_CANCEL_CODES).not.toContain("closed");
  });

  it("switches dishes and options and sets portions, and never touches the settings, hours, closures or customers", () => {
    expect(role("kitchen").limits!["menu_items"]).toEqual({ writable: ["available", "stock_today", "stock_on"] });
    expect(role("kitchen").limits!["modifiers"]).toEqual({ writable: ["available"] });
    for (const t of ["settings", "hours", "closures", "customers"]) {
      for (const action of ["create", "update", "delete"]) expect(role("kitchen").permissions).not.toContain(`table:@${t}:${action}`);
    }
    expect(role("kitchen").permissions.some((p) => p.startsWith("table:@customers:"))).toBe(false);
  });
});

describe("every word the manifest shows", () => {
  it("is in the eight languages", async () => {
    const { untranslated } = await import("./labels.ts");
    buildManifest();
    expect(untranslated()).toEqual([]);
  });
});
