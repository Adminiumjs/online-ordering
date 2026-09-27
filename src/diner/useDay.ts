/**
 * Where the kitchen's day stands for the order page, worked out from what
 * Adminium answered (hours, closures, slot availability, the online switch)
 * on the kitchen's clock: open or closed and why, the next day it opens, the
 * first free pickup, and whether online orders are paused.
 */
import { useNow } from "../data/sources.ts";
import { homeState, hoursOn, lastPickup, nextOpenDay, stoppedForToday, type DayHours, type HomeState } from "../lib/day.ts";
import { addDays, type Day } from "../lib/venueTime.ts";
import { minutesOf, rulesOf, slotsOn, todayOf, useDiner } from "../state/diner.ts";

export interface DayFacts {
  now: number;
  today: Day;
  tomorrow: Day;
  minutes: number;
  hours: DayHours;
  state: HomeState;
  online: boolean;
  /** The kitchen paused every time left today. */
  stopped: boolean;
  /** Online orders are off, or paused for today. */
  paused: boolean;
  firstFreeToday: string | null;
  nextOpen: Day | null;
  nextHours: DayHours | null;
  nextFirst: string | null;
  lastPickupToday: string;
  slotMinutes: number;
  notice: number;
}

export function useDay(): DayFacts {
  const now = useNow();
  const data = useDiner((s) => s.data);
  useDiner((s) => s.slots);
  const today = todayOf(now);
  const tomorrow = addDays(today, 1);
  const minutes = minutesOf(now);
  const hoursRows = data?.hours ?? [];
  const closures = data?.closures ?? [];
  const hours = hoursOn(today, hoursRows, closures);
  const rules = rulesOf();
  const todaySlots = slotsOn(today, now);
  const free = todaySlots.filter((s) => !s.off);
  const stopped = hours.open && stoppedForToday(todaySlots);
  const nextOpen = nextOpenDay(tomorrow, hoursRows, closures);
  const nextHours = nextOpen === null ? null : hoursOn(nextOpen, hoursRows, closures);
  const nextFree = nextOpen === null ? [] : slotsOn(nextOpen, now).filter((s) => !s.off);
  const state = homeState(hours, minutes, free.length);
  return {
    now,
    today,
    tomorrow,
    minutes,
    hours,
    state,
    online: rules.online,
    stopped,
    paused: !rules.online || stopped,
    firstFreeToday: free[0]?.time ?? null,
    nextOpen,
    nextHours,
    nextFirst: nextFree[0]?.time ?? nextHours?.opens ?? null,
    lastPickupToday: lastPickup(hours.closes, rules.slot),
    slotMinutes: rules.slot,
    notice: rules.notice,
  };
}
