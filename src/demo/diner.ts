/**
 * The order page's door into the demo's Adminium: the public API as the
 * kitchen's browser keys answer it — the `customer` key's entries (the menu,
 * the hours, the slots, placing an order, signing in, a large-order enquiry)
 * and the `link` key's (the one order its own link opens).
 *
 * Each entry reads only its `select`, through its filters, and writes only
 * its writable columns; the refusals are the public API's own codes. The
 * sign-in email is the demo's: its code is 284716 and its link opens at once.
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import type { DinerPort, Menu, OrderWithLines } from "../data/ports.ts";
import { ApiError, type ClaimReply, type DishState, type Id, type OrderBody, type OrderReply, type QuoteReply, type Row, type SlotTime } from "../data/wire.ts";
import { toMs } from "../lib/venueTime.ts";
import { Engine, refusedValue, refusedWrite, treeRefused, type Writer } from "./engine.ts";
import { MANIFEST_RULES } from "./rules.ts";

type Entry = (typeof MANIFEST_RULES.publicAccess)[number] & Record<string, unknown>;
const ENTRIES = MANIFEST_RULES.publicAccess as readonly Entry[];
const GUEST: Writer = { origin: "public", name: null, roles: [] };

/** The code and link of the demo's sign-in email. */
export const DEMO_SIGN_IN = { code: "284716", token: "demo-sign-in-link" };

/** The customer key's entry for a table and method (and the `link` key's with `key`). */
function entry(table: string, method: "GET" | "POST" | "PATCH", key?: string): Entry {
  const found = ENTRIES.find((e) => e.table === table && (e.methods as readonly string[]).includes(method) && (e as { key?: string }).key === key && (e as { kind?: string }).kind !== "availability");
  if (found === undefined) throw new Error(`no ${method} entry on ${table}${key === undefined ? "" : ` (${key})`}`);
  return found;
}

/** A row as an entry lets it out: its selected columns — its key only when the entry selects it. */
function project(row: Row, select: readonly string[] | undefined): Row {
  if (select === undefined) return { ...row };
  const out: Record<string, unknown> = {};
  for (const column of select) out[column] = row[column] ?? null;
  return out as Row;
}

/** Whether a row passes an entry's filters. */
function passes(row: Row, filters: readonly Record<string, unknown>[] | undefined, today: string): boolean {
  return (filters ?? []).every((f) => {
    const value = row[String(f["column"])];
    if (f["op"] === "eq") return value === f["value"];
    if (f["op"] === "from-today") return value !== null && value !== undefined && String(value) >= today;
    if (f["op"] === "today") return String(value) === today;
    return true;
  });
}

/** A refusal of the diner's own value (what the form already says): its charge on the caps is handed back. */
const OWN_VALUE: ReadonlySet<string> = new Set(["too-long", "format", "required", "invalid-character", "too-short", "too-small", "too-large", "unknown"]);

const LINK = /(https?:\/\/|www\.|<a\s)/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-.\s]{6,32}$/;

/** A pause before an answer, so a page's "Checking prices…" is seen as it would be. */
export interface Latency {
  read: number;
  quote: number;
  write: number;
}
export const NO_LATENCY: Latency = { read: 0, quote: 0, write: 0 };
export const DEMO_LATENCY: Latency = { read: 120, quote: 450, write: 850 };

export class DemoDiner implements DinerPort {
  private linkSession: { orderId: Id } | null = null;
  private signIn: { customerId: Id; at: number } | null = null;
  /** The code emailed last: five tries, then it has expired. */
  private challenge: { email: string; tries: number } | null = null;
  /** Wrong codes per address, by when: ten in a day lock the code path (the emailed link still opens). */
  private wrongCodes: { email: string; at: number }[] = [];
  /** What the caps on an order nobody signed in for have been charged: every save, by address and when. */
  private charged: { email: string; at: number }[] = [];
  private readonly keys = new Map<string, Id>();
  /** A fault the demo card arms for the next placing (the network drops, the slot fills, a price moves). */
  fault: "offline" | null = null;
  /** Something the demo card makes happen just before the next placing lands (another diner takes the time, a price moves). */
  beforePlace: ((body: OrderBody) => void) | null = null;

