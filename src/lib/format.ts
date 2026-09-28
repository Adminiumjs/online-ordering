/**
 * How a time, a day, an amount and a rate read — in the reader's language,
 * on the KITCHEN's clock.
 *
 * Every date and time comes out of `Intl` for the page's locale (a German
 * reader sees "12:00", an American "12:00 PM", an Egyptian Arabic-Indic
 * digits), in the kitchen's zone (Adminium's, from its config), never the
 * device's: a diner in another zone reads the kitchen's pickup times. Money
 * is in the connection's currency, with its own decimals.
 */
import { dayDate, instantOf, toMs, type Day } from "./venueTime.ts";

export interface Formatter {
  locale: string;
  zone: string;
  currency: string;
  money(value: unknown): string;
  /** An instant as a time of day on the kitchen's clock: "12:00 PM". */
  time(instant: number | string): string;
  /** A wall time of a day: "12:00 PM". */
  wall(day: Day, time: string): string;
  /** "Tuesday, July 28". */
  dayLong(day: Day): string;
  /** "Tue, Jul 28". */
  dayShort(day: Day): string;
  /** "Tuesday". */
  weekday(day: Day): string;
  /** "8.25%" from a rate in percent (8.25). */
  percent(rate: unknown): string;
  number(value: number): string;
  /** "Pacific Time" — the kitchen's zone by its name, for a reader in another. */
  zoneName: string;
  /** Whether the reader's device keeps another zone than the kitchen's. */
  otherZone: boolean;
  year(instant: number | string): string;
}

const cache = new Map<string, Formatter>();

/** The formatter for a language, a kitchen's zone and its currency. */
export function formatter(locale: string, zone: string, currency: string): Formatter {
  const key = `${locale}|${zone}|${currency}`;
  const found = cache.get(key);
  if (found !== undefined) return found;
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const time = new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "numeric", minute: "2-digit" });
  const dayLong = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
  const dayShort = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long" });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 3 });
  const number = new Intl.NumberFormat(locale);
  const year = new Intl.DateTimeFormat(locale, { timeZone: zone, year: "numeric" });
  let zoneName = zone;
  try {
    zoneName =
      new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? zone;
  } catch {
    // An engine without `longGeneric` names the zone by its id.
  }
  let device = zone;
  try {
    device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // No zone to compare with: say nothing.
  }
  const made: Formatter = {
    locale,
    zone,
    currency,
    money: (value) => money.format(Number(value ?? 0)),
    time: (instant) => time.format(new Date(toMs(instant))),
    wall: (day, t) => time.format(new Date(instantOf(day, t, zone))),
    dayLong: (day) => dayLong.format(dayDate(day)),
    dayShort: (day) => dayShort.format(dayDate(day)),
    weekday: (day) => weekday.format(dayDate(day)),
    percent: (rate) => percent.format(Number(rate ?? 0) / 100),
    number: (value) => number.format(value),
    zoneName,
    otherZone: device !== zone,
    year: (instant) => year.format(new Date(toMs(instant))),
  };
  cache.set(key, made);
  return made;
}

/** A phone number as a `tel:` link: its digits, and a leading `+` when it has one. */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/[^0-9]/g, "")}`;
}

/** Arabic-Indic and Persian digits typed into a code, a phone or a count, read as ASCII. */
export function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));
}

/** "kwame.b@mail.example" → "kwame@…": enough to recognise, no more. */
export function maskEmail(email: string | null | undefined): string {
  if (email === null || email === undefined || email === "") return "";
  return `${email.split("@")[0]!.split(".")[0]}@…`;
}

/** The first word of a name: "Kwame B." → "Kwame". */
export const firstName = (name: unknown): string => String(name ?? "").trim().split(/\s+/)[0] ?? "";

/** An address shaped like one: something, an at sign, a domain with a dot. The server judges it again. */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
