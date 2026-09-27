/**
 * The kitchen's side: who is signed in, the orders of the next seven days
 * with their lines, today's and tomorrow's slots and portions, the menu with
 * everything switched off too, the hours and closures — and every write the
 * kitchen makes, each answered by Adminium and read back.
 *
 * The screen never trusts a live frame's contents: a frame names a table,
 * and the page reads that table's queries again, gathered for half a second
 * so a burst of changes costs one read.
 */
import { create } from "zustand";

import type { KitchenPerson, Menu, OrderWithLines } from "../data/ports.ts";
import type { Id, OrderBody, QuoteReply, Row, SlotCount } from "../data/wire.ts";
import { isApiError } from "../data/wire.ts";
import { sources } from "../data/sources.ts";
import { menuModel, type MenuModel } from "../lib/menu.ts";
import { addDays, instantOf, venueDay, type Day } from "../lib/venueTime.ts";
import { lineKey } from "./diner.ts";

export type KitchenTab = "queue" | "slots" | "shelf" | "menu" | "hours";
export const BOARD = ["placed", "confirmed", "preparing", "ready"] as const;
export type BoardState = (typeof BOARD)[number];

/** The move each column's button makes. */
export const NEXT: Record<BoardState, string> = { placed: "confirmed", confirmed: "preparing", preparing: "ready", ready: "picked_up" };

export interface PhoneLine {
  key: string;
  dishId: Id;
  qty: number;
  options: Id[];
}

export interface PhoneDraft {
  day: "today" | "tomorrow";
  time: string | null;
  lines: PhoneLine[];
  name: string;
  phone: string;
  email: string;
  note: string;
  category: Id | "all";
  sheet: { dishId: Id; options: Id[]; qty: number } | null;
  quote: { key: string; state: "busy" | "ok" | "err"; reply: QuoteReply | null } | null;
  placing: boolean;
  error: string | null;
}

export interface CancelDraft {
  id: Id;
  reason: "ran_out" | "too_busy" | "customer_asked" | "other" | null;
  dish: string | null;
  dishId: Id | null;
  note: string;
  markSold: boolean;
  busy: boolean;
}

interface KitchenState {
  load: "busy" | "ok" | "err";
  signedOut: boolean;
  person: KitchenPerson | null;
  zone: string;
  currency: string;
  settings: Row | null;
  hours: Row[];
  closures: Row[];
  menuRows: Menu | null;
  menu: MenuModel | null;
  orders: OrderWithLines[];
  slots: Record<Day, SlotCount[] | undefined>;
  dishCounts: Record<Day, Record<string, number> | undefined>;
  holidays: { date: string; name: string }[] | null;
  receipts: boolean;
  conn: "live" | "reconnecting";
  tab: KitchenTab;
  slotDay: "today" | "tomorrow";
  /** Orders that just arrived: their cards pulse. */
  pulse: Id[];
  ticket: Id | null;
  cancel: CancelDraft | null;
  handoff: { id: Id; paid: "cash" | "card" | null; busy: boolean } | null;
  tomorrow: boolean;
  phone: PhoneDraft | null;
  askStop: boolean;
  askOnlineOff: boolean;
  /** Stop for today stopped part-way: the slots from here on are still open. */
  stopFailed: { until: string } | null;
  menuOpen: Record<string, boolean>;
  personMenu: boolean;
  closureDraft: { from: string; to: string; reason: string };
}

export const useKitchen = create<KitchenState>(() => ({
  load: "busy",
  signedOut: false,
  person: null,
  zone: "UTC",
  currency: "USD",
  settings: null,
  hours: [],
  closures: [],
  menuRows: null,
  menu: null,
  orders: [],
  slots: {},
  dishCounts: {},
  holidays: null,
  receipts: false,
  conn: "live",
  tab: "queue",
  slotDay: "today",
  pulse: [],
  ticket: null,
  cancel: null,
  handoff: null,
  tomorrow: false,
  phone: null,
  askStop: false,
  askOnlineOff: false,
  stopFailed: null,
  menuOpen: {},
  personMenu: false,
  closureDraft: { from: "", to: "", reason: "" },
}));

const get = useKitchen.getState;
const set = useKitchen.setState;
const port = () => sources().kitchen;
const now = () => sources().clock.now();

