/**
 * The add-ons this app works better with. It needs none: the ordering loop —
 * an order placed, cooked and handed over — works with neither.
 *
 * Invoices & Receipts draws the receipt a diner is emailed when they pick up
 * (and the dashboard prints); it is offered ticked, and the receipt is the
 * feature `receipts`. Holiday calendars offers the public holidays in the
 * kitchen's Hours tab, each one a closure in a tap; that is the feature
 * `holiday-closures`.
 *
 * The ranges name the add-ons' release that first draws an order's options on
 * its receipt and hands its holidays to an app's screens.
 *
 * Offers & gift cards answers the price question of an order (the features
 * `codes` and `gift-cards`); Inventory holds and takes a dish's ingredients
 * (`ingredients`).
 */
import { l } from "./labels.ts";

export const ADD_ONS_RANGE = ">=1.0.6";

/**
 * Offers & gift cards and Inventory, from the release that first works with
 * this app: codes and gift cards at checkout and at the counter, and dishes
 * that run out with their ingredients. Neither is needed and neither is
 * ticked: with both away the app takes orders as it always has.
 */
export const LEDGER_ADD_ONS_RANGE = ">=1.0.9";

export const ADD_ONS = {
  suggests: [
    {
      key: "invoices",
      range: ADD_ONS_RANGE,
      checked: true,
      reason: l("Email a receipt when an order is picked up, and print one from the dashboard."),
    },
    {
      key: "holiday-calendars",
      range: ADD_ONS_RANGE,
      reason: l("Close for public holidays in a tap, from the kitchen's Hours tab."),
    },
    {
      key: "offers",
      range: LEDGER_ADD_ONS_RANGE,
      reason: l("Take discount codes and gift cards at checkout and at the counter."),
    },
    {
      key: "inventory",
      range: LEDGER_ADD_ONS_RANGE,
      reason: l("Count ingredients, so a dish runs out when what it is made of does."),
    },
  ],
  features: [
    { id: "receipts", label: l("Receipts"), requires: ["invoices"] },
    { id: "holiday-closures", label: l("Public holidays as closures"), requires: ["holiday-calendars"] },
    { id: "codes", label: l("Discount codes and offers"), requires: ["offers"] },
    { id: "gift-cards", label: l("Gift cards"), requires: ["offers"] },
    { id: "ingredients", label: l("Ingredient stock"), requires: ["inventory"] },
  ],
};
