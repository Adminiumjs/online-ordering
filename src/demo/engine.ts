/**
 * THE DEMO'S ADMINIUM — what the server decides on every write, in memory.
 *
 * The website's demo has no server, so a write in the demo goes through this
 * instead of the APIs, and comes out as Adminium would have left it:
 *
 *   1. a pickup time judged by the slot limit: the opening hours of its day,
 *      the closures, the quarter-hour grid, what the slot already holds — and,
 *      for a diner only, the paused slots, the notice and how far ahead;
 *   2. a dish's portions judged for the pickup's day (none left, or fewer
 *      than asked, is sold out);
 *   3. an order with its lines and options: each dish and option one the
 *      diner may read, each option of the line's own dish, each group within
 *      its least and most, no more items than an online order holds;
 *   4. the prices copied from the menu, each line's options summed, the
 *      subtotal, tax and total worked out — and a total other than the one
 *      the diner was shown written nowhere;
 *   5. the states: one listed move at a time, a repeat refused with when and
 *      by whom it got there, a cancel only with its reason, a finished order
 *      locked with its lines; the moves the clock makes at closing;
 *   6. the stamps (when, and who), the running number, the order's own link;
 *   7. the emails the producers queue.
 *
 * Refusals carry the server's own status, code and params (`PUBLIC_SLOT_FULL`,
 * `PUBLIC_SOLD_OUT`, `PUBLIC_PRICE_CHANGED`, `STATE_UNCHANGED` …), so a screen
 * says the same words it would against Adminium. The rules are the manifest's
 * (`rules.ts`, written from it, and the sample loader's `RULES`), each held to
 * it by a test — the Undo, the moves at closing and the held emails included.
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import { RULES, workOut } from "../data/sampleRows.ts";
import { ApiError, type DishState, type Id, type Row, type SlotCount, type SlotTime } from "../data/wire.ts";
import { addDays, daysBetween, hhmm, instantOf, minutesOf, toMs, venueDay, venueMinutes, weekdayOf, type Day } from "../lib/venueTime.ts";
import { MANIFEST_RULES } from "./rules.ts";
import type { Table, World } from "./world.ts";

/** Who is writing, and through which door — what the stamps and the moves read. */
export interface Writer {
  /** `public`: a diner's page; `staff`: a person in the kitchen; `automation`: the clock. */
  origin: "public" | "staff" | "automation";
  name: string | null;
  roles: readonly string[];
}

export const CLOCK: Writer = { origin: "automation", name: "Timed move", roles: [] };


const COUNTED = ["placed", "confirmed", "preparing", "ready", "picked_up"];
const iso = (ms: number) => new Date(ms).toISOString();
const empty = (value: unknown) => value === null || value === undefined || (typeof value === "string" && value.trim() === "");
const round2 = (n: number) => Math.round(n * 100) / 100;

type StampRule = { set: unknown; on: unknown };
type Trigger = "create" | { column: string; values: unknown[] } | { column: string; filled: true } | { columns: string[] };

export class Engine {
  readonly world: World;
  /** Whether a feature of the app is on: its add-ons attached (the demo card switches them). */
  featureOn: (feature: string) => boolean = () => true;
  constructor(world: World) {
    this.world = world;
  }

  get now(): number {
    return this.world.now;
  }

  private setting(column: string): unknown {
    return this.world.settings()[column];
  }
  private num(column: string): number {
    return Number(this.setting(column));
  }

  today(): Day {
    return venueDay(this.now, this.world.zone);
  }

  // ── the slot limit ─────────────────────────────────────────────────────────

  /** A day's opening, from the hours and the closures. */
  dayHours(day: Day): { open: boolean; opens: string; closes: string; closure: Row | null } {
    const hours = this.world.all("hours").find((h) => h["weekday"] === weekdayOf(day));
    const closure =
      this.world.all("closures").find((c) => c["active"] === true && String(c["from_date"]) <= day && day <= String(c["to_date"] ?? c["from_date"])) ?? null;
    return {
      open: hours !== undefined && hours["open"] === true && closure === null,
      opens: String(hours?.["opens"] ?? "00:00"),
      closes: String(hours?.["closes"] ?? "00:00"),
      closure,
    };
  }

