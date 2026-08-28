// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Connected mode (28-public-surface.md §5.2, 28-T28).
 *
 * ── WHY THIS DRIVES A REAL CLIENT ──────────────────────────────────────────
 * `createPublicClient` takes an injectable `fetch`, so these run the SHIPPED
 * client against canned wire responses rather than a hand-written stub of it.
 * That puts `assertRefs`, the config fetch, the paging and the URL building
 * under test too — and those are where a connected app actually fails, not in
 * the mapping.
 *
 * ── WHAT IS WORTH ASSERTING, AND WHY ───────────────────────────────────────
 * Every property below fails SILENTLY if it breaks:
 *
 *  1. Demo mode survives an absent variable — thirteen static marketplace
 *     demos depend on it, and a green build would not notice.
 *  2. The swap happens before the store reads.
 *  3. A dish carries its modifier groups. The store looks an item up to open
 *     its sheet, and against a connected menu that lookup used to search the
 *     SEED — so every real dish opened nothing at all.
 *  4. The tax rate is zero, loudly. The schema has no column for it; charging
 *     the demo's 8% against a real order is the wrong kind of plausible.
 *  5. Yesterday's orders do not appear on today's board. Minutes since
 *     midnight cannot carry a date.
 */

import { describe, expect, it } from "vitest";

import { createPublicClient } from "@adminiumjs/public-client";

import { loadSnapshot, snapshotSource } from "./adminiumSource.ts";
import { demoSource, isConnected, setDataSource, source } from "./source.ts";

const REFS = [
  "menuCategories",
  "menuItems",
  "modifierGroups",
  "modifiers",
  "orders",
  "orderItems",
  "orderItemModifiers",
  "hours",
];

/** Today in the tenant's zone, so the order book is not date-pinned fiction. */
const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const ROWS: Record<string, unknown[]> = {
  menuCategories: [
    { id: 2, slug: "pizza", name: "Pizza", position: 1, icon: "pizza", tint: "--ft-pizza" },
    { id: 1, slug: "bowls", name: "Bowls", position: 0, icon: "salad", tint: "--ft-bowl" },
  ],
  menuItems: [
    {
      id: 10, category_id: 2, slug: "marg", name: "Margherita", short_name: "Marg",
      description: "Tomato, mozzarella, basil.", price: "12.50", image: "marg.webp",
      available: true, featured: true, tags: "V", position: 0,
    },
    {
      id: 11, category_id: 1, slug: "grain", name: "Grain bowl", short_name: "",
      description: "Farro and greens.", price: "11.00", image: "",
      available: false, featured: false, tags: "V,Spicy", position: 1,
    },
    {
      id: 12, category_id: 99, slug: "orphan", name: "Orphan", short_name: "",
      description: "", price: "1.00", image: "", available: true, featured: false,
      tags: "", position: 2,
    },
  ],
  modifierGroups: [
    { id: 30, item_id: 10, slug: "size", name: "Size", kind: "radio", min: 1, max: 1, hint: "Pick one", position: 0 },
    { id: 31, item_id: 10, slug: "tops", name: "Toppings", kind: "check", min: 0, max: 5, hint: "Up to 5", position: 1 },
  ],
  modifiers: [
    { id: 40, group_id: 30, slug: "s13", name: '13"', price_delta: "2.00", available: true, position: 1 },
    { id: 41, group_id: 30, slug: "s10", name: '10"', price_delta: "0.00", available: true, position: 0 },
    { id: 42, group_id: 31, slug: "pep", name: "Pepperoni", price_delta: "1.50", available: true, position: 0 },
    { id: 43, group_id: 31, slug: "anchovy", name: "Anchovy", price_delta: "1.50", available: false, position: 1 },
  ],
  orders: [
    {
      id: 500, number: "2118", customer_name: "Alba R.", status: "preparing",
      pickup_at: `${TODAY}T17:30:00Z`, total: "16.00", note: "no onions",
      status_at: `${TODAY}T17:05:00Z`, placed_at: `${TODAY}T17:00:00Z`,
    },
    {
      id: 501, number: "2119", customer_name: "Nobody", status: "cancelled",
      pickup_at: `${TODAY}T18:00:00Z`, total: "9.00", note: "",
      status_at: null, placed_at: `${TODAY}T17:10:00Z`,
    },
    {
      id: 502, number: "2100", customer_name: "Yesterday", status: "picked_up",
      pickup_at: `${YESTERDAY}T17:30:00Z`, total: "9.00", note: "",
      status_at: null, placed_at: `${YESTERDAY}T17:00:00Z`,
    },
  ],
  orderItems: [
    { id: 600, order_id: 500, item_id: 10, qty: 2, unit_price: "12.50", note: "well done", position: 0 },
    { id: 601, order_id: 501, item_id: 10, qty: 1, unit_price: "12.50", note: "", position: 0 },
    { id: 602, order_id: 502, item_id: 10, qty: 1, unit_price: "12.50", note: "", position: 0 },
  ],
  orderItemModifiers: [
    { order_item_id: 600, modifier_id: 40 },
    { order_item_id: 600, modifier_id: 42 },
  ],
  hours: [
    { weekday: "mon", opens: "11:00", closes: "21:00", position: 0 },
    { weekday: "tue", opens: "11:00", closes: "21:00", position: 1 },
    { weekday: "wed", opens: "11:00", closes: "21:00", position: 2 },
    { weekday: "thu", opens: "11:00", closes: "21:00", position: 3 },
    { weekday: "fri", opens: "11:00", closes: "22:00", position: 4 },
    { weekday: "sat", opens: "11:00", closes: "22:00", position: 5 },
    { weekday: "sun", opens: "12:00", closes: "20:00", position: 6 },
  ],
};

