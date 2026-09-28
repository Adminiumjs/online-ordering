/**
 * This app's screens, as data — the ONE declaration two build outputs and one
 * runtime all read: `App.tsx` (which components a build renders), `urlSync.ts`
 * (which path selects which screen) and `surface.json` (which sections
 * Adminium's sidebar offers).
 *
 * Icons are lucide NAMES in kebab-case, never imported components: this module
 * is read by the Vite config to emit `surface.json`.
 */

import type { View } from "./state/views.ts";
import type { MessageKey } from "./i18n/messages/index.ts";
import type { SurfaceNavEntry } from "./surface-types.ts";

export const APP_KEY = "ordering";

/** The sidebar section heading when this app is blended into Adminium. */
export const APP_LABEL_KEY: MessageKey = "shell.brand";

type Entry = SurfaceNavEntry<View> & { labelKey: MessageKey };

/**
 * The NAVIGABLE screens. The diner's come first: a build that carries both
 * sides reads the empty path as the order page's Home.
 *
 * An order's own link lands on `o` with its code in the fragment, and an
 * emailed sign-in link on `c` — the same screen as `orders`, which it signs in
 * to (`orders` is listed first, so that is the address the screen shows after).
 *
 * The kitchen side has one address; its tabs are the screen's own.
 */
export const SURFACE_NAV = [
  { id: "home", path: "", view: "home", side: "customer", labelKey: "shell.nav.home" },
  { id: "menu", path: "menu", view: "menu", side: "customer", labelKey: "shell.nav.menu" },
  { id: "cart", path: "cart", view: "cart", side: "customer", labelKey: "shell.footer.cart" },
  { id: "checkout", path: "checkout", view: "checkout", side: "customer", labelKey: "co.title" },
  { id: "track", path: "o", view: "track", side: "customer", labelKey: "shell.nav.track" },
  { id: "find", path: "find", view: "find", side: "customer", labelKey: "find.title" },
  { id: "orders", path: "orders", view: "orders", side: "customer", labelKey: "shell.nav.orders" },
  { id: "signin", path: "c", view: "orders", side: "customer", labelKey: "shell.nav.orders" },
  { id: "large", path: "large", view: "large", side: "customer", labelKey: "shell.nav.large" },
  { id: "kitchen", path: "", view: "kitchen", side: "staff", icon: "chef-hat", labelKey: "shell.kitchen" },
] as const satisfies readonly Entry[];

/**
 * The kitchen's own modules, which the order page's build must not carry: its
 * screens, its state and its door into Adminium (the staff session). The
 * surface gate reads this list and looks for each in the customer bundle's
 * source maps.
 */
export const SURFACE_STAFF_ONLY = [
  "src/screens/Kitchen.tsx",
  "src/kitchen/KitchenApp.tsx",
  "src/kitchen/Board.tsx",
  "src/kitchen/Phone.tsx",
  "src/kitchen/Hours.tsx",
  "src/state/kitchen.ts",
  "src/data/adminiumKitchen.ts",
  "src/data/sessionSource.ts",
] as const;

/** Screens a side renders without an address of their own. */
export const SURFACE_EXTRAS = {
  staff: ["notfound"],
  customer: ["notfound"],
} as const satisfies Record<"staff" | "customer", readonly View[]>;

export type StaffView =
  | Extract<(typeof SURFACE_NAV)[number], { side: "staff" }>["view"]
  | (typeof SURFACE_EXTRAS)["staff"][number];

export type CustomerView =
  | Extract<(typeof SURFACE_NAV)[number], { side: "customer" }>["view"]
  | (typeof SURFACE_EXTRAS)["customer"][number];
