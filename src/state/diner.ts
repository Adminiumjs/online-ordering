/**
 * The diner's side: what the kitchen lets out (its settings, menu, hours,
 * closures and the slots and portions of today and tomorrow), the cart, the
 * pickup time, Adminium's price for the order, and placing it.
 *
 * Nothing here decides a price, a total, a free time or a sold-out dish:
 * those are Adminium's answers (`quote()` is its dry run, `place()` the
 * order itself), and a refusal is turned into what the page says about it —
 * a line to fix, a time to pick again, a changed price to accept.
 */
import { create } from "zustand";

import type { OrderBody, QuoteReply, Row, SlotTime, DishState, Id } from "../data/wire.ts";
import { ApiError, isApiError, refusedLine } from "../data/wire.ts";
import { sources } from "../data/sources.ts";
import { menuModel, type MenuModel } from "../lib/menu.ts";
import { addDays, instantOf, venueDay, venueMinutes, type Day } from "../lib/venueTime.ts";
import { hoursOn, offeredSlots, type Slot } from "../lib/day.ts";

export interface CartLine {
  /** One line per dish, options and note: the same three merge into one line. */
  key: string;
  dishId: Id;
  qty: number;
  options: Id[];
  note: string;
}

export interface Sheet {
  dishId: Id;
  /** The cart line being changed, or null for a new one. */
  editKey: string | null;
  options: Id[];
  note: string;
  qty: number;
}

/** What a refused order says about one of its lines. */
export type LineAlert =
  | { kind: "soldout"; day: Day }
  | { kind: "short"; left: number; day: Day }
  | { kind: "gone"; name: string; dish: boolean };

export type PlaceError = "stopped" | "toomany" | "offline" | "limit" | "busy" | "failed";

/** Why the chosen time went: it filled, it is too soon now, it was paused, the day closed. */
export type SlotNotice = { time: string; day: Day; reason: "full" | "too-soon" | "paused" | "closed" };

export interface Placed {
  id: Id;
  number: string;
  /** The order's own link code, or null when the reply was a replay (it is in the email). */
  token: string | null;
  email: string;
  name: string;
  pickupAt: string;
  total: number;
  replayed: boolean;
}

interface Loaded {
  zone: string;
  currency: string;
  settings: Row;
  menu: MenuModel;
  hours: Row[];
  closures: Row[];
}

interface DinerState {
  load: "busy" | "ok" | "err";
  data: Loaded | null;
  slots: Record<Day, SlotTime[] | undefined>;
  dishes: Record<Day, DishState[] | undefined>;
  cart: CartLine[];
  /** The chosen pickup: a day and a time, kept until the diner picks another (never changed by itself). */
  pick: { day: Day; time: string } | null;
  /** Which day the picker shows. */
  pickDay: "today" | "tomorrow";
  sheet: Sheet | null;
  drawer: boolean;
  quote: { key: string; state: "busy" | "ok" | "err"; reply: QuoteReply | null } | null;
  alerts: Record<string, LineAlert>;
  form: { name: string; email: string; phone: string; note: string };
  touched: Partial<Record<"name" | "email" | "phone", boolean>>;
  placing: boolean;
  placeError: PlaceError | null;
  /** Kept from the first press until an answer: a retry lands on the same order. */
  clientKey: string | null;
  priceChanged: { lines: { name: string; from: number; to: number }[]; total: number } | null;
  soldOut: { dishId: Id; short: boolean; left: number | null; day: Day } | null;
  slotNotice: SlotNotice | null;
  placed: Placed | null;
}

const CART_KEY = "online-ordering-cart";

function storedCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw === null ? [] : (JSON.parse(raw) as unknown);
    return Array.isArray(parsed) ? (parsed as CartLine[]).filter((l) => typeof l.key === "string" && typeof l.dishId === "number") : [];
  } catch {
    return [];
  }
}

