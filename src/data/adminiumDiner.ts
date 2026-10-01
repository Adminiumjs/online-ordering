/**
 * The order page's door into a real Adminium: the public API through the
 * kitchen's two browser keys, one client each — the `customer` key (the menu,
 * the hours, what is still free, placing an order, signing in, a large-order
 * enquiry) and the `link` key (the one order its own link opens). A session
 * belongs to the key that opened it, so each client holds its own.
 *
 * Every figure is Adminium's: an order's price is its dry run, a placed
 * order's total the row it wrote, what is free the availability answer.
 * Placing sends the total the diner was shown and a retry key; a retry of an
 * order already made answers that order.
 *
 * A session is kept for the tab (its own storage, one slot per key), so a
 * reload — and an emailed sign-in link always lands on a fresh page — keeps
 * the diner signed in. Signing out, a session ended elsewhere and a session
 * found gone all empty the slot: a tab never signs back in by itself.
 */
import { createPublicClient, pictureUrl, PublicApiError, type HeldSession, type PublicClient, type PublicConfig as ClientConfig } from "@adminiumjs/public-client";

import { withYesNo } from "./columnKinds.ts";
import type { DinerPort, Menu, OrderWithLines } from "./ports.ts";
import { publicRefs, type Refs } from "./publicRefs.ts";
import { ApiError, type ClaimReply, type DishState, type Id, type OrderBody, type OrderReply, type PublicConfig, type QuoteReply, type Row, type SlotTime } from "./wire.ts";

/** What the door needs to start: the address, the customer key, the tables' real names and the other keys. */
export interface DinerServed {
  baseUrl: string;
  publishableKey: string;
  tables?: Record<string, string>;
  publicKeys?: Record<string, string>;
}

export interface DinerDoorOptions {
  /** Test seam; `globalThis.fetch` otherwise. */
  fetch?: typeof fetch;
  /** The tab's storage, or none (a private window, a test). */
  storage?: Storage | null;
  clock?: () => number;
}

/** A sign-in session idles out after half an hour, sliding on use, and lasts twelve hours at most. */
const IDLE_MS = 30 * 60_000;
const CAP_MS = 12 * 60 * 60_000;
const PAGE = 200;

/** A session as the tab keeps it: the client's, and when it was opened (the wire never says). */
interface Kept extends HeldSession {
  at: number;
}

/** The tab's storage, or none. */
export function tabStorage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The client's refusal as the screens read one: its status, its code, what it said beside. */
function asApiError(error: unknown): unknown {
  if (error instanceof PublicApiError) return new ApiError(error.status, error.code, error.message, { ...error.params });
  return error;
}

async function answer<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw asApiError(error);
  }
}

const byPosition = (a: Row, b: Row) => Number(a["position"] ?? 0) - Number(b["position"] ?? 0) || Number(a.id) - Number(b.id);
const gone = () => new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such record.");

export class AdminiumDiner implements DinerPort {
  private readonly served: DinerServed;
  private readonly refs: Refs;
  private readonly storage: Storage | null;
  private readonly clock: () => number;
  private readonly customer: PublicClient;
  private readonly link: PublicClient | null;
  private config$: Promise<ClientConfig> | null = null;

  constructor(served: DinerServed, options: DinerDoorOptions = {}) {
    this.served = served;
    this.refs = publicRefs(served.tables);
    this.storage = options.storage === undefined ? tabStorage() : options.storage;
    this.clock = options.clock ?? Date.now;
    const client = (name: string, publishableKey: string, humanCheck: PublicClientHumanCheck) =>
      createPublicClient({
        baseUrl: served.baseUrl,
        publishableKey,
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        humanCheck,
        ...this.seed(name),
        onSessionChange: (session) => this.keep(name, session),
        onSessionEnded: () => this.keep(name, null),
      });
    const customer = client("customer", served.publishableKey, { refs: [this.refs.place, this.refs.enquire], claim: true });
    if (customer === null) throw new Error("The order page's key could not be used.");
    this.customer = customer;
    const linkKey = served.publicKeys?.["link"] ?? null;
    this.link = linkKey === null ? null : client("link", linkKey, false);
  }

