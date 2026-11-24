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
 *                              with Invoices & Receipts attached, and while
 *                              its switch in Settings is on) — once per
 *                              hand-over, so one taken back and made again
 *                              (paid another way) sends the corrected one;
 *   enquiry-received           a large-order enquiry, with its reference;
 *   order-confirmation-prepaid an online order a gift card paid in full: the
 *   order-ready-prepaid        same two emails, saying nothing is left to pay;
 *   card-money-returned        a cancelled order a gift card had paid: the
 *                              money is back on the card;
 *   card-money-kept            an order nobody collected that a gift card had
 *                              paid: the money stayed, ask at the counter;
 *   order-confirmation-paid    an order paid online as it was placed: the
 *   order-ready-paid           same two emails, saying it was paid online —
 *                              the confirmation is the diner's receipt of the
 *                              payment, so Adminium sends none;
 *   order-cancelled-paid       an order paid online, cancelled: why, and that
 *   order-cancelled-paid-by-you the money goes back (the diner's own cancel
 *                              has its own words);
 *   order-refunded             money paid online given back: once for each
 *                              amount given back of the order.
 *
 * An order waiting for its payment hears nothing: its confirmation goes when
 * the payment makes it new, or when the diner chooses to pay at pickup after
 * all. One not paid in time is cancelled without an email — the diner was on
 * its page — and a gift card it held gets its money back without one either.
 *
 * And one text, sent from the business's own Twilio or Telnyx account:
 *   order-ready-text           the order is on the shelf, to a diner who ticked
 *                              "Text me when my order is ready" at checkout.
 *                              It waits out the kitchen's Undo as the ready
 *                              email does, and an undone "ready" drops it. The
 *                              diner is waiting for it at the counter, so it
 *                              may go at any hour (`waiting`). Adminium checks
 *                              the yes, the stop list and the daily limit at
 *                              the moment it sends, and adds the opt-out line.
 *
 * Every kind is service mail: each is about the diner's own order, its
 * money or their own enquiry. A cancellation's "call us if you'd like to
 * order again" is said about the order that was; offers go out as
 * Adminium's campaigns, which the do-not-email list stops.
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
  "order-confirmation-prepaid",
  "order-ready-prepaid",
  "card-money-returned",
  "card-money-kept",
  "order-confirmation-paid",
  "order-ready-paid",
  "order-cancelled-paid",
  "order-cancelled-paid-by-you",
  "order-refunded",
] as const;
export type Kind = (typeof KINDS)[number];

/** The kinds sent as texts: each a template of its own (`texts.ts`), never an email's. */
export const TEXT_KINDS = ["order-ready-text"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];

/** Every kind of the outbox, emails first. */
export const ALL_KINDS = [...KINDS, ...TEXT_KINDS] as const;

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
 * A message that waits a few seconds, so an order paid online gets its own
 * words instead (`dropWhen`), and one still waiting for its payment gets none.
 */
const unlessPaidOnline = (...more: Record<string, unknown>[]) => ({
  holdSeconds: 5,
  dropWhen: [{ column: "online_used", eq: 1, reason: "no-longer-needed" }, ...more],
});
/** An order still waiting for its payment, or let go unpaid, is not confirmed — and one paid online at once gets the paid confirmation. */
const notWhilePaying = {
  holdSeconds: 5,
  dropWhen: [
    { column: "status", in: ["paying", "cancelled"], reason: "no-longer-needed" },
    { column: "online_used", eq: 1, reason: "no-longer-needed" },
  ],
};

/** The confirmation of an order that waited for its payment: dropped only if it is cancelled meanwhile. */
const afterPaying = { holdSeconds: 5, dropWhen: [{ column: "status", in: ["cancelled"], reason: "no-longer-needed" }] };

/**
 * How long "ready" and "picked up" wait before the diner hears of them: past
 * the kitchen screen's Undo (`UNDO_MS`), with room for an Undo pressed at its
 * last moment to land first. The board counts the ready text down by it.
 */
export const HOLD_SECONDS = 20;

/**
 * A message that waits a few seconds, so an Undo made at once takes it back
 * before the diner hears of a move that did not stand.
 */
