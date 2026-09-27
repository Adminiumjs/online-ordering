/**
 * EVERY FIGURE THE DESIGN QUOTES COMES OUT OF THE SAMPLE.
 *
 * The sample is added at 11:40 on Tuesday 28 July 2026 in Riverside
 * (America/Los_Angeles), resolved the way Adminium resolves it — prices
 * copied from the menu, each line's options summed, the order's subtotal,
 * tax (8.25 %, rounded once, half up) and total worked out — and each figure
 * the screens, the emails and the Overview show is read back from the rows.
 * A figure that changes here changes on every screen; change the design's
 * copy with it, never this test alone.
 */
import { describe, expect, it } from "vitest";

import { RULES, resolveSample, workOut, type ResolvedRow, type SampleBundleRows } from "../data/sampleRows.ts";
import { DEMO_ZONE, sampleBundle } from "./juniper.ts";

/** 11:40 PDT is 18:40 UTC. */
const AT_1140 = Date.parse("2026-07-28T18:40:00Z");
const rows = resolveSample(sampleBundle() as unknown as SampleBundleRows, { now: AT_1140, zone: DEMO_ZONE, locale: "en-US", currency: "USD" });

const orders = rows["orders"]!;
const lines = rows["order_items"]!;
const dishes = rows["menu_items"]!;
const order = (n: number) => orders.find((o) => o["number"] === `S${String(n)}`)!;
const money = (value: unknown) => Number(value).toFixed(2);
const sum = (values: unknown[]) => values.reduce<number>((a, v) => a + Math.round(Number(v) * 100), 0) / 100;

/** The kitchen's date and wall time of an instant. */
const local = (iso: unknown) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(String(iso)));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, hour: Number(get("hour")) };
};
const TODAY = "2026-07-28";
const WEEK = ["2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28"];
const inWeek = (o: ResolvedRow) => WEEK.includes(local(o["pickup_at"]).day);
const linesOf = (o: ResolvedRow) => lines.filter((l) => l["order_id"] === o["id"]);
const dishName = (l: ResolvedRow) => dishes.find((d) => d["id"] === l["menu_item_id"])!["name"];

describe("today's orders, as the design draws them at 11:40", () => {
  const TABLE: [number, string, string, string, string, number, string, string, string][] = [
    [2107, "Hana K.", "09:15", "2026-07-29 12:30", "placed", 2, "22.00", "1.82", "23.82"],
    [2108, "Rosa M.", "10:36", "2026-07-28 11:00", "picked_up", 2, "17.50", "1.44", "18.94"],
    [2109, "Kwame B.", "10:48", "2026-07-28 11:15", "picked_up", 2, "21.50", "1.77", "23.27"],
    [2110, "Sofia R.", "10:52", "2026-07-28 11:15", "picked_up", 3, "34.75", "2.87", "37.62"],
    [2111, "Aiden T.", "11:02", "2026-07-28 11:30", "picked_up", 3, "34.25", "2.83", "37.08"],
    [2112, "Noor H.", "11:06", "2026-07-28 11:30", "picked_up", 2, "19.75", "1.63", "21.38"],
    [2113, "Priya N.", "11:12", "2026-07-28 11:45", "ready", 3, "31.00", "2.56", "33.56"],
    [2114, "Marcus O.", "11:15", "2026-07-28 11:45", "preparing", 2, "30.50", "2.52", "33.02"],
    [2115, "Dana L.", "11:18", "2026-07-28 12:00", "confirmed", 3, "26.50", "2.19", "28.69"],
    [2116, "Theo A.", "11:24", "2026-07-28 12:15", "placed", 4, "38.50", "3.18", "41.68"],
    [2117, "Ines V.", "11:26", "2026-07-28 12:15", "placed", 3, "19.75", "1.63", "21.38"],
  ];

  it.each(TABLE)("#%i %s: placed %s, pickup %s, %s, %i items, %s + %s = %s", (n, name, placed, pickup, status, items, subtotal, tax, total) => {
    const o = order(n);
    expect(o["name"]).toBe(name);
    expect(local(o["placed_at"]).time).toBe(placed);
    const p = local(o["pickup_at"]);
    expect(`${p.day} ${p.time}`).toBe(pickup);
    expect(o["status"]).toBe(status);
    expect(o["item_count"]).toBe(items);
    expect([money(o["subtotal"]), money(o["tax"]), money(o["total"])]).toEqual([subtotal, tax, total]);
    expect(o["tax_rate"]).toBe(8.25);
  });

  it("stamps #2113's timeline as the ticket shows it: confirmed 11:14 and ready 11:34 by Sam", () => {
    const o = order(2113);
    expect([local(o["confirmed_at"]).time, local(o["preparing_at"]).time, local(o["ready_at"]).time]).toEqual(["11:14", "11:22", "11:34"]);
    expect([o["confirmed_by"], o["ready_by"]]).toEqual(["Sam", "Sam"]);
    expect([local(order(2114)["confirmed_at"]).time, local(order(2114)["preparing_at"]).time]).toEqual(["11:17", "11:28"]);
    expect(local(order(2115)["confirmed_at"]).time).toBe("11:20");
  });

  it("gives every order a phone but #2111 and #2116, which read \"No phone given\"", () => {
    const today = orders.filter((o) => Number(String(o["number"]).slice(1)) >= 2107);
    expect(today.filter((o) => o["phone"] === null).map((o) => o["number"])).toEqual(["S2111", "S2116"]);
    expect(order(2109)["phone"]).toBe("(555) 019-2205");
  });

  it("keeps the kitchen's notes: #2114 extra crispy, #2116 one box", () => {
    expect(order(2114)["note"]).toBe("Extra crispy, please.");
    expect(order(2116)["note"]).toBe("One box, please — we're sharing.");
  });

  it("puts the board's pickups on the quarter-hour grid, at least 20 minutes after placing, no slot over 2", () => {
    const slots = new Map<string, number>();
    for (const o of orders) {
      const p = local(o["pickup_at"]);
      if (p.day !== TODAY && p.day !== "2026-07-29") continue;
      expect(Number(p.time.slice(3)) % 15, String(o["number"])).toBe(0);
      expect(Date.parse(String(o["pickup_at"])) - Date.parse(String(o["placed_at"])), String(o["number"])).toBeGreaterThanOrEqual(20 * 60_000);
      const key = `${p.day} ${p.time}`;
      slots.set(key, (slots.get(key) ?? 0) + 1);
    }
    expect(Math.max(...slots.values())).toBeLessThanOrEqual(2);
  });
});

