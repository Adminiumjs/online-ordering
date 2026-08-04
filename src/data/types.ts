/**
 * The app's domain types.
 *
 * Money is INTEGER CENTS. Times are MINUTES SINCE MIDNIGHT — the whole app's
 * clock is one integer, which is what makes the dock's "+10 min" chip a single
 * addition and the pickup-slot arithmetic plain integer maths.
 *
 * VOCABULARY: this is a PICKUP-ONLY product. The word "delivery" appears
 * nowhere, in any locale, and there is no type below that could carry one.
 */

export type View =
  | "home"
  | "menu"
  | "cart"
  | "checkout"
  | "confirm"
  | "track"
  | "kitchen"
  | "notfound";

export type Persona = "diner" | "kitchen";

export type CategoryId = "bowls" | "pizza" | "sides" | "drinks" | "sweets";

export interface Category {
  id: CategoryId;
  /** i18n key. */
  name: string;
  icon: string;
  /** CSS custom property carrying this category's tint. */
  tint: string;
}

export interface ModifierOption {
  id: string;
  /** i18n key. */
  name: string;
  /** Price change in cents; may be 0. */
  delta: number;
}

export interface ModifierGroup {
  id: string;
  /** i18n key. */
  name: string;
  /** `radio` replaces the selection; `check` accumulates up to `max`. */
  type: "radio" | "check";
  min: number;
  max: number;
  /** i18n key for the rule hint ("Pick one", "Up to 5"). */
  hint: string;
  options: ModifierOption[];
}

export interface Item {
  id: string;
  cat: CategoryId;
  /** i18n key. */
  name: string;
  /** i18n key — a shorter form for the kitchen board and the all-day strip. */
  short: string;
  /** i18n key. */
  desc: string;
  /** Base price in cents. */
  price: number;
  icon: string;
  /** A fictional filename for the tile's mono chip. Never translated. */
  file: string;
  /** Dietary chips: "V", "Spicy". */
  tags: string[];
  mods: ModifierGroup[];
  feat?: boolean;
  soldOut?: boolean;
}

/** Group id → the option ids chosen in it. */
export type Selection = Record<string, string[]>;

export interface CartLine {
  /** The composite key `item|options|note` — this line's identity. */
  key: string;
  item: string;
  selection: Selection;
  note: string;
  qty: number;
}

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "picked_up";

export interface Order {
  num: number;
  customer: string;
  status: OrderStatus;
  /** Minutes since midnight. */
  placedAt: number;
  /** When the order last changed status. */
  statusAt: number;
  /** The chosen pickup slot. */
  pickupAt: number;
  lines: CartLine[];
  /** Free text from the customer; rendered warn-tinted on the kitchen card. */
  note: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: "pos" | "danger" | "info";
}
