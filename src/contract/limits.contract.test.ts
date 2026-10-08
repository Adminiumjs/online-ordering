/**
 * THE LIMITS HOLD, ON A BUILT ADMINIUM.
 *
 * What a code and a gift card may never do, however many ask at once: a code
 * is used no more often than its owner said, a card pays no more than it
 * holds, a code that ran out between the price and the order writes nothing,
 * and an order is never made smaller than what a gift card already paid for.
 *
 * The app installed with Offers & gift cards ticked; the codes are made as
 * their owner makes them, in Offers' own tables. Everything a diner does goes
 * through the order page's own door.
 *
 * It runs with `CONTRACT=1` where the built add-on is; its servers take the
 * ports after `absent.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { codeErrorOf } from "../state/diner.ts";
import { ENGINES, missing, missingAddOn, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing() ?? missingAddOn("offers");
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_LIMITS_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 150);

const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const at = (time: string) => new Date(instantOf(TODAY, time, DEMO_ZONE)).toISOString();
const cents = (value: unknown) => Number(value).toFixed(2);

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe.skipIf(why !== null)(`the limits of codes and gift cards${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_limits_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { addOns: ["offers"] });
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** A code its owner makes: an offer that a code opens, switched on, and the code itself. */
      const codeFor = async (code: string, offer: Record<string, unknown>, limit: Record<string, unknown> = {}): Promise<void> => {
        const made = ok(await stand.staff.post<{ data: Row }>(stand.data("offers_offers"), { values: { name: code, public_name: { "en-US": code }, trigger: "code", applies_to: "order", starts_on: "2026-01-01", ...offer } }), 201).data;
        ok(await stand.staff.post(stand.data("offers_codes"), { values: { offer_id: made.id, code, ...limit } }), 201);
        ok(await stand.staff.patch(`${stand.data("offers_offers")}/${String(made.id)}`, { values: { status: "active" } }));
      };
      /** A gift card with value on it, sold at the desk; its key and its code. */
      const cardWith = async (amount: string): Promise<{ id: number; code: string }> => {
        const schema = ok(await stand.staff.get<{ model: { relations: { id: string; from: { tableId: string; columns: string[] } }[] } }>(`/api/v1/connections/${stand.connectionId}/schema`));
        const actions = schema.model.relations.find((relation) => relation.from.tableId === stand.ids["offers_card_actions"] && relation.from.columns.join() === "card_id")!.id;
        const made = ok(await stand.staff.post<{ data: Row }>(stand.data("offers_gift_cards"), { values: { kind: "card" }, children: { [actions]: [{ values: { action: "issue", amount, reason: "Sold at the desk", paid_by: "cash" } }] } }), 201).data;
        const card = ok(await stand.staff.get<{ data: Row }>(`${stand.data("offers_gift_cards")}/${String(made.id)}`)).data;
        return { id: made.id, code: String(card["code"]) };
      };
      const balanceOf = async (id: number) => cents(ok(await stand.staff.get<{ data: Row }>(`${stand.data("offers_gift_cards")}/${String(id)}`)).data["balance"]);
      /** Margheritas at a time, with whatever is typed: two are $27.00, $29.23 with tax. */
      const order = async (diner: AdminiumDiner, who: string, time: string, more: { codes?: string[]; card?: string; qty?: number } = {}): Promise<OrderBody> => {
        const menu = await diner.menu();
        return {
          values: { language: "en-US", name: who, email: `${who.toLowerCase().replace(" ", "")}.${engine}@juniper-diners.dev`, pickup_at: at(time) },
          children: {
            order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Margherita")!.id, qty: more.qty ?? 2 } }],
            ...(more.codes === undefined ? {} : { order_codes: more.codes.map((typed) => ({ values: { typed } })) }),
            ...(more.card === undefined ? {} : { payments: [{ values: { card_code: more.card } }] }),
          },
        };
      };
      const key = (who: string) => `${who}-limits-${engine}-0123456789abcdef`;

      it("the owner makes the codes: five off from $40.00, a tenth off, one that is used once, one for the last use", async () => {
        await codeFor("LUNCH5", { gives: "amount", value: "5", min_spend: "40" });
        await codeFor("TENTH", { gives: "percent", value: "10" });
        await codeFor("THREEOFF", { gives: "amount", value: "3" });
        await codeFor("ONCE", { gives: "amount", value: "2" }, { max_uses: 1 });
        await codeFor("LASTONE", { gives: "amount", value: "2" }, { max_uses: 1 });
        await codeFor("GONE", { gives: "amount", value: "2" }, { max_uses: 1 });
      }, 120_000);

      it("the minimum is said, with its amount, only when nothing else is wrong", async () => {
        const diner = await stand.dinerOf();
        const short = await refusal(diner.quote(await order(diner, "Min", "12:30", { codes: ["LUNCH5"] })));
        expect([short.status, short.code, short.params["reason"]]).toEqual([400, "PUBLIC_WRITE_REFUSED", "needs-minimum"]);
        expect(codeErrorOf(short)).toEqual({ kind: "minimum", amount: expect.stringMatching(/^40(\.0+)?$/) });
        // Enough in the cart: four are $54.00, and five comes off.
        const enough = await diner.quote(await order(diner, "Min", "12:30", { codes: ["LUNCH5"], qty: 4 }));
        expect([cents(enough.data["subtotal"]), cents(enough.data["discount"])]).toEqual(["54.00", "5.00"]);
      }, 60_000);

      it("of two codes the better one applies, and the other is told", async () => {
        const diner = await stand.dinerOf();
        // Two Margheritas, $27.00: a tenth is $2.70, and three off is more.
        const quote = await diner.quote(await order(diner, "Two", "12:30", { codes: ["TENTH", "THREEOFF"] }));
        expect(cents(quote.data["discount"])).toBe("3.00");
        expect((quote.applied ?? []).map((one) => cents(one.amount))).toEqual(["3.00"]);
        expect((quote.told ?? []).length).toBe(1);
      }, 60_000);

      it("a code that is used up is not valid, and says no more than a code that never was", async () => {
        const first = await stand.dinerOf();
        const body = await order(first, "Uma", "12:45", { codes: ["GONE"] });
        const quote = await first.quote(body);
        await first.place({ ...body, expect: { total: cents(quote.data["total"]) } }, key("uma"));
        const next = await stand.dinerOf();
        const used = await refusal(next.quote(await order(next, "Vic", "13:15", { codes: ["GONE"] })));
        const never = await refusal(next.quote(await order(next, "Vic", "13:15", { codes: ["NEVERWAS"] })));
        expect([used.status, used.code, used.params["reason"]]).toEqual([never.status, never.code, never.params["reason"]]);
        expect([codeErrorOf(used), codeErrorOf(never)]).toEqual([{ kind: "invalid" }, { kind: "invalid" }]);
      }, 120_000);

      it("the code ran out between the price and the order: nothing is written, and the page is told", async () => {
        const slow = await stand.dinerOf();
        const slowBody = await order(slow, "Slow", "13:30", { codes: ["ONCE"] });
        const priced = await slow.quote(slowBody);
        expect(cents(priced.data["discount"])).toBe("2.00");
        const quick = await stand.dinerOf();
        const quickBody = await order(quick, "Quick", "13:45", { codes: ["ONCE"] });
        await quick.place({ ...quickBody, expect: { total: cents((await quick.quote(quickBody)).data["total"]) } }, key("quick"));
        const before = (await stand.rows("orders")).length;
        const error = await refusal(slow.place({ ...slowBody, expect: { total: cents(priced.data["total"]) } }, key("slow")));
        expect(error.status >= 400 && error.status < 500).toBe(true);
        expect(["PUBLIC_PRICE_CHANGED", "PUBLIC_WRITE_REFUSED"]).toContain(error.code);
        expect((await stand.rows("orders")).length).toBe(before);
      }, 120_000);

      /** Ten browsers, ten pickup times — as many saves as the order page takes from one address in an hour — each with its own body. */
      const HOUR = 61 * 60_000;
      const TIMES = Array.from({ length: 10 }, (_, i) => `${String(15 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
      const tenAtOnce = async (who: string, more: { codes?: string[]; card?: string }) => {
        const tabs = await Promise.all(TIMES.map(() => stand.dinerOf()));
        const bodies = await Promise.all(tabs.map((tab, i) => order(tab, `${who} ${"abcdefghij"[i]!}`, TIMES[i]!, more)));
        const total = cents((await tabs[0]!.quote(bodies[0]!)).data["total"]);
        const done = await Promise.allSettled(tabs.map((tab, i) => tab.place({ ...bodies[i]!, expect: { total } }, key(`${who}${String(i)}`))));
        const lost = done.flatMap((one) => (one.status === "rejected" ? [one.reason as ApiError] : []));
        return { won: done.flatMap((one) => (one.status === "fulfilled" ? [one.value] : [])), lost, said: JSON.stringify(lost.map((one) => [one.status, one.code])).slice(0, 400) };
      };

      it("ten diners at once for the last use of a code: one order has it", async () => {
        // An hour on: nothing sent before counts against the address these come from.
        await stand.server.setClock(DEMO_START + HOUR);
        const before = (await stand.rows("orders")).length;
        const { won, lost, said } = await tenAtOnce("Last", { codes: ["LASTONE"] });
        expect(won.length, said).toBe(1);
        // The others: the price moved under them, the code is not valid any more, or the door asked them to slow down.
        expect(lost.every((one) => one.code === "PUBLIC_PRICE_CHANGED" || one.code === "PUBLIC_RATE_LIMITED" || (one.code === "PUBLIC_WRITE_REFUSED" && one.params["column"] === "typed")), said).toBe(true);
        expect((await stand.rows("orders")).length).toBe(before + 1);
        const code = ok(await stand.staff.get<{ data: Row[] }>(`${stand.data("offers_codes")}?limit=200`)).data.find((one) => one["code"] === "LASTONE")!;
        expect(Number(code["uses"])).toBe(1);
        expect((await stand.rows("order_codes")).filter((one) => one["typed"] === "LASTONE").length).toBe(1);
      }, 240_000);

      it("ten orders at once on one gift card: together they take what it held, and not a cent more", async () => {
        await stand.server.setClock(DEMO_START + 2 * HOUR);
        const card = await cardWith("40.00");
        const { won, lost, said } = await tenAtOnce("Card", { card: card.code });
        // $40.00 pays one order whole and $10.77 of a second; the card is empty for every other.
        expect(won.length, said).toBe(2);
        expect(lost.every((one) => one.code === "PUBLIC_CARD_REFUSED" || one.code === "PUBLIC_PRICE_CHANGED" || one.code === "PUBLIC_RATE_LIMITED"), said).toBe(true);
        expect(await balanceOf(card.id)).toBe("0.00");
        const ids = new Set(won.map((one) => one.data.id));
        const paid = (await stand.rows("payments")).filter((one) => ids.has(one["order_id"] as number));
        expect(paid.map((one) => cents(one["amount"])).sort()).toEqual(["10.77", "29.23"]);
      }, 240_000);

      it("an order made smaller than what its card paid is refused; after the manager gives the difference back, it goes through", async () => {
        await stand.server.setClock(DEMO_START + 3 * HOUR);
        const card = await cardWith("60.00");
        const diner = await stand.dinerOf();
        const body = await order(diner, "Wren", "19:00", { card: card.code });
        const made = await diner.place({ ...body, expect: { total: "29.23" } }, key("wren"));
        expect(await balanceOf(card.id)).toBe("30.77");
        const [line] = (await stand.rows("order_items")).filter((one) => one["order_id"] === made.data.id);
        const smaller = () => stand.staff.patch(`${stand.data("order_items")}/${String(line!.id)}`, { values: { qty: 1 } });
        const refused = await smaller();
        expect([refused.status, refused.code], JSON.stringify(refused.body).slice(0, 500)).toEqual([409, "BALANCE_EXCEEDED"]);
        // One Margherita is $13.50, $14.61 with tax (or a cent beside it): the difference goes back to the card first.
        const [payment] = (await stand.rows("payments")).filter((one) => one["order_id"] === made.data.id);
        ok(await stand.staff.post(stand.data("payment_refunds"), { values: { payment_id: payment!.id, order_id: made.data.id, amount: "14.62", reason: "One dish taken off" } }), 201);
        expect(await balanceOf(card.id)).toBe("45.39");
        const now = await smaller();
        expect(now.status, JSON.stringify(now.body).slice(0, 500)).toBe(200);
        const stored = (await stand.rows("orders")).find((one) => one.id === made.data.id)!;
        expect(Number(stored["due"])).toBeGreaterThanOrEqual(0);
      }, 180_000);
    });
  });
});