  // ── the tab's sessions ──────────────────────────────────────────────────────

  private slot(name: string): string {
    return `ordering.session.${name}`;
  }
  private kept(name: string): Kept | null {
    try {
      const raw = this.storage?.getItem(this.slot(name)) ?? null;
      if (raw === null) return null;
      const value = JSON.parse(raw) as Partial<Kept>;
      return typeof value.token === "string" && typeof value.expiresAt === "number" && typeof value.at === "number" && (value.level === "lookup" || value.level === "verified")
        ? { token: value.token, expiresAt: value.expiresAt, level: value.level, at: value.at }
        : null;
    } catch {
      return null;
    }
  }
  /** The kept session a client starts with, while it has not run out. */
  private seed(name: string): { session?: HeldSession } {
    const held = this.kept(name);
    return held === null || held.expiresAt <= this.clock() ? {} : { session: { token: held.token, expiresAt: held.expiresAt, level: held.level } };
  }
  private keep(name: string, session: HeldSession | null): void {
    try {
      if (session === null) {
        this.storage?.removeItem(this.slot(name));
        return;
      }
      const before = this.kept(name);
      const at = before !== null && before.token === session.token ? before.at : this.clock();
      this.storage?.setItem(this.slot(name), JSON.stringify({ ...session, at }));
    } catch {
      // storage refused (full, blocked): the client's own copy lasts until the page goes
    }
  }
  /**
   * A sign-in session slides on the server with every use, up to its cap; the
   * client keeps the half hour it was opened with. After a use, the kept one
   * slides too — the server still decides, and a session it has ended reads as gone.
   */
  private slide(): void {
    const held = this.kept("customer");
    if (held === null) return;
    const expiresAt = Math.min(this.clock() + IDLE_MS, held.at + CAP_MS);
    try {
      this.storage?.setItem(this.slot("customer"), JSON.stringify({ ...held, expiresAt }));
    } catch {
      // as above
    }
  }
  private dropAll(): void {
    this.keep("customer", null);
    this.keep("link", null);
  }

  // ── reading ─────────────────────────────────────────────────────────────────

  private async list(client: PublicClient, ref: string): Promise<Row[]> {
    const rows: Row[] = [];
    for (let offset = 0; offset < 50 * PAGE; offset += PAGE) {
      const page = await client.list<Row>(ref, { limit: PAGE, offset });
      /*
       * Yes/no columns as booleans. On SQLite and MySQL the public API
       * answered 0 and 1 (before Adminium 0.3.9, and after it for an install
       * not yet updated), and the page tests `!== false`: "Taking online
       * orders" off and a closed weekday never reached the diner.
       */
      rows.push(...page.data.map(withYesNo));
      if (page.data.length < PAGE) break;
    }
    return rows;
  }

  private clientConfig(): Promise<ClientConfig> {
    this.config$ ??= this.customer.config().catch((error: unknown) => {
      this.config$ = null;
      throw error;
    });
    return this.config$;
  }

  /** A picture column's address, through the public pictures route; null when the row has none. */
  private async picture(ref: string, row: Row, column: string): Promise<string | null> {
    const id = row["id"];
    if (id === undefined || id === null) return null;
    return pictureUrl(this.served.baseUrl, await this.clientConfig(), ref, String(id), column, row[column]);
  }

  config(): Promise<PublicConfig> {
    return answer(async () => {
      const c = await this.customer.config();
      this.config$ = Promise.resolve(c);
      return { timezone: c.timezone, currency: c.currency, ...(c.now === undefined ? {} : { now: c.now }) };
    });
  }

  settings(): Promise<Row> {
    return answer(async () => {
      const row = (await this.list(this.customer, this.refs.settings))[0];
      if (row === undefined) throw gone();
      const out: Row = { ...row };
      for (const column of ["photo_hero", "photo_street", "photo_closed", "photo_store"]) out[column] = await this.picture(this.refs.settings, row, column);
      return out;
    });
  }