const heldWhileUndone = (states: string[]) => ({
  holdSeconds: HOLD_SECONDS,
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
    repeatKey: "repeat_key",
  },
  links: { order: "order_id", enquiry: "enquiry_id", customer: "customer_id" },
  recipient: {
    via: "customer_id",
    table: "customers",
    email: "email",
    name: "name",
    // Written in the language the order was placed in, whatever the diner's own row says.
    language: { column: "language" },
    // The mobile a text goes to: the diner's own, as their first order gave it.
    phone: "phone",
    // An order nobody signed in for — and every phone order — carries its own details.
    fallback: { via: "order_id", email: "email", phone: "phone", name: "name", language: "language" },
  },
  settings: { table: "settings", name: "venue_name", phone: "phone" },
  // An order's own link opens its page on the diner's side; its code rides the fragment.
  pages: { manage: "/o", booking: "/" },
  kinds: Object.fromEntries(ALL_KINDS.map((kind) => [kind, `ordering-${kind}`])),
  // Every email and text is about a diner's own order or enquiry: none is stopped by the do-not-email list.
  classes: Object.fromEntries(ALL_KINDS.map((kind) => [kind, "service"])),
  channels: Object.fromEntries(TEXT_KINDS.map((kind) => [kind, "sms"])),
  // The diner is at the counter waiting for "ready": it may go outside the kitchen's sending hours.
  waiting: ["order-ready-text"],
  producers: [
    // One decided column says which confirmation: an online order (1), one a gift card paid in full (2), one paid online (3).
    // Each once for the order (the log): an order made new again by an Undo is not confirmed twice.
    { kind: "order-confirmation", link: "order_id", onCreate: { table: "orders", where: { column: "confirm_as", eq: 1 } }, ...notWhilePaying },
    { kind: "order-confirmation-prepaid", link: "order_id", onCreate: { table: "orders", where: { column: "confirm_as", eq: 2 } }, ...notWhilePaying },
    { kind: "order-confirmation-phone", link: "order_id", onCreate: { table: "orders", where: { column: "channel", eq: "phone" } } },
    // An order that waited for its payment: confirmed as paid when the payment makes it new, or as today when the diner
    // chose to pay at pickup after all.
    // Each waits a few seconds: a confirmation dropped while the order waited for its payment does not then stop it.
    { kind: "order-confirmation-paid", link: "order_id", ...onOrder("status", "placed", { column: "confirm_as", eq: 3 }), ...afterPaying },
    { kind: "order-confirmation", link: "order_id", ...onOrder("status", "placed", { column: "confirm_as", eq: 1 }), ...afterPaying },
    // "You'll pay … at the counter", or "nothing to pay": one email, by whether a gift card, or a payment online, paid it all.
    ...([["order-ready", 0], ["order-ready-prepaid", 1], ["order-ready-paid", 2]] as const).map(([kind, paidAs]) => ({
      kind,
      link: "order_id",
      gate: { setting: { table: "settings", column: "ready_email_on" } },
      ...onOrder("status", "ready", { column: "paid_as", eq: paidAs }),
      ...heldWhileUndone(["placed", "confirmed", "preparing", "picked_up", "cancelled", "not_collected"]),
    })),
    // "Ready", by text, to a diner who asked for it on this order: after the same Undo wait as the email, and never
    // for a "ready" taken back. Behind the kitchen's own switch for texts, never the ready email's.
    {
      kind: "order-ready-text",
      link: "order_id",
      gate: { setting: { table: "settings", column: "ready_text_on" } },
      ...onOrder("status", "ready", { column: "texts_ok", eq: true }),
      ...heldWhileUndone(["placed", "confirmed", "preparing", "picked_up", "cancelled", "not_collected"]),
    },
    // Why it was cancelled, one email per reason — or, for an order paid online, the one that says its money goes back.
    ...Object.entries(CANCELLED).map(([code, kind]) => ({ kind, link: "order_id", ...onOrder("status", "cancelled", { column: "cancel_code", eq: code }), ...unlessPaidOnline() })),
    { kind: "order-cancelled-paid", link: "order_id", ...onOrder("status", "cancelled", { column: "online_used", eq: 1 }), holdSeconds: 5, dropWhen: [{ column: "cancel_code", eq: "self", reason: "no-longer-needed" }] },
    { kind: "order-cancelled-paid-by-you", link: "order_id", ...onOrder("status", "cancelled", { column: "cancel_code", eq: "self" }), holdSeconds: 5, dropWhen: [{ column: "online_used", eq: 0, reason: "no-longer-needed" }] },
    // A cancelled order a gift card paid: the money went back to the card. One nobody collected: it stayed, and the counter can give it back.
    // An order not paid in time says nothing: the diner saw it go.
    {
      kind: "card-money-returned",
      link: "order_id",
      ...onOrder("status", "cancelled", { column: "card_used", eq: 1 }),
      holdSeconds: 5,
      dropWhen: [{ column: "cancel_code", eq: "unpaid", reason: "no-longer-needed" }],
    },
    { kind: "card-money-kept", link: "order_id", ...onOrder("status", "not_collected", { column: "card_used", eq: 1 }) },
    // Drawn by Invoices & Receipts: without it attached, or with the switch off, no receipt is queued at all.
    // One per hand-over (its stamp), not one per order: a hand-over taken back and made again is receipted again.
    {
      kind: "order-receipt",
      link: "order_id",
      gate: { feature: "receipts", setting: { table: "settings", column: "receipt_email_on" } },
      repeatBy: "picked_up_at",
      ...onOrder("status", "picked_up"),
      ...heldWhileUndone(["ready"]),
    },
    { kind: "enquiry-received", link: "enquiry_id", onCreate: { table: "enquiries" }, recipient: { column: "email", name: "name", language: "language" } },
    // Money paid online given back, by the kitchen or by itself: one email for each amount the order has had back.
    {
      kind: "order-refunded",
      link: "order_id",
      onCreate: { table: "payment_refunds", via: "order_id", where: { column: "method", eq: "online" } },
      repeatBy: "online_refunded",
      holdSeconds: 5,
    },
  ],
};