  /** The pickup times of a day: from opening, every slot, the last one a slot before closing. */
  grid(day: Day): { time: string; at: number }[] {
    const h = this.dayHours(day);
    if (!h.open) return [];
    const step = this.num("slot_minutes");
    const out: { time: string; at: number }[] = [];
    for (let m = minutesOf(h.opens); m <= minutesOf(h.closes) - step; m += step) out.push({ time: hhmm(m), at: instantOf(day, hhmm(m), this.world.zone) });
    return out;
  }

  /** How many orders a pickup time holds (one leaving it out). */
  taken(at: number, except?: Id): number {
    return this.world.where("orders", (o) => o.id !== except && COUNTED.includes(String(o["status"])) && toMs(String(o["pickup_at"])) === at).length;
  }

  pauseAt(at: number): Row | undefined {
    return this.world.all("slot_pauses").find((p) => p["active"] === true && toMs(String(p["slot_at"])) === at);
  }

  /** Whether a diner may still take a time: not past, with the notice given, inside the days ahead. */
  private takeable(at: number, day: Day): boolean {
    if (at < this.now) return false;
    if (this.now + this.num("lead_minutes") * 60_000 > at) return false;
    return daysBetween(this.today(), day) <= this.num("preorder_days");
  }

  /** `GET /public/availability/orders?date=`: each time of the day, free, full or paused. */
  slotAnswer(day: Day): SlotTime[] {
    const size = this.num("slot_capacity");
    return this.grid(day).map(({ time, at }) => {
      if (this.pauseAt(at) !== undefined) return { time, state: "paused" };
      return { time, state: this.taken(at) + 1 <= size && this.takeable(at, day) ? "free" : "full" };
    });
  }

  /** The kitchen's counts: each slot of a day, what it holds, and its pause. */
  slotCounts(day: Day): SlotCount[] {
    const size = this.num("slot_capacity");
    return this.grid(day).map(({ time, at }) => {
      const pause = this.pauseAt(at);
      return { time, at: iso(at), taken: this.taken(at), size, pause: pause === undefined ? null : { id: pause.id, by: (pause["paused_by"] as string | null) ?? null } };
    });
  }

  /**
   * A pickup time judged for a write: its day open, inside its hours, on the
   * grid, not past, inside the days ahead, with room — and, for a diner, not
   * paused and with the notice given. A diner hears the public API's refusal
   * (`{column, reason}`); the kitchen the data API's (`fields.pickup_at`, and
   * the limit's own `CAPACITY_FULL`).
   */
  judgeSlot(pickupAt: unknown, origin: Writer["origin"], except?: Id): void {
    const refuse = (code: "closed" | "out-of-hours" | "out-of-range" | "paused" | "required"): never => {
      if (origin === "public") throw refusedValue("pickup_at", code === "required" ? "out-of-range" : code);
      const reason = code === "required" ? undefined : `CAPACITY_${code.toUpperCase().replace(/-/g, "_")}`;
      throw new ApiError(422, "VALIDATION_FAILED", "Some values were refused.", { fields: { pickup_at: { code } }, ...(reason === undefined ? {} : { reason }) });
    };
    // An order holds a pickup time: none is priced without one.
    if (pickupAt === undefined || pickupAt === null || pickupAt === "") refuse("required");
    const at = toMs(String(pickupAt));
    if (Number.isNaN(at)) refuse("out-of-range");
    const day = venueDay(at, this.world.zone);
    const h = this.dayHours(day);
    if (!h.open) refuse("closed");
    const minute = venueMinutes(at, this.world.zone);
    if (minute < minutesOf(h.opens) || minute >= minutesOf(h.closes)) refuse("out-of-hours");
    const onGrid = this.grid(day).some((slot) => slot.at === at);
    if (!onGrid || at < this.now || daysBetween(this.today(), day) > this.num("preorder_days")) refuse("out-of-range");
    if (origin === "public") {
      if (this.pauseAt(at) !== undefined) refuse("paused");
      if (!this.takeable(at, day)) refuse("out-of-range");
    }
    if (this.taken(at, except) + 1 > this.num("slot_capacity")) {
      if (origin === "public") throw new ApiError(409, "PUBLIC_SLOT_FULL", "That time is full.", { column: "pickup_at" });
      throw new ApiError(409, "CAPACITY_FULL", "That time is full.", { column: "pickup_at", rule: 0, kind: "slot", pool: { key: iso(at), at: day }, left: 0 });
    }
  }

  // ── a dish's portions for a day ─────────────────────────────────────────────

