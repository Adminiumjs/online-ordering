/**
 * The kitchen's days as the order page reads them: whether it is open today
 * and until when, the next day it opens, the pickup times a diner may still
 * take, grouped the way the picker shows them.
 *
 * Everything here is worked out from Adminium's answers — the hours and
 * closures it lets out, and its slot availability — and the kitchen's clock.
 * Which time is free is never decided here: a time the answer calls `full`
 * is full, and one before the notice is simply not offered.
 */
import type { Row, SlotTime } from "../data/wire.ts";
import { addDays, hhmm, minutesOf, weekdayOf, type Day } from "./venueTime.ts";

export interface DayHours {
  open: boolean;
  opens: string;
  closes: string;
  /** The closure over the day, with its reason, when there is one. */
  closure: { reason: string | null } | null;
}

/** A day's opening from the hours rows and the closures. */
export function hoursOn(day: Day, hours: readonly Row[], closures: readonly Row[]): DayHours {
  const row = hours.find((h) => h["weekday"] === weekdayOf(day));
  const closure = closures.find((c) => String(c["from_date"]) <= day && day <= String(c["to_date"] ?? c["from_date"]));
  return {
    open: row !== undefined && row["open"] !== false && closure === undefined,
    opens: String(row?.["opens"] ?? "00:00"),
    closes: String(row?.["closes"] ?? "00:00"),
    closure: closure === undefined ? null : { reason: (closure["reason"] as string | null) ?? null },
  };
}

/** The first day from `from` (itself included) the kitchen opens, looking two weeks ahead. */
export function nextOpenDay(from: Day, hours: readonly Row[], closures: readonly Row[], within = 14): Day | null {
  for (let i = 0; i < within; i += 1) {
    const day = addDays(from, i);
    if (hoursOn(day, hours, closures).open) return day;
  }
  return null;
}

export type HomeState = "open" | "later" | "closedTonight" | "closedToday" | "noSlots";

/**
 * Where today stands at `minutes` past midnight: open, opening later, closed
 * tonight, closed all day, or open with no pickup left a diner may take.
 */
export function homeState(today: DayHours, minutes: number, freeToday: number): HomeState {
  if (!today.open) return "closedToday";
  if (minutes < minutesOf(today.opens)) return "later";
  if (minutes >= minutesOf(today.closes)) return "closedTonight";
  if (freeToday === 0) return "noSlots";
  return "open";
}

/** A pickup time as the picker offers it. */
export interface Slot {
  day: Day;
  time: string;
  /** Full, or paused: shown and not pickable. */
  off: boolean;
  paused: boolean;
}

/**
 * The times a diner is offered on a day: every time of Adminium's answer from
 * `now` + the notice on — a time already too soon is left out rather than
 * called full — each marked off when it is full or paused.
 */
export function offeredSlots(day: Day, answer: readonly SlotTime[], today: Day, minutesNow: number, noticeMinutes: number): Slot[] {
  const earliest = day === today ? minutesNow + noticeMinutes : -1;
  return answer
    .filter((s) => minutesOf(s.time) >= earliest)
    .map((s) => ({ day, time: s.time, off: s.state !== "free", paused: s.state === "paused" }));
}

/** Whether every time left today is paused (and at least one is): the kitchen stopped for today. */
export function stoppedForToday(slots: readonly Slot[]): boolean {
  const left = slots.filter((s) => !(s.off && !s.paused));
  return left.length > 0 && left.every((s) => s.paused);
}

export type SlotGroupId = "morning" | "lunch" | "afternoon" | "evening";

/** The picker's groups: before 11 AM, to 3 PM, to 5 PM, and the evening; an empty group is left out. */
export function groupSlots<T extends { time: string }>(slots: readonly T[]): { id: SlotGroupId; slots: T[] }[] {
  const bands: [SlotGroupId, number, number][] = [
    ["morning", 0, 660],
    ["lunch", 660, 900],
    ["afternoon", 900, 1020],
    ["evening", 1020, 1440],
  ];
  return bands
    .map(([id, from, to]) => ({ id, slots: slots.filter((s) => minutesOf(s.time) >= from && minutesOf(s.time) < to) }))
    .filter((g) => g.slots.length > 0);
}

/** The last pickup of a day: a slot before closing. */
export const lastPickup = (closes: string, slotMinutes: number): string => hhmm(minutesOf(closes) - slotMinutes);

/** The week's rows, runs of three or more equal days folded into one: "Monday–Thursday". */
export function weekRows(hours: readonly Row[]): { from: number; to: number; open: boolean; opens: string; closes: string }[] {
  const week = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((w) => {
    const row = hours.find((h) => h["weekday"] === w);
    return { open: row !== undefined && row["open"] !== false, opens: String(row?.["opens"] ?? ""), closes: String(row?.["closes"] ?? "") };
  });
  const same = (a: (typeof week)[number], b: (typeof week)[number]) => a.open === b.open && a.opens === b.opens && a.closes === b.closes;
  const out: { from: number; to: number; open: boolean; opens: string; closes: string }[] = [];
  let i = 0;
  while (i < 7) {
    let j = i;
    while (j + 1 < 7 && same(week[j + 1]!, week[i]!)) j += 1;
    if (j - i >= 2) {
      out.push({ from: i, to: j, ...week[i]! });
      i = j + 1;
    } else {
      out.push({ from: i, to: i, ...week[i]! });
      i += 1;
    }
  }
  return out;
}
