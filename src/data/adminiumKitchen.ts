/**
 * The kitchen's door into a real Adminium: the data API as the person signed
 * in to it, the way the dashboard reads it — the app served by Adminium at
 * `/apps/ordering/staff/`, riding that person's session, their roles and
 * limits holding every read and write.
 *
 * Everything the kitchen needs to start is in the staff `surface-config.json`:
 * the connection, the tables' real names, the kitchen's zone and money, who is
 * signed in and the roles they hold, the add-ons attached. A kitchen person
 * may not read the dashboard's own routes, so nothing here asks them.
 *
 * Every figure is Adminium's: a phone order's price is its dry run, what a
 * slot or a dish holds the limit's own counts. A move is a change of
 * `status`, judged by the table's states; the status the screen saw goes with
 * it, so an order that moved on since is refused rather than moved twice. A
 * phone order's save carries the price the screen showed and a retry key.
 *
 * Each engine spells a moment and a yes/no its own way (SQLite: the server's
 * wall time with no zone, and 0 or 1); every row is read back here as the
 * screens expect it, an ISO instant and a boolean.
 */
import type { KitchenPerson, KitchenPort, Menu, OrderWithLines } from "./ports.ts";
import { SessionPortError, type SessionTransport } from "./sessionSource.ts";
import type { StaffConfig } from "../staffConnection.ts";
import { MOMENTS, YES_NO } from "./columnKinds.ts";
import { addDays, instantOf, zoneOffsetMs, type Day } from "../lib/venueTime.ts";
import { ApiError, type Id, type LiveFrame, type OrderBody, type OrderReply, type QuoteReply, type Row, type SlotCount, type TreeRow } from "./wire.ts";

/** The app's key: its roles are named `ordering-<role>`, its tables `ordering_<table>` when the server does not say. */
const APP_KEY = "ordering";
const PAGE = 200;

type Table =
  | "settings" | "menu_categories" | "menu_items" | "modifier_groups" | "modifiers" | "hours" | "closures" | "slot_pauses"
  | "orders" | "order_items" | "order_item_modifiers";

/** The tables whose changes the kitchen hears: every one it reads (a channel it may not read refuses the whole stream). */
const LIVE: readonly Table[] = ["orders", "order_items", "order_item_modifiers", "slot_pauses", "menu_items", "modifiers", "modifier_groups", "menu_categories", "settings", "hours", "closures"];

/** The transport's refusal as the screens read one: its status, its code, what it said beside. */
function asApiError(error: unknown): unknown {
  if (error instanceof SessionPortError) {
    const details = error.details !== null && typeof error.details === "object" && !Array.isArray(error.details) ? (error.details as Record<string, unknown>) : {};
    return new ApiError(error.status, error.code, error.message, details);
  }
  return error;
}

const byPosition = (a: Row, b: Row) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0) || Number(a.id) - Number(b.id);
const q = (value: unknown) => encodeURIComponent(JSON.stringify(value));

/**
 * A moment as SQLite hands it back — the server's wall time, `2026-07-28
 * 18:40:00[.123]`, no zone — as the instant it is, in ISO; any other spelling
 * (an ISO instant, a Date's JSON) as it came.
 */
export function momentOf(value: unknown, serverZone: string): unknown {
  if (typeof value !== "string") return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(value);
  if (m === null) return value;
  const [y, mo, d, h, mi, s = "0", frac = "0"] = m.slice(1).map((part) => part ?? "0") as string[];
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(frac.padEnd(3, "0").slice(0, 3)));
  const first = wall - zoneOffsetMs(serverZone, wall);
  const instant = wall - zoneOffsetMs(serverZone, first);
  return new Date(instant).toISOString();
}

/** A yes/no as MySQL or SQLite hands it back (0, 1, "1"), as a boolean. */
const yesNo = (value: unknown): unknown => (value === null || value === undefined || typeof value === "boolean" ? value : value === 1 || value === "1" || value === "true");