export const kToday = (at: number = now()): Day => venueDay(at, get().zone);
export const isManager = (): boolean => get().person?.roles.includes("manager") === true;

/** A number a column holds, whatever the engine spelled it as. */
export const num = (value: unknown, fallback = 0): number => (value === null || value === undefined || value === "" ? fallback : Number(value));
export const dayOf = (o: OrderWithLines): Day => venueDay(String(o.order["pickup_at"]), get().zone);

// ── reading ─────────────────────────────────────────────────────────────────

let arrived = new Set<Id>();
/** Phone orders this screen just put in: no "New" chime for what the cook typed. */
const ownPhone = new Set<Id>();
let onArrival: ((order: OrderWithLines) => void) | null = null;

/** Called when a new online order reaches the board (the sound and the toast live with the screen). */
export function whenOrderArrives(listener: ((order: OrderWithLines) => void) | null): void {
  onArrival = listener;
}

function signedOutBy(error: unknown): boolean {
  if (isApiError(error) && error.status === 401) {
    set({ signedOut: true, personMenu: false });
    return true;
  }
  return false;
}

export async function loadKitchen(): Promise<void> {
  set({ load: "busy" });
  try {
    const p = port();
    const [person, config, settings, hours, closures, menu, holidays, receipts] = await Promise.all([p.me(), p.config(), p.settings(), p.hours(), p.closures(), p.menu(), p.holidays(), p.receipts()]);
    set({ person, zone: config.timezone ?? sources().zone, currency: config.currency ?? sources().currency, settings, hours, closures, menuRows: menu, menu: menuModel(menu), holidays, receipts, signedOut: false });
    await Promise.all([readOrders(true), readSlots(), readCounts()]);
    set({ load: "ok" });
  } catch (error) {
    if (!signedOutBy(error)) set({ load: "err" });
  }
}

/** The next seven days' orders: today's board, tomorrow's pre-orders, and what a closure would cover. */
async function readOrders(first = false): Promise<void> {
  const today = kToday();
  const orders = await port().orders(today, addDays(today, 6));
  const fresh = orders.filter((o) => !arrived.has(o.order.id));
  arrived = new Set(orders.map((o) => o.order.id));
  set({ orders });
  if (first) return;
  for (const order of fresh) {
    if (order.order["status"] !== "placed" || dayOf(order) !== today || ownPhone.has(order.order.id)) continue;
    set({ pulse: [...get().pulse.filter((id) => id !== order.order.id), order.order.id] });
    onArrival?.(order);
  }
}

async function readSlots(): Promise<void> {
  const today = kToday();
  const days = [today, addDays(today, 1)];
  const answers = await Promise.all(days.map((d) => port().slotCounts(d)));
  set({ slots: Object.fromEntries(days.map((d, i) => [d, answers[i]])) });
}

async function readCounts(): Promise<void> {
  const today = kToday();
  const days = [today, addDays(today, 1)];
  const answers = await Promise.all(days.map((d) => port().dishCounts(d)));
  set({ dishCounts: Object.fromEntries(days.map((d, i) => [d, answers[i]])) });
}

async function readMenu(): Promise<void> {
  const menu = await port().menu();
  set({ menuRows: menu, menu: menuModel(menu) });
}

const QUERIES: Record<string, (() => Promise<void>)[]> = {
  orders: [() => readOrders(), readSlots, readCounts],
  order_items: [() => readOrders(), readCounts],
  order_item_modifiers: [() => readOrders()],
  slot_pauses: [readSlots],
  menu_items: [readMenu, readCounts],
  modifiers: [readMenu],
  modifier_groups: [readMenu],
  menu_categories: [readMenu],
  settings: [async () => set({ settings: await port().settings() }), readSlots],
  hours: [async () => set({ hours: await port().hours() }), readSlots],
  closures: [async () => set({ closures: await port().closures() }), readSlots],
};

let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Reads again what a set of tables feeds, once, after the burst settles. */
export function refresh(tables: readonly string[], wait = 500): void {
  for (const table of tables) pending.add(table);
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => void flush(), wait);
}

