/**
 * The Overview page's layout: the kitchen at a glance, drawn by Adminium's
 * own widgets from the app's tables. Nothing on it is typed in — every figure
 * is a stored row, counted or summed where Adminium runs the query, on the
 * kitchen's clock.
 *
 * Read top to bottom:
 *   - today: the orders for today, what was collected, what is still to
 *     collect, the average order;
 *   - the last 7 days: the same, and what was cancelled;
 *   - today's pickup times, each with the orders it holds (from the slot
 *     limit itself), beside the next orders on the board;
 *   - what needs a person: new large-order enquiries, paused times, orders
 *     nobody collected;
 *   - orders and money by day; the dishes sold out or running low today,
 *     each with what is ordered of its portions;
 *   - when people pick up, hour by hour, and the dishes ordered most.
 *
 * What the words mean, once:
 *   - every figure is dated by the day of the order's pickup;
 *   - an "order" is any order but a cancelled one (an order nobody collected
 *     still counts);
 *   - "collected" is an order handed over and paid at the counter;
 *   - "still to collect" is an order for today not handed over yet;
 *   - "the last 7 days" are today and the six days before it.
 *
 * A card's title, subtitle and empty words are written in every language the
 * app speaks; money is shown in the connection's currency.
 */
import { l, titles as others } from "./labels.ts";
import { COUNTED } from "./tables.ts";

type Json = Record<string, unknown>;

const query = (table: string, rest: Json): Json => ({ kind: "table-query", source: { name: table, type: "table" }, ...rest });
const orders = (rest: Json): Json => query("orders", rest);
const metric = (aggregation: Json, rest: Json): Json => orders({ shape: "metric+delta", aggregations: [aggregation], ...rest });
const list = (table: string, rest: Json): Json => query(table, { shape: "record-list", ...rest });

const count = (alias: string): Json => ({ fn: "count", alias });
const sum = (column: string, alias: string): Json => ({ fn: "sum", column, alias });
const avg = (column: string, alias: string): Json => ({ fn: "avg", column, alias });
const eq = (column: string, value: unknown): Json => ({ column, op: "eq", value });
const oneOf = (column: string, value: string[]): Json => ({ column, op: "in", value });
const day = (column: string, op: string, when: string): Json => ({ column, op, day: when });

/** The kitchen's today, on its calendar. */
const today = (column: string): Json => ({ column, last: 1, unit: "day", calendar: true });
/** Today and the six days before it, on the kitchen's calendar. */
const week = (column: string): Json => ({ column, last: 7, unit: "day", calendar: true });

const COUNT = { metricFormat: "plain", deltaMode: "none", showSparkline: false };
const MONEY = { metricFormat: "currency", deltaMode: "none", showSparkline: false };

/** Every order but a cancelled one. */
const ORDERED = oneOf("status", [...COUNTED, "not_collected"]);
/** Waiting to be handed over. */
const BOARD = ["placed", "confirmed", "preparing", "ready"];

/** The Orders page, filtered as a card counts. */
const ordersPage = (...filters: string[]) => `/p/ordering-orders?${filters.join("&")}`;
const TODAY_LINK = ["f.pickup_at=gte:today", "f.pickup_at=lte:today"];
const WEEK_LINK = ["f.pickup_at=gte:today-6", "f.pickup_at=lte:today"];
const NOT_CANCELLED = "f.status=neq:cancelled";

type Place = [x: number, y: number, w: number, h: number];

/** A card's words beside its title, each in every language the app speaks. */
interface Words {
  subtitle?: string;
  empty?: string;
}

function card(i: string, widget: string, [x, y, w, h]: Place, en: string, config: Json, words: Words = {}): Json {
  return {
    i,
    widget,
    x,
    y,
    w,
    h,
    config: {
      title: en,
      titles: l(en),
      ...(words.subtitle === undefined ? {} : { subtitle: words.subtitle, subtitles: others(words.subtitle) }),
      ...(words.empty === undefined ? {} : { emptyState: { titleKey: words.empty, titles: others(words.empty) } }),
      ...config,
    },
  };
}

