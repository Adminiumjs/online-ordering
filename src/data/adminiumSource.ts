// SPDX-License-Identifier: AGPL-3.0-only
/**
 * A `DataSource` backed by a real Adminium instance (28-public-surface.md §5.2,
 * 28-T28 wave 2).
 *
 * ── READS DO NOT BECOME ASYNC ──────────────────────────────────────────────
 * `loadSnapshot` fetches the whole read-set once, before React mounts, and
 * hands back the same SYNCHRONOUS shapes `demoSource` returns — so the store,
 * the ordering engine and every screen are untouched.
 *
 * ── THE ID SPACE HOLDS EVERYWHERE, AND THAT IS UNUSUAL ─────────────────────
 * `menu_categories.slug`, `menu_items.slug`, `modifier_groups.slug` and
 * `modifiers.slug` are all TEXT and all carry the app's own identifiers, so
 * categories, dishes, modifier groups and options pass straight through and no
 * migration is needed. This is the convention hotel-reservations and
 * factory-ops set and it is the one the rest of the fleet should copy: put the
 * app's identifier in the database and identity falls out of it.
 *
 * `CategoryId` is still a compile-time union of five, and that is the people-ops
 * trap in a milder form: a tenant who adds a sixth category gets it, because
 * nothing here rejects an unknown slug — but the app's tint tables and nav are
 * written against the five, so a sixth arrives unstyled rather than missing.
 * Widening that union is a change to the app's type system, not to a mapping.
 *
 * ── OPERATOR TEXT SURVIVES BECAUSE `label()` FALLS BACK TO ITS ARGUMENT ────
 * The seed stores i18n KEYS in translatable fields and `lib/format.ts`'s
 * `label()` resolves them with `tOr(key, key)`, so a value that is not a key
 * renders literally. Every mapping below therefore passes the row's own words
 * where the seed passed a key, and the tenant's menu reads in the tenant's
 * words.
 *
 * ── TIME IS THE VENUE'S, NEVER THE READER'S ────────────────────────────────
 * The app's clock is minutes since midnight, so every instant is converted in
 * the TENANT's zone (`toTenantMinutes`). A kitchen in Chicago read through a
 * browser in Berlin would otherwise show every ticket seven hours out, with no
 * error anywhere.
 *
 * ── WHAT THE SCHEMA CANNOT SAY (WS-I gaps, marked not hidden) ──────────────
 * G-1 THE TAX RATE HAS NO COLUMN, so connected mode adds NO tax. That is a
 *     visible zero on the totals rather than a plausible 8% charged against a
 *     real order for a rate nobody set — the wrong number here is money. It is
 *     the strongest argument in this repo for §5.5's settings record.
 * G-2 The address has no column either, so the venue card renders blank rather
 *     than the demo's street.
 * G-3 The service is ONE DAY. `Order.placedAt` is minutes since midnight, so
 *     orders from other days would land on today's board at the same clock
 *     reading. They are filtered to the tenant's today instead.
 * G-4 `menu_items` has no icon column; the tile takes its CATEGORY's icon, and
 *     `image` is read as the mono chip's filename because it is the only
 *     column of that shape.
 * G-5 `delivery_zones` exists and nothing reads it, here or in the app.
 */

import {
  createPublicClient,
  toTenantDay,
  toTenantMinutes,
  type PublicClient,
} from "@adminiumjs/public-client";

import { lineKey } from "../lib/order.ts";
import type {
  CartLine,
  Category,
  CategoryId,
  Item,
  ModifierGroup,
  ModifierOption,
  Order,
  OrderStatus,
  Selection,
} from "./types.ts";
import { resolveSurfaceConfig } from "../publicConfig.ts";
import type { SnapshotPort } from "./snapshotPort.ts";
import type { DataSource, DayHours, Venue } from "./source.ts";

/* --------------------------------------------------------------- the wire */

interface WireCategory {
  id: number;
  slug: string;
  name: string;
  position: number;
  icon: string;
  tint: string;
}