  menu(): Promise<Menu> {
    return answer(async () => {
      const [categories, items, groups, options] = await Promise.all(
        [this.refs.categories, this.refs.dishes, this.refs.groups, this.refs.options].map((ref) => this.list(this.customer, ref)),
      );
      const pictured = await Promise.all(items!.map(async (item) => ({ ...item, image: await this.picture(this.refs.dishes, item, "image") })));
      return { categories: categories!.sort(byPosition), items: pictured.sort(byPosition), groups: groups!.sort(byPosition), options: options!.sort(byPosition) };
    });
  }

  hours(): Promise<Row[]> {
    return answer(() => this.list(this.customer, this.refs.hours));
  }

  closures(): Promise<Row[]> {
    return answer(() => this.list(this.customer, this.refs.closures));
  }

  slots(date: string): Promise<SlotTime[]> {
    return answer(async () => (await this.customer.availability(this.refs.slots, date, 1)).map((slot) => ({ time: slot.time, state: slot.state })));
  }

  dishes(date: string, qty?: number): Promise<DishState[]> {
    return answer(async () =>
      (await this.customer.parentAvailability(this.refs.portions, { date, ...(qty === undefined ? {} : { qty }) })).map((dish) => ({
        id: dish.id,
        state: dish.state,
        ...(dish.left === undefined ? {} : { left: dish.left }),
      })),
    );
  }

  // ── placing an order ────────────────────────────────────────────────────────

  quote(body: OrderBody): Promise<QuoteReply> {
    // A price the diner was shown goes with the save alone: a dry run carrying one is refused.
    return answer(async () => {
      const quote = await this.customer.quote(this.refs.place, { values: body.values, children: body.children });
      return { data: quote.data, children: quote.children as QuoteReply["children"], capacity: quote.capacity, exact: quote.exact };
    });
  }

  place(body: OrderBody, clientKey: string): Promise<OrderReply> {
    return answer(async () => {
      const made = await this.customer.createTree<Row>(this.refs.place, {
        values: { ...body.values, client_key: clientKey },
        children: body.children,
        ...(body.expect === undefined ? {} : { expect: body.expect }),
      });
      // The order's own link, and a session on it already open: the confirmation follows the order at once.
      if (made.link !== null && this.link !== null && made.link.session !== null && made.link.expiresAt !== null) {
        this.link.adoptSession({ token: made.link.session, expiresAt: made.link.expiresAt, level: "verified" });
      }
      return {
        data: made.data,
        children: made.children as OrderReply["children"],
        ...(made.replayed ? { replayed: true as const } : {}),
        ...(made.link === null ? {} : { link: { key: made.link.key, token: made.link.token } }),
      };
    });
  }

  // ── the order's own link ────────────────────────────────────────────────────

