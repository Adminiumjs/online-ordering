/**
 * The DataSource seam.
 *
 * This app ships in demo mode: every read below returns the seeded fiction in
 * `demo.ts`, synchronously, with no network involved. The seam exists so that
 * pointing the app at a real Adminium deployment is a change to ONE file
 * rather than a rewrite — the store loads through this interface and the
 * screens read what it handed over.
 *
 * That second implementation now exists: `adminiumSource.ts` reads a real
 * Adminium instance through `@adminiumjs/public-client` and is swapped in by
 * `main.tsx` before React mounts. `demoSource` remains the fallback whenever
 * either build-time env var is absent — which is the case for every
 * marketplace demo, and is why that fallback is structural rather than a catch.
 *
 * Two facts live here rather than in `demo.ts`: the address and the week's
 * hours. They are properties of the VENUE, not of the menu or the order book,
 * and in a real deployment they arrive from a settings record rather than from
 * the same table as the food.
 *
 * SIX MORE JOINED THEM WHEN CONNECTED MODE LANDED, and each was a real hole
 * rather than tidying. The clock, the service date, the tax rate, the first
 * pickup slot and the next order number were all imported STRAIGHT FROM THE
 * SEED by the store and by five screens — so a connected kitchen would have
 * charged the demo's tax, opened at the demo's hours, printed a date two
 * months stale and re-issued an order number the venue had already used, with
 * every row on the screen real.
 */

import {
  CATEGORIES,
  FIRST_LIVE_NUMBER,
  FIRST_SLOT,
  ITEMS,
  PINNED_DATE,
  PINNED_NOW,
  SEED_ORDERS,
  TAX_RATE,
  at,
} from "./demo.ts";
import type { Category, Item, Order } from "./types.ts";

export interface Venue {
  /** Street lines are proper nouns and stay literal in every locale. */
  line1: string;
  line2: string;
  /** i18n key — this one is prose, so it is translated. */
  note: string;
}

export interface DayHours {
  /** i18n key. */
  day: string;
  open: number;
  close: number;
  /** Exactly one row carries this: the pinned demo day. */
  today?: boolean;
}

const VENUE: Venue = {
  line1: "482 Alder Street",
  line2: "Old Mill District",
  note: "data.venue.note",
};

/**
 * The posted week. Tuesday matches `OPEN_AT` / `CLOSE_AT` in `demo.ts`,
 * because Tuesday is the pinned day and the two must agree — an hours card
 * that disagrees with the open/closed pill is the kind of small lie that makes
 * a demo feel fake.
 */
const WEEK_HOURS: DayHours[] = [
  { day: "data.day.mon", open: at(11, 0), close: at(21, 0) },
  { day: "data.day.tue", open: at(11, 0), close: at(21, 0), today: true },
  { day: "data.day.wed", open: at(11, 0), close: at(21, 0) },
  { day: "data.day.thu", open: at(11, 0), close: at(21, 0) },
  { day: "data.day.fri", open: at(11, 0), close: at(22, 0) },
  { day: "data.day.sat", open: at(11, 0), close: at(22, 0) },
  { day: "data.day.sun", open: at(12, 0), close: at(20, 0) },
];

export interface DataSource {
  categories(): Category[];
  items(): Item[];
  orders(): Order[];
  venue(): Venue;
  weekHours(): DayHours[];
  /** The clock the app runs on, as minutes since midnight in the VENUE's zone. */
  now(): number;
  /** The service date as `YYYY-MM-DD` — the header line, and nothing else. */
  today(): string;
  /** Sales tax, as a percentage. */
  taxRate(): number;
  /** The earliest pickup slot offered, minutes since midnight. */
  firstSlot(): number;
  /** The next order number to mint, so a reload does not re-issue one. */
  nextNumber(): number;
}

/**
 * Everything is copied on the way out, deeply enough that no caller can reach
 * back into the seed by mutating what it was given. That is what lets the
 * dock's reset restore a pristine service without reloading the page.
 */
export const demoSource: DataSource = {
  categories: () => CATEGORIES.map((c) => ({ ...c })),

  items: () =>
    ITEMS.map((item) => ({
      ...item,
      tags: [...item.tags],
      mods: item.mods.map((group) => ({
        ...group,
        options: group.options.map((option) => ({ ...option })),
      })),
    })),

  orders: () =>
    SEED_ORDERS.map((order) => ({
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        selection: Object.fromEntries(
          Object.entries(line.selection).map(([group, ids]) => [group, [...ids]]),
        ),
      })),
    })),

  venue: () => ({ ...VENUE }),

  weekHours: () => WEEK_HOURS.map((d) => ({ ...d })),

  now: () => PINNED_NOW,
  today: () => PINNED_DATE.toISOString().slice(0, 10),
  taxRate: () => TAX_RATE,
  firstSlot: () => FIRST_SLOT,
  nextNumber: () => FIRST_LIVE_NUMBER,
};

let current: DataSource = demoSource;
let read = false;

/**
 * The source the app is currently wired to.
 *
 * An indirection rather than a re-export, because `state/store.ts` reads it at
 * MODULE SCOPE — a re-exported binding would be captured at import time and a
 * later swap would change nothing.
 */
export const source: DataSource = {
  categories: () => ((read = true), current.categories()),
  items: () => ((read = true), current.items()),
  orders: () => ((read = true), current.orders()),
  venue: () => ((read = true), current.venue()),
  weekHours: () => ((read = true), current.weekHours()),
  now: () => ((read = true), current.now()),
  today: () => ((read = true), current.today()),
  taxRate: () => ((read = true), current.taxRate()),
  firstSlot: () => ((read = true), current.firstSlot()),
  nextNumber: () => ((read = true), current.nextNumber()),
};

/**
 * Swap the backing source. Must happen before any module-scope read.
 *
 * The tripwire is the whole reason this is a function and not an assignment:
 * the ordering it depends on is invisible, and getting it wrong fails SILENTLY
 * — the app renders demo data against a configured backend and looks fine. A
 * thrown error at boot is the only way that mistake announces itself.
 */
export function setDataSource(next: DataSource): void {
  if (read) {
    throw new Error(
      "setDataSource() called after the store already read — import App dynamically, after the snapshot resolves.",
    );
  }
  current = next;
}

/**
 * True once a real backend is behind the seam.
 *
 * Read by the demo dock, which resets the service, advances the clock and
 * fakes kitchen progress: against real orders those controls either lie or do
 * damage, so it does not render.
 */
export function isConnected(): boolean {
  return current !== demoSource;
}
