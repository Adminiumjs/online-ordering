/**
 * The kitchen's door into the demo's Adminium: the data API as Sam, signed
 * in to the kitchen (a manager too, so the Hours tab is theirs). Every write
 * goes through the demo's engine, held to the role's grants and limits as
 * the manifest writes them.
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import { DEMO_HOLIDAYS } from "../data/demo.ts";
import type { KitchenPerson, KitchenPort, Menu, OrderWithLines } from "../data/ports.ts";
import { ApiError, type Id, type LiveFrame, type OrderBody, type OrderReply, type Row } from "../data/wire.ts";
import { venueDay } from "../lib/venueTime.ts";
import { Engine, type Writer } from "./engine.ts";
import { MANIFEST_RULES } from "./rules.ts";

/** The holidays Holiday calendars offers the demo's kitchen (US, the rest of 2026). */
type Limit = { writable: readonly string[]; writableValues?: Record<string, readonly unknown[]> };

export class DemoKitchen implements KitchenPort {
  readonly person: KitchenPerson = { name: "Sam", roles: ["kitchen", "manager"] };
  /** Add-ons the demo card has switched on. */
  addOns = { invoices: true, holidays: true };
  private live: "live" | "reconnecting" = "live";
  private stateListeners = new Set<(state: "live" | "reconnecting") => void>();

  readonly engine: Engine;
  constructor(engine: Engine) {
    this.engine = engine;
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
      if (!limit.writable.includes(column)) throw new ApiError(403, "FORBIDDEN", `The kitchen does not change ${column}.`, { column });
      const allowed = limit.writableValues?.[column];
      if (allowed !== undefined && !allowed.includes(value)) throw new ApiError(403, "FORBIDDEN", `The kitchen does not set ${column} to ${String(value)}.`, { column });
    }
  }

  private manager(): void {
    if (!this.person.roles.includes("manager")) throw new ApiError(403, "FORBIDDEN", "Managers change these.");
  }

  async me() {
    return this.person;
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
      lines: this.world
        .where("order_items", (l) => l["order_id"] === order.id)
        .sort((a, b) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0))
        .map((line) => Object.assign({ ...line }, { options: this.world.where("order_item_modifiers", (o) => o["order_item_id"] === line.id).map((o) => ({ ...o })) })),
    };
  }

  async orders(from: string, to: string): Promise<OrderWithLines[]> {
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
    this.held("orders", { status: to });
    return { ...this.engine.updateOrder(id, { status: to }, this.writer, { from }) };
  }

  async cancel(id: Id, from: string, code: string, dish: string | null, note: string | null): Promise<Row> {
    const values = { status: "cancelled", cancel_code: code, cancel_dish: dish, cancel_note: note };
    this.held("orders", values);
    return { ...this.engine.updateOrder(id, values, this.writer, { from }) };
  }

  async handOff(id: Id, paid: "cash" | "card"): Promise<Row> {
    const values = { status: "picked_up", paid_method: paid };
    this.held("orders", values);
    return { ...this.engine.updateOrder(id, values, this.writer, { from: "ready" }) };
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

  async phoneOrder(body: OrderBody): Promise<OrderReply> {
    const values = { ...body.values, channel: "phone" };
    const lines = body.children.order_items.map((line) => ({ values: line.values, options: (line.children?.["order_item_modifiers"] ?? []).map((o) => o.values) }));
    // The kitchen reads the whole menu: a dish switched off online is still one it may sell by phone.
    const tree = this.engine.orderTree(values, lines, this.writer, { dry: false, readableDish: (d) => d["available"] === true, readableOption: (o) => o["available"] === true });
    const { order } = this.engine.writeOrder(tree, this.writer, { channel: "phone", customer_id: null, link_token: null });
    return { data: { ...order } };
  }

  async setHours(id: Id, values: { open?: boolean; opens?: string; closes?: string }): Promise<Row> {
    this.manager();
    return { ...this.world.update("hours", id, values) };
  }

  async addClosure(values: { from_date: string; to_date: string; reason: string | null }): Promise<Row> {
    this.manager();
    return { ...this.world.insert("closures", { ...values, active: true }) };
  }

  async setClosure(id: Id, active: boolean): Promise<Row> {
    this.manager();
    return { ...this.world.update("closures", id, { active }) };
  }

  async setOnline(on: boolean): Promise<Row> {
    this.manager();
    return { ...this.world.update("settings", this.world.settings().id, { online_on: on }) };
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