describe("the kitchen at 11:40", () => {
  const board = orders.filter((o) => local(o["pickup_at"]).day === TODAY && ["placed", "confirmed", "preparing", "ready"].includes(String(o["status"])));

  it("has five on the board: New 2, Confirmed 1, Preparing 1, Ready 1; one for tomorrow", () => {
    const count = (status: string) => board.filter((o) => o["status"] === status).length;
    expect([count("placed"), count("confirmed"), count("preparing"), count("ready")]).toEqual([2, 1, 1, 1]);
    expect(orders.filter((o) => local(o["pickup_at"]).day === "2026-07-29").map((o) => o["number"])).toEqual(["S2107"]);
  });

  it("counts the slots 11:00 1, 11:15 2, 11:30 2, 11:45 2, 12:00 1, 12:15 2, and 1:00 PM paused by Sam", () => {
    const today = orders.filter((o) => local(o["pickup_at"]).day === TODAY && o["status"] !== "cancelled");
    const at = (time: string) => today.filter((o) => local(o["pickup_at"]).time === time).length;
    expect(["11:00", "11:15", "11:30", "11:45", "12:00", "12:15"].map(at)).toEqual([1, 2, 2, 2, 1, 2]);
    const pause = rows["slot_pauses"]![0]!;
    expect([local(pause["slot_at"]).time, pause["paused_by"], pause["active"]]).toEqual(["13:00", "Sam", true]);
  });

  it("shows #2113 on the shelf: 3 items, collect $33.56", () => {
    expect([order(2113)["item_count"], money(order(2113)["total"])]).toEqual([3, "33.56"]);
  });

  it("holds Wild mushroom to 3 portions today with 1 ordered (\"2 left\"), and Diavola sold out", () => {
    const funghi = dishes.find((d) => d["slug"] === "pizza-funghi")!;
    const diavola = dishes.find((d) => d["slug"] === "pizza-diavola")!;
    expect([funghi["stock_today"], funghi["stock_on"], diavola["stock_today"], diavola["stock_on"]]).toEqual([3, TODAY, 0, TODAY]);
    const ordered = lines
      .filter((l) => l["menu_item_id"] === funghi["id"])
      .filter((l) => {
        const o = orders.find((x) => x["id"] === l["order_id"])!;
        return local(o["pickup_at"]).day === TODAY && o["status"] !== "cancelled" && o["status"] !== "not_collected";
      })
      .reduce((n, l) => n + Number(l["qty"]), 0);
    expect(3 - ordered).toBe(2);
  });

  it("strips the all-day board: Margherita 3, Lemonade 3, Brown butter cookie 2, Hibiscus iced tea 2, then 1 each", () => {
    const tally = new Map<string, number>();
    for (const o of board) for (const l of linesOf(o)) tally.set(String(dishName(l)), (tally.get(String(dishName(l))) ?? 0) + Number(l["qty"]));
    expect(Object.fromEntries(tally)).toEqual({
      Margherita: 3,
      Lemonade: 3,
      "Brown butter cookie": 2,
      "Hibiscus iced tea": 2,
      "Build your own pizza": 1,
      "Charred brussels": 1,
      "Signature grain bowl": 1,
      "Wild mushroom": 1,
      "Smoky chili bowl": 1,
    });
  });
});

