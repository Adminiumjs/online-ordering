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
import { KITCHEN_CANCEL_CODES, MENU_TABLES, TABLE_REFS } from "./tables.ts";

const grant = (table: string, ...actions: string[]) => actions.map((action) => `table:@${table}:${action}`);
const view = (page: string) => `page:@${page}:view`;
/** Seeing a table's personal columns (a diner's phone and email). */
const pii = (table: string) => `table:@${table}:read_pii`;

/** What the kitchen reads to run the day. */
const KITCHEN_READS = [...MENU_TABLES, "orders", "order_items", "order_item_modifiers", "settings", "hours", "closures", "slot_pauses"];

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
      ...grant("slot_pauses", "create", "update"),
      ...grant("menu_items", "update"),
      ...grant("modifiers", "update"),
    ],
    limits: {
      orders: {
        writable: ["status", "cancel_code", "cancel_dish", "cancel_note", "paid_method"],
        writableValues: {
          // Forward, and back one step (the Undo) — never back from a hand-over.
          status: ["placed", "confirmed", "preparing", "ready", "picked_up", "cancelled"],
          cancel_code: KITCHEN_CANCEL_CODES,
        },
      },
      menu_items: { writable: ["available", "stock_today", "stock_on"] },
      modifiers: { writable: ["available"] },
    },
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
  },
];