interface WireItem {
  id: number;
  category_id: number;
  slug: string;
  name: string;
  short_name: string;
  description: string;
  /** `numeric` serializes as a STRING, not a number. */
  price: string;
  image: string;
  available: boolean;
  featured: boolean;
  tags: string;
  position: number;
}

interface WireGroup {
  id: number;
  item_id: number;
  slug: string;
  name: string;
  kind: "radio" | "check";
  min: number;
  max: number;
  hint: string;
  position: number;
}

interface WireModifier {
  id: number;
  group_id: number;
  slug: string;
  name: string;
  price_delta: string;
  available: boolean;
  position: number;
}

interface WireOrder {
  id: number;
  number: string;
  customer_name: string;
  status: string;
  pickup_at: string;
  total: string;
  note: string;
  status_at: string | null;
  placed_at: string;
}

interface WireOrderItem {
  id: number;
  order_id: number;
  item_id: number;
  qty: number;
  unit_price: string;
  note: string;
  position: number;
}

interface WireOrderItemModifier {
  order_item_id: number;
  modifier_id: number;
}

interface WireHours {
  weekday: string;
  opens: string;
  closes: string;
  position: number;
}

/** The five the app is styled for. A sixth is accepted, and arrives untinted. */
const LIVE_STATUSES: readonly OrderStatus[] = [
  "placed",
  "confirmed",
  "preparing",
  "ready",
  "picked_up",
];

/** `hours.weekday` uses these, and so do the app's `data.day.*` keys. */
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * WS-I G-1/G-2 — the venue's own facts, which `db/schema.sql` has nowhere to
 * put. Blank rather than the seed's, so nobody's card prints somebody else's
 * street, and a tax rate of zero rather than a plausible one: the failure this
 * avoids is a real order charged a rate the operator never set.
 */
const NO_VENUE: Venue = { line1: "", line2: "", note: "" };
const NO_TAX = 0;

/** How long after opening the first pickup slot is offered. */
const FIRST_SLOT_AFTER_OPEN = 60;

/**
 * The columns the scope must expose, checked at boot.
 *
 * Fail with a legible message naming the missing column rather than at render
 * with a 403 on a screen nobody was looking at — an operator can narrow a scope
 * at any time, and this turns that into a startup error.
 */
export const REQUIRED = {
  menuCategories: ["id", "slug", "name", "position", "icon", "tint"],
  menuItems: [
    "id", "category_id", "slug", "name", "short_name", "description",
    "price", "image", "available", "featured", "tags", "position",
  ],
  modifierGroups: ["id", "item_id", "slug", "name", "kind", "min", "max", "hint", "position"],
  modifiers: ["id", "group_id", "slug", "name", "price_delta", "available", "position"],
  orders: ["id", "number", "customer_name", "status", "pickup_at", "total", "note", "status_at", "placed_at"],
  orderItems: ["id", "order_id", "item_id", "qty", "unit_price", "note", "position"],
  orderItemModifiers: ["order_item_id", "modifier_id"],
  hours: ["weekday", "opens", "closes", "position"],
};

let lastSnapshotError: Error | null = null;

/** Why the last {@link loadSnapshot} returned null, or null if it did not. */
export function snapshotFailure(): Error | null {
  return lastSnapshotError;
}

export interface Snapshot {
  /** The tenant\'s ISO-4217 code, or null (28-T34). Drives every formatter. */
  currency: string | null;
  /** The zone the serials below were computed in. */
  timezone: string;
  /**
   * Who chose {@link timezone}. Carried so the UI can SAY which zone these
   * dates are in when nobody confirmed it — the field exists precisely because
   * both an unconfirmed zone and a UTC substitute are silent otherwise (a
   * console line is not an operator surface).
   */
  timezoneSource: 'operator' | 'host' | 'fallback' | null;
  categories: Category[];
  items: Item[];
  orders: Order[];
  weekHours: DayHours[];
  now: number;
  today: string;
  firstSlot: number;
  nextNumber: number;
}

