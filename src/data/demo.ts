/**
 * Seeded demo data — Juniper Kitchen, a fictional fast-casual restaurant
 * serving bowls and pizza. Pickup only.
 *
 * Eighteen items across five categories, two of them deliberately
 * modifier-heavy (the build-your-own pizza and the grain bowl) so the item
 * sheet's min/max rules have something real to enforce. Five live orders are
 * spread across the four working statuses so the kitchen board and the all-day
 * strip both read mid-service on load, plus seven picked-up morning orders
 * that give the numbering real history.
 *
 * Money is INTEGER CENTS. Times are MINUTES SINCE MIDNIGHT.
 */

import type { Category, Item, ModifierGroup, Order, Selection } from "./types.ts";

/** Minutes since midnight, from a wall-clock hour and minute. */
export const at = (h: number, m: number): number => h * 60 + m;

/** The pinned clock: Tuesday 28 July 2026, 11:40. Nothing reads `Date.now()`. */
export const PINNED_NOW = at(11, 40);
export const OPEN_AT = at(11, 0);
export const CLOSE_AT = at(21, 0);
export const FIRST_SLOT = at(12, 0);
export const SLOT_STEP = 15;
/** Each tap of the dock's chip moves the clock this far. */
export const CLOCK_STEP = 10;

export const TAX_RATE = 8;

/** The pinned calendar date, for the header line only. */
export const PINNED_DATE = new Date(Date.UTC(2026, 6, 28));

export const CATEGORIES: Category[] = [
  { id: "bowls", name: "data.cat.bowls", icon: "salad", tint: "--ft-bowl" },
  { id: "pizza", name: "data.cat.pizza", icon: "pizza", tint: "--ft-pizza" },
  { id: "sides", name: "data.cat.sides", icon: "soup", tint: "--ft-side" },
  { id: "drinks", name: "data.cat.drinks", icon: "cup-soda", tint: "--ft-drink" },
  { id: "sweets", name: "data.cat.sweets", icon: "cookie", tint: "--ft-sweet" },
];

const G = (
  id: string,
  name: string,
  type: "radio" | "check",
  min: number,
  max: number,
  hint: string,
  options: { id: string; name: string; delta: number }[],
): ModifierGroup => ({ id, name, type, min, max, hint, options });

export const MG_BASE = G("base", "data.mod.base", "radio", 1, 1, "data.hint.pickOne", [
  { id: "farro", name: "data.opt.farro", delta: 0 },
  { id: "rice", name: "data.opt.rice", delta: 0 },
  { id: "greens", name: "data.opt.greens", delta: 0 },
]);

export const MG_PROTEIN = G("protein", "data.mod.protein", "radio", 1, 1, "data.hint.pickOne", [
  { id: "none", name: "data.opt.noProtein", delta: 0 },
  { id: "chick", name: "data.opt.chicken", delta: 300 },
  { id: "tofu", name: "data.opt.tofu", delta: 300 },
  { id: "pork", name: "data.opt.pork", delta: 350 },
]);

export const MG_EXTRAS = G("extras", "data.mod.extras", "check", 0, 3, "data.hint.upTo3", [
  { id: "avo", name: "data.opt.avocado", delta: 200 },
  { id: "feta", name: "data.opt.feta", delta: 150 },
  { id: "pkon", name: "data.opt.pickledOnion", delta: 75 },
  { id: "seeds", name: "data.opt.seeds", delta: 100 },
  { id: "tah", name: "data.opt.tahini", delta: 50 },
]);

export const MG_HEAT = G("heat", "data.mod.heat", "radio", 1, 1, "data.hint.pickOne", [
  { id: "mild", name: "data.opt.mild", delta: 0 },
  { id: "med", name: "data.opt.medium", delta: 0 },
  { id: "hot", name: "data.opt.hot", delta: 0 },
]);

export const MG_SIZE = G("size", "data.mod.size", "radio", 1, 1, "data.hint.pickOne", [
  { id: "s10", name: "data.opt.s10", delta: 0 },
  { id: "s13", name: "data.opt.s13", delta: 400 },
  { id: "s16", name: "data.opt.s16", delta: 700 },
]);

export const MG_CRUST = G("crust", "data.mod.crust", "radio", 1, 1, "data.hint.pickOne", [
  { id: "hand", name: "data.opt.handTossed", delta: 0 },
  { id: "thin", name: "data.opt.thin", delta: 0 },
  { id: "gf", name: "data.opt.gf", delta: 200 },
]);