describe("the history: #2017–#2106 over the six days before today", () => {
  const history = orders.filter((o) => {
    const n = Number(String(o["number"]).slice(1));
    return n >= 2017 && n <= 2106;
  });

  it("holds 90 orders, one not collected on Friday ($29.77) and one cancelled on Saturday ($21.38)", () => {
    expect(history).toHaveLength(90);
    const odd = history.filter((o) => o["status"] !== "picked_up").map((o) => [o["number"], local(o["pickup_at"]).day, local(o["pickup_at"]).time, o["status"], money(o["total"])]);
    expect(odd).toEqual([
      ["S2060", "2026-07-24", "19:30", "not_collected", "29.77"],
      ["S2082", "2026-07-25", "19:45", "cancelled", "21.38"],
    ]);
    expect(order(2082)["cancel_code"]).toBe("ran_out");
  });

  it("gives Kwame #2009 ($26.79), #1951 ($23.27) and #1872 ($40.86) for Order again", () => {
    expect([order(2009), order(1951), order(1872)].map((o) => [local(o["pickup_at"]).day, local(o["pickup_at"]).time, money(o["total"])])).toEqual([
      ["2026-07-21", "12:00", "26.79"],
      ["2026-07-17", "12:15", "23.27"],
      ["2026-07-10", "12:30", "40.86"],
    ]);
  });
});

describe("the Overview's figures", () => {
  const week = orders.filter(inWeek);
  const counted = week.filter((o) => o["status"] !== "cancelled");
  const collectedOn = (day: string) => sum(week.filter((o) => o["status"] === "picked_up" && local(o["pickup_at"]).day === day).map((o) => o["total"]));

  it("counts and collects by day: Wed 12 / $311.50 … Tue 10 / $138.29 so far", () => {
    const byDay = WEEK.map((day) => [counted.filter((o) => local(o["pickup_at"]).day === day).length, collectedOn(day).toFixed(2)]);
    expect(byDay).toEqual([
      [12, "311.50"],
      [15, "388.35"],
      [19, "463.85"],
      [20, "549.11"],
      [14, "363.72"],
      [9, "202.97"],
      [10, "138.29"],
    ]);
  });

  it("reads today at 11:40: 10 orders, $138.29 collected, $158.33 to collect, $29.66 average", () => {
    const today = counted.filter((o) => local(o["pickup_at"]).day === TODAY);
    const collected = sum(today.filter((o) => o["status"] === "picked_up").map((o) => o["total"]));
    const toCollect = sum(today.filter((o) => o["status"] !== "picked_up").map((o) => o["total"]));
    expect([today.length, collected.toFixed(2), toCollect.toFixed(2), ((collected + toCollect) / today.length).toFixed(2)]).toEqual([10, "138.29", "158.33", "29.66"]);
  });

  it("reads the last 7 days: 99 orders, $2,417.79 collected, $26.32 average over $2,605.89", () => {
    const all = sum(counted.map((o) => o["total"]));
    expect([counted.length, sum(week.filter((o) => o["status"] === "picked_up").map((o) => o["total"])).toFixed(2), all.toFixed(2), (all / counted.length).toFixed(2)]).toEqual([
      99,
      "2417.79",
      "2605.89",
      "26.32",
    ]);
  });

  it("spreads pickups by hour: 11 AM 13, 12 PM 21, 1 PM 14 … 8 PM 6", () => {
    const hours = new Map<number, number>();
    for (const o of counted) hours.set(local(o["pickup_at"]).hour, (hours.get(local(o["pickup_at"]).hour) ?? 0) + 1);
    expect([...hours.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [11, 13],
      [12, 21],
      [13, 14],
      [14, 5],
      [15, 4],
      [16, 3],
      [17, 6],
      [18, 16],
      [19, 11],
      [20, 6],
    ]);
  });

  it("ranks the top dishes: Margherita 33, Lemonade 26, Hibiscus 24, grain bowl 19, then a four-way tie at 12 ranked by name", () => {
    const tally = new Map<string, number>();
    for (const o of counted) for (const l of linesOf(o)) tally.set(String(dishName(l)), (tally.get(String(dishName(l))) ?? 0) + Number(l["qty"]));
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
    expect(ranked).toEqual([
      ["Margherita", 33],
      ["Lemonade", 26],
      ["Hibiscus iced tea", 24],
      ["Signature grain bowl", 19],
      ["Build your own pizza", 12],
      ["Charred brussels", 12],
      ["Little gem salad", 12],
      ["Wild mushroom", 12],
    ]);
  });
});

describe("the tax is worked out once, half up", () => {
  it.each([
    ["62.00", "5.12", "67.12"],
    ["66.00", "5.45", "71.45"],
    ["146.00", "12.05", "158.05"],
  ])("$%s → tax $%s → $%s, by the order's own formulas", (subtotal, tax, total) => {
    const formula = (column: string) => RULES.formulas.find((f) => f.table === "orders" && f.column === column)!.expr;
    const row: Record<string, unknown> = { subtotal, tax_rate: 8.25 };
    row["tax"] = workOut(formula("tax"), row, 2);
    row["total"] = workOut(formula("total"), row, 2);
    expect([money(row["tax"]), money(row["total"])]).toEqual([tax, total]);
  });
});