export const useDiner = create<DinerState>(() => ({
  load: "busy",
  data: null,
  slots: {},
  dishes: {},
  cart: storedCart(),
  pick: null,
  pickDay: "today",
  sheet: null,
  drawer: false,
  quote: null,
  alerts: {},
  form: { name: "", email: "", phone: "", note: "" },
  touched: {},
  placing: false,
  placeError: null,
  clientKey: null,
  priceChanged: null,
  soldOut: null,
  slotNotice: null,
  placed: null,
}));

useDiner.subscribe((state, before) => {
  if (state.cart === before.cart) return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch {
    // Not kept across a reload; still there now.
  }
});

const get = useDiner.getState;
const set = useDiner.setState;
const port = () => sources().diner;

// ── the kitchen's clock and days ────────────────────────────────────────────

export function zoneOf(): string {
  return get().data?.zone ?? sources().zone;
}
export const todayOf = (now: number): Day => venueDay(now, zoneOf());
export const minutesOf = (now: number): number => venueMinutes(now, zoneOf());

/** Minutes of notice a diner must give, and minutes per slot. */
export function rulesOf(): { notice: number; slot: number; prep: number; maxItems: number; preorderDays: number; online: boolean } {
  const s: Row = get().data?.settings ?? { id: 0 };
  return {
    notice: Number(s["lead_minutes"] ?? 20),
    slot: Number(s["slot_minutes"] ?? 15),
    prep: Number(s["prep_minutes"] ?? 15),
    maxItems: Number(s["max_items"] ?? 12),
    preorderDays: Number(s["preorder_days"] ?? 1),
    online: s["online_on"] !== false,
  };
}

/** The times offered on a day, as the picker shows them. */
export function slotsOn(day: Day, now: number): Slot[] {
  const answer = get().slots[day];
  if (answer === undefined) return [];
  return offeredSlots(day, answer, todayOf(now), minutesOf(now), rulesOf().notice);
}

/** The day the diner is ordering for: today while it has a free time, else tomorrow when that is open and in reach. */
export function activeDay(now: number): Day {
  const today = todayOf(now);
  const tomorrow = addDays(today, 1);
  const todayFree = slotsOn(today, now).some((s) => !s.off);
  const tomorrowOpen = tomorrowOpenFor(now);
  if (!todayFree) return tomorrowOpen ? tomorrow : today;
  return get().pickDay === "tomorrow" && tomorrowOpen ? tomorrow : today;
}

export function tomorrowOpenFor(now: number): boolean {
  const d = get().data;
  if (d === null || rulesOf().preorderDays < 1) return false;
  return hoursOn(addDays(todayOf(now), 1), d.hours, d.closures).open;
}

/** The chosen time, while it is still offered and free. */
export function validPick(now: number): { day: Day; time: string } | null {
  const pick = get().pick;
  if (pick === null) return null;
  const offered = slotsOn(pick.day, now).find((s) => s.time === pick.time);
  return offered !== undefined && !offered.off ? pick : null;
}

// ── loading ─────────────────────────────────────────────────────────────────

/** Reads what the page shows: the kitchen, its menu, hours and closures, then today's and tomorrow's slots and portions. */
export async function loadDiner(): Promise<void> {
  set({ load: "busy" });
  try {
    const p = port();
    const [config, settings, menu, hours, closures] = await Promise.all([p.config(), p.settings(), p.menu(), p.hours(), p.closures()]);
    set({ data: { zone: config.timezone, currency: config.currency ?? sources().currency, settings, menu: menuModel(menu), hours, closures } });
    await refreshAvailability(sources().clock.now());
    set({ load: "ok" });
  } catch {
    set({ load: "err" });
  }
}

/** The slots and portions of today and tomorrow, again (after an order, a refusal, the clock moving). */
export async function refreshAvailability(now: number): Promise<void> {
  const today = todayOf(now);
  const days = [today, addDays(today, 1)];
  const p = port();
  const [slots, dishes] = await Promise.all([Promise.all(days.map((d) => p.slots(d))), Promise.all(days.map((d) => p.dishes(d)))]);
  set({ slots: Object.fromEntries(days.map((d, i) => [d, slots[i]])), dishes: Object.fromEntries(days.map((d, i) => [d, dishes[i]])) });
  preselect(now);
}

