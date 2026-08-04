/**
 * The ordering engine.
 *
 * The load-bearing idea is the CART LINE'S IDENTITY: a line is identified by
 * the composite key `item | options | note`. Two lines merge into one only
 * when all three match; any difference — a different topping, a different
 * note, even different whitespace-trimmed text — makes a separate line. That
 * is what stops "no onions" being silently merged into somebody else's pizza.
 *
 * Money is INTEGER CENTS throughout. Times are MINUTES SINCE MIDNIGHT, which
 * is what makes the pickup-slot arithmetic plain integer maths and keeps the
 * demo clock a single number.
 *
 * Pure and React-free; `now` is always a parameter.
 */

import type {
  CartLine,
  Item,
  ModifierGroup,
  Order,
  OrderStatus,
  Selection,
} from "../data/types.ts";

/* ------------------------------------------------------- the composite key */

/**
 * A canonical string for one selection map.
 *
 * Group ids and option ids are BOTH sorted, so `{tops:[a,b]}` and
 * `{tops:[b,a]}` produce the same key — the reader picked the same pizza, and
 * the order they tapped the toppings in is not part of what they ordered.
 */
export function optionsKey(selection: Selection): string {
  const groups = Object.keys(selection)
    .filter((g) => (selection[g] ?? []).length > 0)
    .sort();
  return groups
    .map((g) => `${g}:${[...(selection[g] ?? [])].sort().join("+")}`)
    .join(";");
}

/** The full line identity: item, options and the trimmed note. */
export function lineKey(itemId: string, selection: Selection, note: string): string {
  return `${itemId}|${optionsKey(selection)}|${note.trim()}`;
}

/* -------------------------------------------------------------- line price */

export function findOption(item: Item, groupId: string, optionId: string) {
  for (const group of item.mods) {
    if (group.id !== groupId) continue;
    const hit = group.options.find((o) => o.id === optionId);
    if (hit !== undefined) return hit;
  }
  return null;
}

/** Per-unit price: the base price plus every selected modifier's delta. */
export function unitPrice(item: Item, selection: Selection): number {
  let price = item.price;
  for (const [groupId, optionIds] of Object.entries(selection)) {
    for (const optionId of optionIds ?? []) {
      const option = findOption(item, groupId, optionId);
      if (option !== null) price += option.delta;
    }
  }
  return price;
}

export function lineTotal(line: CartLine, item: Item): number {
  return unitPrice(item, line.selection) * line.qty;
}

/* -------------------------------------------------------------- validation */

export interface GroupProblem {
  group: ModifierGroup;
  /** Which rule the current selection breaks. */
  kind: "tooFew" | "tooMany";
}

/**
 * Which modifier groups are not satisfied.
 *
 * Returns the offending GROUPS rather than a boolean, so the item sheet can
 * name the problem in plain language ("Choose a base.") instead of showing a
 * disabled button with no explanation.
 */
export function problems(item: Item, selection: Selection): GroupProblem[] {
  const out: GroupProblem[] = [];
  for (const group of item.mods) {
    const chosen = (selection[group.id] ?? []).length;
    if (chosen < group.min) out.push({ group, kind: "tooFew" });
    else if (chosen > group.max) out.push({ group, kind: "tooMany" });
  }
  return out;
}

export function isComplete(item: Item, selection: Selection): boolean {
  return problems(item, selection).length === 0;
}

/** True when a check-type group is at its cap, so the rest can disable. */
export function atCap(group: ModifierGroup, selection: Selection): boolean {
  return (selection[group.id] ?? []).length >= group.max;
}

/**
 * Toggle one option, respecting the group's own type.
 *
 * A `radio` group replaces; a `check` group adds until the cap and always
 * allows removal — a reader at the cap must still be able to change their
 * mind without clearing the whole group first.
 */
export function toggleOption(
  group: ModifierGroup,
  selection: Selection,
  optionId: string,
): Selection {
  const current = selection[group.id] ?? [];

  if (group.type === "radio") {
    return { ...selection, [group.id]: [optionId] };
  }

  if (current.includes(optionId)) {
    return { ...selection, [group.id]: current.filter((id) => id !== optionId) };
  }
  if (current.length >= group.max) return selection;
  return { ...selection, [group.id]: [...current, optionId] };
}

/** The selection a sheet opens with: required radio groups pre-pick nothing. */
export function emptySelection(): Selection {
  return {};
}

/* -------------------------------------------------------------------- cart */

/**
 * Add a line, merging into an existing one ONLY when the composite key
 * matches. Returns a new array — the store never mutates in place.
 */
export function addLine(
  cart: CartLine[],
  itemId: string,
  selection: Selection,
  note: string,
  qty: number,
): CartLine[] {
  const key = lineKey(itemId, selection, note);
  const existing = cart.find((l) => l.key === key);

  if (existing !== undefined) {
    return cart.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
  }

  return [
    ...cart,
    { key, item: itemId, selection: { ...selection }, note: note.trim(), qty },
  ];
}

/** Change a line's quantity; zero or less removes it. */
export function setQty(cart: CartLine[], key: string, qty: number): CartLine[] {
  if (qty <= 0) return cart.filter((l) => l.key !== key);
  return cart.map((l) => (l.key === key ? { ...l, qty } : l));
}

