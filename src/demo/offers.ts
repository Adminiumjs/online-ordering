/**
 * The demo's stand-in for Offers & gift cards: what the add-on would answer
 * the demo's Adminium for an order — with the demo's own offer, codes and one
 * gift card, never the add-on's sample.
 *
 *   Pizza pair   two Pepperoni & honey: the cheaper one is free, by itself;
 *   WELCOME10    10 % off, for a signed-in diner (a guest is told to sign in);
 *   LUNCH5       $5.00 off an order of $30.00 or more;
 *   the card     GC-7K2M-W3HN-Q4XP, holding $19.00 until the demo spends it.
 *
 * The figures an order comes to follow the manifest's own formulas: tax on
 * what is left after reductions, a card paying what it holds as far as the
 * total goes. DEMO BUILD ONLY — nothing in a real build imports it.
 */
import { ApiError, type Applied, type CardPayment, type OrderBody, type Told } from "../data/wire.ts";

export const DEMO_PAIR = { dish: "Pepperoni & honey", name: "Pizza pair" };
export const DEMO_CODES: Record<string, { name: string; percent?: number; amount?: number; minimum?: number; signIn?: true }> = {
  WELCOME10: { name: "Welcome 10", percent: 10, signIn: true },
  LUNCH5: { name: "Lunch 5", amount: 5, minimum: 30 },
};
export const DEMO_CARD = { code: "GC-7K2M-W3HN-Q4XP", balance: 19 };

const cents = (value: number) => Math.round(value * 100) / 100;
const money = (value: number) => value.toFixed(2);
const bare = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, "");

export interface DemoPriced {
  /** The order's own columns, as the manifest's formulas leave them. */
  figures: { discount: number; net: number; tax: number; total: number; paid: number | null; due: number; to_pay: number; prepaid: number; card_used: number; confirm_as: number };
  /** Each line's share of the reductions, in the lines' order. */
  lineDiscounts: number[];
  applied: Applied[];
  told: Told[];
  payment: CardPayment | null;
  /** The code rows the order keeps, as typed. */
  codes: string[];
  /** The card that pays and what it takes, when one does. */
  card: { code: string; amount: number } | null;
}

/** The demo's gift cards: what each still holds. */
export class DemoCards {
  private readonly left = new Map<string, number>([[bare(DEMO_CARD.code), DEMO_CARD.balance]]);
  balance(code: string): number | null {
    return this.left.get(bare(code)) ?? null;
  }
  spend(code: string, amount: number): void {
    this.left.set(bare(code), cents((this.left.get(bare(code)) ?? 0) - amount));
  }
  giveBack(code: string, amount: number): void {
    this.left.set(bare(code), cents((this.left.get(bare(code)) ?? 0) + amount));
  }
}

/**
 * What an order comes to with the demo's offers, the codes typed on it and
 * the gift card that is to pay. Refuses as the public API refuses: a code by
 * its field with one plain reason, a card with the one answer a card gets.
 */
export function priceDemoOrder(
  order: Readonly<Record<string, unknown>>,
  lines: readonly { line: Readonly<Record<string, unknown>> }[],
  body: OrderBody,
  ctx: { signedIn: boolean; cards: DemoCards; phone?: boolean },
): DemoPriced {
  const subtotal = Number(order["subtotal"] ?? 0);
  const rate = Number(order["tax_rate"] ?? 0);
  const applied: Applied[] = [];
  const lineDiscounts = lines.map(() => 0);
  lines.forEach(({ line }, i) => {
    if (line["name"] !== DEMO_PAIR.dish) return;
    const free = Math.floor(Number(line["qty"] ?? 0) / 2);
    if (free === 0) return;
    const off = cents(free * Number(line["unit_total"] ?? 0));
    lineDiscounts[i] = off;
    applied.push({ line: `order_items/${String(i)}`, name: DEMO_PAIR.name, kind: "offer", amount: money(off), typed: false });
  });
  const afterOffers = cents(subtotal - lineDiscounts.reduce((a, b) => a + b, 0));
  const codes: string[] = [];
  (body.children.order_codes ?? []).forEach((row, index) => {
    const typed = String(row.values.typed ?? "");
    const code = DEMO_CODES[bare(typed)];
    const refuse = (reason: string, more: Record<string, unknown> = {}) =>
      new ApiError(400, "PUBLIC_WRITE_REFUSED", "That write was refused.", { child: "order_codes", index, path: ["order_codes", index], column: "typed", reason, ...more });
    if (code === undefined) throw refuse("unknown");
    if (code.signIn === true && !ctx.signedIn) throw refuse("needs-sign-in");
    if (code.minimum !== undefined && afterOffers < code.minimum) throw refuse("needs-minimum", { amount: money(code.minimum) });
    const off = cents(code.percent !== undefined ? (afterOffers * code.percent) / 100 : Math.min(code.amount ?? 0, afterOffers));
    applied.push({ line: null, name: code.name, kind: "code", amount: money(off), typed: true });
    codes.push(typed);
  });
  const discount = cents(applied.reduce((sum, one) => sum + Number(one.amount), 0));
  const net = Math.max(0, cents(subtotal - discount));
  const tax = cents((net * rate) / 100);
  const total = cents(net + tax);
  let payment: CardPayment | null = null;
  let card: DemoPriced["card"] = null;
  const typedCard = body.children.payments?.[0]?.values.card_code;
  if (typedCard !== undefined) {
    const balance = ctx.cards.balance(typedCard);
    if (balance === null || balance <= 0) throw new ApiError(409, "PUBLIC_CARD_REFUSED", "That card or code was not accepted.", { reason: "not-valid" });
    const amount = Math.min(balance, total);
    payment = { amount: money(amount), due: money(cents(total - amount)) };
    card = { code: typedCard, amount };
  }
  const paid = card === null ? null : card.amount;
  const due = cents(total - (paid ?? 0));
  const full = (paid ?? 0) > 0 && (paid ?? 0) >= total;
  return {
    figures: { discount, net, tax, total, paid, due, to_pay: due, prepaid: full ? 1 : 0, card_used: (paid ?? 0) > 0 ? 1 : 0, confirm_as: ctx.phone === true ? 0 : full ? 2 : 1 },
    lineDiscounts,
    applied,
    told: [],
    payment,
    codes,
    card,
  };
}
