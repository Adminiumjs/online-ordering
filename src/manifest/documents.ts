/**
 * The one document this app declares: the receipt for an order handed over,
 * drawn by Invoices & Receipts (the feature `receipts`) — on the 80 mm roll or
 * a page, emailed at pickup and printed from the dashboard.
 *
 * Each line is a dish as the order kept it: its name, how many, and the price
 * of one with its options.
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
        collection: { table: "order_items", via: "order_id", orderBy: "position", columns: { desc: "name", qty: "qty", rate: "unit_total" } },
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
