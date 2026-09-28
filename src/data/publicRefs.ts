/**
 * The public API's names for the order page's entries.
 *
 * Adminium names each entry of the manifest's `publicAccess` when it installs
 * the app: the table's real name, a suffix for what the entry is (`_claimed`
 * for a sign-in or a link's own row, `_verified` for a signed-in diner's rows,
 * `_availability` for what is still free, none for a plain read), and a
 * counter (`_2`, `_3` …) for the second entry of the same name, counted across
 * both keys in the manifest's order. The table's real name is the one the
 * server sends in `surface-config.json` (`orders` → `ordering_orders`).
 *
 * The suffixes below are the manifest's, worked out once and held by
 * `publicRefs.test.ts` against the manifest's own entries: an entry added or
 * moved fails that test before it can send a page to the wrong ref.
 */

/** Each entry the order page calls: the table, and its suffix. */
export const PUBLIC_REFS = {
  // The customer key: the kitchen, its menu and its hours.
  settings: ["settings", ""],
  categories: ["menu_categories", ""],
  dishes: ["menu_items", ""],
  groups: ["modifier_groups", ""],
  options: ["modifiers", ""],
  hours: ["hours", ""],
  closures: ["closures", ""],
  // What is still free: a pickup slot, a dish's portions.
  slots: ["orders", "_availability"],
  portions: ["order_items", "_availability"],
  // Placing an order with its lines and options, priced by Adminium; a large-order enquiry.
  place: ["orders", "_verified_2"],
  enquire: ["enquiries", ""],
  // A signed-in diner: their account and their own orders.
  account: ["customers", "_claimed"],
  myOrders: ["orders", "_verified"],
  myLines: ["order_items", "_verified"],
  myOptions: ["order_item_modifiers", "_verified"],
  // The `link` key: the one order its own link opens.
  linkOrder: ["orders", "_claimed"],
  linkLines: ["order_items", "_verified_2"],
  linkOptions: ["order_item_modifiers", "_verified_2"],
} as const satisfies Record<string, readonly [string, string]>;

export type RefName = keyof typeof PUBLIC_REFS;
export type Refs = Record<RefName, string>;

/** The app's key, which names its tables when the server does not say (`ordering_orders`). */
const APP_KEY = "ordering";

/** Every ref by its real name, from the server's table names. */
export function publicRefs(tables: Readonly<Record<string, string>> = {}): Refs {
  const out = {} as Refs;
  for (const [name, [table, suffix]] of Object.entries(PUBLIC_REFS) as [RefName, readonly [string, string]][]) {
    out[name] = `${tables[table] ?? `${APP_KEY}_${table}`}${suffix}`;
  }
  return out;
}
