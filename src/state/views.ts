/** The app's screens by name — read by the runtime and by the build (`surface-nav.ts`), so nothing here touches the page. */

export type DinerView = "home" | "menu" | "cart" | "checkout" | "track" | "find" | "orders" | "large" | "notfound";
export type KitchenView = "queue" | "slots" | "shelf" | "today" | "hours";

/** A screen with an address: the diner's views, and the kitchen's (one address, its tabs its own). */
export type View = DinerView | "kitchen";
