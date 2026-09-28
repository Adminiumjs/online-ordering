/**
 * What the diner's pages may read and write, through two browser keys.
 *
 * The `customer` key is the order page's: the menu (the dishes and options
 * that are on, and sold online), the hours, the closures, the kitchen's public
 * settings and pictures; whether a slot or a dish is still free; placing an
 * order with its lines and options in one write, priced by Adminium and
 * checked against the price the diner saw; sending a large-order enquiry; and,
 * once a diner has signed in with a link emailed to them, their own orders
 * and nothing else.
 *
 * The `link` key opens one order by the code in its own link — the link its
 * confirmation email carries — so the diner can follow it without signing
 * in, and cancel it while the kitchen has not taken it yet.
 *
 * What never leaves through these keys: who in the kitchen moved an order (the receipt Invoices &
 * Receipts draws names who handed it over, as a till receipt does), the exact portions
 * left (only "N left" below five), anyone else's order, the order's link code
 * and retry key.
 */
import { MENU_TABLES } from "./tables.ts";

/** What a diner sees of an order: its progress, their details, what it costs. */
export const ORDER_SELECT = [
  "id",
  "number",
  "status",
  "channel",
  "pickup_at",
  "name",
  "phone",
  "email",
  "note",
  "item_count",
  "subtotal",
  "tax_rate",
  "tax",
  "total",
  "paid_method",
  "cancel_code",
  "cancel_dish",
  "cancel_note",
  "placed_at",
  "confirmed_at",
  "preparing_at",
  "ready_at",
  "picked_up_at",
  "cancelled_at",
  "not_collected_at",
  "link_expires",
];

/**
 * What placing an order answers: its figures and its progress, never the
 * diner's own details back — a create anyone may call reads no personal
 * column (the page knows what it typed).
 */
export const PLACED_SELECT = ORDER_SELECT.filter((column) => !["name", "phone", "email"].includes(column));

export const LINE_SELECT = ["id", "order_id", "position", "menu_item_id", "qty", "note", "name", "unit_price", "options_total", "unit_total", "line_total"];
export const OPTION_SELECT = ["id", "order_item_id", "modifier_id", "name", "price_delta"];

/** The menu as a diner reads it: never the portions (only "N left", from availability). */
const MENU_SELECT: Record<string, string[]> = {
  menu_categories: ["id", "slug", "name", "position", "icon", "tint"],
  menu_items: ["id", "category_id", "slug", "name", "description", "price", "image", "featured", "tags", "position", "hue", "allergens"],
  modifier_groups: ["id", "item_id", "slug", "name", "kind", "min", "max", "hint", "position"],
  modifiers: ["id", "group_id", "slug", "name", "price_delta", "position", "allergens"],
};

const MENU_FILTERS: Record<string, unknown[]> = {
  menu_items: [
    { column: "available", op: "eq", value: true },
    { column: "online", op: "eq", value: true },
  ],
  modifiers: [{ column: "available", op: "eq", value: true }],
};

/** The kitchen's public face: its words, its photos, its rules for a slot. */
export const SETTINGS_SELECT = [
  // The row's key: its photos are addressed by it.
  "id",
  "venue_name",
  "headline",
  "intro",
  "about",
  "address",
  "area",
  "directions",
  "phone",
  "photo_hero",
  "photo_street",
  "photo_closed",
  "photo_store",
  "tax_rate",
  "slot_minutes",
  "lead_minutes",
  "preorder_days",
  "prep_minutes",
  "max_items",
  "online_on",
];
const VENUE_PHOTOS = ["photo_hero", "photo_street", "photo_closed", "photo_store"];

/** The diner's cancel: only to cancelled, only while the kitchen has not taken it, and the reason is theirs. */
const OWN_CANCEL = {
  writable: ["status"],
  writableValues: { status: ["cancelled"] },
  writableWhen: { status: ["placed"] },
  defaults: { cancel_code: "self" },
};

/** An order's lines and each line's options, read where the order is. */
function linesOf(key?: string) {
  const keyed = key === undefined ? {} : { key };
  return [
    { table: "order_items", ...keyed, methods: ["GET"], level: "verified", visibleWith: { table: "orders", via: "order_id" }, select: LINE_SELECT },
    { table: "order_item_modifiers", ...keyed, methods: ["GET"], level: "verified", visibleWith: { table: "order_items", via: "order_item_id" }, select: OPTION_SELECT },
  ];
}

export const PUBLIC_KEYS = { link: {} };

