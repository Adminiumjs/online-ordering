/**
 * Engine assertions for `lib/order.ts`.
 *
 * The composite-key merge rule gets the most attention here, because it is the
 * one piece of this app that is easy to get subtly wrong and impossible to
 * notice until a customer is handed the wrong pizza.
 */

import { describe, expect, it } from "vitest";

import {
  CLOSE_AT,
  FIRST_SLOT,
  ITEMS,
  MG_CRUST,
  MG_EXTRAS,
  MG_SIZE,
  MG_TOPS,
  OPEN_AT,
  PINNED_NOW,
  SEED_ORDERS,
  TAX_RATE,
  at,
  itemById,
} from "../data/demo.ts";
import type { CartLine, Selection } from "../data/types.ts";
import {
  addLine,
  advanceAll,
  allDayCounts,
  atCap,
  cartTotals,
  elapsed,
  isComplete,
  isOpen,
  isPhoneish,
  lineKey,
  lineTotal,
  liveOrders,
  nextOrderNumber,
  nextStatus,
  optionNames,
  optionsKey,
  ordersByStatus,
  pickupSlots,
  problems,
  replaceLine,
  setQty,
  toggleOption,
  unitPrice,
} from "./order.ts";

const byo = itemById("byo")!;
const grain = itemById("grain")!;
const knots = itemById("knots")!;

describe("the composite key", () => {
  it("is stable regardless of the order options were tapped in", () => {
    const a: Selection = { tops: ["pep", "mush"] };
    const b: Selection = { tops: ["mush", "pep"] };
    expect(optionsKey(a)).toBe(optionsKey(b));
  });

  it("sorts groups as well as options", () => {
    const a: Selection = { size: ["s13"], crust: ["thin"] };
    const b: Selection = { crust: ["thin"], size: ["s13"] };
    expect(optionsKey(a)).toBe(optionsKey(b));
  });

  it("ignores empty groups", () => {
    expect(optionsKey({ tops: [], size: ["s13"] })).toBe(optionsKey({ size: ["s13"] }));
  });

  it("is empty for an item with no options", () => {
    expect(optionsKey({})).toBe("");
  });

  it("includes the trimmed note", () => {
    expect(lineKey("byo", {}, "  extra crispy  ")).toBe(lineKey("byo", {}, "extra crispy"));
    expect(lineKey("byo", {}, "extra crispy")).not.toBe(lineKey("byo", {}, "well done"));
  });

  it("distinguishes different items with identical options", () => {
    expect(lineKey("marg", { size: ["s13"] }, "")).not.toBe(lineKey("sopp", { size: ["s13"] }, ""));
  });
});