  readonly engine: Engine;
  readonly latency: Latency;
  constructor(engine: Engine, latency: Latency = NO_LATENCY) {
    this.engine = engine;
    this.latency = latency;
  }

  private get world() {
    return this.engine.world;
  }
  private wait(ms: number): Promise<void> {
    return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
  }
  private today(): string {
    return this.engine.today();
  }

  // ── reads ───────────────────────────────────────────────────────────────────

  async config() {
    await this.wait(this.latency.read);
    return { timezone: this.world.zone, currency: this.world.currency, now: new Date(this.engine.now).toISOString() };
  }

  async settings(): Promise<Row> {
    await this.wait(this.latency.read);
    return project(this.world.settings(), entry("settings", "GET").select as readonly string[]);
  }

  private readable(table: "menu_items" | "modifiers" | "menu_categories" | "modifier_groups") {
    const e = entry(table, "GET");
    return (row: Row) => passes(row, e.filters as readonly Record<string, unknown>[] | undefined, this.today());
  }

  async menu(): Promise<Menu> {
    await this.wait(this.latency.read);
    const list = (table: "menu_categories" | "menu_items" | "modifier_groups" | "modifiers") => {
      const e = entry(table, "GET");
      return this.world.where(table, this.readable(table)).sort(byPosition).map((row) => project(row, e.select as readonly string[]));
    };
    return { categories: list("menu_categories"), items: list("menu_items"), groups: list("modifier_groups"), options: list("modifiers") };
  }

  async hours(): Promise<Row[]> {
    await this.wait(this.latency.read);
    const e = entry("hours", "GET");
    return this.world.all("hours").map((row) => project(row, e.select as readonly string[]));
  }

  async closures(): Promise<Row[]> {
    await this.wait(this.latency.read);
    const e = entry("closures", "GET");
    return this.world.where("closures", (row) => passes(row, e.filters as readonly Record<string, unknown>[], this.today())).map((row) => project(row, e.select as readonly string[]));
  }

  async slots(date: string): Promise<SlotTime[]> {
    await this.wait(this.latency.read);
    return this.engine.slotAnswer(date);
  }

  async dishes(date: string, qty = 1): Promise<DishState[]> {
    await this.wait(this.latency.read);
    return this.engine.dishAnswer(date, qty, this.readable("menu_items"));
  }

  // ── placing an order ─────────────────────────────────────────────────────────

