/**
 * The kitchen's rules as the screen plays them, on the demo's Adminium at
 * 11:40 on Tuesday 28 July: the chips' words, Stop for today, the phone order
 * that lands confirmed, Undo, and a sold-out dish a cancel does not put back.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { setSources } from "../data/sources.ts";
import { DemoAdminium } from "../demo/adminium.ts";
import { anotherScreenReady } from "../demo/shortcuts.ts";
import { MESSAGES, type MessageKey } from "../i18n/messages/index.ts";
import type { TFunction } from "../i18n/index.tsx";
import { formatter } from "../lib/format.ts";
import {
  addPhoneLine,
  cancelOrder,
  freshPhone,
  kToday,
  loadKitchen,
  markSoldOut,
  moveOrder,
  pauseMany,
  placePhone,
  reopenMany,
  setPhone,
  useKitchen,
} from "../state/kitchen.ts";
import { chipFor } from "./Board.tsx";
import { bookable, stopPauses, stoppedToday } from "./Slots.tsx";

const t: TFunction = (key, params, count) => {
  const raw = MESSAGES["en-US"][key as MessageKey] ?? key;
  const text = count === undefined ? raw.split("|").pop()! : (raw.split("|")[count === 1 ? 0 : 1] ?? raw);
  const all = { ...(count === undefined ? {} : { count }), ...params };
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in all ? String(all[name as keyof typeof all]) : m));
};
const fmt = formatter("en-US", "America/Los_Angeles", "USD");

let demo: DemoAdminium;

beforeEach(async () => {
  demo = new DemoAdminium();
  setSources({ diner: demo.diner, kitchen: demo.kitchen, clock: { now: () => demo.now, subscribe: () => () => undefined }, zone: "America/Los_Angeles", currency: "USD" });
  useKitchen.setState({ load: "busy", signedOut: false, orders: [], slots: {}, phone: null, cancel: null });
  await loadKitchen();
});

const byNumber = (n: string) => useKitchen.getState().orders.find((o) => String(o.order["number"]) === n)!;
const today = () => kToday(demo.now);

describe("the board's words", () => {
  it("says when to start, when it is due, how late, how long on the shelf", () => {
    const now = demo.now;
    expect(chipFor(t, fmt, byNumber("2116"), now, 15).text).toBe("Start 12:00 PM");
    expect(chipFor(t, fmt, byNumber("2115"), now, 15).text).toBe("Start 11:45 AM");
    expect(chipFor(t, fmt, byNumber("2114"), now, 15).text).toBe("Due in 5m");
    expect(chipFor(t, fmt, byNumber("2113"), now, 15).text).toBe("On the shelf 6m");
    expect(chipFor(t, fmt, byNumber("2114"), now + 10 * 60_000, 15)).toMatchObject({ text: "Late 5m", tone: "danger" });
  });
});

describe("Stop for today", () => {
  it("pauses 12:00 PM to 8:45 PM today, and tomorrow stays open", async () => {
    const slots = useKitchen.getState().slots[today()]!;
    const need = bookable(slots, 11 * 60 + 40, 20).filter((s) => s.pause === null).map((s) => s.time);
    expect(need[0]).toBe("12:00");
    expect(need.at(-1)).toBe("20:45");
    const result = await pauseMany(today(), need);
    expect(result.failedAt).toBeNull();
    const after = useKitchen.getState().slots[today()]!;
    expect(stoppedToday(after, 11 * 60 + 40, 20)).toBe(true);
    const tomorrow = Object.keys(useKitchen.getState().slots).find((d) => d !== today())!;
    expect(useKitchen.getState().slots[tomorrow]!.every((s) => s.pause === null)).toBe(true);
    const free = await demo.diner.slots(today());
    expect(free.filter((s) => s.state === "free")).toEqual([]);

    // Take orders again: every time from the notice on reopens.
    await reopenMany(bookable(after, 11 * 60 + 40, 20).flatMap((s) => (s.pause === null ? [] : [s.pause.id])));
    expect(stoppedToday(useKitchen.getState().slots[today()]!, 11 * 60 + 40, 20)).toBe(false);
  });
});

describe("the phone order", () => {
  it("lands confirmed with a Phone tag, no email needed, into a paused slot too", async () => {
    useKitchen.setState({ phone: freshPhone() });
    const margherita = useKitchen.getState().menu!.dishes.find((d) => d.name === "Margherita")!;
    addPhoneLine(margherita.id, [], 2);
    setPhone({ time: "13:00", name: "Dana R.", phone: "(555) 017-4410" });
    const placed = await placePhone();
    expect("number" in placed).toBe(true);
    const order = useKitchen.getState().orders.find((o) => o.order.id === (placed as { id: number }).id)!;
    expect(order.order["status"]).toBe("confirmed");
    expect(order.order["channel"]).toBe("phone");
    expect(order.order["email"] ?? null).toBeNull();
  });
});

describe("moves", () => {
  it("moves on, and Undo moves back within its time", async () => {
    const id = byNumber("2116").order.id;
    expect((await moveOrder(id, "placed", "confirmed")).ok).toBe(true);
    expect(byNumber("2116").order["status"]).toBe("confirmed");
    expect((await moveOrder(id, "confirmed", "placed")).ok).toBe(true);
    expect(byNumber("2116").order["status"]).toBe("placed");
    expect(byNumber("2116").order["confirmed_at"] ?? null).toBeNull();
  });

  it("names who got there first when another screen moved it", async () => {
    const other = anotherScreenReady(demo)!;
    const result = await moveOrder(other.id, "preparing", "ready");
    expect(result).toMatchObject({ ok: false, kind: "unchanged", state: "ready", by: "Sam" });
  });
});

describe("sold out today", () => {
  it("stays sold out when one of its orders is cancelled", async () => {
    const mushroom = useKitchen.getState().menu!.dishes.find((d) => d.name === "Wild mushroom")!;
    expect(await markSoldOut(mushroom.id)).toBe(true);
    const holding = byNumber("2116");
    useKitchen.setState({ cancel: { id: holding.order.id, reason: "ran_out", dish: "Wild mushroom", dishId: mushroom.id, note: "", markSold: true, busy: false } });
    const result = await cancelOrder();
    expect(result).toMatchObject({ ok: true, soldOut: "Wild mushroom", soldFailed: false });
    const states = await demo.diner.dishes(today());
    expect(states.find((s) => s.id === String(mushroom.id))?.state).toBe("soldout");
  });
});

describe("taking orders again after a stop", () => {
  const slot = (time: string, at: string | null | undefined, id: number) => ({ time, at: `2026-07-28T${time}:00.000Z`, taken: 0, size: 6, pause: at === undefined ? null : { id, by: "Sam", at } });

  it("reopens what the stop paused, and leaves a time paused by hand before it", () => {
    // 13:00 was paused at 10:02 for another reason; the stop at 11:30 paused the rest, one write after another.
    const slots = [
      slot("12:45", "2026-07-28T11:30:01.000Z", 1),
      slot("13:00", "2026-07-28T10:02:00.000Z", 2),
      slot("13:15", "2026-07-28T11:30:02.500Z", 3),
      slot("13:30", "2026-07-28T11:30:04.000Z", 4),
      slot("13:45", undefined, 5),
    ];
    expect(stopPauses(slots).map((s) => s.time).sort()).toEqual(["12:45", "13:15", "13:30"]);
  });

  it("takes every pause as the stop's when a pause carries no moment", () => {
    const slots = [slot("12:45", null, 1), slot("13:00", "2026-07-28T10:02:00.000Z", 2)];
    expect(stopPauses(slots).map((s) => s.time)).toEqual(["12:45", "13:00"]);
  });
});
