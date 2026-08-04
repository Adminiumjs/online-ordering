/**
 * Presentation helpers.
 *
 * Money arrives as INTEGER CENTS and is divided exactly once, here. Times
 * arrive as MINUTES SINCE MIDNIGHT and become a locale-formatted clock the
 * same way — the app's whole notion of "now" is one integer, and this is the
 * only place it turns into something a person reads.
 */

import { PINNED_DATE } from "../data/demo.ts";
import { locale, number as ambientNumber, t, tOr } from "../i18n/ambient.ts";
import type { MessageKey } from "../i18n/messages/index.ts";

/** Resolve a seed field that stores an i18n key; pass literal text through. */
export function label(key: string): string {
  return tOr(key, key);
}

export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat(locale(), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** A modifier's price change — "+$1.50", or nothing at all when it is free. */
export function delta(cents: number): string {
  if (cents === 0) return "";
  return t("chrome.plusAmount", { amount: money(cents) });
}

export function number(value: number, opts?: Intl.NumberFormatOptions): string {
  return ambientNumber(value, opts);
}

/* --------------------------------------------------------------------- time */

/**
 * Minutes since midnight → a locale clock.
 *
 * Built on a fixed UTC date so the formatter cannot drift with the reader's
 * timezone; only the hour and minute are ever shown.
 */
export function clock(minutes: number): string {
  const d = new Date(Date.UTC(2026, 6, 28, Math.floor(minutes / 60), minutes % 60));
  return new Intl.DateTimeFormat(locale(), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

/** A 24-hour range like "11:00 – 21:00", for the hours strip. */
export function clockRange(from: number, to: number): string {
  return t("chrome.range", { from: clock(from), to: clock(to) });
}

/** "Tuesday, 28 July 2026" — the header line. */
export function today(): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(PINNED_DATE);
}

/** "12 min" — an elapsed chip on a kitchen card. */
export function minutes(n: number): string {
  return t("chrome.minutes", { count: n }, n);
}

/* -------------------------------------------------------------------- tints */

function toRgb(hex: string): [number, number, number] {
  let h = (hex || "#e11d48").replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * The layered gradient that stands in for a food photograph.
 *
 * Built from the category's CSS custom property rather than a hex, so it
 * re-tints with the theme automatically. `index` varies the mix slightly so
 * two items in the same category do not look identical on a grid.
 */
export function foodTile(tintVar: string, index: number): string {
  const a = 14 + ((index * 3) % 8);
  const b = 40 + ((index * 5) % 14);
  return `linear-gradient(145deg, color-mix(in srgb, var(${tintVar}) ${a}%, var(--surface-2)) 0%, color-mix(in srgb, var(${tintVar}) ${b}%, var(--surface-2)) 100%)`;
}

export { t };
export type { MessageKey };