  /** How many of a dish the orders of a day hold. */
  ordered(dishId: Id, day: Day, exceptOrder?: Id): number {
    let n = 0;
    for (const order of this.world.where("orders", (o) => o.id !== exceptOrder && COUNTED.includes(String(o["status"])))) {
      if (venueDay(String(order["pickup_at"]), this.world.zone) !== day) continue;
      for (const line of this.world.where("order_items", (l) => l["order_id"] === order.id && l["menu_item_id"] === dishId)) n += Number(line["qty"]);
    }
    return n;
  }

  /** A dish's portions on a day: its limit (none when it is set for another day) and what is left. */
  portions(dish: Row, day: Day, exceptOrder?: Id): { size: number | null; left: number | null } {
    const size = dish["stock_today"] === null || dish["stock_today"] === undefined || dish["stock_on"] !== day ? null : Number(dish["stock_today"]);
    return { size, left: size === null ? null : size - this.ordered(dish.id, day, exceptOrder) };
  }

  /** `GET /public/availability/order_items?date=&qty=`: each dish a diner may read, on sale or sold out. */
  dishAnswer(day: Day, qty = 1, readable: (dish: Row) => boolean): DishState[] {
    // A page may ask about no more than it is shown: "fewer than five left".
    const asked = Math.max(1, Math.min(qty, 5));
    return this.world.where("menu_items", readable).map((dish) => {
      const { left } = this.portions(dish, day);
      const soldout = left !== null && left < asked;
      const shown = left !== null && left < 5 ? Math.max(0, left) : undefined;
      return { id: String(dish.id), state: soldout ? "soldout" : "on", ...(shown === undefined || soldout ? {} : { left: shown }) };
    });
  }

  // ── writing an order with its lines ─────────────────────────────────────────

  /**
   * An order and its lines and options, judged and worked out — written, or
   * (with `dry`) only quoted. The order row comes back with its figures, each
   * line with its own and its options.
   */
  orderTree(
    values: Record<string, unknown>,
    lines: { values: Record<string, unknown>; options: Record<string, unknown>[] }[],
    writer: Writer,
    opts: { dry: boolean; readableDish: (dish: Row) => boolean; readableOption: (option: Row) => boolean; except?: Id },
  ): { order: Record<string, unknown>; lines: { line: Record<string, unknown>; options: Record<string, unknown>[] }[] } {
    const pub = writer.origin === "public";
    // A diner's lines are held to the entry's 1 to 20; the kitchen's are not (a staff tree takes up to 200).
    const refused = (params: Record<string, unknown>) => treeRefused(params, writer.origin);
    if (pub && lines.length === 0) throw refused({ child: "order_items", reason: "too-few" });
    if (lines.length > (pub ? 20 : 200)) throw refused({ child: "order_items", reason: "too-many" });
    const at = (i: number) => ({ child: "order_items", index: i, path: ["order_items", i] });
    const optionAt = (i: number, j: number) => ({ child: "order_item_modifiers", index: j, path: ["order_items", i, "order_item_modifiers", j] });

    // Each line: a dish the writer may read, a whole quantity of 1 to 20.
    const built = lines.map((line, i) => {
      const dish = this.world.get("menu_items", Number(line.values["menu_item_id"]));
      if (dish === undefined || !opts.readableDish(dish)) throw refused({ ...at(i), column: "menu_item_id", reason: "not-offered" });
      const qty = Number(line.values["qty"] ?? 1);
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw refused({ ...at(i), column: "qty", reason: qty < 1 ? "too-small" : "too-large" });
      if (line.options.length > 20) throw refused({ child: "order_item_modifiers", path: ["order_items", i, "order_item_modifiers"], reason: "too-many" });
      const options = line.options.map((option, j) => {
        const modifier = this.world.get("modifiers", Number(option["modifier_id"]));
        if (modifier === undefined || !opts.readableOption(modifier)) throw refused({ ...optionAt(i, j), column: "modifier_id", reason: "not-offered" });
        // An option of another dish is not one this line is offered.
        const group = this.world.get("modifier_groups", Number(modifier["group_id"]));
        if (group === undefined || group["item_id"] !== dish.id) throw refused({ ...optionAt(i, j), column: "modifier_id", reason: "not-offered" });
        return { modifier, group };
      });
      // Every group of the dish, chosen within its least and its most — judged on the line (an option twice counts twice).
      for (const group of this.world.where("modifier_groups", (g) => g["item_id"] === dish.id)) {
        const n = options.filter((o) => o.group.id === group.id).length;
        if (n < Number(group["min"] ?? 0) || n > Number(group["max"] ?? Infinity)) {
          throw refused({ ...at(i), reason: n < Number(group["min"] ?? 0) ? "too-few" : "too-many", group: group.id });
        }
      }
      return { dish, qty, note: line.values["note"] ?? null, options };
    });

    // No more items than an online order holds.
    const items = built.reduce((n, line) => n + line.qty, 0);
    if (items > this.num("max_items")) throw refused({ child: "order_items", column: "qty", reason: "too-many" });

    // The pickup time — a quote too: an order is priced only on a time it could hold — then each dish's portions on its day.
    this.judgeSlot(values["pickup_at"], writer.origin, opts.except);
    const day = venueDay(String(values["pickup_at"]), this.world.zone);
    const wanted = new Map<Id, number>();
    built.forEach((line, i) => {
      wanted.set(line.dish.id, (wanted.get(line.dish.id) ?? 0) + line.qty);
      const { left } = this.portions(line.dish, day, opts.except);
      if (left !== null && wanted.get(line.dish.id)! > left) {
        // The line's link to what ran out; the kitchen hears the limit's own answer, naming the dish.
        if (pub) throw new ApiError(409, "PUBLIC_SOLD_OUT", "That is sold out.", { ...at(i), column: "menu_item_id" });
        throw new ApiError(409, "CAPACITY_FULL", "That is sold out.", { column: "menu_item_id", rule: 0, kind: "parent", row: i, pool: { key: String(line.dish.id), at: day }, left: Math.max(0, left) });
      }
    });

    // The figures, as the copies, the rollups and the formulas leave them.
    const lineRows = built.map((line, i) => {
      const optionRows = line.options.map(({ modifier }) => ({ modifier_id: modifier.id, name: modifier["name"], price_delta: Number(modifier["price_delta"]) }));
      const row: Record<string, unknown> = {
        position: i + 1,
        menu_item_id: line.dish.id,
        qty: line.qty,
        note: empty(line.note) ? null : line.note,
        name: line.dish["name"],
        unit_price: Number(line.dish["price"]),
        options_total: round2(optionRows.reduce((sum, o) => sum + o.price_delta, 0)),
      };
      settleFormulas("order_items", row);
      return { line: row, options: optionRows };
    });
    const order: Record<string, unknown> = {
      ...values,
      tax_rate: values["tax_rate"] ?? this.setting("tax_rate"),
      item_count: items,
      subtotal: round2(lineRows.reduce((sum, l) => sum + Number(l.line["line_total"]), 0)),
    };
    settleFormulas("orders", order);
    return { order, lines: lineRows };
  }

