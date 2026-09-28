/**
 * The order page's ref names are the ones Adminium gives the manifest's
 * entries when it installs the app: worked out here from the manifest itself,
 * by the server's own naming, and compared with `PUBLIC_REFS`.
 */
import { describe, expect, it } from "vitest";

import { buildManifest } from "../manifest/build.ts";
import { PUBLIC_REFS, publicRefs } from "./publicRefs.ts";

type Entry = { table: string; key?: string; kind?: string; claim?: unknown; claimedBy?: unknown; visibleWith?: unknown; unlockBy?: unknown; level?: string; methods: string[] };

/** The server's naming of `publicAccess` entries, over the tables' real names. */
function serverRefs(entries: Entry[], real: (table: string) => string): string[] {
  const taken = new Set<string>();
  return entries.map((entry) => {
    const name = real(entry.table);
    const own = entry.claimedBy !== undefined || entry.visibleWith !== undefined;
    const base =
      entry.kind === "availability"
        ? `${name}_availability`
        : entry.unlockBy !== undefined
          ? `${name}_unlocked`
          : entry.claim !== undefined || (own && entry.level !== "verified")
            ? `${name}_claimed`
            : own
              ? `${name}_verified`
              : name;
    let ref = base;
    for (let n = 2; taken.has(ref); n += 1) ref = `${base}_${String(n)}`;
    taken.add(ref);
    return ref;
  });
}

const entries = (buildManifest() as { publicAccess: Entry[] }).publicAccess;
const refs = serverRefs(entries, (t) => `ordering_${t}`);
const refOf = (find: (e: Entry) => boolean) => {
  const at = entries.findIndex(find);
  return at < 0 ? undefined : refs[at];
};
const plain = (e: Entry) => e.key === undefined && e.claim === undefined && e.claimedBy === undefined && e.visibleWith === undefined && e.kind === undefined;

describe("the order page's refs", () => {
  const r = publicRefs();

  it("name the kitchen's plain reads", () => {
    for (const name of ["settings", "categories", "dishes", "groups", "options", "hours", "closures"] as const) {
      const table = PUBLIC_REFS[name][0];
      expect(r[name], name).toBe(refOf((e) => e.table === table && plain(e) && e.methods.includes("GET")));
    }
  });

  it("name what is still free by the availability entries", () => {
    expect(r.slots).toBe(refOf((e) => e.table === "orders" && e.kind === "availability"));
    expect(r.portions).toBe(refOf((e) => e.table === "order_items" && e.kind === "availability"));
  });

  it("name placing an order and sending an enquiry", () => {
    expect(r.place).toBe(refOf((e) => e.table === "orders" && e.methods.includes("POST")));
    expect(r.enquire).toBe(refOf((e) => e.table === "enquiries" && e.methods.includes("POST")));
  });

  it("name the account and the signed-in diner's own orders", () => {
    expect(r.account).toBe(refOf((e) => e.table === "customers" && e.claim !== undefined));
    expect(r.myOrders).toBe(refOf((e) => e.table === "orders" && e.key === undefined && e.claimedBy !== undefined && e.methods.includes("GET")));
    expect(r.myLines).toBe(refOf((e) => e.table === "order_items" && e.key === undefined && e.visibleWith !== undefined));
    expect(r.myOptions).toBe(refOf((e) => e.table === "order_item_modifiers" && e.key === undefined && e.visibleWith !== undefined));
  });

  it("name the one order its own link opens, on the link key", () => {
    expect(r.linkOrder).toBe(refOf((e) => e.table === "orders" && e.key === "link"));
    expect(r.linkLines).toBe(refOf((e) => e.table === "order_items" && e.key === "link"));
    expect(r.linkOptions).toBe(refOf((e) => e.table === "order_item_modifiers" && e.key === "link"));
  });

  it("follow the server's table names", () => {
    const renamed = publicRefs({ orders: "juniper_orders" });
    expect([renamed.place, renamed.linkOrder, renamed.dishes]).toEqual(["juniper_orders_verified_2", "juniper_orders_claimed", "ordering_menu_items"]);
  });

  it("leave no entry of the manifest unnamed", () => {
    const named = new Set(Object.values(r));
    expect(refs.filter((ref) => !named.has(ref))).toEqual([]);
  });
});