async function flush(): Promise<void> {
  timer = null;
  const tables = [...pending];
  pending = new Set();
  const reads = new Set<() => Promise<void>>();
  for (const table of tables) for (const read of QUERIES[table] ?? []) reads.add(read);
  try {
    await Promise.all([...reads].map((read) => read()));
  } catch (error) {
    signedOutBy(error);
  }
}

/** Every read again: on reconnecting, on coming back to the tab, when the day turns. */
export async function refreshAll(): Promise<void> {
  try {
    await Promise.all([readOrders(), readSlots(), readCounts(), readMenu()]);
  } catch (error) {
    signedOutBy(error);
  }
}

/** Listens to the live stream while the kitchen is open. */
export function goLive(): () => void {
  return port().subscribe(
    (frame) => refresh([frame.table]),
    (state) => {
      const was = get().conn;
      set({ conn: state });
      if (was === "reconnecting" && state === "live") void refreshAll();
    },
  );
}

// ── the session ─────────────────────────────────────────────────────────────

/** A cheap check that the staff session still holds (every minute while the board is open). */
export async function checkSession(): Promise<void> {
  try {
    await port().me();
  } catch (error) {
    signedOutBy(error);
  }
}

export async function signOut(): Promise<void> {
  await port().signOut();
  set({ signedOut: true, personMenu: false });
}

export async function signIn(): Promise<void> {
  await port().signIn();
  await loadKitchen();
}

// ── moves ───────────────────────────────────────────────────────────────────

export type MoveResult =
  | { ok: true; order: Row }
  | { ok: false; kind: "unchanged"; state: string; at: string | null; by: string | null }
  | { ok: false; kind: "cancelled"; at: string | null }
  | { ok: false; kind: "failed" };

function refused(error: unknown, id: Id): MoveResult {
  if (signedOutBy(error)) return { ok: false, kind: "failed" };
  if (isApiError(error) && error.code === "STATE_UNCHANGED") {
    return { ok: false, kind: "unchanged", state: String(error.params["state"] ?? ""), at: (error.params["at"] as string | null) ?? null, by: (error.params["by"] as string | null) ?? null };
  }
  if (isApiError(error) && error.code === "STATE_MOVE_REFUSED" && error.params["from"] === "cancelled") {
    const order = get().orders.find((o) => o.order.id === id);
    return { ok: false, kind: "cancelled", at: (order?.order["cancelled_at"] as string | null) ?? null };
  }
  return { ok: false, kind: "failed" };
}

/** Moves an order on, from the state this screen showed. */
export async function moveOrder(id: Id, from: string, to: string): Promise<MoveResult> {
  try {
    const order = await port().move(id, from, to);
    return { ok: true, order };
  } catch (error) {
    return refused(error, id);
  } finally {
    await refreshNow(["orders"]);
  }
}

/** Reads the tables again at once (after this screen's own write). */
async function refreshNow(tables: readonly string[]): Promise<void> {
  for (const table of tables) pending.add(table);
  if (timer !== null) clearTimeout(timer);
  await flush();
}

export async function handOff(): Promise<{ ok: true; order: OrderWithLines } | { ok: false; result: MoveResult }> {
  const h = get().handoff;
  const order = get().orders.find((o) => o.order.id === h?.id);
  if (h === null || h.paid === null || order === undefined) return { ok: false, result: { ok: false, kind: "failed" } };
  set({ handoff: { ...h, busy: true } });
  try {
    await port().handOff(h.id, h.paid);
    set({ handoff: null, ticket: null });
    return { ok: true, order };
  } catch (error) {
    set({ handoff: { ...h, busy: false } });
    return { ok: false, result: refused(error, h.id) };
  } finally {
    await refreshNow(["orders"]);
  }
}

/**
 * Cancels an order with its reason; then, as a second write once the cancel
 * is in, marks the dish that ran out sold out for today.
 */
