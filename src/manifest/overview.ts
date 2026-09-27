/**
 * The Overview page's layout: the kitchen at a glance, drawn by Adminium's
 * own widgets from the app's tables. Nothing on it is typed in — every figure
 * is a stored row, counted or summed where Adminium runs the query, on the
 * kitchen's clock.
 *
 * Two groups of figures, read top to bottom:
 *   - today: the orders for today, what was collected, what is still to
 *     collect;
 *   - the last 7 days: orders and what was collected, and both by day.
 *
 * What the words mean, once:
 *   - an order "for today" is picked up today and still wanted or handed
 *     over (not cancelled, not left uncollected);
 *   - "collected" is an order handed over, counted on the day it was;
 *   - "still to collect" is an order for today not handed over yet.
 *
 * A card's title is written in every language the app speaks; money is shown
 * in the connection's currency.
 */
import { l, type Labels } from "./labels.ts";
import { COUNTED } from "./tables.ts";

type Json = Record<string, unknown>;

const query = (rest: Json): Json => ({ kind: "table-query", source: { name: "orders", type: "table" }, ...rest });
const metric = (aggregation: Json, rest: Json): Json => query({ shape: "metric+delta", aggregations: [aggregation], ...rest });

const count = (alias: string): Json => ({ fn: "count", alias });
const sum = (column: string, alias: string): Json => ({ fn: "sum", column, alias });
const eq = (column: string, value: unknown): Json => ({ column, op: "eq", value });
const oneOf = (column: string, value: string[]): Json => ({ column, op: "in", value });

/** The kitchen's today, on its calendar. */
const today = (column: string): Json => ({ column, last: 1, unit: "day", calendar: true });
/** The seven days ending today, on the kitchen's calendar. */
const week = (column: string): Json => ({ column, last: 7, unit: "day", calendar: true });

const COUNT = { metricFormat: "plain", deltaMode: "none", showSparkline: false };
const MONEY = { metricFormat: "currency", deltaMode: "none", showSparkline: false };

type Place = [x: number, y: number, w: number, h: number];

function card(i: string, widget: string, [x, y, w, h]: Place, en: string, config: Json): Json {
  const titles: Labels = l(en);
  return { i, widget, x, y, w, h, config: { title: titles["en-US"], titles, ...config } };
}

const STILL_WANTED = ["placed", "confirmed", "preparing", "ready"];

export const OVERVIEW_LAYOUT = {
  version: 1,
  items: [
    card("orders-today", "kpi-stat-card", [0, 0, 4, 3], "Orders today", {
      ...COUNT,
      iconName: "receipt",
      binding: metric(count("orders"), { filters: [oneOf("status", COUNTED)], window: today("pickup_at") }),
    }),
    card("collected-today", "kpi-stat-card", [4, 0, 4, 3], "Collected today", {
      ...MONEY,
      iconName: "banknote",
      binding: metric(sum("total", "collected"), { filters: [eq("status", "picked_up")], window: today("picked_up_at") }),
    }),
    card("to-collect", "kpi-stat-card", [8, 0, 4, 3], "Still to collect today", {
      ...MONEY,
      iconName: "hand-coins",
      binding: metric(sum("total", "to_collect"), { filters: [oneOf("status", STILL_WANTED)], window: today("pickup_at") }),
    }),
    card("orders-week", "kpi-stat-card", [0, 3, 6, 3], "Orders, last 7 days", {
      ...COUNT,
      iconName: "activity",
      binding: metric(count("orders"), { filters: [oneOf("status", [...COUNTED, "not_collected"])], window: week("pickup_at") }),
    }),
    card("collected-week", "kpi-stat-card", [6, 3, 6, 3], "Collected, last 7 days", {
      ...MONEY,
      iconName: "banknote",
      binding: metric(sum("total", "collected"), { filters: [eq("status", "picked_up")], window: week("picked_up_at") }),
    }),
    card("orders-by-day", "chart-bar", [0, 6, 6, 8], "Orders by day", {
      binding: query({
        shape: "timeseries",
        aggregations: [count("orders")],
        bucket: { column: "pickup_at", unit: "day" },
        filters: [oneOf("status", [...COUNTED, "not_collected"])],
        window: week("pickup_at"),
      }),
    }),
    card("collected-by-day", "chart-bar", [6, 6, 6, 8], "Collected by day", {
      binding: query({
        shape: "timeseries",
        aggregations: [sum("total", "collected")],
        bucket: { column: "picked_up_at", unit: "day" },
        filters: [eq("status", "picked_up")],
        window: week("picked_up_at"),
      }),
    }),
  ],
};