/** Everything again: the settings may have changed (online orders switched off), the menu too. */
export async function reloadAll(): Promise<void> {
  const p = port();
  try {
    const [settings, menu, closures] = await Promise.all([p.settings(), p.menu(), p.closures()]);
    const d = get().data;
    if (d !== null) set({ data: { ...d, settings, menu: menuModel(menu), closures } });
    await refreshAvailability(sources().clock.now());
  } catch {
    // The page keeps what it had; the next action reads again.
  }
}

/** The first visit's time: the earliest free one of the day being ordered for. Never changes a chosen one. */
function preselect(now: number): void {
  if (get().pick !== null) return;
  const day = activeDay(now);
  const first = slotsOn(day, now).find((s) => !s.off);
  if (first !== undefined) set({ pick: { day: first.day, time: first.time } });
}

// ── the cart ────────────────────────────────────────────────────────────────

export const lineKey = (dishId: Id, options: readonly Id[], note: string): string => `${String(dishId)}|${[...options].sort((a, b) => a - b).join(",")}|${note.trim()}`;

export const cartCount = (cart: readonly CartLine[]): number => cart.reduce((n, l) => n + l.qty, 0);

function setCart(cart: CartLine[]): void {
  const alerts = Object.fromEntries(Object.entries(get().alerts).filter(([key]) => cart.some((l) => l.key === key)));
  set({ cart, alerts, placeError: null });
  scheduleQuote();
}

export function openSheet(dishId: Id, editKey: string | null = null): void {
  const line = editKey === null ? undefined : get().cart.find((l) => l.key === editKey);
  const menu = get().data?.menu;
  const offered = (id: Id) => menu?.option(id)?.available !== false;
  set({ sheet: { dishId, editKey, options: line?.options.filter(offered) ?? [], note: line?.note ?? "", qty: line?.qty ?? 1 }, drawer: false });
}

export function closeSheet(): void {
  set({ sheet: null });
}

/** Picks or unpicks an option: one of a pick-one group; up to a group's most, where the chosen stay removable. */
export function toggleOption(groupId: Id, optionId: Id): void {
  const sheet = get().sheet;
  const group = get().data?.menu.dish(sheet?.dishId ?? -1)?.groups.find((g) => g.id === groupId);
  if (sheet === null || group === undefined) return;
  const inGroup = sheet.options.filter((id) => group.options.some((o) => o.id === id));
  const others = sheet.options.filter((id) => !inGroup.includes(id));
  let next: Id[];
  // A pick-one the diner must answer is a radio: a second tap keeps it.
  if (group.one) next = inGroup.includes(optionId) ? (group.min >= 1 ? inGroup : []) : [optionId];
  else if (inGroup.includes(optionId)) next = inGroup.filter((id) => id !== optionId);
  else if (inGroup.length >= group.max) return;
  else next = [...inGroup, optionId];
  set({ sheet: { ...sheet, options: [...others, ...next] } });
}

export function setSheet(patch: Partial<Pick<Sheet, "note" | "qty">>): void {
  const sheet = get().sheet;
  if (sheet !== null) set({ sheet: { ...sheet, ...patch } });
}

/** The sheet's dish into the cart (or its line changed): a line of the same dish, options and note gains the quantity. */
export function addSheetToCart(): string | null {
  const sheet = get().sheet;
  if (sheet === null) return null;
  const key = lineKey(sheet.dishId, sheet.options, sheet.note);
  let cart = get().cart.map((l) => ({ ...l }));
  if (sheet.editKey !== null) cart = cart.filter((l) => l.key !== sheet.editKey);
  const same = cart.find((l) => l.key === key);
  if (same !== undefined) same.qty = Math.min(20, same.qty + sheet.qty);
  else cart.push({ key, dishId: sheet.dishId, qty: sheet.qty, options: [...sheet.options], note: sheet.note.trim() });
  set({ sheet: null, drawer: true });
  setCart(cart);
  return sheet.editKey;
}

