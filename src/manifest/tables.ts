/**
 * The kitchen's tables, as the manifest asks Adminium to make them.
 *
 * Everything the diner's pages, the kitchen and the dashboard read or write is
 * here, and so is every rule the server keeps on their behalf — a rule the
 * browser keeps is a rule another browser can skip:
 *
 *   - an order's number runs without gaps from the first number in Settings;
 *     its lines copy each dish's name and price, its options their names and
 *     extra charges, and the subtotal, tax and total are worked out by the
 *     server, never sent by a page;
 *   - a pickup slot holds at most so many orders, inside the opening hours,
 *     outside closures and paused slots, far enough ahead and not too far; a
 *     dish with portions set for a day sells no more than that on that day;
 *   - the order moves new → confirmed → preparing → ready → picked up, one
 *     step at a time, each step stamped with when and by whom; a cancel always
 *     carries its reason; at closing, a ready order not collected is marked so,
 *     and half an hour later one never finished is cancelled; a step taken by
 *     mistake is taken back within a minute, emptying its stamps;
 *   - a finished order is locked, with its lines.
 *
 * The four menu tables are Point of Sale's `menu@1`, column for column (the
 * vendored copy of its released tables), so the two apps can share one menu.
 * Ordering adds its own columns to two of them: portions for a day, the dish
 * tile's colour, allergens, and whether a dish is sold online at all.
 */
import POS_MENU from "./vendored/pos-menu-0.2.2.json" with { type: "json" };
import { l, type Labels } from "./labels.ts";

type Tone = "pos" | "warn" | "danger" | "info" | "neutral" | "accent";

export interface Column {
  ref: string;
  type: "int" | "text" | "decimal" | "money" | "bool" | "enum" | "date" | "timestamptz" | "fk";
  role?: "pk" | "created_at";
  semantic?: "name" | "email" | "image" | "money";
  nullable?: true;
  enum?: string[];
  references?: string;
  default?: string | number | boolean;
  maxLength?: number;
  unique?: true;
  index?: true;
  scale?: number | "currency";
  rules?: Record<string, unknown>;
  label?: Labels | Record<string, string>;
}

export interface Table {
  ref: string;
  label: Labels | Record<string, string>;
  labelPlural: Labels | Record<string, string>;
  keyField?: string;
  shape?: string;
  unique?: string[][];
  capacity?: Record<string, unknown>;
  states?: Record<string, unknown>;
  /** The price question an add-on answers inside every save of this table. */
  adjust?: Record<string, unknown>;
  /** What this table hands an add-on's ledger, and when. */
  postings?: Record<string, unknown>[];
  columns: Column[];
}

// ── column makers ───────────────────────────────────────────────────────────

const id: Column = { ref: "id", type: "int", role: "pk" };
const opt = { nullable: true } as const;

function text(ref: string, maxLength: number, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "text", maxLength, label: l(label), ...more };
}
function int(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "int", label: l(label), ...more };
}
function bool(ref: string, label: string, value: boolean): Column {
  return { ref, type: "bool", default: value, label: l(label) };
}
function fk(ref: string, references: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "fk", references, label: l(label), ...more };
}
function date(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "date", label: l(label), ...more };
}
function at(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "timestamptz", label: l(label), ...more };
}
/** Money Adminium works out: the connection's currency decides the places. */
function money(ref: string, label: string, rules: Record<string, unknown>): Column {
  return { ref, type: "decimal", scale: "currency", nullable: true, label: l(label), rules };
}
/** An enum, each value labelled, with tones where a list shows it as a chip. */
function choice(
  ref: string,
  label: string,
  values: Record<string, string>,
  more: Partial<Column> & { tones?: Record<string, Tone> } = {},
): Column {
  const { tones, rules, ...rest } = more;
  return {
    ref,
    type: "enum",
    enum: Object.keys(values),
    label: l(label),
    ...rest,
    rules: {
      ...rules,
      enumLabels: {
        labels: Object.fromEntries(Object.entries(values).map(([value, word]) => [value, l(word)])),
        ...(tones === undefined ? {} : { tones }),
      },
    },
  };
}