export const PUBLIC_ACCESS = [
  // ── the diner who signs in with a link emailed to them ──────────────────────
  {
    table: "customers",
    methods: ["GET", "PATCH"],
    select: ["name", "email"],
    writable: ["name"],
    claim: { verify: "email-link", email: "email" },
    humanCheck: true,
    // "Delete my details" also stops every link the diner's orders were emailed with.
    forget: { columns: ["email", "name"], stamp: "forgotten_at", links: true },
  },
  // Their own orders, newest first on the page; and the cancel while the kitchen has not taken it.
  { table: "orders", methods: ["GET", "PATCH"], level: "verified", claimedBy: { table: "customers", column: "customer_id" }, select: ORDER_SELECT, ...OWN_CANCEL },
  ...linesOf(),

  // Whether a pickup slot is still free, and a dish still has portions ("3 left" only below five).
  { table: "orders", kind: "availability", methods: ["GET"] },
  { table: "order_items", kind: "availability", methods: ["GET"], showLeft: { below: 5 } },

  // ── the menu, the hours, the kitchen ─────────────────────────────────────────
  ...MENU_TABLES.map((table) => ({
    table,
    methods: ["GET"],
    select: MENU_SELECT[table],
    ...(MENU_FILTERS[table] === undefined ? {} : { filters: MENU_FILTERS[table] }),
    ...(table === "menu_items" ? { pictures: ["image"] } : {}),
  })),
  { table: "hours", methods: ["GET"], select: ["id", "weekday", "open", "opens", "closes"] },
  {
    table: "closures",
    methods: ["GET"],
    select: ["id", "from_date", "to_date", "reason"],
    filters: [
      { column: "active", op: "eq", value: true },
      { column: "to_date", op: "from-today" },
    ],
  },
  { table: "settings", methods: ["GET"], select: SETTINGS_SELECT, pictures: VENUE_PHOTOS },

  // ── placing an order ─────────────────────────────────────────────────────────
  {
    table: "orders",
    methods: ["POST"],
    humanCheck: true,
    level: "verified",
    select: PLACED_SELECT,
    writable: ["name", "email", "phone", "language", "pickup_at", "note", "client_key"],
    requires: ["name", "email"],
    // The manager's switch in Hours; the kitchen's phone orders never pass here.
    requireSetting: [{ table: "settings", column: "online_on" }],
    claimedBy: { table: "customers", column: "customer_id", optional: true },
    identity: { table: "customers", email: "email", link: "customer_id", fill: { name: "name" } },
    shareLink: "link_token",
    anonymous: { perValue: { columns: ["email"], n: 10 }, perIpHour: 10, perKeyHour: 300, plainText: ["name", "note"] },
    // A signed-in diner holds at most three orders still to pick up: the caps above are for strangers.
    maxOpen: { column: "status", values: ["placed", "confirmed", "preparing", "ready"], n: 3, upcoming: "pickup_at" },
    children: {
      order_items: {
        via: "order_id",
        writable: ["menu_item_id", "qty", "note"],
        select: LINE_SELECT.filter((c) => c !== "order_id"),
        position: "position",
        min: 1,
        max: 20,
        plainText: ["note"],
        sumMax: { column: "qty", max: { table: "settings", column: "max_items" } },
        children: {
          order_item_modifiers: {
            via: "order_item_id",
            writable: ["modifier_id"],
            select: OPTION_SELECT.filter((c) => c !== "order_item_id"),
            max: 20,
            agrees: [{ column: "modifier_id", path: ["group_id", "item_id"], eq: { parent: "menu_item_id" } }],
            counts: [{ by: ["modifier_id", "group_id"], every: { column: "item_id", eq: { parent: "menu_item_id" } }, min: "min", max: "max" }],
          },
        },
      },
    },
    dryRun: true,
    expect: "total",
    clientKey: "client_key",
  },

  // ── a large order: an enquiry the kitchen calls back about ──────────────────
  {
    table: "enquiries",
    methods: ["POST"],
    humanCheck: true,
    select: ["id", "ref", "heads", "wanted_on", "status"],
    writable: ["heads", "wanted_on", "notes", "name", "phone", "email", "language", "client_key"],
    requires: ["heads", "wanted_on", "name", "phone", "email"],
    anonymous: { perValue: { columns: ["email"], n: 5 }, perIpHour: 3, perKeyHour: 60, plainText: ["name", "notes"] },
    clientKey: "client_key",
  },

  // ── one order, by its own link ───────────────────────────────────────────────
  {
    table: "orders",
    key: "link",
    methods: ["GET", "PATCH"],
    select: ORDER_SELECT,
    claim: { by: "token", column: "link_token", expires: "link_expires", stopped: "link_stopped", own: true, address: "email" },
    ...OWN_CANCEL,
  },
  ...linesOf("link"),
];