  /** Writes a judged order and its rows; stamps, number and emails as a create leaves them. */
  writeOrder(tree: ReturnType<Engine["orderTree"]>, writer: Writer, extra: Record<string, unknown> = {}): { order: Row; lines: (Row & { options: Row[] })[] } {
    const values: Record<string, unknown> = {
      status: "placed",
      channel: "online",
      link_stopped: false,
      ...tree.order,
      ...extra,
      number_seq: this.world.nextNumber("orders", "number_seq"),
    };
    values["number"] = String(values["number_seq"]);
    Object.assign(values, this.stampsFor("orders", null, values, writer));
    const order = this.world.insert("orders", values);
    const lines = tree.lines.map(({ line, options }) => {
      const written = this.world.insert("order_items", { ...line, order_id: order.id });
      const optionRows = options.map((o) => this.world.insert("order_item_modifiers", { ...o, order_item_id: written.id }));
      return Object.assign(written, { options: optionRows });
    });
    this.produce("orders", null, order);
    return { order, lines };
  }

  // ── the states of an order ──────────────────────────────────────────────────

  /**
   * A change of an order: a move by its listed moves, strict — a move to the
   * state it holds is refused, naming when and by whom it got there — and
   * nothing but its exceptions once it is finished. A move marked `undo` is
   * made only by a write naming the state it saw, within its time, and
   * empties the stamps marked `clearOnBack` of the state it leaves.
   */
  updateOrder(id: Id, values: Record<string, unknown>, writer: Writer, opts: { from?: string } = {}): Row {
    const stored = this.world.get("orders", id);
    if (stored === undefined) throw new ApiError(404, "NOT_FOUND", "No such order.");
    const before = { ...stored };
    const states = MANIFEST_RULES.states.orders;
    const was = String(stored["status"]);
    const to = values["status"] === undefined ? was : String(values["status"]);
    const lock = states.lock.when as readonly string[];
    if (to === was && values["status"] !== undefined) {
      // Once means once: the stamps of the move into this state say when, and who.
      const at = stored[`${was}_at`] ?? null;
      const by = stored[`${was}_by`] ?? null;
      throw new ApiError(409, "STATE_UNCHANGED", `Already ${was}.`, { column: "status", state: was, at, by });
    }
    if (to !== was) {
      if (opts.from !== undefined && opts.from !== was) throw new ApiError(409, "STATE_MOVE_REFUSED", `It is ${was} now.`, { column: "status", from: was, to, named: opts.from });
      const listed = ((states.moves as Record<string, readonly unknown[]>)[was] ?? []).find((m) => (typeof m === "string" ? m : (m as { to: string }).to) === to) as
        | string
        | {
            to: string;
            roles?: readonly string[];
            undo?: true;
            requires?: { where?: readonly { column: string; isNull?: boolean }[]; time?: { before?: { column: string; plus?: { minutes?: number } } } };
          }
        | undefined;
      if (listed === undefined) throw new ApiError(409, "STATE_MOVE_REFUSED", `No move from ${was} to ${to}.`, { column: "status", from: was, to });
      const move = typeof listed === "object" ? listed : { to };
      if (move.roles !== undefined && writer.origin !== "automation" && !writer.roles.some((r) => move.roles!.includes(r))) {
        // The roles by their slugs, as the installed app names them.
        throw new ApiError(409, "STATE_MOVE_REFUSED", `Not yours to move from ${was} to ${to}.`, { column: "status", from: was, to, roles: move.roles.map((r) => `ordering-${r}`) });
      }
      // An undo only from the state the screen showed.
      if (move.undo === true && opts.from === undefined) throw new ApiError(409, "STATE_MOVE_REFUSED", "Name the state it was in.", { column: "status", from: was, to, undo: true });
      // What it waits for, judged on the row as it stands.
      const until = move.requires?.time?.before;
      if (until !== undefined) {
        const base = stored[until.column];
        const by = empty(base) ? null : toMs(String(base)) + (until.plus?.minutes ?? 0) * 60_000;
        if (by === null || this.now >= by) {
          throw new ApiError(409, "STATE_MOVE_REFUSED", "Too late to take it back.", { column: "status", from: was, to, requires: "time", bound: "before", ...(by === null ? {} : { at: iso(by) }) });
        }
      }
      const after = { ...stored, ...values };
      for (const condition of move.requires?.where ?? []) {
        if (condition.isNull === false && empty(after[condition.column])) {
          throw new ApiError(409, "STATE_MOVE_REFUSED", `A move to ${to} needs ${condition.column}.`, { column: "status", from: was, to, requires: condition.column });
        }
      }
    } else if (lock.includes(was)) {
      const except = (states.lock.except ?? []) as readonly string[];
      const locked = Object.keys(values).filter((c) => !except.includes(c));
      if (locked.length > 0) throw new ApiError(409, "RECORD_LOCKED", "A finished order does not change.", { column: locked[0], state: was });
    }
    let change: Record<string, unknown> = { ...values };
    const listedTo = ((states.moves as Record<string, readonly unknown[]>)[was] ?? []).find((m) => typeof m === "object" && (m as { to: string }).to === to) as { undo?: true } | undefined;
    const backward = to !== was && listedTo?.undo === true;
    if (backward) {
      // The stamps of the state it leaves are emptied; those of the state it returns to keep what they had.
      const rules = (MANIFEST_RULES.stamps as Record<string, Record<string, StampRule & { clearOnBack?: true }>>)["orders"] ?? {};
      for (const [column, rule] of Object.entries(rules)) {
        const on = (Array.isArray(rule.on) ? rule.on : [rule.on]) as Trigger[];
        const watches = (state: string) => on.some((t) => typeof t === "object" && "values" in t && t.column === "status" && t.values.includes(state));
        if (rule.clearOnBack === true && watches(was) && !watches(to)) change[column] = null;
      }
    }
    // A backward move never stamps the state it returns to again.
    if (!backward) change = { ...change, ...this.stampsFor("orders", stored, { ...stored, ...change }, writer) };
    const row = this.world.update("orders", id, change);
    if (to !== was) this.produce("orders", before, row);
    return row;
  }