/**
 * The client, or null when either build-time variable is absent.
 *
 * The emptiness check is `createPublicClient`'s, not repeated here: it already
 * treats a missing or empty value as "this build has no server", and a second
 * copy of that rule is a second place for it to drift.
 */
/**
 * The customer client, from the SERVED config (29 D10).
 *
 * Baked vars still win — see `resolveSurfaceConfig` — so a standalone build
 * pointed at an Adminium elsewhere is untouched. What this adds is the hosted
 * case: a key an operator bound in Studio, fetched at boot, so rotating it is
 * Studio + reload instead of a rebuild. It is also how this surface learns the
 * name the operator gave the app.
 */
export async function clientFromConfig(): Promise<PublicClient | null> {
  const config = await resolveSurfaceConfig();
  if (config === null) return null;
  return createPublicClient({ baseUrl: config.baseUrl, publishableKey: config.publishableKey });
}

export function clientFromEnv(): PublicClient | null {
  return createPublicClient({
    baseUrl: import.meta.env.VITE_ADMINIUM_API_BASE_URL,
    publishableKey: import.meta.env.VITE_ADMINIUM_PUBLISHABLE_KEY,
  });
}

/**
 * Read a whole ref, a page at a time.
 *
 * The page size is the SCOPE's — `refs[ref].limit` is the operator's ceiling
 * and asking for more than it allows is refused. A busy service has more order
 * lines than any single page holds, and a truncated read loses tickets off the
 * kitchen board silently.
 */
async function listAll<T>(
  client: SnapshotPort,
  ref: string,
  size: number,
  max: number,
): Promise<T[]> {
  const out: T[] = [];
  const page = Math.max(1, Math.min(size, 500));
  for (let offset = 0; offset < max; offset += page) {
    const res = await client.list<T>(ref, { limit: page, offset });
    out.push(...res.data);
    if (res.data.length < page) return out;
  }
  console.warn(`[adminium] ${ref}: stopped at ${String(max)} rows — the rest were not read.`);
  return out;
}

/** "11:30" → 690. The `hours` table stores wall-clock strings, not instants. */
function clockToMinutes(value: string): number {
  const parts = value.split(":");
  return Number(parts[0]) * 60 + Number(parts[1] ?? "0");
}

/**
 * Fetch the read-set and map it into the app's shapes.
 *
 * Returns `null` on ANY failure so the caller falls back to demo mode
 * structurally rather than in a catch — the marketplace demos are static clones
 * with no server and must keep working byte-identically.
 */