export function bumpQty(key: string, by: number): void {
  const cart = get()
    .cart.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + by) } : l))
    .filter((l) => l.qty > 0);
  setCart(cart);
}

export function setQty(key: string, qty: number): void {
  setCart(get().cart.map((l) => (l.key === key ? { ...l, qty } : l)));
}

export function removeLine(key: string): void {
  setCart(get().cart.filter((l) => l.key !== key));
}

export function removeDish(dishId: Id): void {
  setCart(get().cart.filter((l) => l.dishId !== dishId));
}

export function replaceCart(lines: CartLine[]): void {
  setCart(lines);
}

export function setDrawer(open: boolean): void {
  set({ drawer: open });
}

// ── the pickup time ────────────────────────────────────────────────────────

export function choose(day: Day, time: string): void {
  set({ pick: { day, time }, slotNotice: null, placeError: null });
  scheduleQuote();
}

export function choosePickDay(which: "today" | "tomorrow"): void {
  const pick = get().pick;
  const now = sources().clock.now();
  const day = which === "today" ? todayOf(now) : addDays(todayOf(now), 1);
  set({ pickDay: which, pick: pick !== null && pick.day === day ? pick : null });
  scheduleQuote();
}

// ── Adminium's price ────────────────────────────────────────────────────────

/**
 * The time a quote is asked for before the diner has picked one: Adminium
 * prices an order only on a pickup time it could hold, so the figures are
 * asked for the first free time of the day shown (else the other day) —
 * the prices are the same at any time; only what is sold out is the day's.
 */
function quoteTime(): { day: Day; time: string } | null {
  const s = get();
  if (s.pick !== null) return s.pick;
  const today = todayOf(sources().clock.now());
  const days = s.pickDay === "today" ? [today, addDays(today, 1)] : [addDays(today, 1), today];
  for (const day of days) {
    const free = (s.slots[day] ?? []).find((slot) => slot.state === "free");
    if (free !== undefined) return { day, time: free.time };
  }
  return null;
}

/** The order as it would be sent: the diner's values, each line with its options (a quote's at the time it is asked for). */
export function orderBody(values: Record<string, unknown> = {}, forQuote = false): OrderBody {
  const s = get();
  const pick = forQuote ? quoteTime() : s.pick;
  return {
    values: { ...values, ...(pick === null ? {} : { pickup_at: new Date(instantOf(pick.day, pick.time, zoneOf())).toISOString() }) },
    children: {
      order_items: s.cart.map((l) => ({
        values: { menu_item_id: l.dishId, qty: l.qty, ...(l.note === "" ? {} : { note: l.note }) },
        ...(l.options.length === 0 ? {} : { children: { order_item_modifiers: l.options.map((id) => ({ values: { modifier_id: id } })) } }),
      })),
    },
  };
}

const quoteKeyOf = () => JSON.stringify([get().cart, get().pick ?? quoteTime()]);
let quoteTimer: ReturnType<typeof setTimeout> | null = null;

/** Asks Adminium for the order's figures once the cart has been still for a moment. */
export function scheduleQuote(): void {
  if (quoteTimer !== null) clearTimeout(quoteTimer);
  if (get().cart.length === 0) {
    set({ quote: null });
    return;
  }
  set({ quote: { key: quoteKeyOf(), state: "busy", reply: get().quote?.reply ?? null } });
  quoteTimer = setTimeout(() => void runQuote(), 250);
}

export async function runQuote(): Promise<void> {
  const key = quoteKeyOf();
  if (get().cart.length === 0) return;
  // No free time today or tomorrow: nothing can be priced, and nothing ordered.
  if (quoteTime() === null) {
    set({ quote: null });
    return;
  }
  set({ quote: { key, state: "busy", reply: get().quote?.reply ?? null } });
  try {
    const reply = await port().quote(orderBody({}, true));
    if (quoteKeyOf() !== key) return;
    set({ quote: { key, state: "ok", reply }, alerts: {} });
  } catch (error) {
    if (quoteKeyOf() !== key) return;
    set({ quote: { key, state: "err", reply: null } });
    if (isApiError(error)) await readRefusal(error, "quote");
  }
}

