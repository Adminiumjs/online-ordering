/**
 * The kitchen's calendar and clock.
 *
 * Every day and time a diner or the kitchen reads is the KITCHEN's — its
 * zone comes from Adminium (the connection's, or `/public/config`), never
 * from the reader's device: a diner in another zone picks 12:00 PM in
 * Riverside, not their own noon. Days are `YYYY-MM-DD`, times `HH:MM`, and
 * an instant is epoch milliseconds or an ISO string.
 */

export type Day = string;

const parts = (instant: number, zone: string) => {
  const found = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(instant));
  const get = (type: string) => found.find((part) => part.type === type)?.value ?? "";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), h: Number(get("hour")) % 24, min: Number(get("minute")), s: Number(get("second")) };
};

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** How far `zone` is ahead of UTC at `instant`, in ms. */
export function zoneOffsetMs(zone: string, instant: number): number {
  const p = parts(instant, zone);
  const local = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((local - instant) / 60_000) * 60_000;
}

export const toMs = (instant: number | string): number => (typeof instant === "number" ? instant : Date.parse(instant));

/** The kitchen's date of an instant. */
export function venueDay(instant: number | string, zone: string): Day {
  const p = parts(toMs(instant), zone);
  return `${pad(p.y, 4)}-${pad(p.m)}-${pad(p.d)}`;
}

/** Minutes after the kitchen's midnight of an instant (11:40 → 700). */
export function venueMinutes(instant: number | string, zone: string): number {
  const p = parts(toMs(instant), zone);
  return p.h * 60 + p.min;
}

/** `HH:MM` of a number of minutes after midnight. */
export const hhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

/** Minutes after midnight of an `HH:MM`. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** The instant of a wall time on a day of the kitchen; across a clock change a second pass settles it. */
export function instantOf(day: Day, time: string, zone: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = zoneOffsetMs(zone, guess);
  const again = zoneOffsetMs(zone, guess - offset);
  return again === offset ? guess - offset : guess - again;
}

/** A day moved by `n` days. */
export function addDays(day: Day, n: number): Day {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(at.getUTCFullYear(), 4)}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** Whole days from `a` to `b`. */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** The weekday of a day, as the hours table keys it. */
export function weekdayOf(day: Day): WeekdayKey {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return WEEKDAY_KEYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]!;
}

/** A day as a Date at noon UTC — safe to format with `timeZone: "UTC"` into its own weekday and date. */
export const dayDate = (day: Day): Date => new Date(`${day}T12:00:00Z`);