/** Money somebody else decides (an add-on's answer), or nobody has yet: empty until then. */
function amount(ref: string, label: string): Column {
  return { ref, type: "decimal", scale: "currency", nullable: true, label: l(label) };
}
/** A whole number Adminium works out, for a rule or an email to test: 1 or 0, never a person's to write. */
function flag(ref: string, label: string, formula: unknown): Column {
  return { ref, type: "int", nullable: true, label: l(label), rules: { formula } };
}
/** A row of an add-on's table, by its key. No database link: the add-on may be away, and its table with it. */
function link(ref: string, addOn: string, table: string, label: string, rules: Record<string, unknown> = {}): Column {
  return { ref, type: "int", nullable: true, label: l(label), rules: { addOnLink: { addOn, table }, ...rules } };
}
/**
 * A figure worked out again at every move of the order, not only when what it
 * reads changes: Adminium works a formula out when one of its columns is
 * written, so naming the status makes each step of the order's life one of
 * them. An order placed before these columns existed has none of them until
 * it next moves — and an email that tests one (ready, paid in full?) is sent
 * at exactly such a move.
 */
const atEachMove = (formula: unknown) => ({ if: [{ isNull: "status" }, formula, formula] });
/** What gift cards paid of an order and still hold, nothing when none did; and whether that is all of it, or part. */
const CARDS_PAID = { coalesce: ["paid", 0] };
const PAID_IN_FULL = { and: [{ gt: [CARDS_PAID, 0] }, { gte: [CARDS_PAID, { coalesce: ["total", 0] }] }] };
const PAID_IN_PART = { and: [{ gt: [CARDS_PAID, 0] }, { lt: [CARDS_PAID, { coalesce: ["total", 0] }] }] };
const stamp = (set: unknown, on: unknown) => ({ stamp: { set, on } });
const onCreate = "create";
const onStatus = (...values: string[]) => ({ column: "status", values });
const setting = (column: string) => ({ table: "settings", column });

// ── the words the tables share ──────────────────────────────────────────────

/** The eight languages an order or an enquiry may be written in, by their own names. */
export const LANGUAGES: Record<string, string> = {
  "en-US": "English",
  "de-DE": "Deutsch",
  "fr-FR": "Français",
  "da-DK": "Dansk",
  "cs-CZ": "Čeština",
  "ar-EG": "العربية",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
};

/**
 * A language column: a text the emails read their language from, held to one
 * of the eight, each named in itself (no translation).
 */
function language(ref: string): Column {
  return {
    ref,
    type: "text",
    maxLength: 16,
    nullable: true,
    label: l("Language"),
    rules: { options: { values: Object.entries(LANGUAGES).map(([value, label]) => ({ value, label })) } },
  };
}

export const STATUSES = ["placed", "confirmed", "preparing", "ready", "picked_up", "cancelled", "not_collected"] as const;

/** The orders a pickup slot and a dish's portions count: every one still wanted, or handed over. */
export const COUNTED = ["placed", "confirmed", "preparing", "ready", "picked_up"];

/**
 * Why an order was cancelled. The kitchen picks one of the first four and
 * `closed` is written at closing; `self` is written by the diner's own cancel
 * online and is never offered to the kitchen.
 */
export const CANCEL_CODES = ["ran_out", "too_busy", "customer_asked", "closed", "other", "self"] as const;
export const KITCHEN_CANCEL_CODES = ["ran_out", "too_busy", "customer_asked", "other"];

/** The kitchen's hours: one row per weekday, the order the slot rule reads them in. */
const WEEKDAYS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

// ── the menu: Point of Sale's `menu@1`, and ordering's own columns on it ─────

type PosTable = { ref: string; shape: string; columns: Column[]; label: Record<string, string>; labelPlural: Record<string, string>; keyField: string };
const posTable = (ref: string): Table => {
  const found = (POS_MENU.tables as unknown as PosTable[]).find((t) => t.ref === ref);
  if (found === undefined) throw new Error(`the vendored menu@1 has no "${ref}"`);
  return structuredClone(found);
};

/** Ordering's own columns on the shared dishes: none may refuse a row the till writes. */
const DISH_EXTRAS: Column[] = [
  // Portions for one day: empty is no limit; any other day than `stock_on` has none.
  int("stock_today", "Portions", { ...opt, rules: { validation: { min: 0 } } }),
  date("stock_on", "Portions for", opt),
  text("hue", 32, "Tile colour", opt),
  text("allergens", 160, "Allergens", opt),
  // Sold online. On a menu shared with the till, a dish may stay on the till only.
  bool("online", "Sold online", true),
];

