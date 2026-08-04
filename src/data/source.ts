/**
 * The DataSource seam.
 *
 * This app ships in demo mode: every read below returns the seeded fiction in
 * `demo.ts`, synchronously, with no network involved. The seam exists so that
 * pointing the app at a real Adminium deployment is a change to ONE file
 * rather than a rewrite — the store loads through this interface and the
 * screens read what it handed over.
 *
 * When `@adminium/manifest` lands (Phase B), a second implementation of
 * `DataSource` backed by `AdminiumDataSource` slots in here and `demoSource`
 * becomes the fallback used when no `adm_pub_` key is configured.
 *
 * Two facts live here rather than in `demo.ts`: the address and the week's
 * hours. They are properties of the VENUE, not of the menu or the order book,
 * and in a real deployment they arrive from a settings record rather than from
 * the same table as the food.
 */

import { CATEGORIES, ITEMS, SEED_ORDERS, at } from "./demo.ts";
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
};

/** The source the app is currently wired to. */
export const source: DataSource = demoSource;