export const MG_TOPS = G("tops", "data.mod.tops", "check", 0, 5, "data.hint.upTo5", [
  { id: "pep", name: "data.opt.pepperoni", delta: 150 },
  { id: "saus", name: "data.opt.sausage", delta: 150 },
  { id: "mush", name: "data.opt.mushroom", delta: 150 },
  { id: "onion", name: "data.opt.redOnion", delta: 150 },
  { id: "oliv", name: "data.opt.olives", delta: 150 },
  { id: "pepr", name: "data.opt.peppers", delta: 150 },
  { id: "basil", name: "data.opt.basil", delta: 150 },
  { id: "honey", name: "data.opt.hotHoney", delta: 150 },
]);

export const MG_DIP = G("dip", "data.mod.dip", "check", 0, 2, "data.hint.upTo2", [
  { id: "aioli", name: "data.opt.aioli", delta: 50 },
  { id: "cket", name: "data.opt.ketchup", delta: 50 },
]);

export const ITEMS: Item[] = [
  { id: "grain", cat: "bowls", name: "data.item.grain", short: "data.short.grain", desc: "data.desc.grain", price: 1150, icon: "salad", file: "grain-bowl.jpg", tags: ["V"], mods: [MG_BASE, MG_PROTEIN, MG_EXTRAS], feat: true },
  { id: "goddess", cat: "bowls", name: "data.item.goddess", short: "data.short.goddess", desc: "data.desc.goddess", price: 1075, icon: "leafy-green", file: "green-goddess.jpg", tags: ["V"], mods: [MG_PROTEIN] },
  { id: "sesame", cat: "bowls", name: "data.item.sesame", short: "data.short.sesame", desc: "data.desc.sesame", price: 1125, icon: "soup", file: "sesame-noodle.jpg", tags: ["Spicy"], mods: [MG_PROTEIN, MG_HEAT] },
  { id: "citrus", cat: "bowls", name: "data.item.citrus", short: "data.short.citrus", desc: "data.desc.citrus", price: 1200, icon: "citrus", file: "chili-citrus.jpg", tags: ["V", "Spicy"], mods: [MG_PROTEIN] },
  { id: "byo", cat: "pizza", name: "data.item.byo", short: "data.short.byo", desc: "data.desc.byo", price: 900, icon: "pizza", file: "build-your-own.jpg", tags: [], mods: [MG_SIZE, MG_CRUST, MG_TOPS], feat: true },
  { id: "marg", cat: "pizza", name: "data.item.marg", short: "data.short.marg", desc: "data.desc.marg", price: 1050, icon: "pizza", file: "margherita.jpg", tags: ["V"], mods: [MG_SIZE, MG_CRUST] },
  { id: "sopp", cat: "pizza", name: "data.item.sopp", short: "data.short.sopp", desc: "data.desc.sopp", price: 1250, icon: "flame", file: "hot-soppressata.jpg", tags: ["Spicy"], mods: [MG_SIZE], feat: true },
  { id: "mush", cat: "pizza", name: "data.item.mush", short: "data.short.mush", desc: "data.desc.mush", price: 1175, icon: "pizza", file: "mushroom-thyme.jpg", tags: ["V"], mods: [MG_SIZE] },
  { id: "white", cat: "pizza", name: "data.item.white", short: "data.short.white", desc: "data.desc.white", price: 1125, icon: "pizza", file: "white-pie.jpg", tags: ["V"], soldOut: true, mods: [MG_SIZE] },
  { id: "knots", cat: "sides", name: "data.item.knots", short: "data.short.knots", desc: "data.desc.knots", price: 450, icon: "croissant", file: "garlic-knots.jpg", tags: [], mods: [] },
  { id: "brocc", cat: "sides", name: "data.item.brocc", short: "data.short.brocc", desc: "data.desc.brocc", price: 500, icon: "sprout", file: "broccolini.jpg", tags: ["V"], mods: [] },
  { id: "fries", cat: "sides", name: "data.item.fries", short: "data.short.fries", desc: "data.desc.fries", price: 425, icon: "utensils-crossed", file: "rosemary-fries.jpg", tags: ["V"], mods: [MG_DIP] },
  { id: "caesar", cat: "sides", name: "data.item.caesar", short: "data.short.caesar", desc: "data.desc.caesar", price: 600, icon: "salad", file: "gem-caesar.jpg", tags: [], mods: [] },
  { id: "lemon", cat: "drinks", name: "data.item.lemon", short: "data.short.lemon", desc: "data.desc.lemon", price: 350, icon: "citrus", file: "lemonade.jpg", tags: ["V"], mods: [] },
  { id: "tea", cat: "drinks", name: "data.item.tea", short: "data.short.tea", desc: "data.desc.tea", price: 350, icon: "cup-soda", file: "hibiscus-tea.jpg", tags: ["V"], mods: [] },
  { id: "spark", cat: "drinks", name: "data.item.spark", short: "data.short.spark", desc: "data.desc.spark", price: 275, icon: "glass-water", file: "sparkling.jpg", tags: [], mods: [] },
  { id: "cheese", cat: "sweets", name: "data.item.cheese", short: "data.short.cheese", desc: "data.desc.cheese", price: 550, icon: "cake-slice", file: "cheesecake.jpg", tags: ["V"], mods: [], feat: true },
  { id: "cookie", cat: "sweets", name: "data.item.cookie", short: "data.short.cookie", desc: "data.desc.cookie", price: 325, icon: "cookie", file: "chunk-cookie.jpg", tags: ["V"], mods: [] },
];