  /** The moves the clock makes: at closing, a ready order not collected; half an hour on, an unfinished one cancelled. */
  runTimed(): Row[] {
    const moved: Row[] = [];
    for (const order of this.world.all("orders")) {
      const status = String(order["status"]);
      const day = venueDay(String(order["pickup_at"]), this.world.zone);
      const h = this.dayHours(day);
      // A closed day ends at midnight.
      const closes = h.open || h.closure === null ? instantOf(day, h.closes, this.world.zone) : instantOf(addDays(day, 1), "00:00", this.world.zone);
      for (const timed of MANIFEST_RULES.states.orders.timed as readonly { from: string; to: string; at: { plus?: { minutes?: number } }; set?: Record<string, unknown> }[]) {
        if (timed.from === status && this.now >= closes + (timed.at.plus?.minutes ?? 0) * 60_000) {
          moved.push(this.updateOrder(order.id, { status: timed.to, ...timed.set }, CLOCK));
        }
      }
    }
    this.sendDue();
    return moved;
  }

  // ── stamps ─────────────────────────────────────────────────────────────────

  /** The stamps a write fires: on create, or when a watched column changes. */
  stampsFor(table: Table, stored: Row | null, after: Record<string, unknown>, writer: Writer): Record<string, unknown> {
    const rules = ((MANIFEST_RULES.stamps as Record<string, Record<string, StampRule>>)[table] ?? {}) as Record<string, StampRule>;
    const out: Record<string, unknown> = {};
    for (const [column, rule] of Object.entries(rules)) {
      const triggers = (Array.isArray(rule.on) ? rule.on : [rule.on]) as Trigger[];
      const fires = triggers.some((trigger) => {
        if (trigger === "create") return stored === null;
        if ("columns" in trigger) return stored === null || trigger.columns.some((c) => after[c] !== stored[c]);
        if ("filled" in trigger) return empty(stored?.[trigger.column]) && !empty(after[trigger.column]);
        const changed = stored === null || after[trigger.column] !== stored[trigger.column];
        return changed && trigger.values.includes(after[trigger.column]);
      });
      if (fires) out[column] = this.stampValue(rule.set, after, writer);
    }
    return out;
  }

