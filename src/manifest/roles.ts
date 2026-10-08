/**
 * Who may do what, enforced by Adminium on every read and write.
 *
 *   kitchen   the kitchen's own screens, never the dashboard. Reads the menu,
 *             the orders (with the diner's phone and email, to call them), the
 *             hours, closures and paused slots. Moves an order along, cancels it
 *             with a reason, hands it over with how it was paid; takes a phone
 *             order; pauses and reopens slots; switches dishes and options on
 *             and off and sets today's portions. Never the settings, the hours,
 *             the closures or the customers;
 *   manager   everything: the dashboard section, the settings, the hours and
 *             closures, whether online orders are taken, the enquiries, the
 *             menu, the customers, the emails.
 *
 * A one-person kitchen is simply the workspace's admin.
 *
 * The kitchen's screens show or hide a button by the role, but the grant and
 * the limits below are what refuse the write — a hidden button is not a lock.
 */
import { PAGE_REFS } from "./pages.ts";
import { KITCHEN_CANCEL_CODES, MENU_TABLES, TABLE_REFS, TABLES } from "./tables.ts";

const grant = (table: string, ...actions: string[]) => actions.map((action) => `table:@${table}:${action}`);
const view = (page: string) => `page:@${page}:view`;
/** Seeing a table's personal columns (a diner's phone and email). */
const pii = (table: string) => `table:@${table}:read_pii`;

/** What the kitchen reads to run the day. */
const KITCHEN_READS = [...MENU_TABLES, "orders", "order_items", "order_item_modifiers", "payments", "settings", "hours", "closures", "slot_pauses"];

/**
 * What a desk role reads of the add-ons' own tables, column by column. A code
 * that is scanned or typed is looked up, and the look-up answers only what the
 * caller may read: a card's state, balance and expiry, never its code or its
 * holder. Nothing here is held while the add-on is away.
 */
const OFFERS_LOOK_UP = [
  { addOn: "offers", table: "gift_cards", actions: ["read"], limit: { readable: ["kind", "label", "status", "balance", "expires_on"] } },
  { addOn: "offers", table: "vouchers", actions: ["read"], limit: { readable: ["code_last4", "worth", "value", "what", "units", "public_name", "uses_left", "uses_total", "status", "expires_on"] } },
  { addOn: "offers", table: "codes", actions: ["read"], limit: { readable: ["offer_id", "active", "valid_until"] } },
];
/** The reductions of an order, as the dashboard's order page lists them: a manager's, never the kitchen screens'. */
const APPLIED_READ = { addOn: "offers", table: "applied", actions: ["read"], limit: { readable: ["source_table", "source_row", "source_line", "name", "kind", "amount", "typed", "at"] } };
const KITCHEN_ADD_ON_TABLES = [
  // What a dish is made of and how much is in, for the kitchen's own stock words.
  { addOn: "inventory", table: "items", actions: ["read"], limit: { readable: ["id", "name", "unit", "decimals", "active"] } },
  { addOn: "inventory", table: "stock_points", actions: ["read"], limit: { readable: ["id", "item_id", "place_id", "on_hand", "available", "low", "state"] } },
  ...OFFERS_LOOK_UP,
];

/**
 * What anybody reads of a gift card's payment: what it paid and kept, when,
 * by whom, and the card's last four. Never `card_code` — the whole code is
 * typed once, looked up by Adminium, and shown again by no screen.
 */
const PAYMENT_READS = TABLES.find((t) => t.ref === "payments")!.columns.map((c) => c.ref).filter((ref) => ref !== "card_code");

/** What an add-on's answer fills on an order: nobody's to write, whatever their role. */
const DECIDED_ON_ORDERS: ReadonlySet<string> = new Set(["discount", "due", "customer_proved"]);

export const ROLES = [
  {
    key: "kitchen",
    name: "Kitchen",
    screensOnly: true,
    permissions: [
      "app:@:staff",
      ...KITCHEN_READS.flatMap((table) => grant(table, "read")),
      pii("orders"),
      // A phone order: the order with its lines and options, in one write.
      ...grant("orders", "create", "update"),
      ...grant("order_items", "create"),
      ...grant("order_item_modifiers", "create"),
      // Another gift card at the counter: its own save, never a line of the hand-over.
      ...grant("payments", "create"),
      ...grant("slot_pauses", "create", "update"),
      ...grant("menu_items", "update"),
      ...grant("modifiers", "update"),
    ],
    limits: {
      orders: {
        writable: ["status", "cancel_code", "cancel_dish", "cancel_note", "paid_method", "rest_paid_by"],
        writableValues: {
          // Forward, and back one step (the Undo) — never back from a hand-over.
          status: ["placed", "confirmed", "preparing", "ready", "picked_up", "cancelled"],
          cancel_code: KITCHEN_CANCEL_CODES,
        },
        // A phone order is what the kitchen makes, and all it makes: who it is for, when, a note,
        // as a phone order — never a customer, a link's code, how it was paid or another channel.
        creatable: ["name", "phone", "email", "note", "pickup_at", "channel"],
        creatableValues: { channel: ["phone"] },
      },
      menu_items: { writable: ["available", "stock_today", "stock_on"] },
      modifiers: { writable: ["available"] },
      // The card's code and the order it pays: what the card gives is never the kitchen's to type.
      payments: { readable: PAYMENT_READS, creatable: ["order_id", "card_code", "client_key"] },
    },
    tables: KITCHEN_ADD_ON_TABLES,
  },
  {
    key: "manager",
    name: "Manager",
    permissions: [
      "app:@:staff",
      ...TABLE_REFS.flatMap((table) =>
        // The emails are the kitchen's record of what was sent: nobody deletes from it.
        table === "messages" ? grant(table, "read", "create", "update") : grant(table, "read", "create", "update", "delete"),
      ),
      ...PAGE_REFS.flatMap((page) => [view(page), `page:@${page}:edit`]),
      ...["orders", "customers", "enquiries", "messages"].map(pii),
    ],
    limits: {
      // "Cancelled by the customer" and "not ready by closing" are the diner's and the clock's to give, never a person's here.
      orders: {
        // Every column a person writes: never one Adminium works out, or Offers & gift cards decides.
        writable: TABLES.find((t) => t.ref === "orders")!.columns.filter((c) => !DECIDED_ON_ORDERS.has(c.ref) && c.rules?.["rollup"] === undefined && c.rules?.["formula"] === undefined).map((c) => c.ref).filter((ref) => ref !== "id"),
        writableValues: { cancel_code: KITCHEN_CANCEL_CODES },
      },
      // A gift card's whole code is typed and never read back, by a manager either.
      // …and what a card gives is Adminium's to say: a payment is made with the order and the code, nothing else.
      payments: { readable: PAYMENT_READS, creatable: ["order_id", "card_code", "client_key"] },
    },
    tables: [APPLIED_READ, ...KITCHEN_ADD_ON_TABLES],
  },
];