export async function loadSnapshot(client: SnapshotPort): Promise<Snapshot | null> {
  try {
    await client.assertRefs(REQUIRED);
    const config = await client.config();
    const tz = config.timezone;
    const cap = (ref: string): number => config.refs[ref]?.limit ?? 100;

    const [cats, items, groups, mods, orders, orderItems, orderMods, hours] = await Promise.all([
      listAll<WireCategory>(client, "menuCategories", cap("menuCategories"), 200),
      listAll<WireItem>(client, "menuItems", cap("menuItems"), 2_000),
      listAll<WireGroup>(client, "modifierGroups", cap("modifierGroups"), 5_000),
      listAll<WireModifier>(client, "modifiers", cap("modifiers"), 20_000),
      listAll<WireOrder>(client, "orders", cap("orders"), 20_000),
      listAll<WireOrderItem>(client, "orderItems", cap("orderItems"), 50_000),
      listAll<WireOrderItemModifier>(client, "orderItemModifiers", cap("orderItemModifiers"), 100_000),
      listAll<WireHours>(client, "hours", cap("hours"), 100),
    ]);

    const nowIso = new Date().toISOString();
    const todayIso = toTenantDay(nowIso, tz);

    /* --- the menu ---------------------------------------------------- */

    const catSlug = new Map<number, string>(cats.map((c) => [c.id, c.slug]));
    const catIcon = new Map<number, string>(cats.map((c) => [c.id, c.icon]));

    const categories: Category[] = [...cats]
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        id: row.slug as CategoryId,
        name: row.name,
        icon: row.icon,
        tint: row.tint,
      }));

    const modsByGroup = new Map<number, WireModifier[]>();
    for (const row of mods) {
      // An unavailable option is not offered at all: the app has no state for
      // one, and rendering it would let a reader pick something off the menu.
      if (!row.available) continue;
      const list = modsByGroup.get(row.group_id) ?? [];
      list.push(row);
      modsByGroup.set(row.group_id, list);
    }

    const groupsByItem = new Map<number, ModifierGroup[]>();
    const groupSlugOfModifier = new Map<number, { group: string; option: string }>();
    for (const row of [...groups].sort((a, b) => a.position - b.position)) {
      const own = (modsByGroup.get(row.id) ?? []).sort((a, b) => a.position - b.position);
      const options: ModifierOption[] = own.map((m) => {
        groupSlugOfModifier.set(m.id, { group: row.slug, option: m.slug });
        return { id: m.slug, name: m.name, delta: Math.round(Number(m.price_delta) * 100) };
      });
      const list = groupsByItem.get(row.item_id) ?? [];
      list.push({
        id: row.slug,
        name: row.name,
        type: row.kind,
        min: row.min,
        max: row.max,
        hint: row.hint,
        options,
      });
      groupsByItem.set(row.item_id, list);
    }

    const itemSlug = new Map<number, string>(items.map((i) => [i.id, i.slug]));
    const mappedItems: Item[] = [];
    for (const row of [...items].sort((a, b) => a.position - b.position)) {
      const cat = catSlug.get(row.category_id);
      // A dish whose category did not come back has no tab to live under and
      // no tint to render in. Dropped, not filed under a guess.
      if (cat === undefined) continue;
      const item: Item = {
        id: row.slug,
        cat: cat as CategoryId,
        name: row.name,
        short: row.short_name.length > 0 ? row.short_name : row.name,
        desc: row.description,
        price: Math.round(Number(row.price) * 100),
        // WS-I G-4: no icon column, so the tile wears its category's.
        icon: catIcon.get(row.category_id) ?? "",
        file: row.image.length > 0 ? row.image : `${row.slug}.webp`,
        tags: row.tags.length === 0 ? [] : row.tags.split(","),
        mods: groupsByItem.get(row.id) ?? [],
      };
      if (row.featured) item.feat = true;
      if (!row.available) item.soldOut = true;
      mappedItems.push(item);
    }

    /* --- today's order book ------------------------------------------ */

    const linesByOrder = new Map<number, WireOrderItem[]>();
    for (const row of orderItems) {
      const list = linesByOrder.get(row.order_id) ?? [];
      list.push(row);
      linesByOrder.set(row.order_id, list);
    }

    const selectionByLine = new Map<number, Selection>();
    for (const row of orderMods) {
      const named = groupSlugOfModifier.get(row.modifier_id);
      if (named === undefined) continue;
      const selection = selectionByLine.get(row.order_item_id) ?? {};
      const chosen = selection[named.group] ?? [];
      chosen.push(named.option);
      selection[named.group] = chosen;
      selectionByLine.set(row.order_item_id, selection);
    }

    const mappedOrders: Order[] = [];
    for (const row of orders) {
      const status = row.status as OrderStatus;
      /* A cancelled order is not a ticket: the board has five columns and no
       * sixth to put it in, and showing it as "placed" would put a kitchen to
       * work on food nobody is collecting. */
      if (!LIVE_STATUSES.includes(status)) continue;
      // WS-I G-3: minutes-since-midnight cannot carry a date. Yesterday's
      // service would otherwise reappear on today's board at the same clock.
      if (toTenantDay(row.placed_at, tz) !== todayIso) continue;

      const lines: CartLine[] = [];
      for (const line of (linesByOrder.get(row.id) ?? []).sort((a, b) => a.position - b.position)) {
        const slug = itemSlug.get(line.item_id);
        if (slug === undefined) continue;
        const selection = selectionByLine.get(line.id) ?? {};
        lines.push({
          key: lineKey(slug, selection, line.note),
          item: slug,
          selection,
          note: line.note,
          qty: line.qty,
        });
      }
      // An order whose every dish has been deleted from the menu cannot be
      // rendered; it is dropped rather than shown as an empty ticket.
      if (lines.length === 0) continue;

      mappedOrders.push({
        num: numberOf(row.number),
        customer: row.customer_name,
        status,
        placedAt: toTenantMinutes(row.placed_at, tz),
        statusAt: toTenantMinutes(row.status_at ?? row.placed_at, tz),
        pickupAt: toTenantMinutes(row.pickup_at, tz),
        lines,
        note: row.note,
      });
    }

    /* --- the posted week --------------------------------------------- */

    const todayName = WEEKDAYS[new Date(`${todayIso}T00:00:00Z`).getUTCDay()];
    const weekHours: DayHours[] = [...hours]
      .sort((a, b) => a.position - b.position)
      .map((row) => {
        const day: DayHours = {
          day: `data.day.${row.weekday}`,
          open: clockToMinutes(row.opens),
          close: clockToMinutes(row.closes),
        };
        if (row.weekday === todayName) day.today = true;
        return day;
      });

    const openToday = weekHours.find((d) => d.today === true);

    return {
      currency: config.currency,
      timezone: tz,
      // Absent on the public path (the API always carries a real zone on its
      // scope), and absent means no claim — never a guess.
      timezoneSource: config.timezoneSource ?? null,
      categories,
      items: mappedItems,
      orders: mappedOrders,
      weekHours,
      now: toTenantMinutes(nowIso, tz),
      today: todayIso,
      /* Derived rather than invented: the seed opens at 11:00 and offers the
       * first slot at 12:00, so an hour after opening is the venue's own rule
       * expressed against the venue's own hours. */
      firstSlot: (openToday?.open ?? 0) + FIRST_SLOT_AFTER_OPEN,
      nextNumber: nextNumberFrom(orders),
    };
  } catch (error) {
    /* The reason is REPORTED, not swallowed: a non-demo build hard-stops now,
       so "using demo data" stopped being true and the caller was left showing a
       generic failure while the real cause sat in the console. */
    lastSnapshotError = error instanceof Error ? error : new Error(String(error));
    console.warn("[adminium] could not load a snapshot:", error);
    return null;
  }
}