describe("cart merging", () => {
  const sel: Selection = { size: ["s13"], crust: ["thin"], tops: ["pep"] };

  it("merges two identical lines into one", () => {
    let cart: CartLine[] = [];
    cart = addLine(cart, "byo", sel, "", 1);
    cart = addLine(cart, "byo", sel, "", 2);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
  });

  it("keeps a different topping as its own line", () => {
    let cart: CartLine[] = [];
    cart = addLine(cart, "byo", sel, "", 1);
    cart = addLine(cart, "byo", { ...sel, tops: ["mush"] }, "", 1);
    expect(cart).toHaveLength(2);
  });

  it("keeps a different NOTE as its own line", () => {
    let cart: CartLine[] = [];
    cart = addLine(cart, "byo", sel, "", 1);
    cart = addLine(cart, "byo", sel, "No cheese on half", 1);
    expect(cart).toHaveLength(2);
    expect(cart.map((l) => l.qty)).toEqual([1, 1]);
  });

  it("merges regardless of tap order", () => {
    let cart: CartLine[] = [];
    cart = addLine(cart, "byo", { tops: ["pep", "mush"] }, "", 1);
    cart = addLine(cart, "byo", { tops: ["mush", "pep"] }, "", 1);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it("removes a line when its quantity reaches zero", () => {
    let cart = addLine([], "knots", {}, "", 2);
    cart = setQty(cart, cart[0].key, 0);
    expect(cart).toEqual([]);
  });

  it("merges on edit when the edit makes two lines identical", () => {
    let cart: CartLine[] = [];
    cart = addLine(cart, "byo", { size: ["s10"] }, "", 1);
    cart = addLine(cart, "byo", { size: ["s13"] }, "", 1);
    expect(cart).toHaveLength(2);

    // Edit the 10″ up to 13″ — it should now merge into the existing line.
    cart = replaceLine(cart, cart[0].key, "byo", { size: ["s13"] }, "", 1);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });
});

describe("pricing", () => {
  it("adds every selected modifier delta to the base", () => {
    // 900 base + 400 (13″) + 0 (hand) + 150 + 150 (two toppings).
    expect(unitPrice(byo, { size: ["s13"], crust: ["hand"], tops: ["pep", "mush"] })).toBe(1600);
  });

  it("charges nothing extra for a zero-delta option", () => {
    expect(unitPrice(byo, { size: ["s10"], crust: ["hand"] })).toBe(900);
  });

  it("ignores an option id that does not belong to the item", () => {
    expect(unitPrice(knots, { tops: ["pep"] })).toBe(knots.price);
  });

  it("multiplies by quantity for the line total", () => {
    const cart = addLine([], "grain", { base: ["farro"], protein: ["chick"] }, "", 3);
    // 1150 + 0 + 300 = 1450, ×3.
    expect(lineTotal(cart[0], grain)).toBe(4350);
  });

  it("taxes the subtotal once and counts every unit", () => {
    let cart = addLine([], "knots", {}, "", 2); // 450 × 2 = 900
    cart = addLine(cart, "lemon", {}, "", 1); //   350
    const totals = cartTotals(cart, ITEMS, TAX_RATE);
    expect(totals.subtotal).toBe(1250);
    expect(totals.tax).toBe(100);
    expect(totals.total).toBe(1350);
    expect(totals.count).toBe(3);
  });

  it("returns zeroes for an empty cart rather than NaN", () => {
    expect(cartTotals([], ITEMS, TAX_RATE)).toEqual({
      subtotal: 0,
      tax: 0,
      total: 0,
      count: 0,
    });
  });
});

describe("modifier rules", () => {
  it("reports a required group that has not been chosen", () => {
    const found = problems(byo, {});
    expect(found.map((p) => p.group.id).sort()).toEqual(["crust", "size"]);
    expect(found.every((p) => p.kind === "tooFew")).toBe(true);
  });

  it("is complete once every required group is satisfied", () => {
    expect(isComplete(byo, { size: ["s13"], crust: ["hand"] })).toBe(true);
    expect(isComplete(grain, { base: ["farro"], protein: ["none"] })).toBe(true);
  });

  it("treats an optional group as satisfied when empty", () => {
    expect(problems(byo, { size: ["s13"], crust: ["hand"], tops: [] })).toEqual([]);
  });

  it("reports a group over its cap", () => {
    const over = { size: ["s13"], crust: ["hand"], tops: ["pep", "saus", "mush", "onion", "oliv", "pepr"] };
    expect(problems(byo, over).map((p) => p.kind)).toEqual(["tooMany"]);
  });

  it("knows when a check group is at its cap", () => {
    expect(atCap(MG_TOPS, { tops: ["pep", "saus", "mush", "onion", "oliv"] })).toBe(true);
    expect(atCap(MG_TOPS, { tops: ["pep"] })).toBe(false);
    expect(atCap(MG_EXTRAS, { extras: ["avo", "feta", "pkon"] })).toBe(true);
  });
});

describe("toggling options", () => {
  it("replaces the selection in a radio group", () => {
    let sel: Selection = {};
    sel = toggleOption(MG_SIZE, sel, "s10");
    sel = toggleOption(MG_SIZE, sel, "s16");
    expect(sel.size).toEqual(["s16"]);
  });

  it("accumulates in a check group", () => {
    let sel: Selection = {};
    sel = toggleOption(MG_TOPS, sel, "pep");
    sel = toggleOption(MG_TOPS, sel, "mush");
    expect(sel.tops).toEqual(["pep", "mush"]);
  });

  it("removes on a second tap in a check group", () => {
    let sel = toggleOption(MG_TOPS, {}, "pep");
    sel = toggleOption(MG_TOPS, sel, "pep");
    expect(sel.tops).toEqual([]);
  });

  it("refuses to add past the cap", () => {
    let sel: Selection = { tops: ["pep", "saus", "mush", "onion", "oliv"] };
    sel = toggleOption(MG_TOPS, sel, "basil");
    expect(sel.tops).toHaveLength(5);
  });

  it("still allows REMOVAL when at the cap", () => {
    let sel: Selection = { tops: ["pep", "saus", "mush", "onion", "oliv"] };
    sel = toggleOption(MG_TOPS, sel, "pep");
    expect(sel.tops).toEqual(["saus", "mush", "onion", "oliv"]);
  });

  it("does not disturb other groups", () => {
    const sel = toggleOption(MG_CRUST, { size: ["s13"] }, "thin");
    expect(sel.size).toEqual(["s13"]);
    expect(sel.crust).toEqual(["thin"]);
  });
});

describe("pickup slots", () => {
  it("starts no earlier than the first slot", () => {
    const slots = pickupSlots(at(11, 5), FIRST_SLOT, CLOSE_AT);
    expect(slots[0]).toBe(FIRST_SLOT);
  });

  it("never offers a slot that has already passed", () => {
    const slots = pickupSlots(at(14, 3), FIRST_SLOT, CLOSE_AT);
    expect(slots.every((s) => s > at(14, 3))).toBe(true);
  });

  it("respects the lead time and rounds up to the step", () => {
    // 14:03 + 20 min lead = 14:23 → rounds up to 14:30.
    expect(pickupSlots(at(14, 3), FIRST_SLOT, CLOSE_AT)[0]).toBe(at(14, 30));
  });

  it("steps in quarter hours", () => {
    const slots = pickupSlots(PINNED_NOW, FIRST_SLOT, CLOSE_AT);
    expect(slots[1] - slots[0]).toBe(15);
  });

  it("stops before closing", () => {
    const slots = pickupSlots(at(20, 30), FIRST_SLOT, CLOSE_AT);
    expect(slots.every((s) => s <= CLOSE_AT - 15)).toBe(true);
  });

  it("returns nothing once the kitchen is shut", () => {
    expect(pickupSlots(at(21, 30), FIRST_SLOT, CLOSE_AT)).toEqual([]);
  });

  it("knows whether the kitchen is open", () => {
    expect(isOpen(PINNED_NOW, OPEN_AT, CLOSE_AT)).toBe(true);
    expect(isOpen(at(9, 0), OPEN_AT, CLOSE_AT)).toBe(false);
    expect(isOpen(at(21, 0), OPEN_AT, CLOSE_AT)).toBe(false);
  });
});

describe("the status machine", () => {
  it("advances along the chain", () => {
    expect(nextStatus("placed")).toBe("confirmed");
    expect(nextStatus("confirmed")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("ready");
    expect(nextStatus("ready")).toBe("picked_up");
  });

  it("stops at picked up", () => {
    expect(nextStatus("picked_up")).toBe("picked_up");
  });

  it("advances every in-flight order one step on a clock tick", () => {
    const before = SEED_ORDERS.find((o) => o.num === 2117)!;
    const after = advanceAll(SEED_ORDERS, PINNED_NOW + 10).find((o) => o.num === 2117)!;
    expect(before.status).toBe("placed");
    expect(after.status).toBe("confirmed");
  });

  it("HOLDS at ready — only the kitchen clears an order", () => {
    const ready = SEED_ORDERS.find((o) => o.num === 2113)!;
    expect(ready.status).toBe("ready");
    const after = advanceAll(SEED_ORDERS, PINNED_NOW + 10).find((o) => o.num === 2113)!;
    expect(after.status).toBe("ready");
  });

  it("leaves picked-up orders alone", () => {
    const after = advanceAll(SEED_ORDERS, PINNED_NOW + 10);
    expect(after.filter((o) => o.status === "picked_up")).toHaveLength(7);
  });

  it("never reports a negative elapsed time", () => {
    const order = SEED_ORDERS[0];
    expect(elapsed(order, order.placedAt - 30)).toBe(0);
  });
});

describe("the kitchen board", () => {
  it("shows every order that has not been handed over", () => {
    expect(liveOrders(SEED_ORDERS)).toHaveLength(5);
  });

  it("populates all four working columns from the seed", () => {
    for (const status of ["placed", "confirmed", "preparing", "ready"] as const) {
      expect(ordersByStatus(SEED_ORDERS, status).length).toBeGreaterThan(0);
    }
  });

  it("orders a column oldest first", () => {
    const preparing = ordersByStatus(SEED_ORDERS, "preparing");
    expect(preparing.map((o) => o.placedAt)).toEqual(
      [...preparing.map((o) => o.placedAt)].sort((a, b) => a - b),
    );
  });

  it("aggregates the all-day strip from live orders only", () => {
    const counts = allDayCounts(SEED_ORDERS, ITEMS);
    expect(counts.length).toBeGreaterThan(0);
    // Descending by count.
    expect(counts.map((c) => c.count)).toEqual(
      [...counts.map((c) => c.count)].sort((a, b) => b - a),
    );
    // The two picked-up margheritas must not be counted.
    const marg = counts.find((c) => c.item.id === "marg");
    expect(marg?.count).toBe(2);
  });

  it("mints the next order number above the highest seeded one", () => {
    expect(nextOrderNumber(SEED_ORDERS, 2118)).toBe(2118);
    const withHigher = [...SEED_ORDERS, { ...SEED_ORDERS[0], num: 2200 }];
    expect(nextOrderNumber(withHigher, 2118)).toBe(2201);
  });
});

describe("summaries and validation", () => {
  it("lists option names in the item's own group order", () => {
    const names = optionNames(byo, { tops: ["mush"], crust: ["thin"], size: ["s16"] });
    // MG_SIZE, MG_CRUST, MG_TOPS is the item's declared order.
    expect(names).toEqual(["data.opt.s16", "data.opt.thin", "data.opt.mushroom"]);
  });

  it("returns nothing for an item with no options chosen", () => {
    expect(optionNames(knots, {})).toEqual([]);
  });

  it("accepts a plausible mobile number and refuses a short one", () => {
    expect(isPhoneish("0161 884 7723")).toBe(true);
    expect(isPhoneish("12")).toBe(false);
  });
});