export async function cancelOrder(): Promise<{ ok: true; soldOut: string | null; soldFailed: boolean } | { ok: false; result: MoveResult }> {
  const c = get().cancel;
  const order = get().orders.find((o) => o.order.id === c?.id);
  if (c === null || c.reason === null || order === undefined) return { ok: false, result: { ok: false, kind: "failed" } };
  set({ cancel: { ...c, busy: true } });
  try {
    await port().cancel(c.id, String(order.order["status"]), c.reason, c.reason === "ran_out" ? c.dish : null, c.reason === "other" ? c.note.trim() || null : null);
  } catch (error) {
    set({ cancel: { ...c, busy: false } });
    await refreshNow(["orders"]);
    return { ok: false, result: refused(error, c.id) };
  }
  set({ cancel: null, ticket: null });
  let soldFailed = false;
  const mark = c.reason === "ran_out" && c.markSold && c.dishId !== null;
  if (mark) soldFailed = !(await markSoldOut(c.dishId!));
  await refreshNow(["orders", "menu_items"]);
  return { ok: true, soldOut: mark && !soldFailed ? c.dish : null, soldFailed };
}

/** Sold out today: no more portions today, whatever a later cancel frees. */
export async function markSoldOut(dishId: Id): Promise<boolean> {
  try {
    await port().setDish(dishId, { stock_today: 0, stock_on: kToday() });
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  }
}

// ── slots ───────────────────────────────────────────────────────────────────

export const slotAt = (day: Day, time: string): string => new Date(instantOf(day, time, get().zone)).toISOString();

export async function pauseSlot(day: Day, time: string): Promise<boolean> {
  try {
    await port().pause(slotAt(day, time));
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  } finally {
    await refreshNow(["slot_pauses"]);
  }
}

export async function reopenSlot(pauseId: Id): Promise<boolean> {
  try {
    await port().reopen(pauseId);
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  } finally {
    await refreshNow(["slot_pauses"]);
  }
}

/** Pauses several slots one by one, each tried twice; answers the last one it paused. */
export async function pauseMany(day: Day, times: readonly string[]): Promise<{ done: string[]; failedAt: string | null }> {
  const done: string[] = [];
  for (const time of times) {
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt += 1) {
      try {
        await port().pause(slotAt(day, time));
        ok = true;
      } catch (error) {
        if (signedOutBy(error)) break;
      }
    }
    if (!ok) {
      await refreshNow(["slot_pauses"]);
      return { done, failedAt: time };
    }
    done.push(time);
  }
  await refreshNow(["slot_pauses"]);
  return { done, failedAt: null };
}

export async function reopenMany(ids: readonly Id[]): Promise<boolean> {
  try {
    await Promise.all(ids.map((id) => port().reopen(id)));
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  } finally {
    await refreshNow(["slot_pauses"]);
  }
}

// ── today's menu ────────────────────────────────────────────────────────────

export async function setDish(id: Id, values: { available?: boolean; stock_today?: number | null; stock_on?: string | null }): Promise<boolean> {
  try {
    await port().setDish(id, values);
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  } finally {
    await refreshNow(["menu_items"]);
  }
}

export async function setOption(id: Id, available: boolean): Promise<boolean> {
  try {
    await port().setOption(id, available);
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  } finally {
    await refreshNow(["modifiers"]);
  }
}

// ── hours (a manager's) ─────────────────────────────────────────────────────

async function managerWrite(write: () => Promise<unknown>, tables: string[]): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (error) {
    signedOutBy(error);
    return false;
  } finally {
    await refreshNow(tables);
  }
}

export const setHours = (id: Id, values: { open?: boolean; opens?: string; closes?: string }) => managerWrite(() => port().setHours(id, values), ["hours"]);
export const addClosure = (values: { from_date: string; to_date: string; reason: string | null }) => managerWrite(() => port().addClosure(values), ["closures"]);
export const setClosure = (id: Id, active: boolean) => managerWrite(() => port().setClosure(id, active), ["closures"]);
export const setOnline = (on: boolean) => managerWrite(() => port().setOnline(on), ["settings"]);

// ── the phone order ─────────────────────────────────────────────────────────

export const freshPhone = (): PhoneDraft => ({ day: "today", time: null, lines: [], name: "", phone: "", email: "", note: "", category: "all", sheet: null, quote: null, placing: false, error: null });

export function setPhone(patch: Partial<PhoneDraft>): void {
  const p = get().phone;
  if (p === null) return;
  const next = { ...p, ...patch };
  set({ phone: next });
  if ("lines" in patch || "time" in patch || "day" in patch) schedulePhoneQuote();
}