/** `Order.num` is an integer; `orders.number` is text. Digits, or zero. */
function numberOf(value: string): number {
  const match = /(\d+)/.exec(value);
  return match === null ? 0 : Number(match[1]);
}

/**
 * The next order number, read off the highest one already issued — including
 * cancelled ones. A number the venue has used is used, whatever became of it.
 */
function nextNumberFrom(orders: readonly WireOrder[]): number {
  let highest = 0;
  for (const row of orders) highest = Math.max(highest, numberOf(row.number));
  return highest + 1;
}

/** A synchronous `DataSource` over an already-fetched snapshot. */
export function snapshotSource(snap: Snapshot): DataSource {
  return {
    categories: () => snap.categories.map((c) => ({ ...c })),
    items: () =>
      snap.items.map((item) => ({
        ...item,
        tags: [...item.tags],
        mods: item.mods.map((group) => ({
          ...group,
          options: group.options.map((option) => ({ ...option })),
        })),
      })),
    orders: () =>
      snap.orders.map((order) => ({
        ...order,
        lines: order.lines.map((line) => ({
          ...line,
          selection: Object.fromEntries(
            Object.entries(line.selection).map(([group, ids]) => [group, [...ids]]),
          ),
        })),
      })),
    // WS-I G-2: no address column, so the card renders blank.
    venue: () => ({ ...NO_VENUE }),
    weekHours: () => snap.weekHours.map((d) => ({ ...d })),
    now: () => snap.now,
    today: () => snap.today,
    // WS-I G-1: no tax column, so nothing is added and the zero is visible.
    taxRate: () => NO_TAX,
    firstSlot: () => snap.firstSlot,
    nextNumber: () => snap.nextNumber,
  };
}