export interface KitchenDoorOptions {
  /** The live stream's connection: `EventSource` in a browser, a stand-in in a test. */
  stream?: (url: string) => EventSourceLike;
  /** Where signing in goes. */
  leave?: (url: string) => void;
  /** The staff config read again: whether this screen is still signed in. */
  reload?: () => Promise<StaffConfig | null>;
}

/** `EventSource.CLOSED`: the browser will not try again by itself. */
const CLOSED = 2;

export interface EventSourceLike {
  /** 0 connecting, 1 open, 2 closed for good. */
  readonly readyState?: number;
  onopen: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  addEventListener(type: string, listener: (event: { data: string }) => void): void;
  close(): void;
}

export class AdminiumKitchen implements KitchenPort {
  private readonly t: SessionTransport;
  private readonly cfg: StaffConfig;
  private readonly opts: KitchenDoorOptions;
  private settingsId: Id | null = null;
  private dishIds: Id[] | null = null;

  constructor(transport: SessionTransport, config: StaffConfig, options: KitchenDoorOptions = {}) {
    this.t = transport;
    this.cfg = config;
    this.opts = options;
  }

  // ── the wire ──────────────────────────────────────────────────────────────

  /** The kitchen's zone: the connection's, else UTC — the zone the server works the kitchen's days in. */
  private get zone(): string {
    return this.cfg.timezone ?? "UTC";
  }
  /** The zone a moment without one is spelled in: the server's own. */
  private get serverZone(): string {
    return this.cfg.serverTimezone ?? "UTC";
  }
  private real(table: Table): string {
    return this.cfg.tables[table] ?? `${APP_KEY}_${table}`;
  }
  private async path(table: Table, rest = ""): Promise<string> {
    const conn = this.cfg.connectionId ?? (await this.t.connection());
    return `/api/v1/data/${encodeURIComponent(conn)}/${encodeURIComponent(this.real(table))}${rest}`;
  }
  /** A row as every screen reads it: moments in ISO, yes/no as booleans. */
  private row(table: Table, row: Row): Row {
    const out: Row = { ...row };
    for (const column of MOMENTS[table] ?? []) if (column in out) out[column] = momentOf(out[column], this.serverZone);
    for (const column of YES_NO[table] ?? []) if (column in out) out[column] = yesNo(out[column]);
    return out;
  }
  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw await this.refusal(asApiError(error));
    }
  }
  private async list(table: Table, query: { where?: unknown; order?: string } = {}): Promise<Row[]> {
    const rows: Row[] = [];
    const extra = `${query.where === undefined ? "" : `&where=${q(query.where)}`}${query.order === undefined ? "" : `&order=${encodeURIComponent(query.order)}`}`;
    for (let offset = 0; offset < 50 * PAGE; offset += PAGE) {
      const got = await this.t.get<{ data: Row[] }>(await this.path(table, `?limit=${String(PAGE)}&offset=${String(offset)}${extra}`));
      rows.push(...got.data.map((r) => this.row(table, r)));
      if (got.data.length < PAGE) break;
    }
    return rows;
  }
  /** Rows whose column is one of many values, a page of values at a time. */
  private async listIn(table: Table, column: string, values: readonly unknown[], order?: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let i = 0; i < values.length; i += PAGE) {
      rows.push(...(await this.list(table, { where: { column, op: "in", value: values.slice(i, i + PAGE) }, ...(order === undefined ? {} : { order }) })));
    }
    return rows;
  }
  private async one(table: Table, id: Id): Promise<Row> {
    return this.row(table, (await this.t.get<{ data: Row }>(await this.path(table, `/${encodeURIComponent(String(id))}`))).data);
  }
  private async create(table: Table, values: Record<string, unknown>): Promise<Row> {
    return this.row(table, (await this.t.mutate<{ data: Row }>(await this.path(table), "POST", { values })).data);
  }
  private async change(table: Table, id: Id, values: Record<string, unknown>, from?: string): Promise<Row> {
    const body = from === undefined ? { values } : { values, from };
    return this.row(table, (await this.t.mutate<{ data: Row }>(await this.path(table, `/${encodeURIComponent(String(id))}`), "PATCH", body)).data);
  }

  /**
   * A refusal as the screens read it. The data API names a refused row of a
   * write's tree by the relation it came in on and its place (`relation`,
   * `row`, and `under` for a row below a row); the screens read the list
   * and place by name (`path: ["order_items", 1, "order_item_modifiers", 0]`).
   */
  private async refusal(error: unknown): Promise<unknown> {
    if (!(error instanceof ApiError) || typeof error.params["relation"] !== "string") return error;
    const [lines, options] = await Promise.all([this.t.relation(this.real("order_items"), "order_id"), this.t.relation(this.real("order_item_modifiers"), "order_item_id")]);
    const relation = error.params["relation"];
    const row = error.params["row"];
    const under = error.params["under"] as { relation?: unknown; row?: unknown } | undefined;
    let place: Record<string, unknown> = {};
    if (relation === lines && typeof row === "number") place = { child: "order_items", index: row, path: ["order_items", row] };
    if (relation === options && typeof row === "number" && under?.relation === lines && typeof under.row === "number") {
      place = { child: "order_item_modifiers", index: row, path: ["order_items", under.row, "order_item_modifiers", row] };
    }
    return new ApiError(error.status, error.code, error.message, { ...error.params, ...place });
  }

  // ── who, and the kitchen ──────────────────────────────────────────────────

  /** The person from a staff config: their name, and the app's roles they hold (a manager is anyone who may change the hours). */
  private personOf(cfg: StaffConfig): KitchenPerson {
    const prefix = `${APP_KEY}-`;
    const roles = (cfg.access?.roles ?? []).map((r) => r.slug).filter((slug) => slug.startsWith(prefix)).map((slug) => slug.slice(prefix.length));
    if (!roles.includes("manager") && cfg.access?.tables["hours"]?.includes("update") === true) roles.push("manager");
    return { name: cfg.user?.name ?? "", roles };
  }

  async me(): Promise<KitchenPerson> {
    // Asked every minute: the config read again says whether this screen is still signed in.
    const cfg = this.opts.reload === undefined ? this.cfg : await this.opts.reload();
    if (cfg === null || cfg.user === null) throw new ApiError(401, "UNAUTHENTICATED", "Sign in again.");
    return this.personOf(cfg);
  }

  async config(): Promise<{ timezone: string | null; currency: string | null; zoneSet: boolean }> {
    // The transport takes the session's write token here: a move made before any read still goes.
    await this.t.port.config();
    return { timezone: this.zone, currency: this.cfg.currency, zoneSet: this.cfg.timezone !== null && this.cfg.timezoneSource !== "host" && this.cfg.timezoneSource !== "fallback" };
  }

  settings(): Promise<Row> {
    return this.run(async () => {
      const row = (await this.list("settings"))[0];
      if (row === undefined) throw new ApiError(404, "NOT_FOUND", "The kitchen has no settings row.");
      this.settingsId = row.id;
      return row;
    });
  }

  hours(): Promise<Row[]> {
    return this.run(() => this.list("hours"));
  }

  closures(): Promise<Row[]> {
    return this.run(() => this.list("closures"));
  }

  menu(): Promise<Menu & { all: true }> {
    return this.run(async () => {
      const [categories, items, groups, options] = await Promise.all(
        (["menu_categories", "menu_items", "modifier_groups", "modifiers"] as const).map((table) => this.list(table, { order: "position.asc,id.asc" })),
      );
      this.dishIds = items!.map((d) => d.id);
      return { categories: categories!.sort(byPosition), items: items!.sort(byPosition), groups: groups!.sort(byPosition), options: options!.sort(byPosition), all: true as const };
    });
  }

  // ── the orders ────────────────────────────────────────────────────────────

  private async withLines(orders: Row[]): Promise<OrderWithLines[]> {
    const lines = await this.listIn("order_items", "order_id", orders.map((o) => o.id), "position.asc");
    const options = await this.listIn("order_item_modifiers", "order_item_id", lines.map((l) => l.id));
    return orders.map((order) => ({
      order,
      lines: lines
        .filter((l) => l["order_id"] === order.id)
        .sort(byPosition)
        .map((line) => Object.assign(line, { options: options.filter((o) => o["order_item_id"] === line.id) })),
    }));
  }

  orders(from: string, to: string): Promise<OrderWithLines[]> {
    return this.run(async () => {
      const start = new Date(instantOf(from, "00:00", this.zone)).toISOString();
      const end = new Date(instantOf(addDays(to, 1), "00:00", this.zone)).toISOString();
      const orders = await this.list("orders", {
        where: { and: [{ column: "pickup_at", op: "gte", value: start }, { column: "pickup_at", op: "lt", value: end }] },
        order: "pickup_at.asc",
      });
      return this.withLines(orders);
    });
  }

  order(id: Id): Promise<OrderWithLines> {
    return this.run(async () => (await this.withLines([await this.one("orders", id)]))[0]!);
  }

  move(id: Id, from: string, to: string): Promise<Row> {
    // A hand-over taken back is unpaid again.
    return this.run(() => this.change("orders", id, from === "picked_up" ? { status: to, paid_method: null } : { status: to }, from));
  }

  cancel(id: Id, from: string, code: string, dish: string | null, note: string | null): Promise<Row> {
    return this.run(() => this.change("orders", id, { status: "cancelled", cancel_code: code, cancel_dish: dish, cancel_note: note }, from));
  }

  handOff(id: Id, paid: "cash" | "card"): Promise<Row> {
    return this.run(() => this.change("orders", id, { status: "picked_up", paid_method: paid }, "ready"));
  }

  // ── slots, portions, pauses ───────────────────────────────────────────────

  /** A day's paused slots, by their instant. */
  private async pausesOn(date: Day): Promise<Map<number, Row>> {
    const start = new Date(instantOf(date, "00:00", this.zone)).toISOString();
    const end = new Date(instantOf(addDays(date, 1), "00:00", this.zone)).toISOString();
    const rows = await this.list("slot_pauses", { where: { and: [{ column: "slot_at", op: "gte", value: start }, { column: "slot_at", op: "lt", value: end }] } });
    return new Map(rows.filter((r) => r["active"] === true).map((r) => [Date.parse(String(r["slot_at"])), r]));
  }

  slotCounts(date: string): Promise<SlotCount[]> {
    return this.run(async () => {
      const [counts, pauses] = await Promise.all([
        this.t.get<{ data: { rows: { time: string; size: number; taken: number; closed?: boolean }[] } }>(await this.path("orders", `/capacity-counts?rule=0&date=${encodeURIComponent(date)}`)),
        this.pausesOn(date),
      ]);
      // A closed day still lists its grid on the server: it has no slots to take.
      return counts.data.rows
        .filter((row) => row.closed !== true)
        .map((row) => {
          const at = instantOf(date, row.time, this.zone);
          const pause = pauses.get(at);
          return { time: row.time, at: new Date(at).toISOString(), taken: row.taken, size: row.size, pause: pause === undefined ? null : { id: pause.id, by: (pause["paused_by"] as string | null) ?? null } };
        });
    });
  }

  dishCounts(date: string): Promise<Record<string, number>> {
    return this.run(async () => {
      const ids = this.dishIds ?? (await this.menu()).items.map((d) => d.id);
      const out: Record<string, number> = {};
      // The ids go in the address: a page of them at a time.
      for (let i = 0; i < ids.length; i += PAGE) {
        const page = ids.slice(i, i + PAGE).join(",");
        const got = await this.t.get<{ data: { rows: { id: string; taken: number }[] } }>(await this.path("order_items", `/capacity-counts?rule=0&date=${encodeURIComponent(date)}&ids=${encodeURIComponent(page)}`));
        for (const row of got.data.rows) out[row.id] = row.taken;
      }
      return out;
    });
  }

  pause(at: string): Promise<Row> {
    return this.run(async () => {
      // No two rows for one slot: an old pause is switched back on, a new one made only when none is there.
      const [found] = await this.list("slot_pauses", { where: { column: "slot_at", op: "eq", value: at } });
      if (found === undefined) return this.create("slot_pauses", { slot_at: at, active: true });
      if (found["active"] === true) return found;
      return this.change("slot_pauses", found.id, { active: true });
    });
  }

  reopen(pauseId: Id): Promise<Row> {
    return this.run(async () => {
      const row = await this.change("slot_pauses", pauseId, { active: false });
      // Two tablets pausing at once can leave two rows for one time: every one of them is switched off.
      const same = await this.list("slot_pauses", { where: { column: "slot_at", op: "eq", value: row["slot_at"] } });
      for (const other of same) if (other.id !== pauseId && other["active"] === true) await this.change("slot_pauses", other.id, { active: false });
      return row;
    });
  }

  setDish(id: Id, values: { available?: boolean; stock_today?: number | null; stock_on?: string | null; online?: boolean }): Promise<Row> {
    return this.run(() => this.change("menu_items", id, values));
  }

  setOption(id: Id, available: boolean): Promise<Row> {
    return this.run(() => this.change("modifiers", id, { available }));
  }

  // ── a phone order ─────────────────────────────────────────────────────────

  /** The screen's order as the data API takes a tree: its lists named by the relation each comes in on. */
  private async tree(body: OrderBody): Promise<{ values: Record<string, unknown>; children: Record<string, unknown[]> }> {
    const [lines, options] = await Promise.all([this.t.relation(this.real("order_items"), "order_id"), this.t.relation(this.real("order_item_modifiers"), "order_item_id")]);
    const line = (row: TreeRow) => {
      const below = row.children?.["order_item_modifiers"];
      return { values: row.values, ...(below === undefined || below.length === 0 ? {} : { children: { [options]: below.map((o) => ({ values: o.values })) } }) };
    };
    return { values: { ...body.values, channel: "phone" }, children: { [lines]: body.children.order_items.map(line) } };
  }

  /** A tree's reply with its lists named as the screens name them. */
  private async named(children: Record<string, { data: Row; children?: Record<string, { data: Row }[]> }[]> | undefined): Promise<QuoteReply["children"]> {
    if (children === undefined) return {};
    const [lines, options] = await Promise.all([this.t.relation(this.real("order_items"), "order_id"), this.t.relation(this.real("order_item_modifiers"), "order_item_id")]);
    return {
      order_items: (children[lines] ?? []).map((l) => ({
        data: this.row("order_items", l.data),
        children: { order_item_modifiers: (l.children?.[options] ?? []).map((o) => ({ data: o.data })) },
      })),
    };
  }

  phoneQuote(body: OrderBody): Promise<QuoteReply> {
    return this.run(async () => {
      const tree = await this.tree(body);
      // The quote asks what a save would write: a name stands in until the caller's is typed.
      const values = { name: "—", ...tree.values };
      const name = typeof values["name"] === "string" && values["name"].trim() !== "" ? values["name"] : "—";
      const reply = await this.t.mutate<{ data: Row; children?: Record<string, { data: Row; children?: Record<string, { data: Row }[]> }[]> }>(await this.path("orders", "/dry-run"), "POST", {
        values: { ...values, name },
        children: tree.children,
      });
      // Staff are judged by every limit a save is; a quote that answers holds.
      return { data: this.row("orders", reply.data), children: await this.named(reply.children), capacity: [], exact: true };
    });
  }

  phoneOrder(body: OrderBody, clientKey: string): Promise<OrderReply> {
    return this.run(async () => {
      const tree = await this.tree(body);
      const made = await this.t.mutate<{ data: Row; replayed?: boolean }>(await this.path("orders"), "POST", {
        ...tree,
        clientKey,
        ...(body.expect === undefined ? {} : { expect: { total: body.expect.total, column: "total" } }),
      });
      return { data: this.row("orders", made.data), ...(made.replayed === true ? { replayed: true as const } : {}) };
    });
  }

  // ── signing in and out ────────────────────────────────────────────────────

  signOut(): Promise<void> {
    return this.run(async () => {
      await this.t.mutate("/api/v1/auth/logout", "POST", {});
    });
  }

  async signIn(): Promise<void> {
    const to = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    (this.opts.leave ?? ((url: string) => window.location.assign(url)))(to);
  }

  // ── a manager's ───────────────────────────────────────────────────────────

  setHours(id: Id, values: { open?: boolean; opens?: string; closes?: string }): Promise<Row> {
    return this.run(() => this.change("hours", id, values));
  }

  addClosure(values: { from_date: string; to_date: string; reason: string | null }): Promise<Row> {
    return this.run(() => this.create("closures", values));
  }

  setClosure(id: Id, active: boolean): Promise<Row> {
    return this.run(() => this.change("closures", id, { active }));
  }

  setOnline(on: boolean): Promise<Row> {
    return this.run(async () => {
      const id = this.settingsId ?? (await this.settings()).id;
      return this.change("settings", id, { online_on: on });
    });
  }

  // ── the add-ons ───────────────────────────────────────────────────────────

  /** A receipt is drawn by Invoices & Receipts: on while it is attached (the feature `receipts`). */
  async receipts(): Promise<boolean> {
    return this.cfg.addOns["invoices"] !== undefined;
  }

  /** The public holidays Holiday Calendars hands this app's screens, when it is attached. */
  async holidays(): Promise<{ date: string; name: string }[] | null> {
    const attached = this.cfg.addOns["holiday-calendars"];
    if (attached === undefined) return null;
    const days = attached.settings["days"];
    return (Array.isArray(days) ? days : []).flatMap((day) => {
      const d = day as { date?: unknown; name?: unknown };
      return typeof d.date === "string" && typeof d.name === "string" ? [{ date: d.date, name: d.name }] : [];
    });
  }

  // ── what changes ──────────────────────────────────────────────────────────

  subscribe(listener: (frame: LiveFrame) => void, onState?: (state: "live" | "reconnecting") => void): () => void {
    let source: EventSourceLike | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    /**
     * A browser gives a stream up for good on any reply but a 200 (a deploy's 502, a 503): the
     * stream is opened again, waiting longer each time up to half a minute, and so is one whose
     * setting up failed. The board shows it is reconnecting the whole while.
     */
    const again = () => {
      if (closed) return;
      onState?.("reconnecting");
      const wait = Math.min(30_000, 1_000 * 2 ** attempt);
      attempt += 1;
      retry = setTimeout(() => void open(), wait);
    };
    const open = async () => {
      try {
        const conn = this.cfg.connectionId ?? (await this.t.connection());
        // Only the tables this person may read: one channel refused refuses the stream.
        const readable = LIVE.filter((table) => this.cfg.access === null || this.cfg.access.tables[table]?.includes("read") === true);
        const ids = await Promise.all(readable.map(async (table) => [await this.t.tableId(this.real(table)), table] as const));
        const byChannel = new Map(ids.map(([id, table]) => [`widget-data:${conn}:${id}`, table]));
        if (closed || byChannel.size === 0) return;
        const url = `/api/v1/events?channels=${[...byChannel.keys()].map(encodeURIComponent).join(",")}`;
        const opened = (this.opts.stream ?? ((u: string) => new EventSource(u, { withCredentials: true }) as unknown as EventSourceLike))(url);
        source = opened;
        opened.onopen = () => {
          attempt = 0;
          onState?.("live");
        };
        opened.onerror = () => {
          if (opened.readyState === CLOSED) {
            opened.close();
            again();
          } else onState?.("reconnecting");
        };
        const hear = (op: LiveFrame["op"]) => (event: { data: string }) => {
          try {
            const frame = JSON.parse(event.data) as { channel?: string; data?: { pk?: { id?: unknown } } };
            const table = byChannel.get(String(frame.channel));
            if (table === undefined) return;
            // A frame's row is masked for everyone: it says what changed, and the screens read it again.
            listener({ table, id: Number(frame.data?.pk?.id ?? 0), op });
          } catch {
            // not a frame
          }
        };
        opened.addEventListener("record.create", hear("insert"));
        opened.addEventListener("record.update", hear("update"));
        opened.addEventListener("record.delete", hear("delete"));
        opened.addEventListener("record.bulk-create", hear("insert"));
      } catch {
        again();
      }
    };
    void open();
    return () => {
      closed = true;
      if (retry !== null) clearTimeout(retry);
      source?.close();
    };
  }
}