export function addPhoneLine(dishId: Id, options: Id[], qty: number): void {
  const p = get().phone;
  if (p === null) return;
  const key = lineKey(dishId, options, "");
  const lines = p.lines.map((l) => ({ ...l }));
  const same = lines.find((l) => l.key === key);
  if (same !== undefined) same.qty = Math.min(20, same.qty + qty);
  else lines.push({ key, dishId, qty, options });
  setPhone({ lines, sheet: null });
}

export function phoneDay(p: PhoneDraft): Day {
  const today = kToday();
  return p.day === "today" ? today : addDays(today, 1);
}

export function phoneBody(p: PhoneDraft, values: Record<string, unknown> = {}): OrderBody {
  const day = phoneDay(p);
  return {
    values: { ...values, ...(p.time === null ? {} : { pickup_at: slotAt(day, p.time) }) },
    children: {
      order_items: p.lines.map((l) => ({
        values: { menu_item_id: l.dishId, qty: l.qty },
        ...(l.options.length === 0 ? {} : { children: { order_item_modifiers: l.options.map((id) => ({ values: { modifier_id: id } })) } }),
      })),
    },
  };
}

let quoteTimer: ReturnType<typeof setTimeout> | null = null;
const phoneKey = (p: PhoneDraft) => JSON.stringify([p.lines, p.day, p.time]);

function schedulePhoneQuote(): void {
  if (quoteTimer !== null) clearTimeout(quoteTimer);
  const p = get().phone;
  if (p === null || p.lines.length === 0) {
    if (p !== null) set({ phone: { ...p, quote: null } });
    return;
  }
  set({ phone: { ...p, quote: { key: phoneKey(p), state: "busy", reply: p.quote?.reply ?? null } } });
  quoteTimer = setTimeout(() => void runPhoneQuote(), 400);
}

async function runPhoneQuote(): Promise<void> {
  const p = get().phone;
  if (p === null || p.lines.length === 0) return;
  const key = phoneKey(p);
  try {
    const reply = await port().phoneQuote(phoneBody(p));
    const now2 = get().phone;
    if (now2 !== null && phoneKey(now2) === key) set({ phone: { ...now2, quote: { key, state: "ok", reply } } });
  } catch (error) {
    const now2 = get().phone;
    if (now2 !== null && phoneKey(now2) === key) set({ phone: { ...now2, quote: { key, state: "err", reply: null } } });
    signedOutBy(error);
  }
}

export function freshPhoneQuote(p: PhoneDraft | null): QuoteReply | null {
  return p?.quote !== null && p?.quote !== undefined && p.quote.state === "ok" && p.quote.key === phoneKey(p) ? p.quote.reply : null;
}

/**
 * Puts a phone order on the board: the order is written (it starts New, as
 * every order does), then confirmed at once — the confirm tried again until
 * it lands, so the cook never finds their own order waiting.
 */
export async function placePhone(): Promise<{ number: string; id: Id } | { error: string }> {
  const p = get().phone;
  if (p === null) return { error: "failed" };
  set({ phone: { ...p, placing: true, error: null } });
  let id: Id;
  let number: string;
  try {
    const values = {
      name: p.name.trim(),
      phone: p.phone.trim(),
      ...(p.email.trim() === "" ? {} : { email: p.email.trim() }),
      ...(p.note.trim() === "" ? {} : { note: p.note.trim() }),
    };
    const reply = await port().phoneOrder(phoneBody(p, values));
    id = reply.data.id;
    number = String(reply.data["number"]);
    ownPhone.add(id);
  } catch (error) {
    const code = isApiError(error) ? (error.code === "PUBLIC_SLOT_FULL" || error.params["column"] === "pickup_at" ? "slot" : error.code === "PUBLIC_SOLD_OUT" ? "soldout" : "failed") : "failed";
    set({ phone: { ...get().phone!, placing: false, error: code } });
    signedOutBy(error);
    await refreshNow(["orders"]);
    return { error: code };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await port().move(id, "placed", "confirmed");
      break;
    } catch (error) {
      if (isApiError(error) && error.code === "STATE_UNCHANGED") break;
      if (signedOutBy(error)) break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  set({ phone: null });
  await refreshNow(["orders"]);
  return { number, id };
}