/** The outbox's kinds, as the Emails page names them. */
const EMAIL_KINDS: Record<string, string> = {
  "order-confirmation": "Order confirmation",
  "order-confirmation-phone": "Order confirmation (phone)",
  "order-ready": "Order ready",
  "order-cancelled-ran-out": "Cancelled: something ran out",
  "order-cancelled-too-busy": "Cancelled: the kitchen was too busy",
  "order-cancelled-customer-asked": "Cancelled: as the customer asked",
  "order-cancelled-closed": "Cancelled: not ready by closing",
  "order-cancelled-other": "Cancelled: another reason",
  "order-cancelled-by-you": "Cancelled by the customer",
  "order-confirmation-prepaid": "Order confirmation (paid by gift card)",
  "order-ready-prepaid": "Order ready (paid by gift card)",
  "card-money-returned": "Gift card money returned",
  "card-money-kept": "Gift card money kept",
  "order-receipt": "Receipt",
  "enquiry-received": "Large order enquiry received",
};

const menuItems = posTable("menu_items");
menuItems.columns.push(...DISH_EXTRAS);
const modifiers = posTable("modifiers");
modifiers.columns.push(text("allergens", 160, "Allergens", opt));

export const MENU_TABLES = ["menu_categories", "menu_items", "modifier_groups", "modifiers"];

// ── the tables ──────────────────────────────────────────────────────────────