/** Build a seeded cart line, computing its composite key the same way the cart does. */
function line(item: string, selection: Selection, note: string, qty: number) {
  const groups = Object.keys(selection)
    .filter((g) => (selection[g] ?? []).length > 0)
    .sort();
  const key = `${item}|${groups
    .map((g) => `${g}:${[...(selection[g] ?? [])].sort().join("+")}`)
    .join(";")}|${note.trim()}`;
  return { key, item, selection, note: note.trim(), qty };
}

function order(
  num: number,
  customer: string,
  status: Order["status"],
  placedAt: number,
  statusAt: number,
  pickupAt: number,
  lines: Order["lines"],
  note = "",
): Order {
  return { num, customer, status, placedAt, statusAt, pickupAt, lines, note };
}

/**
 * Seven picked-up morning orders and five live ones. The live five sit across
 * placed / confirmed / preparing / ready, so all four kitchen columns have
 * something in them the moment the board loads.
 */
export const SEED_ORDERS: Order[] = [
  order(2106, "Alba R.", "picked_up", 662, 686, 690, [line("marg", { size: ["s13"], crust: ["hand"] }, "", 1), line("lemon", {}, "", 1)]),
  order(2107, "Theo M.", "picked_up", 665, 690, 705, [line("byo", { size: ["s13"], crust: ["thin"], tops: ["pep", "mush"] }, "", 1), line("knots", {}, "", 1)]),
  order(2108, "June P.", "picked_up", 668, 694, 705, [line("grain", { base: ["farro"], protein: ["tofu"] }, "", 1), line("tea", {}, "", 1)]),
  order(2109, "Omar D.", "picked_up", 671, 697, 705, [line("marg", { size: ["s10"], crust: ["hand"] }, "", 2), line("cookie", {}, "", 2)]),
  order(2110, "Isa K.", "picked_up", 674, 700, 720, [line("byo", { size: ["s16"], crust: ["hand"], tops: ["saus", "onion", "honey"] }, "", 1)]),
  order(2111, "Ren S.", "picked_up", 678, 702, 720, [line("grain", { base: ["rice"], protein: ["chick"] }, "", 1), line("fries", { dip: ["aioli"] }, "", 1)]),
  order(2112, "Mia T.", "picked_up", 682, 706, 720, [line("marg", { size: ["s13"], crust: ["thin"] }, "", 1), line("brocc", {}, "", 1)]),

  /* The live board at 11:40. */
  order(2113, "Nora W.", "ready", 668, 694, 705, [line("marg", { size: ["s13"], crust: ["hand"] }, "", 1), line("knots", {}, "", 1)]),
  order(2114, "Dev P.", "preparing", 682, 691, 720, [line("byo", { size: ["s16"], crust: ["thin"], tops: ["pep", "mush", "honey"] }, "data.note.squares", 1), line("lemon", {}, "", 2)], "data.note.squares"),
  order(2115, "Marisol G.", "preparing", 688, 695, 720, [line("grain", { base: ["farro"], protein: ["chick"], extras: ["avo", "pkon"] }, "", 2)]),
  order(2116, "Kenji T.", "confirmed", 691, 693, 735, [line("marg", { size: ["s10"], crust: ["hand"] }, "", 1), line("sesame", { protein: ["tofu"], heat: ["med"] }, "", 1), line("cookie", {}, "", 1)]),
  order(2117, "Tamar B.", "placed", 696, 696, 735, [line("sopp", { size: ["s13"] }, "", 1), line("fries", { dip: ["aioli"] }, "", 1), line("tea", {}, "", 1)]),
];

/** Seeds end at #2117, so the first live checkout takes #2118 — the house gag. */
export const FIRST_LIVE_NUMBER = 2118;

export function itemById(id: string): Item | undefined {
  return ITEMS.find((i) => i.id === id);
}

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
