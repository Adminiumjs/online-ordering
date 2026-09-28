/**
 * The one document this app declares: the receipt for an order handed over,
 * drawn by Invoices & Receipts (the feature `receipts`) — on the 80 mm roll or
 * a page, emailed at pickup and printed from the dashboard.
 *
 * Each line is a dish as the order kept it: its name, how many, the price of
 * one with its options, and the options' names under it.
 */
import { l } from "./labels.ts";

export const DOCUMENTS = [
  {
    kind: "receipt",
    addOn: "invoices",
    table: "orders",
    feature: "receipts",
    name: l("Receipt"),
    mapping: {
      items: {
        collection: {
          table: "order_items",
          via: "order_id",
          orderBy: "position",
          columns: {
            desc: "name",
            qty: "qty",
            rate: "unit_total",
            // The options chosen, printed under the dish: "Farro · Grilled chicken · Avocado".
            options: { list: { table: "order_item_modifiers", via: "order_item_id", column: "name", orderBy: "id" } },
          },
        },
      },
      subtotal: { column: "subtotal" },
      tax: { column: "tax" },
      total: { column: "total" },
      reference: { column: "number" },
      issuedAt: { column: "picked_up_at" },
      paidWith: { column: "paid_method" },
      attendedBy: { column: "picked_up_by" },
    },
  },
];