/**
 * Replace a line after an edit. The key is recomputed, so an edit that makes
 * the line identical to another one MERGES rather than creating a duplicate.
 */
export function replaceLine(
  cart: CartLine[],
  oldKey: string,
  itemId: string,
  selection: Selection,
  note: string,
  qty: number,
): CartLine[] {
  const without = cart.filter((l) => l.key !== oldKey);
  return addLine(without, itemId, selection, note, qty);
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
  /** Total number of individual items, for the header badge. */
  count: number;
}

/** Tax applies to the rounded subtotal, once — same rule as any till. */
export function cartTotals(
  cart: CartLine[],
  items: Item[],
  taxRate: number,
): CartTotals {
  const byId = new Map(items.map((i) => [i.id, i]));
  let subtotal = 0;
  let count = 0;

  for (const line of cart) {
    const item = byId.get(line.item);
    if (item === undefined) continue;
    subtotal += lineTotal(line, item);
    count += line.qty;
  }

  const tax = Math.round((subtotal * taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax, count };
}

/* ------------------------------------------------------------ pickup slots */

/**
 * Pickup times, every `step` minutes, from the later of `firstSlot` and the
 * current clock rounded up, until the kitchen closes.
 *
 * A slot in the past is not offered at all rather than being offered and then
 * refused — the two are very different experiences at 11:59.
 */
export function pickupSlots(
  now: number,
  firstSlot: number,
  closeAt: number,
  step = 15,
  leadMinutes = 20,
): number[] {
  const earliest = Math.max(firstSlot, Math.ceil((now + leadMinutes) / step) * step);
  const slots: number[] = [];
  for (let t = earliest; t <= closeAt - step; t += step) slots.push(t);
  return slots;
}

/** Whether the kitchen is taking orders at `now`. */
export function isOpen(now: number, openAt: number, closeAt: number): boolean {
  return now >= openAt && now < closeAt;
}

/* ------------------------------------------------------------ order status */

/** The status chain, in order. `picked_up` is terminal. */
export const STATUS_CHAIN: OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "picked_up",
];

export function nextStatus(status: OrderStatus): OrderStatus {
  const i = STATUS_CHAIN.indexOf(status);
  if (i === -1 || i === STATUS_CHAIN.length - 1) return status;
  return STATUS_CHAIN[i + 1];
}

export function statusIndex(status: OrderStatus): number {
  return Math.max(0, STATUS_CHAIN.indexOf(status));
}

/**
 * Advance every in-flight order one step, as the dock's "+10 min" chip does.
 *
 * Orders STOP at `ready`: only the Kitchen can clear an order to `picked_up`,
 * because in a real shop only a person handing over a bag knows that happened.
 */
export function advanceAll(orders: Order[], now: number): Order[] {
  return orders.map((order) => {
    if (order.status === "ready" || order.status === "picked_up") return order;
    const next = nextStatus(order.status);
    return { ...order, status: next, statusAt: now };
  });
}

/** Minutes an order has been on the board. Never negative. */
export function elapsed(order: Order, now: number): number {
  return Math.max(0, now - order.placedAt);
}

/** Orders on the kitchen board — everything not yet handed over. */
export function liveOrders(orders: Order[]): Order[] {
  return orders.filter((o) => o.status !== "picked_up");
}

export function ordersByStatus(orders: Order[], status: OrderStatus): Order[] {
  return orders
    .filter((o) => o.status === status)
    .sort((a, b) => a.placedAt - b.placedAt);
}

/**
 * The all-day aggregate: how many of each item are on the live board, most
 * first. This is the strip a kitchen actually reads before it reads any card.
 */
export function allDayCounts(
  orders: Order[],
  items: Item[],
): { item: Item; count: number }[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const counts = new Map<string, number>();

  for (const order of liveOrders(orders)) {
    for (const line of order.lines) {
      counts.set(line.item, (counts.get(line.item) ?? 0) + line.qty);
    }
  }

  return [...counts.entries()]
    .flatMap(([id, count]) => {
      const item = byId.get(id);
      return item === undefined ? [] : [{ item, count }];
    })
    .sort((a, b) => b.count - a.count || a.item.id.localeCompare(b.item.id));
}

/** Mint the next order number from the highest already issued. */
export function nextOrderNumber(orders: Order[], floor: number): number {
  return Math.max(floor, ...orders.map((o) => o.num + 1));
}

/* --------------------------------------------------------------- summaries */

/**
 * A human summary of one line's options, in the item's own group order —
 * not the order the reader happened to tap them in.
 */
export function optionNames(item: Item, selection: Selection): string[] {
  const out: string[] = [];
  for (const group of item.mods) {
    for (const optionId of selection[group.id] ?? []) {
      const option = group.options.find((o) => o.id === optionId);
      if (option !== undefined) out.push(option.name);
    }
  }
  return out;
}

/* ------------------------------------------------------------- validation */

/** A mobile number is "enough digits", not a format — this is a demo, not a carrier. */
export function isPhoneish(value: string): boolean {
  return value.replace(/\D/g, "").length >= 7;
}

export function isNameish(value: string): boolean {
  return value.trim().length >= 2;
}