  private stampValue(set: unknown, row: Record<string, unknown>, writer: Writer): unknown {
    if (set === "now") return iso(this.now);
    if (set === "today") return this.today();
    // A public write never stamps a person: a browser key is nobody.
    if (set === "user-name") return writer.origin === "public" ? null : writer.name;
    const object = set as Record<string, Record<string, unknown>>;
    if (object["byOrigin"] !== undefined) return writer.origin === "public" ? object["byOrigin"]["public"] : writer.name;
    if (object["moment"] !== undefined) {
      const moment = object["moment"] as { column: string; plus?: { days?: number } };
      const base = row[moment.column];
      return empty(base) ? null : iso(toMs(String(base)) + (moment.plus?.days ?? 0) * 86_400_000);
    }
    return null;
  }

  // ── emails ────────────────────────────────────────────────────────────────

  /** Queues what the producers queue for a write (a create when `before` is null). */
  produce(table: Table, before: Row | null, after: Row): void {
    for (const producer of MANIFEST_RULES.producers as readonly Record<string, unknown>[]) {
      const source = (producer["onCreate"] ?? producer["onChange"]) as { table: string; column?: string; to?: unknown; where?: { column: string; eq: unknown } };
      if (source.table !== table) continue;
      if (producer["onCreate"] !== undefined && before !== null) continue;
      if (producer["onChange"] !== undefined && (before === null || before[source.column!] === after[source.column!] || after[source.column!] !== source.to)) continue;
      if (source.where !== undefined && after[source.where.column] !== source.where.eq) continue;
      const gate = producer["gate"] as { setting: { column: string } } | { feature: string } | undefined;
      if (gate !== undefined && "setting" in gate && this.setting(gate.setting.column) !== true) continue;
      if (gate !== undefined && "feature" in gate && !this.featureOn(gate.feature)) continue;
      const kind = String(producer["kind"]);
      const link = String(producer["link"]);
      if (this.world.where("messages", (m) => m["kind"] === kind && m[link] === after.id && m["status"] !== "skipped").length > 0) continue;
      const recipient = producer["recipient"] as { column: string } | undefined;
      const customer = table === "orders" && !empty(after["customer_id"]) ? this.world.get("customers", Number(after["customer_id"])) : undefined;
      const to = recipient !== undefined ? after[recipient.column] : (customer?.["email"] ?? after["email"]);
      const hold = typeof producer["holdSeconds"] === "number" ? producer["holdSeconds"] * 1000 : 0;
      this.world.insert("messages", {
        kind,
        status: empty(to) ? "skipped" : "queued",
        to_address: empty(to) ? null : to,
        language: after["language"] ?? null,
        order_id: table === "orders" ? after.id : null,
        enquiry_id: table === "enquiries" ? after.id : null,
        customer_id: customer?.id ?? null,
        due: iso(this.now + hold),
        created_at: iso(this.now),
        sent_at: null,
        error: null,
        skip_reason: empty(to) ? "no-longer-needed" : null,
      });
    }
    this.sendDue();
  }