interface FakeOptions {
  rows?: Record<string, unknown[]>;
  expose?: (ref: string) => string[];
  /** The scope's per-ref page ceiling — the operator's number, not the app's. */
  limit?: number;
}

/** A server that answers exactly what the scope would, paging included. */
function fakeFetch(overrides: FakeOptions = {}) {
  const rows = overrides.rows ?? ROWS;
  const limit = overrides.limit ?? 500;
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(String(input));
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

    if (url.pathname.endsWith("/public/config")) {
      const refs: Record<string, unknown> = {};
      for (const ref of REFS) {
        refs[ref] = {
          actions: ["list"],
          expose: overrides.expose?.(ref) ?? Object.keys((rows[ref]?.[0] ?? {}) as object),
          filterable: [], searchable: [], orderable: [], writable: [], limit,
        };
      }
      // `/public/config` is the one route the client unwraps: it reads
      // `body.data`, while `list` reads the body itself.
      return json({
        data: { version: 1, side: "customer", timezone: "UTC", currency: "USD", claim: null, refs },
      });
    }

    const ref = url.pathname.split("/").pop() ?? "";
    const all = rows[ref] ?? [];
    // Honour the window the caller asked for — a fake that ignores it cannot
    // tell a paging bug from a working read.
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const size = Number(url.searchParams.get("limit") ?? String(all.length));
    return json({ data: all.slice(offset, offset + size) });
  };
}

const clientWith = (fetch: ReturnType<typeof fakeFetch>) =>
  createPublicClient({ baseUrl: "https://api.example.test", publishableKey: "adm_pub_test", fetch });

const snapshot = async (overrides: FakeOptions = {}) =>
  loadSnapshot(clientWith(fakeFetch(overrides))!);

describe("demo mode is the structural default", () => {
  it("builds no client when either variable is absent", () => {
    expect(createPublicClient({ baseUrl: "https://x.test", publishableKey: "" })).toBeNull();
    expect(createPublicClient({ baseUrl: "", publishableKey: "adm_pub_x" })).toBeNull();
    expect(createPublicClient(undefined)).toBeNull();
  });

  it("falls back rather than throwing when the server is unreachable", async () => {
    const client = clientWith(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await loadSnapshot(client!)).toBeNull();
  });

  it("falls back when the scope does not expose a column the app reads", async () => {
    expect(await snapshot({ expose: (ref) => (ref === "menuItems" ? ["slug"] : ["id"]) })).toBeNull();
  });
});