export const OVERVIEW_LAYOUT = {
  version: 1,
  toolbar: {
    link: { label: "Open the kitchen", labels: others("Open the kitchen"), href: "@staff", icon: "external-link" },
  },
  items: [
    // ── today ────────────────────────────────────────────────────────────────
    card("orders-today", "kpi-stat-card", [0, 0, 3, 3], "Orders today", {
      ...COUNT,
      iconName: "receipt",
      href: ordersPage(...TODAY_LINK, NOT_CANCELLED),
      binding: metric(count("orders"), { filters: [ORDERED], window: today("pickup_at") }),
    }),
    card("collected-today", "kpi-stat-card", [3, 0, 3, 3], "Collected today", {
      ...MONEY,
      iconName: "banknote",
      href: ordersPage(...TODAY_LINK, "f.status=eq:picked_up"),
      binding: metric(sum("total", "collected"), { filters: [eq("status", "picked_up")], window: today("pickup_at") }),
    }),
    card("to-collect", "kpi-stat-card", [6, 0, 3, 3], "Still to collect today", {
      ...MONEY,
      iconName: "hand-coins",
      href: ordersPage(...TODAY_LINK, `f.status=in:${BOARD.join(",")}`),
      binding: metric(sum("total", "to_collect"), { filters: [oneOf("status", BOARD)], window: today("pickup_at") }),
    }),
    card("average-today", "kpi-stat-card", [9, 0, 3, 3], "Average order today", {
      ...MONEY,
      iconName: "activity",
      href: ordersPage(...TODAY_LINK, NOT_CANCELLED),
      binding: metric(avg("total", "average"), { filters: [ORDERED], window: today("pickup_at") }),
    }),

    // ── the last 7 days ──────────────────────────────────────────────────────
    card("orders-week", "kpi-stat-card", [0, 3, 3, 3], "Orders, last 7 days", {
      ...COUNT,
      iconName: "receipt",
      href: ordersPage(...WEEK_LINK, NOT_CANCELLED),
      binding: metric(count("orders"), { filters: [ORDERED], window: week("pickup_at") }),
    }),
    card("collected-week", "kpi-stat-card", [3, 3, 3, 3], "Collected, last 7 days", {
      ...MONEY,
      iconName: "banknote",
      href: ordersPage(...WEEK_LINK, "f.status=eq:picked_up"),
      binding: metric(sum("total", "collected"), { filters: [eq("status", "picked_up")], window: week("pickup_at") }),
    }),
    card("average-week", "kpi-stat-card", [6, 3, 3, 3], "Average order, last 7 days", {
      ...MONEY,
      iconName: "activity",
      href: ordersPage(...WEEK_LINK, NOT_CANCELLED),
      binding: metric(avg("total", "average"), { filters: [ORDERED], window: week("pickup_at") }),
    }),
    card("cancelled-week", "kpi-stat-card", [9, 3, 3, 3], "Cancelled, last 7 days", {
      ...COUNT,
      iconName: "calendar-x",
      iconTone: "warn",
      href: ordersPage(...WEEK_LINK, "f.status=eq:cancelled"),
      binding: metric(count("orders"), { filters: [eq("status", "cancelled")], window: week("pickup_at") }),
    }),

    // ── today's pickup times, and the next orders on the board ───────────────
    card(
      "pickups-today",
      "chart-bar",
      [0, 6, 8, 7],
      "Pickups today",
      {
        highlight: "none",
        series: [{ label: "Orders", labels: others("Orders") }],
        // What the slot limit has taken of each of today's pickup times.
        binding: { kind: "capacity-counts", source: { name: "orders" }, shape: "categorical", capacity: { rule: 0 } },
      },
      { subtitle: "Orders in each pickup time, today", empty: "No pickup times today" },
    ),
    card(
      "next-on-board",
      "mini-table",
      [8, 6, 4, 7],
      "Next on the board",
      {
        limit: 4,
        columns: [
          { name: "number", label: "Order", format: "mono" },
          { name: "pickup_at", label: "Pickup", logicalType: "timestamptz" },
          { name: "status", label: "Status", logicalType: "enum" },
        ],
        secondary: ["name"],
        viewAllHref: ordersPage(...TODAY_LINK, `f.status=in:${BOARD.join(",")}`),
        binding: list("orders", {
          select: ["id", "number", "name", "pickup_at", "status"],
          filters: [oneOf("status", BOARD)],
          window: today("pickup_at"),
          orderBy: [
            { column: "pickup_at", dir: "asc" },
            { column: "number", dir: "asc" },
          ],
          limit: 4,
        }),
      },
      { subtitle: "Still to hand over today, soonest first", empty: "Nothing left on the board today" },
    ),

    // ── what needs a person ──────────────────────────────────────────────────
    card(
      "new-enquiries",
      "mini-table",
      [0, 13, 4, 6],
      "New enquiries",
      {
        limit: 3,
        columns: [
          { name: "ref", label: "Enquiry", format: "mono" },
          { name: "heads", label: "People", logicalType: "integer" },
          { name: "wanted_on", label: "For", logicalType: "date" },
        ],
        secondary: ["name"],
        viewAllHref: "/p/ordering-enquiries?f.status=eq:new",
        binding: list("enquiries", {
          select: ["id", "ref", "name", "heads", "wanted_on"],
          filters: [eq("status", "new")],
          orderBy: [{ column: "created_at", dir: "asc" }],
          limit: 3,
        }),
      },
      { subtitle: "Large orders waiting for a call back", empty: "No new enquiries" },
    ),
    card(
      "paused-slots",
      "mini-table",
      [4, 13, 4, 6],
      "Paused slots",
      {
        limit: 3,
        columns: [
          { name: "slot_at", label: "Pickup time", logicalType: "timestamptz" },
          { name: "paused_by", label: "Paused by" },
        ],
        viewAllHref: "/p/ordering-paused-slots?f.active=eq:true",
        binding: list("slot_pauses", {
          select: ["id", "slot_at", "paused_by"],
          filters: [eq("active", true), day("slot_at", "gte", "today")],
          orderBy: [{ column: "slot_at", dir: "asc" }],
          limit: 3,
        }),
      },
      { subtitle: "Taking no online orders, from today on", empty: "No paused times" },
    ),
    card(
      "not-collected",
      "mini-table",
      [8, 13, 4, 6],
      "Not collected, last 7 days",
      {
        limit: 3,
        columns: [
          { name: "number", label: "Order", format: "mono" },
          { name: "pickup_at", label: "Pickup", logicalType: "timestamptz" },
          { name: "total", label: "Total", logicalType: "decimal", semantic: "money" },
        ],
        secondary: ["name"],
        viewAllHref: ordersPage(...WEEK_LINK, "f.status=eq:not_collected"),
        binding: list("orders", {
          select: ["id", "number", "name", "pickup_at", "total"],
          filters: [eq("status", "not_collected")],
          window: week("pickup_at"),
          orderBy: [{ column: "pickup_at", dir: "desc" }],
          limit: 3,
        }),
      },
      { subtitle: "Nothing was charged for these", empty: "Every order was collected" },
    ),

    // ── by day, and today's portions ─────────────────────────────────────────
    card(
      "orders-by-day",
      "chart-bar",
      [0, 19, 4, 7],
      "Orders by day",
      {
        highlight: "current",
        series: [{ label: "Orders", labels: others("Orders") }],
        binding: orders({ shape: "timeseries", aggregations: [count("orders")], bucket: { column: "pickup_at", unit: "day" }, filters: [ORDERED], window: week("pickup_at") }),
      },
      { subtitle: "Last 7 days, by day of pickup", empty: "No orders in the last 7 days" },
    ),
    card(
      "collected-by-day",
      "chart-bar",
      [4, 19, 4, 7],
      "Collected by day",
      {
        highlight: "current",
        series: [{ label: "Collected", labels: others("Collected") }],
        binding: orders({
          shape: "timeseries",
          aggregations: [sum("total", "collected")],
          bucket: { column: "pickup_at", unit: "day" },
          filters: [eq("status", "picked_up")],
          window: week("pickup_at"),
        }),
      },
      { subtitle: "Last 7 days, by day of pickup", empty: "Nothing collected in the last 7 days" },
    ),
    card(
      "portions-today",
      "mini-table",
      [8, 19, 4, 7],
      "Sold out and running low",
      {
        limit: 6,
        columns: [
          { name: "name", label: "Dish" },
          { name: "portions", label: "Ordered", semantic: "capacity-bar" },
        ],
        viewAllHref: "/p/ordering-dishes?f.stock_on=eq:today",
        // Each dish with portions set for today, fewest first, and what today's orders hold of them.
        binding: list("menu_items", {
          select: ["id", "name", "stock_today"],
          filters: [{ column: "stock_today", op: "not_null" }, day("stock_on", "eq", "today")],
          orderBy: [
            { column: "stock_today", dir: "asc" },
            { column: "name", dir: "asc" },
          ],
          limit: 6,
          counts: { table: "order_items", as: "portions" },
        }),
      },
      { subtitle: "Portions for today", empty: "No portions set for today" },
    ),

    // ── when, and what ───────────────────────────────────────────────────────
    card(
      "pickup-hours",
      "chart-bar",
      [0, 26, 8, 7],
      "When people pick up",
      {
        highlight: "max",
        series: [{ label: "Pickups", labels: others("Pickups") }],
        binding: orders({ shape: "timeseries", aggregations: [count("pickups")], bucket: { column: "pickup_at", unit: "hour-of-day" }, filters: [ORDERED], window: week("pickup_at") }),
      },
      { subtitle: "Pickups by hour, last 7 days", empty: "No orders in the last 7 days" },
    ),
    card(
      "top-dishes",
      "chart-ranking-bars",
      [8, 26, 4, 7],
      "Top dishes, last 7 days",
      {
        n: 5,
        metricFormat: "plain",
        href: "/p/ordering-dishes",
        // Counted through each line's order: its pickup day, and never a cancelled one. Ties go by name.
        binding: query("order_items", {
          shape: "categorical",
          groupBy: ["menu_item_id"],
          groupLabel: "menu_item_id.name",
          aggregations: [sum("qty", "ordered")],
          filters: [{ column: "order_id.status", op: "neq", value: "cancelled" }],
          window: week("order_id.pickup_at"),
          limit: 5,
        }),
      },
      { subtitle: "By quantity ordered", empty: "No orders in the last 7 days" },
    ),
  ],
};
