/**
 * The kitchen's own facts and the page's formatter, for any screen: its name,
 * its words, its address, its phone, its photos — all its settings, read from
 * Adminium — and times, days and amounts in the reader's language on the
 * kitchen's clock.
 */
import { useI18n } from "../i18n/index.tsx";
import { sources } from "../data/sources.ts";
import { formatter, type Formatter } from "../lib/format.ts";
import { useDiner } from "../state/diner.ts";

export interface Venue {
  name: string;
  headline: string | null;
  intro: string | null;
  about: string | null;
  /** The address's first part ("112 Junction Ave") and the rest ("Riverside"). */
  street: string;
  town: string;
  address: string;
  area: string | null;
  directions: string | null;
  phone: string | null;
  photos: { hero: string | null; street: string | null; closed: string | null; store: string | null };
  taxRate: number;
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

export function venueOf(settings: Record<string, unknown> | null | undefined): Venue {
  const s = settings ?? {};
  const address = text(s["address"]) ?? "";
  const comma = address.indexOf(",");
  return {
    name: text(s["venue_name"]) ?? "",
    headline: text(s["headline"]),
    intro: text(s["intro"]),
    about: text(s["about"]),
    street: comma < 0 ? address : address.slice(0, comma).trim(),
    town: comma < 0 ? "" : address.slice(comma + 1).trim(),
    address,
    area: text(s["area"]),
    directions: text(s["directions"]),
    phone: text(s["phone"]),
    photos: { hero: text(s["photo_hero"]), street: text(s["photo_street"]), closed: text(s["photo_closed"]), store: text(s["photo_store"]) },
    taxRate: Number(s["tax_rate"] ?? 0),
  };
}

export function useVenue(): Venue {
  const settings = useDiner((s) => s.data?.settings);
  return venueOf(settings);
}

/** The formatter for the page's language, on the kitchen's clock and in its money. */
export function useFmt(): Formatter {
  const { locale } = useI18n();
  const data = useDiner((s) => s.data);
  const src = sources();
  return formatter(locale, data?.zone ?? src.zone, data?.currency ?? src.currency);
}
