/**
 * The kitchen's emails: the `messages` table is the outbox, and every email
 * is a row in it the dashboard lists.
 *
 * To the diner:
 *   order-confirmation         an order placed online: what they ordered, what
 *                              it costs, where to come, and the link to follow
 *                              it;
 *   order-confirmation-phone   an order the kitchen took by phone, when the
 *                              caller gave an email: the same without the link
 *                              (a phone order is nobody's signed-in order);
 *   order-ready                the order is on the shelf (behind its switch in
 *                              Settings);
 *   order-cancelled-*          the kitchen cancelled it, one email per reason,
 *                              so each says why in the diner's language; and
 *                              one for an order still unfinished at closing;
 *   order-cancelled-by-you     the diner cancelled it themselves, online — so a
 *                              forwarded link used by someone else shows up;
 *   order-receipt              handed over: the receipt attached (only
 *                              with Invoices & Receipts attached);
 *   enquiry-received           a large-order enquiry, with its reference.
 *
 * The ready and receipt emails wait twenty seconds first, so the kitchen's
 * Undo takes them back before they go; one taken back so does not stop the
 * next. The log is the dedupe: a kind already queued or sent for the same row
 * is not queued again. An order linked to a signed-in diner is addressed to
 * them, any other order to the address typed on it — each in the language it
 * was placed in.
 */

export const KINDS = [
  "order-confirmation",
  "order-confirmation-phone",
  "order-ready",
  "order-cancelled-ran-out",
  "order-cancelled-too-busy",
  "order-cancelled-customer-asked",
  "order-cancelled-closed",
  "order-cancelled-other",
  "order-cancelled-by-you",
  "order-receipt",
  "enquiry-received",
] as const;
export type Kind = (typeof KINDS)[number];

/** The reasons an order is cancelled for, each with its own email; `self` is the diner's own. */
const CANCELLED: Record<string, Kind> = {
  ran_out: "order-cancelled-ran-out",
  too_busy: "order-cancelled-too-busy",
  customer_asked: "order-cancelled-customer-asked",
  closed: "order-cancelled-closed",
  other: "order-cancelled-other",
  self: "order-cancelled-by-you",
};

const onOrder = (column: string, to: string, where?: Record<string, unknown>) => ({
  onChange: { table: "orders", column, to, ...(where === undefined ? {} : { where }) },
});

/**
 * A message that waits a few seconds, so an Undo made at once takes it back
 * before the diner hears of a move that did not stand.
 */
const heldWhileUndone = (states: string[]) => ({
  holdSeconds: 20,
  dropWhen: [{ column: "status", in: states, reason: "no-longer-needed" }],
});

export const OUTBOX = {
  table: "messages",
  columns: {
    kind: "kind",
    status: "status",
    to: "to_address",
    language: "language",
    due: "due",
    sentAt: "sent_at",
    error: "error",
    skipReason: "skip_reason",
  },
  links: { order: "order_id", enquiry: "enquiry_id", customer: "customer_id" },
  recipient: {
    via: "customer_id",
    table: "customers",
    email: "email",
    name: "name",
    // Written in the language the order was placed in, whatever the diner's own row says.
    language: { column: "language" },
    // An order nobody signed in for — and every phone order — carries its own details.
    fallback: { via: "order_id", email: "email", name: "name", language: "language" },
  },
  settings: { table: "settings", name: "venue_name", phone: "phone" },
  // An order's own link opens its page on the diner's side; its code rides the fragment.
  pages: { manage: "/o", booking: "/" },
  kinds: Object.fromEntries(KINDS.map((kind) => [kind, `ordering-${kind}`])),
  producers: [
    { kind: "order-confirmation", link: "order_id", onCreate: { table: "orders", where: { column: "channel", eq: "online" } } },
    { kind: "order-confirmation-phone", link: "order_id", onCreate: { table: "orders", where: { column: "channel", eq: "phone" } } },
    {
      kind: "order-ready",
      link: "order_id",
      gate: { setting: { table: "settings", column: "ready_email_on" } },
      ...onOrder("status", "ready"),
      ...heldWhileUndone(["placed", "confirmed", "preparing", "picked_up", "cancelled", "not_collected"]),
    },
    ...Object.entries(CANCELLED).map(([code, kind]) => ({ kind, link: "order_id", ...onOrder("status", "cancelled", { column: "cancel_code", eq: code }) })),
    // Drawn by Invoices & Receipts: without it attached, no receipt is queued at all.
    { kind: "order-receipt", link: "order_id", gate: { feature: "receipts" }, ...onOrder("status", "picked_up"), ...heldWhileUndone(["ready"]) },
    { kind: "enquiry-received", link: "enquiry_id", onCreate: { table: "enquiries" }, recipient: { column: "email", name: "name", language: "language" } },
  ],
};