export const TABLES: Table[] = [
  {
    ref: "settings",
    label: l("Kitchen settings"),
    labelPlural: l("Kitchen settings"),
    keyField: "venue_name",
    columns: [
      id,
      text("venue_name", 80, "Kitchen name"),
      // The owner's own words for the order page; empty, the page says it generically.
      text("headline", 120, "Headline", opt),
      text("intro", 280, "Introduction", opt),
      text("about", 160, "About line", opt),
      // A business's own address and phone, shown on its order page: not a person's.
      text("address", 160, "Address", { rules: { personal: false } }),
      text("area", 80, "Area", opt),
      text("directions", 280, "Directions", opt),
      text("phone", 32, "Phone", { ...opt, rules: { personal: false, validation: { format: "phone" } } }),
      // The kitchen's own photos, shown on its order page: not a person's, whatever the name suggests.
      text("photo_hero", 400, "Front photo", { ...opt, semantic: "image", rules: { personal: false } }),
      text("photo_street", 400, "Street photo", { ...opt, semantic: "image", rules: { personal: false } }),
      text("photo_closed", 400, "Closed photo", { ...opt, semantic: "image", rules: { personal: false } }),
      text("photo_store", 400, "Counter photo", { ...opt, semantic: "image", rules: { personal: false } }),
      { ref: "tax_rate", type: "decimal", scale: 3, default: 0, label: l("Tax rate (%)"), rules: { validation: { min: 0, max: 100 } } },
      int("slot_minutes", "Minutes per pickup slot", { default: 15, rules: { validation: { min: 5, max: 120 } } }),
      int("slot_capacity", "Orders per slot", { default: 6, rules: { validation: { min: 1, max: 200 } } }),
      int("lead_minutes", "Minutes of notice", { default: 20, rules: { validation: { min: 0, max: 720 } } }),
      int("preorder_days", "Days ahead", { default: 1, rules: { validation: { min: 0, max: 14 } } }),
      int("prep_minutes", "Minutes to prepare", { default: 15, rules: { validation: { min: 0, max: 240 } } }),
      int("max_items", "Items per online order", { default: 12, rules: { validation: { min: 1, max: 200 } } }),
      bool("online_on", "Taking online orders", true),
      bool("ready_email_on", "Email when an order is ready", true),
      bool("receipt_email_on", "Email a receipt at pickup", true),
      int("first_order_number", "First order number", { default: 1001, rules: { validation: { min: 1 } } }),
    ],
  },
  posTable("menu_categories"),
  menuItems,
  posTable("modifier_groups"),
  modifiers,
  {
    ref: "hours",
    label: l("Opening hours"),
    labelPlural: l("Opening hours"),
    keyField: "weekday",
    columns: [
      id,
      choice("weekday", "Day", WEEKDAYS, { unique: true }),
      bool("open", "Open", true),
      // Wall times on the kitchen's clock, "11:00" and "21:00".
      text("opens", 5, "Opens", { default: "11:00" }),
      text("closes", 5, "Closes", { default: "21:00" }),
    ],
  },
  {
    ref: "closures",
    label: l("Closure"),
    labelPlural: l("Closures"),
    keyField: "reason",
    columns: [
      id,
      date("from_date", "From"),
      date("to_date", "To"),
      text("reason", 120, "Reason", opt),
      // Switched off, a closure is kept but no longer closes the kitchen.
      bool("active", "In effect", true),
    ],
  },
  {
    ref: "slot_pauses",
    label: l("Paused slot"),
    labelPlural: l("Paused slots"),
    keyField: "slot_at",
    columns: [
      id,
      at("slot_at", "Slot", { rules: { venueLocal: true } }),
      bool("active", "Paused", true),
      text("paused_by", 80, "Paused by", { ...opt, rules: stamp("user-name", [onCreate, { column: "active", values: [true] }]) }),
      at("paused_at", "Paused at", { ...opt, rules: stamp("now", [onCreate, { column: "active", values: [true] }]) }),
    ],
  },
  {
    ref: "customers",
    label: l("Customer"),
    labelPlural: l("Customers"),
    keyField: "email",
    columns: [
      id,
      text("email", 254, "Email", { ...opt, unique: true, semantic: "email", rules: { normalize: "email", validation: { format: "email" } } }),
      text("name", 80, "Name", opt),
      at("forgotten_at", "Details deleted", opt),
      at("created_at", "First order", { ...opt, rules: stamp("now", onCreate) }),
    ],
  },
  {
    ref: "orders",
    label: l("Order"),
    labelPlural: l("Orders"),
    keyField: "number",
    capacity: {
      kind: "slot",
      slot: "pickup_at",
      amount: 1,
      perSlot: setting("slot_capacity"),
      slotMinutes: setting("slot_minutes"),
      countWhere: { column: "status", values: COUNTED },
      hours: { table: "hours", weekday: "weekday", open: "open", opens: "opens", closes: "closes" },
      closures: { table: "closures", from: "from_date", to: "to_date", active: "active" },
      pauses: { table: "slot_pauses", slot: "slot_at", active: "active" },
      noticeMinutes: setting("lead_minutes"),
      windowDays: setting("preorder_days"),
    },
    // Offers & gift cards works out what a code or an offer takes off, inside the save.
    adjust: {
      by: { addOn: "offers" },
      needs: "codes",
      lines: [
        {
          table: "order_items",
          via: "order_id",
          price: "unit_total",
          quantity: "qty",
          discount: "discount",
          what: [
            { column: "menu_item_id", as: "item" },
            { column: "category_id", as: "category" },
          ],
        },
      ],
      order: {
        discount: "discount",
        // Who is buying: a signed-in diner only. An earlier order counts unless it was cancelled or never collected.
        customer: { link: "customer_id", address: "email", proved: "customer_proved", counts: { column: "status", in: COUNTED } },
      },
      codes: { table: "order_codes", via: "order_id", typed: "typed", code: "code_id", voucher: "voucher_id", removed: "removed_at" },
      uses: "uses",
      frozen: { to: ["picked_up", "cancelled", "not_collected"] },
      expect: "total",
    },
    postings: [
      // A code's use is taken when the order is placed and given back when it is cancelled.
      { id: "uses", into: { addOn: "offers", ledger: "value", action: "redeem" }, needs: "codes", post: { on: { create: true } }, reverse: { on: { to: ["cancelled"] } }, map: {} },
    ],
    states: {
      column: "status",
      initial: "placed",
      // "#2113 is already ready — 11:34, Sam": a second screen's tap is refused, naming the first.
      strict: true,
      moves: {
        // No roles on this cancel: the diner's own link makes it too, and holds none.
        placed: ["confirmed", cancel()],
        confirmed: ["preparing", cancel(), undo("placed", "confirmed_at")],
        preparing: ["ready", cancel(), undo("confirmed", "preparing_at")],
        ready: [
          // How it was paid must be said, and must agree with what a gift card already paid.
          { to: "picked_up", requires: { where: [{ column: "paid_method", isNull: false }, { column: "method_ok", eq: 1 }] } },
          cancel(),
          // Made by the clock at closing; by hand only by a manager.
          { to: "not_collected", roles: ["manager"] },
          undo("preparing", "ready_at"),
        ],
        // A hand-over made by mistake: a manager takes it back, whenever it is noticed.
        picked_up: [{ to: "ready", roles: ["manager"], undo: true, clears: ["paid_method", "rest_paid_by"] }],
      },
      // A finished order is never re-priced: its lines are locked with it. A
      // hand-over taken back empties how it was paid (`clears`), and nothing else opens it.
      lock: { when: ["picked_up", "cancelled", "not_collected"], except: ["link_stopped"] },
      children: {
        order_items: { via: "order_id", lock: true },
        // A code is typed when the order is placed, and at no other time.
        order_codes: { via: "order_id", lock: true },
        // A gift card may pay until the order is handed over.
        payments: { via: "order_id", createIn: ["placed", "confirmed", "preparing", "ready"] },
      },
      timed: [
        { from: "ready", to: "not_collected", at: closing() },
        // Half an hour after closing, what was never finished is cancelled, and the diner told why.
        ...["placed", "confirmed", "preparing"].map((from) => ({ from, to: "cancelled", at: closing(30), set: { cancel_code: "closed" } })),
      ],
    },
    columns: [
      id,
      int("number_seq", "Number (running)", { ...opt, rules: { sequence: { gapless: true, startSetting: setting("first_order_number") } } }),
      text("number", 16, "Number", { ...opt, unique: true, rules: { format: { from: "number_seq" } } }),
      choice("status", "Status", {
        placed: "New",
        confirmed: "Confirmed",
        preparing: "Preparing",
        ready: "Ready",
        picked_up: "Picked up",
        cancelled: "Cancelled",
        not_collected: "Not collected",
      }, {
        default: "placed",
        tones: { placed: "info", confirmed: "accent", preparing: "warn", ready: "pos", picked_up: "neutral", cancelled: "danger", not_collected: "danger" },
      }),
      at("pickup_at", "Pickup", { rules: { venueLocal: true } }),
      text("name", 80, "Name", { semantic: "name" }),
      text("phone", 32, "Phone", { ...opt, rules: { validation: { format: "phone" } } }),
      // A phone order may have none; the diner's own order always has one.
      text("email", 254, "Email", { ...opt, semantic: "email", rules: { validation: { format: "email" } } }),
      choice("channel", "Channel", { online: "Online", phone: "Phone" }, { default: "online" }),
      text("note", 140, "Note for the kitchen", opt),
      int("item_count", "Items", { ...opt, rules: { rollup: { from: "order_items", via: "order_id", sum: "qty" } } }),
      money("subtotal", "Subtotal", { rollup: { from: "order_items", via: "order_id", sum: "line_total" } }),
      // The rate of the day the order was made, kept with it.
      { ref: "tax_rate", type: "decimal", scale: 3, nullable: true, label: l("Tax rate (%)"), rules: { default: { from: setting("tax_rate") } } },
      // What codes and offers took off, decided by Offers & gift cards; empty when it is not in use.
      amount("discount", "Reductions"),
      money("net", "After reductions", { formula: { max: [0, { sub: ["subtotal", { coalesce: ["discount", 0] }] }] } }),
      // Tax follows the reduction. An order from before these columns has no `net`, and keeps its cents.
      money("tax", "Tax", { formula: { round: { div: [{ mul: [{ coalesce: ["net", "subtotal"] }, { coalesce: ["tax_rate", 0] }] }, 100] } } }),
      money("total", "Total", { formula: { add: [{ coalesce: ["net", "subtotal"] }, { coalesce: ["tax", 0] }] } }),
      // What gift cards have paid and still hold, and what is left to collect at the counter.
      money("paid", "Paid by gift card", { rollup: { from: "payments", via: "order_id", sum: "kept", balance: { column: "due", of: "total" }, cap: true } }),
      amount("due", "Left after gift cards"),
      // What to collect, whatever the order's age: an order from before gift cards has nothing paid by one, and owes its total.
      // (Worked out from the total and what cards paid, as `due` is: a formula is not worked out again when a balance settles.)
      money("to_pay", "To pay at the counter", { formula: atEachMove({ max: [0, { sub: ["total", { coalesce: ["paid", 0] }] }] }) }),
      choice("paid_method", "Paid by", { cash: "Cash", card: "Card", gift_card: "Gift card", mixed: "Gift card and more" }, opt),
      // With a gift card paying part: how the rest was paid.
      choice("rest_paid_by", "The rest paid by", { cash: "Cash", card: "Card" }, opt),
      // Whether "Paid by" agrees with what gift cards paid: the hand-over is refused when it does not.
      // (These read the total and what cards paid, never `due`: a formula is not worked out again when a balance settles.)
      flag("method_ok", "Paid-by agrees", {
        if: [{ eq: ["paid_method", "gift_card"] }, { if: [PAID_IN_FULL, 1, 0] }, { if: [{ eq: ["paid_method", "mixed"] }, { if: [PAID_IN_PART, 1, 0] }, { if: [{ lte: [CARDS_PAID, 0] }, 1, 0] }] }],
      }),
      flag("prepaid", "Paid in full by gift card", atEachMove({ if: [PAID_IN_FULL, 1, 0] })),
      flag("card_used", "A gift card paid", atEachMove({ if: [{ gt: [CARDS_PAID, 0] }, 1, 0] })),
      // Which confirmation an order gets: 0 a phone order, 1 an online order, 2 an online order a gift card paid in full.
      flag("confirm_as", "Confirmation kind", { if: [{ eq: ["channel", "phone"] }, 0, { if: [PAID_IN_FULL, 2, 1] }] }),
      // Whether the diner was signed in when a code asked who they are: Offers & gift cards is told, and it is kept.
      { ref: "customer_proved", type: "bool", nullable: true, label: l("Signed in when ordering") },
      // Until when ingredients held for this order stay held, should nothing else let them go: a day after pickup.
      at("hold_until", "Ingredients held until", { ...opt, rules: stamp({ moment: { column: "pickup_at", plus: { days: 1 } } }, onCreate) }),
      choice("cancel_code", "Why it was cancelled", {
        ran_out: "Something ran out",
        too_busy: "The kitchen was too busy",
        customer_asked: "The customer asked",
        closed: "Not ready by closing",
        other: "Other",
        self: "Cancelled online by the customer",
      }, opt),
      text("cancel_dish", 80, "What ran out", opt),
      text("cancel_note", 160, "Cancel note", opt),
      at("placed_at", "Placed", { rules: stamp("now", onCreate) }),
      at("confirmed_at", "Confirmed", { ...opt, rules: undone(stamp("now", onStatus("confirmed"))) }),
      text("confirmed_by", 80, "Confirmed by", { ...opt, rules: undone(stamp("user-name", onStatus("confirmed"))) }),
      at("preparing_at", "Started", { ...opt, rules: undone(stamp("now", onStatus("preparing"))) }),
      at("ready_at", "Ready", { ...opt, rules: undone(stamp("now", onStatus("ready"))) }),
      text("ready_by", 80, "Ready by", { ...opt, rules: undone(stamp("user-name", onStatus("ready"))) }),
      at("picked_up_at", "Picked up", { ...opt, rules: undone(stamp("now", onStatus("picked_up"))) }),
      text("picked_up_by", 80, "Handed over by", { ...opt, rules: undone(stamp("user-name", onStatus("picked_up"))) }),
      at("cancelled_at", "Cancelled", { ...opt, rules: stamp("now", onStatus("cancelled")) }),
      // Staff only: a person's name, or "customer" for the diner's own cancel.
      text("cancelled_by", 80, "Cancelled by", { ...opt, rules: stamp({ byOrigin: { public: "customer", staff: "user-name" } }, onStatus("cancelled")) }),
      at("not_collected_at", "Marked not collected", { ...opt, rules: stamp("now", onStatus("not_collected")) }),
      language("language"),
      fk("customer_id", "customers", "Customer", opt),
      // The order's own link: emailed to the diner, never shown in a list.
      // The key to the diner's own order page: no staff screen reads or copies it (the emails that carry it still do).
      text("link_token", 16, "Link code", { ...opt, rules: { code: { length: 16, hiddenFromStaff: true } } }),
      // The link works until 30 days after pickup.
      at("link_expires", "Link works until", { ...opt, rules: stamp({ moment: { column: "pickup_at", plus: { days: 30 } } }, { columns: ["pickup_at"] }) }),
      bool("link_stopped", "Link stopped", false),
      // The diner's retry key: a retried order lands on the same row.
      text("client_key", 64, "Retry key", { ...opt, unique: true }),
    ],
  },
  {
    ref: "order_items",
    label: l("Order line"),
    labelPlural: l("Order lines"),
    keyField: "name",
    capacity: {
      kind: "parent",
      via: "menu_item_id",
      size: { column: "stock_today", onDay: "stock_on" },
      amount: "qty",
      day: { column: "pickup_at", via: "order_id" },
      countWhere: { column: "status", values: COUNTED, via: "order_id" },
    },
    columns: [
      id,
      fk("order_id", "orders", "Order", { index: true }),
      int("position", "Position", opt),
      fk("menu_item_id", "menu_items", "Dish", { index: true }),
      int("qty", "Quantity", { default: 1, rules: { validation: { min: 1, max: 20 } } }),
      text("note", 80, "Note", opt),
      text("name", 80, "Dish name", { ...opt, rules: { copy: { via: "menu_item_id", from: "name", mode: "always" } } }),
      { ref: "unit_price", type: "money", nullable: true, label: l("Price"), rules: { copy: { via: "menu_item_id", from: "price", mode: "always" } } },
      money("options_total", "Options", { rollup: { from: "order_item_modifiers", via: "order_item_id", sum: "price_delta" } }),
      money("unit_total", "Each", { formula: { add: ["unit_price", { coalesce: ["options_total", 0] }] } }),
      money("line_total", "Line total", { formula: { mul: ["qty", "unit_total"] } }),
      // This line's share of the order's reductions, decided by Offers & gift cards.
      amount("discount", "Reduction"),
      // The dish's category, kept with the line: an offer may be for a category.
      fk("category_id", "menu_categories", "Category", { ...opt, rules: { copy: { via: "menu_item_id", from: "category_id", mode: "always" } } }),
    ],
    postings: [
      // A dish's ingredients are held when the order is placed, taken when the kitchen starts, and let go on a cancel before that.
      {
        id: "ingredients",
        into: { addOn: "inventory", ledger: "stock", action: "hold" },
        needs: "ingredients",
        via: "order_id",
        reserve: { on: { create: true } },
        post: { on: { to: ["preparing"] } },
        reverse: { on: { to: ["cancelled"], from: ["placed", "confirmed"] } },
        heldUntil: { parent: "hold_until" },
        map: { what: "menu_item_id", quantity: "qty" },
      },
    ],
  },
  {
    ref: "order_item_modifiers",
    label: l("Chosen option"),
    labelPlural: l("Chosen options"),
    keyField: "name",
    // Each option once on a line.
    unique: [["order_item_id", "modifier_id"]],
    columns: [
      id,
      fk("order_item_id", "order_items", "Order line", { index: true }),
      fk("modifier_id", "modifiers", "Option"),
      text("name", 80, "Option name", { ...opt, rules: { copy: { via: "modifier_id", from: "name", mode: "always" } } }),
      { ref: "price_delta", type: "money", nullable: true, label: l("Extra charge"), rules: { copy: { via: "modifier_id", from: "price_delta", mode: "always" } } },
    ],
  },
  {
    ref: "order_codes",
    label: l("Code on an order"),
    labelPlural: l("Codes on orders"),
    keyField: "typed",
    columns: [
      id,
      fk("order_id", "orders", "Order"),
      text("typed", 64, "Code as typed", opt),
      link("code_id", "offers", "codes", "Discount code"),
      link("voucher_id", "offers", "vouchers", "Voucher"),
      at("removed_at", "Removed", opt),
    ],
  },
  {
    // Every row is a gift card's payment: cash and card are said at the hand-over, as before.
    ref: "payments",
    label: l("Gift card payment"),
    labelPlural: l("Gift card payments"),
    keyField: "card_last4",
    postings: [
      // The card pays when the row is made, and gets its money back when the order is cancelled.
      {
        id: "card",
        into: { addOn: "offers", ledger: "value", action: "spend" },
        needs: "gift-cards",
        via: "order_id",
        post: { on: { create: true } },
        reverse: { on: { to: ["cancelled"] } },
        map: { card: "card_id", amount: "amount", due: { parent: "due" }, balance_after: "card_balance_after" },
      },
    ],
    columns: [
      id,
      fk("order_id", "orders", "Order", { index: true }),
      // The kitchen's sheet makes this, so a save sent twice is one payment.
      text("client_key", 64, "Retry key", { ...opt, unique: true }),
      // The whole code, as typed: read by no page and no role.
      text("card_code", 64, "Card code", opt),
      link("card_id", "offers", "gift_cards", "Gift card", {
        lookup: { from: "card_code", table: { addOn: "offers", table: "gift_cards" }, column: "code", where: [{ column: "status", eq: "active" }] },
      }),
      text("card_last4", 4, "Card ending", { ...opt, rules: { codeLast4: { of: "card_code" } } }),
      amount("amount", "Paid"),
      amount("card_balance_after", "Left on the card"),
      money("returned", "Given back", { rollup: { from: "payment_refunds", via: "payment_id", sum: "amount" } }),
      money("kept", "Kept", { formula: { sub: ["amount", { coalesce: ["returned", 0] }] } }),
      at("made_at", "Made", { ...opt, rules: stamp("now", onCreate) }),
      text("made_by", 80, "Made by", { ...opt, rules: stamp({ byOrigin: { public: "customer", staff: "user-name" } }, onCreate) }),
    ],
  },
  {
    // Money a manager gives back to a gift card: after an order nobody collected, or one made smaller.
    ref: "payment_refunds",
    label: l("Money back to a gift card"),
    labelPlural: l("Money back to gift cards"),
    keyField: "reason",
    postings: [
      {
        id: "card-refund",
        into: { addOn: "offers", ledger: "value", action: "refund" },
        needs: "gift-cards",
        post: { on: { create: true } },
        map: { amount: "amount", against_table: { value: "ordering:payments" }, against_row: "payment_id" },
      },
    ],
    columns: [
      id,
      { ref: "payment_id", type: "fk", references: "payments", label: l("Gift card payment"), index: true },
      text("client_key", 64, "Retry key", { ...opt, unique: true }),
      fk("order_id", "orders", "Order"),
      { ref: "amount", type: "decimal", scale: "currency", label: l("Amount"), rules: { validation: { min: 0.01 } } },
      text("reason", 120, "Reason", opt),
      at("made_at", "Made", { ...opt, rules: stamp("now", onCreate) }),
      text("made_by", 80, "Made by", { ...opt, rules: stamp("user-name", onCreate) }),
    ],
  },
  {
    ref: "enquiries",
    label: l("Large order"),
    labelPlural: l("Large orders"),
    keyField: "ref",
    states: {
      column: "status",
      initial: "new",
      moves: { new: ["called", "booked", "declined"], called: ["booked", "declined"] },
    },
    columns: [
      id,
      int("ref_seq", "Reference (running)", { ...opt, rules: { sequence: { gapless: true } } }),
      text("ref", 16, "Reference", { ...opt, unique: true, rules: { format: { from: "ref_seq", prefix: "LG-", pad: 4 } } }),
      choice("status", "Status", { new: "New enquiry", called: "Called", booked: "Booked", declined: "Declined" }, {
        default: "new",
        tones: { new: "info", called: "warn", booked: "pos", declined: "neutral" },
      }),
      int("heads", "People", { rules: { validation: { min: 6, max: 120 } } }),
      date("wanted_on", "For"),
      text("notes", 240, "What they asked", opt),
      text("name", 80, "Name", { semantic: "name" }),
      text("phone", 32, "Phone", { rules: { validation: { format: "phone" } } }),
      text("email", 254, "Email", { semantic: "email", rules: { validation: { format: "email" } } }),
      language("language"),
      text("staff_note", 280, "Kitchen note", opt),
      text("handled_by", 80, "Handled by", { ...opt, rules: stamp("user-name", onStatus("called", "booked", "declined")) }),
      at("created_at", "Sent", { ...opt, rules: stamp("now", onCreate) }),
      text("client_key", 64, "Retry key", { ...opt, unique: true }),
    ],
  },
  {
    ref: "messages",
    label: l("Email"),
    labelPlural: l("Emails"),
    keyField: "kind",
    columns: [
      id,
      choice("kind", "Kind", EMAIL_KINDS),
      choice("status", "Status", { queued: "Going out", sent: "Sent", failed: "Not sent", skipped: "Skipped" }, {
        default: "queued",
        tones: { queued: "info", sent: "pos", failed: "danger", skipped: "neutral" },
      }),
      text("to_address", 254, "Sent to", { ...opt, semantic: "email" }),
      text("language", 16, "Language", opt),
      fk("order_id", "orders", "Order", opt),
      fk("enquiry_id", "enquiries", "Large order", opt),
      fk("customer_id", "customers", "Customer", opt),
      at("due", "Due", opt),
      at("created_at", "Created", { ...opt, rules: stamp("now", onCreate) }),
      at("sent_at", "Sent", opt),
      text("error", 500, "What went wrong", opt),
      // Which hand-over a receipt was sent for, as Adminium's digest of it.
      text("repeat_key", 64, "Resend key", opt),
      choice("skip_reason", "Why it was skipped", {
        overtaken: "A later email took its place",
        paid: "Paid",
        void: "Void",
        "no-longer-needed": "No longer needed",
        "by-hand": "Skipped by hand",
      }, opt),
    ],
  },
];

/**
 * A move back, the kitchen's Undo: only by the screen that saw the row where
 * it is now, and only within a minute of the move it takes back.
 */
function undo(to: string, stamped: string) {
  return { to, roles: ["kitchen", "manager"], undo: true, requires: { time: { before: { column: stamped, plus: { minutes: 1 } } } } };
}

/** A stamp an Undo empties again. */
function undone(rule: { stamp: Record<string, unknown> }) {
  return { stamp: { ...rule.stamp, clearOnBack: true } };
}

/** A move to cancelled: always with its reason. */
function cancel() {
  return { to: "cancelled", requires: { where: [{ column: "cancel_code", isNull: false }] } };
}

/** The day's closing time, on the pickup's weekday. */
function closing(plusMinutes?: number) {
  return {
    column: "pickup_at",
    time: { hours: { table: "hours", weekday: "weekday", open: "open", closes: "closes" }, edge: "closes" },
    ...(plusMinutes === undefined ? {} : { plus: { minutes: plusMinutes } }),
  };
}

export const TABLE_REFS = TABLES.map((t) => t.ref);