/** A quote that answers for this very cart and time. */
export function freshQuote(): QuoteReply | null {
  const q = get().quote;
  return q !== null && q.state === "ok" && q.key === quoteKeyOf() ? q.reply : null;
}

// ── refusals, as the page says them ───────────────────────────────────────────

/** What a refusal of a quote or an order means for the page. Returns true when it was said. */
async function readRefusal(error: ApiError, during: "quote" | "place"): Promise<boolean> {
  const s = get();
  const now = sources().clock.now();
  const day = s.pick?.day ?? todayOf(now);
  const line = refusedLine(error);
  const target = line === null ? undefined : s.cart[line];
  if (error.code === "PUBLIC_SWITCHED_OFF") {
    await reloadAll();
    if (during === "place") set({ placeError: "stopped" });
    return true;
  }
  if (error.code === "PUBLIC_SOLD_OUT" && target !== undefined) {
    await refreshAvailability(now);
    const state = get().dishes[day]?.find((d) => d.id === String(target.dishId));
    const left = state?.left ?? null;
    const alert: LineAlert = state?.state === "on" && left !== null && left > 0 ? { kind: "short", left, day } : { kind: "soldout", day };
    set({ alerts: { ...get().alerts, [target.key]: alert } });
    if (during === "place") set({ soldOut: { dishId: target.dishId, short: alert.kind === "short", left: alert.kind === "short" ? alert.left : null, day } });
    return true;
  }
  const reason = error.params["reason"];
  if (error.code === "PUBLIC_WRITE_REFUSED" && reason === "not-offered" && target !== undefined) {
    const path = error.params["path"];
    const optionIndex = Array.isArray(path) && path[2] === "order_item_modifiers" && typeof path[3] === "number" ? path[3] : null;
    const menu = s.data?.menu;
    const name = optionIndex === null ? (menu?.dish(target.dishId)?.name ?? "") : (menu?.option(target.options[optionIndex] ?? -1)?.name ?? "");
    set({ alerts: { ...get().alerts, [target.key]: { kind: "gone", name, dish: optionIndex === null } } });
    await reloadAll();
    return true;
  }
  if (error.code === "PUBLIC_WRITE_REFUSED" && reason === "too-many" && error.params["column"] === "qty" && line === null) {
    if (during === "place") set({ placeError: "toomany" });
    return true;
  }
  if ((error.code === "PUBLIC_SLOT_FULL" || (error.code === "PUBLIC_WRITE_REFUSED" && error.params["column"] === "pickup_at")) && s.pick !== null) {
    // `out-of-hours`: the day's hours moved under the time; `out-of-range`: too soon now, or too far ahead.
    const why: SlotNotice["reason"] = error.code === "PUBLIC_SLOT_FULL" ? "full" : reason === "paused" ? "paused" : reason === "closed" || reason === "out-of-hours" ? "closed" : "too-soon";
    set({ slotNotice: { time: s.pick.time, day: s.pick.day, reason: why }, pick: null });
    await refreshAvailability(now);
    return true;
  }
  if (error.code === "PUBLIC_PRICE_CHANGED" && during === "place") {
    const before = freshQuoteLines();
    // The lines as the save would have written them, under their list: `{order_items: [{data, children}]}`.
    const lines = (error.params["lines"] as { order_items?: { data: Record<string, unknown> }[] } | undefined)?.order_items ?? [];
    const changed = lines
      .map((l, i) => ({ name: s.data?.menu.dish(s.cart[i]?.dishId ?? -1)?.name ?? "", from: before[i] ?? 0, to: Number(l.data["unit_total"] ?? 0) }))
      .filter((l) => l.from !== l.to);
    set({ priceChanged: { lines: changed, total: Number(error.params["total"] ?? 0) } });
    return true;
  }
  return false;
}

