/**
 * Paying for an order online, through the payments Adminium takes.
 *
 * An order is payable while it waits for its payment (`paying`): its total,
 * what is left once a gift card paid its part (`due`), the connection's own
 * currency, and the payment written into the kitchen's own `payments` table as
 * `online`, with the service's reference and name. Payables arrive switched
 * off: someone who manages payments switches Online Ordering on in Adminium's
 * Payments, and until then every page reads as it always has.
 *
 *   - At checkout the diner picks "Pay now" beside "Pay when you pick up". The
 *     order is made waiting for its payment, its slot and portions held for a
 *     few minutes (a setting), and the reply carries the link to pay it. The
 *     payment makes it new, and the kitchen sees it then. Such an order is
 *     paid only by the ways that settle at once (a card, a wallet): a bank
 *     debit would hold a lunch slot for days.
 *   - Not paid in time, it is cancelled as not paid in time — never while a
 *     payment for it is on its way.
 *
 * Refunds are rows of the kitchen's own `payment_refunds` table, beside the
 * money given back to gift cards: a manager who may refund writes one, and
 * Adminium sends it back through the service the payment came by and stamps
 * the row. A paid order cancelled by its diner, at closing, or by someone who
 * may refund is refunded by itself (Adminium writes the row), unless the
 * kitchen turns that off in Hours; any other cancel of a paid order shows
 * "Refund owed" for someone who may. An order nobody collected keeps its
 * money: refunding it is a person's call.
 *
 * The kitchen sends its own receipt: the confirmation of an order paid online
 * lists what was ordered and says what was paid, so Adminium sends none.
 */
const setting = (column: string) => ({ table: "settings", column });

export const PAYMENTS = {
  payables: [
    {
      table: "orders",
      label: "number",
      amount: { column: "total" },
      currency: { connection: true },
      due: { column: "due" },
      payments: {
        kind: "table",
        table: "payments",
        link: "order_id",
        amount: "amount",
        paidAt: "paid_at",
        method: { column: "method", values: { "*": "online" } },
        reference: "payment_ref",
        provider: "provider",
        refundedElsewhere: "refunded_elsewhere",
      },
      // Only an order waiting for its payment is made new by it.
      status: { column: "status", paid: "placed", from: ["paying"] },
      customerEmail: "email",
      payableWhen: [{ column: "status", eq: "paying" }],
      // Back to the order's own page: the order page finds the order this tab placed.
      returnTo: "/o",
      receipt: "app",
      instantOnly: true,
      refunds: {
        model: "rows",
        table: "payment_refunds",
        payment: "payment_id",
        amount: "amount",
        when: [{ column: "method", eq: "online" }],
        providerRef: "provider_ref",
        state: "refund_state",
        // The kitchen's screens: the order's ticket is opened from the board.
        openIn: "/",
        auto: { values: { method: "online", automatic: true } },
      },
      refundOn: {
        // The diner's own cancel, the cancel at closing, and a cancel by someone who may refund. A cancel by anyone
        // else shows "Refund owed"; "not collected" keeps the money.
        moves: [{ from: ["placed", "confirmed", "preparing", "ready"], to: "cancelled", by: ["customer", "system", "refund-right"] }],
        switch: setting("auto_refund"),
      },
    },
  ],
};
