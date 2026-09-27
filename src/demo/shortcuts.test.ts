/**
 * The demo card's shortcuts leave the kitchen as the people they stand for
 * would have: through the demo's Adminium, never around it.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { instantOf } from "../lib/venueTime.ts";
import { DemoAdminium } from "./adminium.ts";
import { DEMO_HOLIDAYS } from "../data/demo.ts";
import { addHoliday, afterClosing, anotherScreenReady, arrive, fillSlot, lunchRush, sellOut } from "./shortcuts.ts";

const ZONE = "America/Los_Angeles";
const at = (time: string) => new Date(instantOf("2026-07-28", time, ZONE)).toISOString();
let demo: DemoAdminium;
beforeEach(() => {
  demo = new DemoAdminium();
});
const order = (n: string) => demo.world.all("orders").find((o) => o["number"] === n)!;
const collectedToday = () =>
  demo.world
    .where("orders", (o) => o["status"] === "picked_up" && String(o["picked_up_at"]).startsWith("2026-07-2") && new Date(String(o["pickup_at"])).toISOString() >= at("00:00") && new Date(String(o["pickup_at"])).toISOString() < new Date(instantOf("2026-07-29", "00:00", ZONE)).toISOString())
    .reduce((sum, o) => sum + Math.round(Number(o["total"]) * 100), 0) / 100;

describe("the card's shortcuts", () => {
  it("After closing: the sample's orders are finished first, so the kitchen agrees with the Overview's $296.62", () => {
    afterClosing(demo);
    expect(["2113", "2114", "2115", "2116", "2117"].map((n) => order(n)["status"])).toEqual(["picked_up", "picked_up", "picked_up", "picked_up", "picked_up"]);
    expect(order("2116")["picked_up_at"]).toBe(at("12:17"));
    expect(collectedToday()).toBe(296.62);
  });

  it("After closing still sweeps an order made in the demo", () => {
    const lena = arrive(demo)!;
    afterClosing(demo);
    expect([demo.world.get("orders", lena.id)!["status"], demo.world.get("orders", lena.id)!["cancel_code"]]).toEqual(["cancelled", "closed"]);
  });

  it("Another screen marks it ready: at the demo's time now, by Sam", () => {
    const ready = anotherScreenReady(demo)!;
    expect([ready["number"], ready["status"], ready["ready_at"], ready["ready_by"]]).toEqual(["2114", "ready", at("11:40"), "Sam"]);
  });

  it("A new order arrives: #2118, Lena W., for the first free time", () => {
    const lena = arrive(demo)!;
    expect([lena["number"], lena["name"], lena["pickup_at"], lena["total"]]).toEqual(["2118", "Lena W.", at("12:00"), 21.38]);
  });

  it("A lunch rush fills 12:30 to six of six", () => {
    expect(lunchRush(demo)).toBe(6);
    expect(demo.engine.taken(instantOf("2026-07-28", "12:30", ZONE))).toBe(6);
  });

  it("The slot fills first; Wild mushroom sells out; a public holiday becomes a closure", () => {
    fillSlot(demo, "12:15");
    expect(demo.engine.slotAnswer("2026-07-28").find((s) => s.time === "12:15")!.state).toBe("full");
    sellOut(demo);
    expect(demo.engine.dishAnswer("2026-07-28", 1, () => true).find((s) => s.id === String(demo.world.all("menu_items").find((d) => d["name"] === "Wild mushroom")!.id))!.state).toBe("soldout");
    expect(addHoliday(demo, DEMO_HOLIDAYS)!["reason"]).toBe("Labor Day");
  });
});