  /**
   * The order's own values as the entry lets a diner write them, judged. A
   * quote fills a placeholder for a value it needs and was not sent yet (the
   * cart is priced before anyone types a name), as Adminium's dry run does.
   */
  private orderValues(body: OrderBody, dry = false): Record<string, unknown> {
    const e = entry("orders", "POST");
    const writable = new Set(e.writable as readonly string[]);
    const values: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(body.values)) {
      if (!writable.has(column)) throw refusedWrite();
      values[column] = typeof value === "string" ? value.trim() : value;
    }
    for (const column of e.requires as readonly string[]) {
      if (values[column] !== undefined && values[column] !== null && values[column] !== "") continue;
      if (!dry) throw refusedValue(column);
      values[column] = column === "email" ? "quote@placeholder.invalid" : "Quote";
    }
    if (!EMAIL.test(String(values["email"]))) throw refusedValue("email", "format");
    if (values["phone"] !== undefined && values["phone"] !== null && values["phone"] !== "" && !PHONE.test(String(values["phone"]))) throw refusedValue("phone", "format");
    if (values["phone"] === "") values["phone"] = null;
    if (values["note"] === "") values["note"] = null;
    // Plain text is asked of a stranger only: a signed-in diner's own words are theirs.
    const anonymous = e.anonymous as { plainText: readonly string[] };
    if (this.signIn === null) for (const column of anonymous.plainText) if (typeof values[column] === "string" && LINK.test(String(values[column]))) throw refusedValue(column);
    return values;
  }

  private lines(body: OrderBody) {
    return body.children.order_items.map((line, i) => {
      if (typeof line.values["note"] === "string" && LINK.test(String(line.values["note"]))) {
        throw treeRefused({ child: "order_items", index: i, path: ["order_items", i], column: "note" });
      }
      return { values: line.values, options: (line.children?.["order_item_modifiers"] ?? []).map((o) => o.values) };
    });
  }

  private judged(body: OrderBody, dry: boolean) {
    if (this.world.settings()["online_on"] !== true) throw new ApiError(403, "PUBLIC_SWITCHED_OFF", "This is not open online right now.");
    return this.engine.orderTree(this.orderValues(body, dry), this.lines(body), GUEST, {
      dry,
      readableDish: this.readable("menu_items"),
      readableOption: this.readable("modifiers"),
    });
  }

  async quote(body: OrderBody): Promise<QuoteReply> {
    await this.wait(this.latency.quote);
    const tree = this.judged(body, true);
    return {
      data: quoted(tree.order),
      children: { order_items: tree.lines.map((l) => ({ data: l.line, children: { order_item_modifiers: l.options.map((o) => ({ data: o })) } })) },
      capacity: [{ pool: "orders", state: "available" }],
      exact: true,
    };
  }

  async place(body: OrderBody, clientKey: string): Promise<OrderReply> {
    await this.wait(this.latency.write);
    if (this.fault === "offline") {
      // The request went, the answer did not: the order may be in.
      this.fault = null;
      throw new ApiError(0, "PUBLIC_NETWORK_UNAVAILABLE", "could not reach the kitchen");
    }
    const first = this.beforePlace;
    this.beforePlace = null;
    first?.(body);
    // A retry of an order already made answers that order, whatever it sends now — without its link.
    const replayed = this.keys.get(clientKey);
    if (replayed !== undefined) return { ...this.reply(replayed), replayed: true };
    // The caps on an order nobody signed in for count every save, refused ones too: only a refusal
    // of the diner's own value (a line's option, a quantity) gives its charge back.
    const charge = this.signIn === null ? this.charge(String(body.values["email"] ?? "").trim().toLowerCase()) : null;
    let tree: ReturnType<DemoDiner["judged"]>;
    try {
      tree = this.judged(body, false);
    } catch (error) {
      if (charge !== null && error instanceof ApiError && error.code === "PUBLIC_WRITE_REFUSED" && error.params["column"] !== undefined && OWN_VALUE.has(String(error.params["reason"]))) {
        this.charged = this.charged.filter((c) => c !== charge);
      }
      throw error;
    }
    const email = String(tree.order["email"]).toLowerCase();
    if (body.expect !== undefined && Number(body.expect.total).toFixed(2) !== Number(tree.order["total"]).toFixed(2)) {
      throw new ApiError(409, "PUBLIC_PRICE_CHANGED", "The price changed.", {
        total: Number(tree.order["total"]).toFixed(2),
        lines: { order_items: tree.lines.map((l) => ({ data: l.line, children: { order_item_modifiers: l.options.map((o) => ({ data: o })) } })) },
      });
    }
    // The person the order is for, found by the address typed, or made.
    let customer = this.world.all("customers").find((c) => String(c["email"] ?? "").toLowerCase() === email);
    if (customer === undefined) customer = this.world.insert("customers", { email, name: tree.order["name"], forgotten_at: null, created_at: new Date(this.engine.now).toISOString() });
    const token = mintToken();
    const { order } = this.engine.writeOrder(tree, GUEST, { customer_id: customer.id, email, link_token: token });
    this.keys.set(clientKey, order.id);
    this.linkSession = { orderId: order.id };
    return { ...this.reply(order.id), link: { key: "link", token } };
  }

  /** Charges the caps for one save by a stranger: an address's rolling day, and one visitor's hour on this entry. */
  private charge(email: string): { email: string; at: number } {
    const anonymous = entry("orders", "POST").anonymous as { perValue: { n: number }; perIpHour: number };
    const now = this.engine.now;
    const day = this.charged.filter((c) => c.email === email && c.at > now - 24 * 3_600_000).length;
    const hour = this.charged.filter((c) => c.at > now - 3_600_000).length;
    if (day >= anonymous.perValue.n || hour >= anonymous.perIpHour) throw new ApiError(409, "PUBLIC_LIMIT_REACHED", "You already have as many of these as can be made online.");
    const charge = { email, at: now };
    this.charged.push(charge);
    return charge;
  }

  /** An order as a create's reply carries it. */
  private reply(id: Id): OrderReply {
    const post = entry("orders", "POST");
    const child = (post.children as Record<string, { select: readonly string[]; children: Record<string, { select: readonly string[] }> }>)["order_items"]!;
    const order = this.world.get("orders", id)!;
    return {
      data: project(order, post.select as readonly string[]),
      children: {
        order_items: this.world
          .where("order_items", (l) => l["order_id"] === id)
          .map((line) => ({
            data: project(line, child.select),
            children: {
              order_item_modifiers: this.world.where("order_item_modifiers", (o) => o["order_item_id"] === line.id).map((o) => ({ data: project(o, child.children["order_item_modifiers"]!.select) })),
            },
          })),
      },
    };
  }

  // ── the order's own link ──────────────────────────────────────────────────────

  async openLink(token: string): Promise<ClaimReply> {
    await this.wait(this.latency.read);
    const order = this.world.all("orders").find((o) => o["link_token"] === token);
    if (order === undefined) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such link.");
    if (order["link_stopped"] === true || (order["link_expires"] !== null && order["link_expires"] !== undefined && toMs(String(order["link_expires"])) < this.engine.now)) {
      throw new ApiError(410, "LINK_EXPIRED", "This link has been stopped or has expired.");
    }
    this.linkSession = { orderId: order.id };
    return { session: `link-${String(order.id)}`, expiresAt: this.engine.now + 30 * 60_000 };
  }

  /** Follow an order placed in this browser, as the confirmation page does. */
  followPlaced(id: Id): void {
    this.linkSession = { orderId: id };
  }

  async linkedOrder(): Promise<OrderWithLines> {
    await this.wait(this.latency.read);
    // No session held (or it lapsed): the order reads as nobody's.
    if (this.linkSession === null) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such order.");
    return this.withLines(this.linkSession.orderId, "link");
  }

  async cancelLinked(id: Id): Promise<Row> {
    await this.wait(this.latency.write);
    if (this.linkSession?.orderId !== id) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such order.");
    return this.ownCancel(id, entry("orders", "PATCH", "link"));
  }

  /** A diner's own cancel: only to cancelled, only while it is new; the reason is theirs. */
  private ownCancel(id: Id, e: Entry): Row {
    const order = this.world.get("orders", id)!;
    const when = (e.writableWhen as Record<string, readonly string[]>)["status"]!;
    // The window rides in the change itself: an order the kitchen took, or one already cancelled, matches nothing.
    if (!when.includes(String(order["status"]))) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such order.");
    const row = this.engine.updateOrder(id, { status: "cancelled", ...(e.defaults as Record<string, unknown>) }, GUEST);
    return project(row, e.select as readonly string[]);
  }

  private withLines(id: Id, key?: string): OrderWithLines {
    const e = entry("orders", "GET", key);
    const lineEntry = ENTRIES.find((x) => x.table === "order_items" && (x as { key?: string }).key === key)!;
    const optionEntry = ENTRIES.find((x) => x.table === "order_item_modifiers" && (x as { key?: string }).key === key)!;
    const order = this.world.get("orders", id)!;
    return {
      order: project(order, e.select as readonly string[]),
      lines: this.world
        .where("order_items", (l) => l["order_id"] === id)
        .sort(byPosition)
        .map((line) =>
          Object.assign(project(line, lineEntry.select as readonly string[]), {
            options: this.world.where("order_item_modifiers", (o) => o["order_item_id"] === line.id).map((o) => project(o, optionEntry.select as readonly string[])),
          }),
        ),
    };
  }

  // ── signing in ──────────────────────────────────────────────────────────────

  async requestSignIn(email: string): Promise<{ sentTo: string }> {
    await this.wait(this.latency.write);
    if (!EMAIL.test(email.trim())) throw new ApiError(400, "PUBLIC_WRITE_REFUSED", "That address cannot be used.");
    this.challenge = { email: email.trim().toLowerCase(), tries: 0 };
    return { sentTo: maskAddress(email.trim()) };
  }

  private open(customer: Row): ClaimReply {
    this.signIn = { customerId: customer.id, at: this.engine.now };
    this.challenge = null;
    const name = String(customer["name"] ?? "").trim();
    return { session: `person-${String(customer.id)}`, expiresAt: this.engine.now + 30 * 60_000, ...(name === "" ? {} : { firstName: name.split(/\s+/)[0]! }) };
  }

  private person(email: string): Row | undefined {
    return this.world.all("customers").find((c) => String(c["email"] ?? "").toLowerCase() === email.toLowerCase());
  }

  async verifyLink(token: string): Promise<ClaimReply> {
    await this.wait(this.latency.write);
    // The demo's email always went to Kwame, whatever address was typed.
    const customer = token === DEMO_SIGN_IN.token ? this.person(this.challenge?.email ?? "kwame.b@mail.example") ?? this.person("kwame.b@mail.example") : undefined;
    if (customer === undefined) throw new ApiError(410, "LINK_EXPIRED", "This link has expired. Ask for a new one.");
    return this.open(customer);
  }

  async verifyCode(email: string, code: string): Promise<ClaimReply> {
    await this.wait(this.latency.write);
    const address = email.trim().toLowerCase();
    // Ten wrong codes in a day lock the address's code path (its emailed link still opens).
    const now = this.engine.now;
    if (this.wrongCodes.filter((w) => w.email === address && w.at > now - 24 * 3_600_000).length >= 10) throw new ApiError(403, "PUBLIC_CLAIM_LOCKED", "Too many tries today. Use the link in the email instead.");
    const c = this.challenge;
    // A code lasts five tries: then it has expired, as one never sent has.
    if (c === null || c.email !== address || c.tries >= 5) throw new ApiError(410, "PUBLIC_CODE_EXPIRED", "That code has expired. Ask for a new link.");
    if (code !== DEMO_SIGN_IN.code) {
      c.tries += 1;
      this.wrongCodes.push({ email: address, at: now });
      throw new ApiError(403, "PUBLIC_CODE_WRONG", "That code isn't right.", { triesLeft: Math.max(0, 5 - c.tries) });
    }
    const customer = this.person(c.email) ?? this.person("kwame.b@mail.example")!;
    return this.open(customer);
  }

  async signedIn() {
    if (this.signIn === null) return null;
    const customer = this.world.get("customers", this.signIn.customerId);
    if (customer === undefined || customer["email"] === null) return null;
    return { email: String(customer["email"]), name: (customer["name"] as string | null) ?? null, at: new Date(this.signIn.at).toISOString() };
  }

  private mine(): Id {
    // No session held (or it lapsed): the diner's own rows read as nobody's.
    if (this.signIn === null) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such record.");
    return this.signIn.customerId;
  }

  async myOrders(): Promise<OrderWithLines[]> {
    await this.wait(this.latency.read);
    const customer = this.mine();
    return this.world
      .where("orders", (o) => o["customer_id"] === customer)
      .sort((a, b) => toMs(String(b["placed_at"])) - toMs(String(a["placed_at"])))
      .map((o) => this.withLines(o.id));
  }

  async cancelMine(id: Id): Promise<Row> {
    await this.wait(this.latency.write);
    const customer = this.mine();
    const order = this.world.get("orders", id);
    if (order === undefined || order["customer_id"] !== customer) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such order.");
    return this.ownCancel(id, entry("orders", "PATCH"));
  }

  async signOut(): Promise<void> {
    this.signIn = null;
  }

  async signOutEverywhere(): Promise<void> {
    await this.wait(this.latency.write);
    this.mine();
    this.signIn = null;
  }

  async forget(): Promise<void> {
    await this.wait(this.latency.write);
    const customer = this.mine();
    // Deleting is asked of a fresh sign-in only.
    if (this.engine.now - this.signIn!.at > 10 * 60_000) throw new ApiError(403, "PUBLIC_CODE_STEP_UP", "Sign in again to do this.");
    const e = entry("customers", "GET");
    const forget = (e as { forget: { columns: readonly string[]; stamp: string; links?: true } }).forget;
    this.world.update("customers", customer, { ...Object.fromEntries(forget.columns.map((c) => [c, null])), [forget.stamp]: new Date(this.engine.now).toISOString() });
    // Every link their orders were emailed with is made afresh, so the old ones open nothing.
    if (forget.links === true) {
      for (const order of this.world.where("orders", (o) => o["customer_id"] === customer && o["link_token"] !== null)) this.world.update("orders", order.id, { link_token: mintToken() });
      this.linkSession = null;
    }
    this.signIn = null;
  }

  // ── a large order ─────────────────────────────────────────────────────────────

  async enquire(values: Record<string, unknown>, clientKey: string): Promise<Row> {
    await this.wait(this.latency.write);
    const e = entry("enquiries", "POST");
    const known = this.keys.get(`enquiry:${clientKey}`);
    if (known !== undefined) return project(this.world.get("enquiries", known)!, e.select as readonly string[]);
    const writable = new Set(e.writable as readonly string[]);
    const row: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(values)) {
      if (column === "client_key") continue;
      if (!writable.has(column)) throw refusedWrite();
      row[column] = typeof value === "string" ? value.trim() : value;
    }
    for (const column of e.requires as readonly string[]) if (row[column] === undefined || row[column] === null || row[column] === "") throw refusedValue(column);
    const heads = Number(row["heads"]);
    if (!Number.isInteger(heads) || heads < 6 || heads > 120) throw refusedValue("heads", heads < 6 ? "too-small" : "too-large");
    if (!EMAIL.test(String(row["email"]))) throw refusedValue("email", "format");
    if (!PHONE.test(String(row["phone"]))) throw refusedValue("phone", "format");
    for (const column of (e.anonymous as { plainText: readonly string[] }).plainText) if (typeof row[column] === "string" && LINK.test(String(row[column]))) throw refusedValue(column);
    const seq = this.world.nextNumber("enquiries", "ref_seq");
    const written = this.world.insert("enquiries", {
      ...row,
      heads,
      ref_seq: seq,
      ref: `LG-${String(seq).padStart(4, "0")}`,
      status: "new",
      staff_note: null,
      handled_by: null,
      created_at: new Date(this.engine.now).toISOString(),
    });
    this.engine.produce("enquiries", null, written);
    this.keys.set(`enquiry:${clientKey}`, written.id);
    return project(written, e.select as readonly string[]);
  }
}

const byPosition = (a: Row, b: Row) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0) || a.id - b.id;

/** A dry run shows figures only: no key, no number, no code. */
function quoted(order: Record<string, unknown>): Record<string, unknown> {
  const { number: _n, number_seq: _s, link_token: _t, client_key: _k, ...figures } = order;
  return figures;
}

/** `kwame.b@mail.example` → `k…@mail.example`: enough to recognise, no more. */
function maskAddress(address: string): string {
  const [local = "", domain = ""] = address.split("@");
  return `${local.slice(0, 1)}…@${domain}`;
}

/** An unguessable code for an order's own link (16 characters, Crockford base 32). */
function mintToken(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % 32]).join("");
}