/** Each line's price for one, as the last quote answered it. */
function freshQuoteLines(): number[] {
  const lines = get().quote?.reply?.children?.order_items ?? [];
  return lines.map((l) => Number(l.data["unit_total"] ?? 0));
}

// ── checkout ────────────────────────────────────────────────────────────────

export function setField(name: keyof DinerState["form"], value: string): void {
  set({ form: { ...get().form, [name]: value }, placeError: null });
}

export function touch(name: "name" | "email" | "phone"): void {
  set({ touched: { ...get().touched, [name]: true } });
}

/** A retry key as the public API wants one: 32 characters of base64url. */
function mintKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Places the order: the diner's details, the lines, the time, and the total
 * they were shown. A lost answer keeps the retry key — pressing again lands
 * on the same order — and a busy slot is tried once more, quietly.
 */
export async function placeOrder(language: string): Promise<Placed | null> {
  const s = get();
  const quote = freshQuote();
  if (s.placing || quote === null || s.pick === null) return null;
  const clientKey = s.clientKey ?? mintKey();
  set({ placing: true, placeError: null, clientKey, slotNotice: null });
  const f = s.form;
  const values = {
    name: f.name.trim(),
    email: f.email.trim(),
    ...(f.phone.trim() === "" ? {} : { phone: f.phone.trim() }),
    ...(f.note.trim() === "" ? {} : { note: f.note.trim() }),
    language,
    client_key: clientKey,
  };
  const body = { ...orderBody(values), expect: { total: Number(quote.data["total"]).toFixed(2) } };
  for (let attempt = 0; ; attempt += 1) {
    try {
      const reply = await port().place(body, clientKey);
      const placed: Placed = {
        id: reply.data.id,
        number: String(reply.data["number"]),
        token: reply.link?.token ?? null,
        email: values.email,
        name: values.name,
        pickupAt: String(reply.data["pickup_at"]),
        total: Number(reply.data["total"]),
        replayed: reply.replayed === true,
      };
      set({ placing: false, placed, cart: [], clientKey: null, quote: null, alerts: {}, priceChanged: null, pick: null, form: { ...get().form, note: "" }, touched: {} });
      void refreshAvailability(sources().clock.now());
      return placed;
    } catch (error) {
      if (isApiError(error) && error.code === "PUBLIC_SLOT_BUSY" && attempt === 0) continue;
      set({ placing: false });
      if (!isApiError(error) || error.status === 0) {
        // The order may be in: the key is kept, and pressing again lands on it.
        set({ placeError: "offline" });
        return null;
      }
      // A named refusal: nothing was made, and the next press is a new order.
      set({ clientKey: null });
      if (error.code === "PUBLIC_LIMIT_REACHED") set({ placeError: "limit" });
      else if (error.code === "PUBLIC_RATE_LIMITED") set({ placeError: "busy" });
      else if (!(await readRefusal(error, "place"))) set({ placeError: "failed" });
      if (error.code !== "PUBLIC_PRICE_CHANGED") scheduleQuote();
      return null;
    }
  }
}

/** The price changed: accept the new total and place again. */
export async function acceptNewPrice(language: string): Promise<Placed | null> {
  set({ priceChanged: null });
  await runQuote();
  return placeOrder(language);
}

export function dismissPriceChanged(): void {
  set({ priceChanged: null });
  scheduleQuote();
}

export function closeSoldOut(): void {
  set({ soldOut: null });
}

/** Only N left: make the line that many. */
export function makeIt(dishId: Id, left: number): void {
  set({ soldOut: null });
  setCart(get().cart.map((l) => (l.dishId === dishId ? { ...l, qty: left } : l)));
}

/** A dish sold out, or its line gone: take it off. */
export function takeOff(dishId: Id): void {
  set({ soldOut: null });
  removeDish(dishId);
}

export function followedPlaced(): Placed | null {
  return get().placed;
}

export function isOrderLine(key: string): boolean {
  return get().cart.some((l) => l.key === key);
}

export type { Row };