  private linkClient(): PublicClient {
    if (this.link === null) throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "This page cannot open an order's own link.");
    return this.link;
  }

  openLink(token: string): Promise<ClaimReply> {
    return answer(async () => {
      const link = this.linkClient();
      const opened = await link.openShared(token);
      if (opened === "unknown") throw new ApiError(404, "PUBLIC_REF_NOT_FOUND", "No such link.");
      if (opened === "closed") throw new ApiError(410, "LINK_EXPIRED", "This link has been stopped or has expired.");
      const session = link.session();
      return { session: session?.token ?? "", expiresAt: session?.expiresAt ?? 0 };
    });
  }

  /** An order with its lines, from three lists read through one key. */
  private async withLines(client: PublicClient, refs: [string, string, string], only?: Id): Promise<OrderWithLines[]> {
    const [orders, lines, options] = await Promise.all(refs.map((ref) => this.list(client, ref)));
    const optionsOf = (lineId: unknown) => options!.filter((o) => o["order_item_id"] === lineId);
    return orders!
      .filter((order) => only === undefined || order.id === only)
      .map((order) => ({
        order,
        lines: lines!
          .filter((line) => line["order_id"] === order.id)
          .sort(byPosition)
          .map((line) => Object.assign({ ...line }, { options: optionsOf(line.id) })),
      }));
  }

  linkedOrder(): Promise<OrderWithLines> {
    return answer(async () => {
      const link = this.linkClient();
      if (link.session() === null) throw gone();
      const [order] = await this.withLines(link, [this.refs.linkOrder, this.refs.linkLines, this.refs.linkOptions]);
      if (order === undefined) throw gone();
      return order;
    });
  }

  cancelLinked(id: Id): Promise<Row> {
    return answer(() => this.linkClient().update<Row>(this.refs.linkOrder, String(id), { status: "cancelled" }));
  }

  // ── signing in ──────────────────────────────────────────────────────────────

  requestSignIn(email: string, lang?: string): Promise<{ sentTo: string }> {
    return answer(async () => {
      return { sentTo: (await this.customer.requestLink({ email: email.trim(), ...(lang === undefined ? {} : { lang }) })).sentTo };
    });
  }

  verifyLink(token: string): Promise<ClaimReply> {
    return answer(async () => {
      const firstName = await this.customer.peekLink(token);
      if (!(await this.customer.openLink(token))) throw new ApiError(410, "LINK_EXPIRED", "This link has expired. Ask for a new one.");
      const session = this.customer.session();
      return { session: session?.token ?? "", expiresAt: session?.expiresAt ?? 0, ...(firstName === null ? {} : { firstName }) };
    });
  }

  verifyCode(email: string, code: string): Promise<ClaimReply> {
    return answer(async () => {
      const result = await this.customer.verifyLinkCode({ email: email.trim(), code });
      if (!result.ok) throw new ApiError(403, "PUBLIC_CODE_WRONG", "That code isn't right.", { triesLeft: result.triesLeft });
      const session = this.customer.session();
      return { session: session?.token ?? "", expiresAt: session?.expiresAt ?? result.expiresAt };
    });
  }

  async signedIn(): Promise<{ email: string; name: string | null; at: string } | null> {
    if (this.customer.session() === null) return null;
    try {
      const row = (await this.list(this.customer, this.refs.account))[0];
      if (row === undefined) {
        this.keep("customer", null);
        return null;
      }
      this.slide();
      const email = row["email"] as string | null;
      if (email === null) return null;
      const at = this.kept("customer")?.at ?? this.clock();
      return { email, name: (row["name"] as string | null) ?? null, at: new Date(at).toISOString() };
    } catch (error) {
      const refused = asApiError(error);
      if (refused instanceof ApiError && refused.status === 404) {
        this.keep("customer", null);
        return null;
      }
      throw refused;
    }
  }

  myOrders(): Promise<OrderWithLines[]> {
    return answer(async () => {
      if (this.customer.session() === null) throw gone();
      const orders = await this.withLines(this.customer, [this.refs.myOrders, this.refs.myLines, this.refs.myOptions]);
      this.slide();
      return orders.sort((a, b) => Date.parse(String(b.order["placed_at"])) - Date.parse(String(a.order["placed_at"])));
    });
  }

  cancelMine(id: Id): Promise<Row> {
    return answer(() => this.customer.update<Row>(this.refs.myOrders, String(id), { status: "cancelled" }));
  }

  signOut(): Promise<void> {
    return answer(async () => {
      try {
        await this.customer.signOut();
      } finally {
        this.keep("customer", null);
      }
    });
  }

  signOutEverywhere(): Promise<void> {
    return answer(async () => {
      try {
        await this.customer.signOutEverywhere();
      } finally {
        this.keep("customer", null);
      }
    });
  }

  forget(): Promise<void> {
    return answer(async () => {
      await this.customer.forgetMe();
      // Their orders' own links were made afresh: the one this tab followed opens nothing now.
      this.dropAll();
    });
  }

  // ── a large order ───────────────────────────────────────────────────────────

  enquire(values: Record<string, unknown>, clientKey: string): Promise<Row> {
    return answer(async () => (await this.customer.createTree<Row>(this.refs.enquire, { values: { ...values, client_key: clientKey } })).data);
  }
}

type PublicClientHumanCheck = boolean | { refs?: readonly string[]; claim?: boolean };