describe("the snapshot maps the wire onto the app's shapes", () => {
  it("keys the menu by slug and orders it by position", async () => {
    const snap = await snapshot();
    expect(snap).not.toBeNull();
    // Seeded out of order: `position` is the list order, not arrival order.
    expect(snap!.categories.map((c) => c.id)).toEqual(["bowls", "pizza"]);
    expect(snap!.categories[0]!.tint).toBe("--ft-bowl");
    // A dish whose category did not come back has no tab and no tint.
    expect(snap!.items.map((i) => i.id)).toEqual(["marg", "grain"]);
  });

  it("carries a dish's modifier groups, which is what the sheet opens", async () => {
    const snap = await snapshot();
    const marg = snap!.items[0]!;
    expect(marg.mods.map((g) => g.id)).toEqual(["size", "tops"]);
    // Options are the modifier slugs, ordered by position — and an unavailable
    // one is not offered at all, because the app has no state for one.
    expect(marg.mods[0]!.options.map((o) => o.id)).toEqual(["s10", "s13"]);
    expect(marg.mods[1]!.options.map((o) => o.id)).toEqual(["pep"]);
    // `numeric` arrives as a string and must not reach arithmetic as one.
    expect(marg.mods[0]!.options[1]!.delta).toBe(200);
    expect(marg.price).toBe(1250);
    expect(marg.feat).toBe(true);
  });

  it("reads availability, tags and the fallbacks for a sparse row", async () => {
    const snap = await snapshot();
    const grain = snap!.items[1]!;
    expect(grain.soldOut).toBe(true);
    expect(grain.tags).toEqual(["V", "Spicy"]);
    // WS-I G-4: no icon column, so the tile wears its category's; no image, so
    // the mono chip's filename is derived from the slug.
    expect(grain.icon).toBe("salad");
    expect(grain.file).toBe("grain.webp");
    // An empty short name falls back to the full one rather than rendering
    // nothing on the kitchen board.
    expect(grain.short).toBe("Grain bowl");
  });

  it("rebuilds each order line's selection and its composite key", async () => {
    const snap = await snapshot();
    const order = snap!.orders[0]!;
    expect(order.num).toBe(2118);
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]!.selection).toEqual({ size: ["s13"], tops: ["pep"] });
    // The identity the cart merges on — item, options and the trimmed note.
    expect(order.lines[0]!.key).toBe("marg|size:s13;tops:pep|well done");
    expect(order.lines[0]!.qty).toBe(2);
  });

  it("keeps a cancelled order and yesterday's service off today's board", async () => {
    const snap = await snapshot();
    // Three rows: one cancelled (no column on the board), one from yesterday
    // (minutes since midnight cannot carry a date), one live.
    expect(snap!.orders.map((o) => o.num)).toEqual([2118]);
    // The number is still taken: a cancelled order used it.
    expect(snap!.nextNumber).toBe(2120);
  });

  it("charges no tax and prints no address, rather than the demo's", async () => {
    const connected = snapshotSource((await snapshot())!);
    // WS-I G-1. The wrong number here is money, so it is a visible zero rather
    // than a plausible 8% nobody set.
    expect(connected.taxRate()).toBe(0);
    // WS-I G-2. Blank, not somebody else's street.
    expect(connected.venue()).toEqual({ line1: "", line2: "", note: "" });
  });

  it("posts the week from the hours table and flags the venue's today", async () => {
    const snap = await snapshot();
    expect(snap!.weekHours).toHaveLength(7);
    expect(snap!.weekHours[0]).toMatchObject({ day: "data.day.mon", open: 660, close: 1260 });
    // Exactly one row is today, and it is the one the tenant's zone says.
    const today = snap!.weekHours.filter((d) => d.today === true);
    expect(today).toHaveLength(1);
    expect(snap!.today).toBe(TODAY);
    // The first slot is the venue's own opening plus an hour, not the seed's.
    expect(snap!.firstSlot).toBe(today[0]!.open + 60);
  });

  it("reads every page, not just the first the scope allows", async () => {
    // THE FAILURE THIS PINS. A scope whose ceiling is one row makes a
    // single-shot read return one modifier out of four, with a 200 and no
    // warning — and the sheet then offers one size and no toppings.
    const snap = await snapshot({ limit: 1 });
    expect(snap!.items).toHaveLength(2);
    expect(snap!.items[0]!.mods[0]!.options).toHaveLength(2);
    expect(snap!.weekHours).toHaveLength(7);
  });

  it("hands back the same shapes demoSource does", async () => {
    const connected = snapshotSource((await snapshot())!);
    for (const key of Object.keys(demoSource) as (keyof typeof demoSource)[]) {
      expect(typeof connected[key]).toBe("function");
    }
    // Copied on the way out, like the demo source: a caller that mutates what
    // it is given must not reach back into the snapshot.
    connected.items()[0]!.tags.push("mutated");
    expect(connected.items()[0]!.tags).toEqual(["V"]);
  });
});

describe("the seam", () => {
  it("reports demo mode until a real source is installed", () => {
    expect(isConnected()).toBe(false);
  });

  it("refuses a swap that arrives after the store has read", () => {
    // THE SILENT FAILURE THIS PINS. `state/store.ts` reads at module scope, so
    // a static `import App` evaluates it during main.tsx's own imports — before
    // any fetch can resolve. The app then renders demo data against a
    // configured backend and looks entirely correct. Nothing else notices.
    source.items();
    expect(() => setDataSource(demoSource)).toThrow(/after the store already read/);
  });
});
