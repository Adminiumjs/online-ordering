/**
 * The kitchen's door into the demo's Adminium: the data API as Sam, signed
 * in to the kitchen (a manager too, so the Hours tab is theirs). Every write
 * goes through the demo's engine, held to the role's grants and limits as
 * the manifest writes them.
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import { DEMO_HOLIDAYS } from "../data/demo.ts";
import type { KitchenPerson, KitchenPort, Menu, OrderWithLines, PaidBy } from "../data/ports.ts";
import { DemoCards } from "./offers.ts";
import { ApiError, type CardPayment, type Id, type KitchenStock, type LiveFrame, type OrderBody, type OrderReply, type QuoteReply, type Row } from "../data/wire.ts";
import { venueDay } from "../lib/venueTime.ts";
import { Engine, type Writer } from "./engine.ts";
import { MANIFEST_RULES } from "./rules.ts";

type Limit = { writable: readonly string[]; writableValues?: Record<string, readonly unknown[]> };

export class DemoKitchen implements KitchenPort {
  readonly person: KitchenPerson = { name: "Sam", roles: ["kitchen", "manager"] };
  /** Add-ons the demo card has switched on. */
  addOns = { invoices: true, holidays: true };
  private live: "live" | "reconnecting" = "live";
  private stateListeners = new Set<(state: "live" | "reconnecting") => void>();

  readonly engine: Engine;
  /** The demo's gift cards, shared with the order page's door: a card spent there is spent here. */
  private readonly cards: DemoCards;
  constructor(engine: Engine, cards: DemoCards = new DemoCards()) {
    this.engine = engine;
    this.cards = cards;
  }

  private get world() {
    return this.engine.world;
  }
  private get writer(): Writer {
    return { origin: "staff", name: this.person.name, roles: this.person.roles };
  }

  /** The kitchen role's limit on a table, unless the person also holds a role with a plain update there. */
  private held(table: string, values: Record<string, unknown>): void {
    if (this.person.roles.includes("manager")) return;
    const limits = MANIFEST_RULES.roles.find((r) => r.key === "kitchen")?.limits as Record<string, Limit> | null | undefined;
    const limit = limits?.[table];
    if (limit === undefined) return;
    for (const [column, value] of Object.entries(values)) {
      if (!limit.writable.includes(column)) {
        throw new ApiError(403, "COLUMN_FORBIDDEN", `The kitchen does not change ${column}.`, { table, column, reason: "update-limit", writable: limit.writable });
      }
      const allowed = limit.writableValues?.[column];
      if (allowed !== undefined && !allowed.includes(value)) {
        throw new ApiError(403, "COLUMN_FORBIDDEN", `The kitchen does not set ${column} to ${String(value)}.`, { table, column, value, reason: "update-limit", writableValues: allowed });
      }
    }
  }

  /** A manager's table: the kitchen holds no grant to change it. */
  private manager(table: string, action: "create" | "update" = "update"): void {
    if (!this.person.roles.includes("manager")) throw new ApiError(403, "TABLE_FORBIDDEN", "Managers change these.", { permission: `table:@${table}:${action}` });
  }

  private out = false;

  /** A signed-out screen reads nothing: every read answers 401 until it signs in again. */
  private signedIn(): void {
    if (this.out) throw new ApiError(401, "UNAUTHENTICATED", "Sign in again.");
  }

  async me() {
    this.signedIn();
    return this.person;
  }

  async signOut(): Promise<void> {
    this.out = true;
  }

  async signIn(): Promise<void> {
    this.out = false;
  }
  async config() {
    return { timezone: this.world.zone, currency: this.world.currency };
  }
  async settings(): Promise<Row> {
    return { ...this.world.settings() };
  }
  async hours(): Promise<Row[]> {
    return this.world.all("hours").map((r) => ({ ...r }));
  }
  async closures(): Promise<Row[]> {
    return this.world.all("closures").map((r) => ({ ...r }));
  }
  async menu(): Promise<Menu & { all: true }> {
    const sorted = (rows: Row[]) => rows.map((r) => ({ ...r })).sort((a, b) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0) || a.id - b.id);
    return {
      categories: sorted(this.world.all("menu_categories")),
      items: sorted(this.world.all("menu_items")),
      groups: sorted(this.world.all("modifier_groups")),
      options: sorted(this.world.all("modifiers")),
      all: true,
    };
  }

  private withLines(order: Row): OrderWithLines {
    return {
      order: { ...order },
      payments: this.world.where("payments", (p) => p["order_id"] === order.id).map((p) => ({ ...p })),
      lines: this.world
        .where("order_items", (l) => l["order_id"] === order.id)
        .sort((a, b) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0))
        .map((line) => Object.assign({ ...line }, { options: this.world.where("order_item_modifiers", (o) => o["order_item_id"] === line.id).map((o) => ({ ...o })) })),
    };
  }

  async orders(from: string, to: string): Promise<OrderWithLines[]> {
    this.signedIn();
    return this.world
      .where("orders", (o) => {
        const day = venueDay(String(o["pickup_at"]), this.world.zone);
        return day >= from && day <= to;
      })
      .map((o) => this.withLines(o));
  }

  async order(id: Id): Promise<OrderWithLines> {
    const order = this.world.get("orders", id);
    if (order === undefined) throw new ApiError(404, "NOT_FOUND", "No such order.");
    return this.withLines(order);
  }

  async move(id: Id, from: string, to: string): Promise<Row> {
    // A hand-over taken back is unpaid again: the move empties how it was paid.
    const values = { status: to };
    this.held("orders", values);
    return { ...this.engine.updateOrder(id, values, this.writer, { from }) };
  }

  async cancel(id: Id, from: string, code: string, dish: string | null, note: string | null): Promise<Row> {
    const values = { status: "cancelled", cancel_code: code, cancel_dish: dish, cancel_note: note };
    this.held("orders", values);
    return { ...this.engine.updateOrder(id, values, this.writer, { from }) };
  }

  async handOff(id: Id, paid: PaidBy, rest?: "cash" | "card"): Promise<Row> {
    const values = { status: "picked_up", paid_method: paid, ...(paid === "mixed" && rest !== undefined ? { rest_paid_by: rest } : {}) };
    this.held("orders", values);
    return { ...this.engine.updateOrder(id, values, this.writer, { from: "ready" }) };
  }

  async giftCards(): Promise<boolean> {
    return true;
  }

  /** The demo keeps no ingredient stock: its dishes run out by the kitchen's own portions alone. */
  async stockWords(): Promise<KitchenStock[]> {
    return [];
  }

  /** What a card would pay of what the order still owes; the one refusal a card gets, with its plain reason for staff. */
  private cardFor(orderId: Id, code: string): { amount: number; due: number } {
    const order = this.world.get("orders", orderId);
    if (order === undefined) throw new ApiError(404, "NOT_FOUND", "No such order.");
    const owed = Math.max(0, Math.round((Number(order["total"] ?? 0) - Number(order["paid"] ?? 0)) * 100) / 100);
    const balance = this.cards.balance(code);
    if (balance === null) throw new ApiError(409, "POSTING_REFUSED", "This gift card is not valid.", { ledger: "value", reason: "not-valid" });
    if (balance <= 0) throw new ApiError(409, "POSTING_REFUSED", "This gift card is empty.", { ledger: "value", reason: "empty" });
    if (owed <= 0) throw new ApiError(409, "POSTING_REFUSED", "Nothing is left to pay.", { ledger: "value", reason: "not-allowed" });
    const amount = Math.min(balance, owed);
    return { amount, due: Math.round((owed - amount) * 100) / 100 };
  }

  async cardCheck(orderId: Id, code: string): Promise<CardPayment> {
    this.signedIn();
    const { amount, due } = this.cardFor(orderId, code);
    return { amount: amount.toFixed(2), due: due.toFixed(2) };
  }

  async cardUse(orderId: Id, code: string, clientKey: string): Promise<CardPayment> {
    this.signedIn();
    const again = this.world.where("payments", (p) => p["client_key"] === clientKey)[0];
    const order = this.world.get("orders", orderId)!;
    if (again !== undefined) return { amount: Number(again["amount"]).toFixed(2), due: Number(order["due"] ?? 0).toFixed(2) };
    const { amount, due } = this.cardFor(orderId, code);
    this.cards.spend(code, amount);
    this.world.insert("payments", { order_id: orderId, card_code: code, card_id: null, card_last4: code.replace(/[^0-9A-Za-z]/g, "").slice(-4).toUpperCase(), amount, card_balance_after: this.cards.balance(code), returned: null, kept: amount, made_at: new Date(this.engine.now).toISOString(), made_by: this.person.name, client_key: clientKey });
    const paid = Math.round((Number(order["paid"] ?? 0) + amount) * 100) / 100;
    const total = Number(order["total"] ?? 0);
    this.world.update("orders", orderId, { paid, due, to_pay: due, card_used: 1, prepaid: paid >= total ? 1 : 0 });
    return { amount: amount.toFixed(2), due: due.toFixed(2) };
  }

  async slotCounts(date: string) {
    return this.engine.slotCounts(date);
  }

  async dishCounts(date: string): Promise<Record<string, number>> {
    return Object.fromEntries(this.world.all("menu_items").map((dish) => [String(dish.id), this.engine.ordered(dish.id, date)]));
  }

  async pause(at: string): Promise<Row> {
    const existing = this.world.all("slot_pauses").find((p) => Date.parse(String(p["slot_at"])) === Date.parse(at));
    const values = { slot_at: new Date(Date.parse(at)).toISOString(), active: true };
    if (existing !== undefined) {
      if (existing["active"] === true) return { ...existing };
      return { ...this.world.update("slot_pauses", existing.id, { active: true, ...this.engine.stampsFor("slot_pauses", existing, { ...existing, active: true }, this.writer) }) };
    }
    return { ...this.world.insert("slot_pauses", { ...values, ...this.engine.stampsFor("slot_pauses", null, values, this.writer) }) };
  }

  async reopen(pauseId: Id): Promise<Row> {
    return { ...this.world.update("slot_pauses", pauseId, { active: false }) };
  }

  async setDish(id: Id, values: { available?: boolean; stock_today?: number | null; stock_on?: string | null; online?: boolean }): Promise<Row> {
    this.held("menu_items", values);
    return { ...this.world.update("menu_items", id, values) };
  }

  async setOption(id: Id, available: boolean): Promise<Row> {
    this.held("modifiers", { available });
    return { ...this.world.update("modifiers", id, { available }) };
  }

  private phoneTree(body: OrderBody, dry: boolean) {
    const values = { ...body.values, channel: "phone" };
    const lines = body.children.order_items.map((line) => ({ values: line.values, options: (line.children?.["order_item_modifiers"] ?? []).map((o) => o.values) }));
    // Staff may point at any dish or option: the phone screen offers only what is on.
    return this.engine.orderTree(values, lines, this.writer, { dry, readableDish: () => true, readableOption: () => true });
  }

  async phoneQuote(body: OrderBody): Promise<QuoteReply> {
    this.signedIn();
    const tree = this.phoneTree(body, true);
    const { number: _n, number_seq: _s, link_token: _t, client_key: _k, ...figures } = tree.order;
    return { data: figures, children: { order_items: tree.lines.map((l) => ({ data: l.line, children: { order_item_modifiers: l.options.map((o) => ({ data: o })) } })) }, capacity: [{ pool: "orders", state: "available" }], exact: true };
  }

  async phoneOrder(body: OrderBody, clientKey: string): Promise<OrderReply> {
    this.signedIn();
    // A retry of an order already taken answers that order.
    const known = this.keys.get(clientKey);
    if (known !== undefined) return { data: { ...this.world.get("orders", known)! }, replayed: true };
    const tree = this.phoneTree(body, false);
    if (body.expect !== undefined && Number(body.expect.total).toFixed(2) !== Number(tree.order["total"]).toFixed(2)) {
      throw new ApiError(409, "PRICE_CHANGED", "The price changed.", { column: "total", total: Number(tree.order["total"]).toFixed(2) });
    }
    const { order } = this.engine.writeOrder(tree, this.writer, { channel: "phone", customer_id: null, link_token: null });
    this.keys.set(clientKey, order.id);
    return { data: { ...order } };
  }

  /** The phone orders already taken, by their retry keys. */
  private readonly keys = new Map<string, Id>();

  async setHours(id: Id, values: { open?: boolean; opens?: string; closes?: string }): Promise<Row> {
    this.manager("hours");
    return { ...this.world.update("hours", id, values) };
  }

  async addClosure(values: { from_date: string; to_date: string; reason: string | null }): Promise<Row> {
    this.manager("closures", "create");
    return { ...this.world.insert("closures", { ...values, active: true }) };
  }

  async setClosure(id: Id, active: boolean): Promise<Row> {
    this.manager("closures");
    return { ...this.world.update("closures", id, { active }) };
  }

  async setOnline(on: boolean): Promise<Row> {
    this.manager("settings");
    return { ...this.world.update("settings", this.world.settings().id, { online_on: on }) };
  }

  async receipts(): Promise<boolean> {
    return this.addOns.invoices;
  }

  /** The sample kitchen's menu is its own. */
  async menuShared(): Promise<boolean> {
    return false;
  }

  async holidays() {
    return this.addOns.holidays ? DEMO_HOLIDAYS : null;
  }

  subscribe(listener: (frame: LiveFrame) => void, onState?: (state: "live" | "reconnecting") => void): () => void {
    const off = this.world.on(listener);
    if (onState !== undefined) {
      this.stateListeners.add(onState);
      onState(this.live);
    }
    return () => {
      off();
      if (onState !== undefined) this.stateListeners.delete(onState);
    };
  }

  /** The demo's "the connection drops" and "it is back". */
  setLive(state: "live" | "reconnecting"): void {
    this.live = state;
    for (const listener of this.stateListeners) listener(state);
  }
}