  /** Sends what has come due; a waiting message whose row meets its producer's `dropWhen` is dropped. */
  sendDue(): void {
    for (const message of this.world.where("messages", (m) => m["status"] === "queued")) {
      const order = message["order_id"] === null ? undefined : this.world.get("orders", Number(message["order_id"]));
      const producer = (MANIFEST_RULES.producers as readonly Record<string, unknown>[]).find((p) => p["kind"] === message["kind"]);
      const drops = (producer?.["dropWhen"] ?? []) as readonly { column: string; in: readonly unknown[]; reason: string }[];
      const drop = order === undefined ? undefined : drops.find((d) => d.in.includes(order[d.column]));
      if (drop !== undefined) {
        this.world.update("messages", message.id, { status: "skipped", skip_reason: drop.reason });
        continue;
      }
      if (toMs(String(message["due"])) <= this.now) this.world.update("messages", message.id, { status: "sent", sent_at: iso(this.now) });
    }
  }

  /** Every figure of a changed order, again (a line added or changed by staff). */
  settleOrder(id: Id): void {
    const order = this.world.get("orders", id)!;
    const lines = this.world.where("order_items", (l) => l["order_id"] === id);
    for (const line of lines) {
      const options = this.world.where("order_item_modifiers", (o) => o["order_item_id"] === line.id);
      line["options_total"] = round2(options.reduce((sum, o) => sum + Number(o["price_delta"]), 0));
      settleFormulas("order_items", line);
    }
    order["item_count"] = lines.reduce((n, l) => n + Number(l["qty"]), 0);
    order["subtotal"] = round2(lines.reduce((sum, l) => sum + Number(l["line_total"]), 0));
    settleFormulas("orders", order);
  }

  /** Minutes after the kitchen's midnight, now. */
  minutesNow(): number {
    return venueMinutes(this.now, this.world.zone);
  }
}

/** A table's formulas, worked out over the row in the order they read each other. */
function settleFormulas(table: string, row: Record<string, unknown>): void {
  const own = RULES.formulas.filter((f) => f.table === table);
  for (let pass = 0; pass < own.length; pass += 1) {
    for (const formula of own) row[formula.column] = workOut(formula.expr, row, typeof formula.scale === "number" ? formula.scale : 2);
  }
}

/** A diner's value refused: which column, and why (the public API names no reason for a missing or not plain-text value). */
export function refusedValue(column: string, reason?: string): ApiError {
  return new ApiError(400, "PUBLIC_WRITE_REFUSED", `${column}: ${reason ?? "refused"}`, reason === undefined ? { column } : { column, reason });
}

/** A value a diner may not write at all: refused, naming nothing. */
export function refusedWrite(): ApiError {
  return new ApiError(400, "PUBLIC_WRITE_REFUSED", "That cannot be written here.");
}

/**
 * A row of an order's tree refused: its list, its place, and why — as the
 * public API says it to a diner, and as the data API says it to the kitchen
 * (422, the column's code under `fields`; the list and place as the
 * kitchen's door reads them back from the data API's relation and row).
 */
export function treeRefused(params: Record<string, unknown>, origin: Writer["origin"] = "public"): ApiError {
  if (origin === "public") return new ApiError(400, "PUBLIC_WRITE_REFUSED", `refused: ${String(params["reason"])}`, params);
  const column = typeof params["column"] === "string" ? params["column"] : "order_items";
  return new ApiError(422, "VALIDATION_FAILED", "Some values were refused.", { fields: { [column]: { code: params["reason"] } }, ...params });
}
