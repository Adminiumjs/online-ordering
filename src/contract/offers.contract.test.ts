/**
 * CODES, OFFERS AND GIFT CARDS AT CHECKOUT, ON A BUILT ADMINIUM.
 *
 * The app installed with Offers & gift cards ticked and the add-on's own
 * sample in (WELCOME10, its cards); the kitchen's own offer is made as its
 * owner makes one, in Offers' own tables (Pizza pair: two Pepperoni & honey,
 * the cheaper one on us — an offer is the add-on's to keep, so no app ships
 * one in its sample). Everything else is asked through
 * the order page's own door, as a diner's browser asks it, on SQLite,
 * Postgres and MySQL.
 *
 * Juniper's worked order: two Pepperoni & honey, a Wild mushroom, Charred
 * brussels, a Lemon tart and a Lemonade — $64.50. Pizza pair takes $16.00
 * off by itself. WELCOME10 is for a diner's first order, so it needs to know
 * who is ordering: a guest is told to sign in, whatever address they typed,
 * and pays $52.50; signed in, it takes $4.85 more and the order is $47.25.
 * A gift card then pays what it holds, and the rest is paid at the counter.
 *
 * It runs with `CONTRACT=1` where the built add-on is; its servers take the
 * ports after `update.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { ENGINES, missing, missingAddOn, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing() ?? missingAddOn("offers");
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_OFFERS_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 90);

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

/** The six-digit code a sign-in email carries. */
const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)?.[1] ?? "";

describe.skipIf(why !== null)(`codes, offers and gift cards on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      const ama = `ama.offers.${engine}@juniper-diners.dev`;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_offers_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { addOns: ["offers"], addOnSamples: ["offers"] });
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** Juniper's worked order, by this Adminium's ids. */
      const worked = async (diner: AdminiumDiner, values: Record<string, unknown>, more: { codes?: string[]; card?: string } = {}): Promise<OrderBody> => {
        const menu = await diner.menu();
        const dish = (name: string) => menu.items.find((d) => d["name"] === name)!.id;
        return {
          values: { language: "en-US", pickup_at: at("12:30"), ...values },
          children: {
            order_items: [
              { values: { menu_item_id: dish("Pepperoni & honey"), qty: 2 } },
              { values: { menu_item_id: dish("Wild mushroom"), qty: 1 } },
              { values: { menu_item_id: dish("Charred brussels"), qty: 1 } },
              { values: { menu_item_id: dish("Lemon tart"), qty: 1 } },
              { values: { menu_item_id: dish("Lemonade"), qty: 1 } },
            ],
            ...(more.codes === undefined ? {} : { order_codes: more.codes.map((typed) => ({ values: { typed } })) }),
            ...(more.card === undefined ? {} : { payments: [{ values: { card_code: more.card } }] }),
          },
        };
      };
      const figures = (data: Record<string, unknown>) => ["subtotal", "discount", "net", "tax", "total"].map((column) => cents(data[column]));
      const signIn = async (email: string): Promise<AdminiumDiner> => {
        const diner = await stand.dinerOf();
        const before = await stand.mailCount();
        await diner.requestSignIn(email, "en-US");
        const mail = await stand.mailTo(email, before);
        await diner.verifyCode(email, codeIn(mail.text));
        return diner;
      };
      const offersRows = async (table: string): Promise<Row[]> => ok(await stand.staff.get<{ data: Row[] }>(`${stand.data(`offers_${table}`)}?limit=200`)).data;

      it("the owner makes the kitchen's own offer, beside the add-on's sample: two Pepperoni & honey, the cheaper one on us", async () => {
        const pepperoni = (await stand.rows("menu_items")).find((dish) => dish["name"] === "Pepperoni & honey")!;
        const offer = ok(
          await stand.staff.post<{ data: Row }>(stand.data("offers_offers"), {
            values: { name: "Pizza pair", public_name: { "en-US": "Two Pepperoni & honey, the cheaper one on us" }, gives: "bonus_item", buy_qty: 2, bonus_qty: 1, trigger: "automatic", applies_to: "lines", starts_on: "2026-01-01" },
          }),
          201,
        ).data;
        // What it is for: one dish, named by the app's own table as Adminium stores it.
        ok(await stand.staff.post(stand.data("offers_offer_targets"), { values: { offer_id: offer.id, kind: "item", source_table: "ordering:menu_items", source_row: String(pepperoni.id), label: "Pepperoni & honey" } }), 201);
        // An offer starts as a draft, and is switched on once what it is for is said.
        ok(await stand.staff.patch(`${stand.data("offers_offers")}/${String(offer.id)}`, { values: { status: "active" } }));
        const offers = await offersRows("offers");
        expect(offers.map((one) => one["name"])).toEqual(expect.arrayContaining(["Pizza pair", "Welcome 10"]));
      }, 60_000);

      it("a guest's worked order: $64.50, Pizza pair −$16.00, tax on what is left, $52.50", async () => {
        const diner = await stand.dinerOf();
        const quote = await diner.quote(await worked(diner, { name: "Pat", email: `pat.${engine}@juniper-diners.dev` }));
        expect(figures(quote.data)).toEqual(["64.50", "16.00", "48.50", "4.00", "52.50"]);
        expect((quote.applied ?? []).map((one) => [one.name, one.kind, cents(one.amount), one.typed])).toEqual([["Two Pepperoni & honey, the cheaper one on us", "offer", "16.00", false]]);
        expect(quote.payment ?? null).toBeNull();
      }, 60_000);

      it("a guest typing WELCOME10 is told to sign in, whatever address they typed", async () => {
        const diner = await stand.dinerOf();
        const error = await refusal(diner.quote(await worked(diner, { name: "Ama", email: ama }, { codes: ["WELCOME10"] })));
        expect([error.status, error.code, error.params["reason"]]).toEqual([400, "PUBLIC_WRITE_REFUSED", "needs-sign-in"]);
      }, 60_000);

      let placed: { id: number; total: string } = { id: 0, total: "" };
      /** Ama's tab, signed in. */
      let amaTab: AdminiumDiner;
      it("signed in, WELCOME10 applies: −$4.85, tax $3.60, $47.25 — and the save agrees with the quote", async () => {
        // On file, with no order yet: a sign-in link goes only to an address the kitchen knows.
        ok(await stand.staff.post(stand.data("customers"), { values: { email: ama, name: "Ama" } }), 201);
        const diner = (amaTab = await signIn(ama));
        const body = await worked(diner, { name: "Ama", email: ama }, { codes: ["welcome10"] });
        const quote = await diner.quote(body);
        expect(figures(quote.data)).toEqual(["64.50", "20.85", "43.65", "3.60", "47.25"]);
        expect((quote.applied ?? []).map((one) => [one.kind, cents(one.amount), one.typed]).sort()).toEqual([["code", "4.85", true], ["offer", "16.00", false]]);
        const made = await diner.place({ ...body, expect: { total: cents(quote.data["total"]) } }, `ama-offers-${engine}-0123456789abcdef`);
        expect(figures(made.data)).toEqual(["64.50", "20.85", "43.65", "3.60", "47.25"]);
        expect((made.applied ?? []).map((one) => cents(one.amount)).sort()).toEqual(["16.00", "4.85"]);
        placed = { id: made.data.id, total: cents(made.data["total"]) };
        // Kept: the diner was signed in when the code asked who they are; and what is left to pay is the total.
        const stored = (await stand.rows("orders")).find((order) => order.id === placed.id)!;
        expect([stored["customer_proved"] === true || stored["customer_proved"] === 1, cents(stored["to_pay"]), cents(stored["due"])]).toEqual([true, "47.25", "47.25"]);
        // The use was taken with the order.
        const codes = (await stand.rows("order_codes")).filter((code) => code["order_id"] === placed.id);
        expect(codes.map((code) => [code["typed"], code["code_id"] !== null])).toEqual([["welcome10", true]]);
      }, 120_000);

      it("a first order only: the same diner's second order is told the code is not for it", async () => {
        const diner = amaTab;
        const error = await refusal(diner.quote(await worked(diner, { name: "Ama", email: ama, pickup_at: at("13:30") }, { codes: ["WELCOME10"] })));
        expect([error.status, error.code]).toEqual([400, "PUBLIC_WRITE_REFUSED"]);
        expect(error.params["column"]).toBe("typed");
      }, 120_000);

      /** A gift card with value on it, sold at the desk as Offers' own page sells one; its key and its code. */
      const cardWith = async (amount: string): Promise<{ id: number; code: string }> => {
        const schema = ok(await stand.staff.get<{ model: { relations: { id: string; from: { tableId: string; columns: string[] } }[] } }>(`/api/v1/connections/${stand.connectionId}/schema`));
        const actions = schema.model.relations.find((relation) => relation.from.tableId === stand.ids["offers_card_actions"] && relation.from.columns.join() === "card_id")!.id;
        const made = ok(await stand.staff.post<{ data: Row }>(stand.data("offers_gift_cards"), { values: { kind: "card" }, children: { [actions]: [{ values: { action: "issue", amount, reason: "Sold at the desk", paid_by: "cash" } }] } }), 201).data;
        const card = ok(await stand.staff.get<{ data: Row }>(`${stand.data("offers_gift_cards")}/${String(made.id)}`)).data;
        expect([card["status"], cents(card["balance"])]).toEqual(["active", cents(amount)]);
        return { id: made.id, code: String(card["code"]) };
      };
      const balanceOf = async (id: number) => cents(ok(await stand.staff.get<{ data: Row }>(`${stand.data("offers_gift_cards")}/${String(id)}`)).data["balance"]);
      const orderRow = async (id: number) => (await stand.rows("orders")).find((order) => order.id === id)!;
      const move = (id: number, values: Record<string, unknown>) => stand.staff.patch(`${stand.data("orders")}/${String(id)}`, { values });

      let card: { id: number; code: string } = { id: 0, code: "" };
      let carded = 0;
      it("a gift card pays what it holds at placing: $19.00 of $52.50, and $33.50 is left for the counter", async () => {
        card = await cardWith("19.00");
        const diner = await stand.dinerOf();
        const body = await worked(diner, { name: "Cleo", email: `cleo.${engine}@juniper-diners.dev`, pickup_at: at("12:45") }, { card: card.code });
        const quote = await diner.quote(body);
        expect(figures(quote.data)).toEqual(["64.50", "16.00", "48.50", "4.00", "52.50"]);
        expect([cents(quote.payment?.amount), cents(quote.payment?.due)]).toEqual(["19.00", "33.50"]);
        // A quote takes nothing off the card.
        expect(await balanceOf(card.id)).toBe("19.00");
        const made = await diner.place({ ...body, expect: { total: "52.50" } }, `cleo-card-${engine}-0123456789abcdef`);
        expect([cents(made.payment?.amount), cents(made.payment?.due)]).toEqual(["19.00", "33.50"]);
        carded = made.data.id;
        expect(await balanceOf(card.id)).toBe("0.00");
        const stored = await orderRow(carded);
        expect([cents(stored["paid"]), cents(stored["due"]), cents(stored["to_pay"]), Number(stored["prepaid"]), Number(stored["card_used"]), Number(stored["confirm_as"])]).toEqual(["19.00", "33.50", "33.50", 0, 1, 1]);
        const [payment] = (await stand.rows("payments")).filter((one) => one["order_id"] === carded);
        expect([cents(payment!["amount"]), cents(payment!["kept"]), payment!["card_last4"], payment!["made_by"]]).toEqual(["19.00", "19.00", card.code.slice(-4), "customer"]);
      }, 120_000);

      it("handed over: cash alone is refused once a card paid part; a card and cash is taken, and says how the rest was paid", async () => {
        for (const status of ["confirmed", "preparing", "ready"]) expect((await move(carded, { status })).status, status).toBe(200);
        // What a 0.2.3 kitchen screen would send: the server says it does not agree with what the card paid.
        const old = await move(carded, { status: "picked_up", paid_method: "cash" });
        expect([old.status, old.code]).toEqual([409, "STATE_MOVE_REFUSED"]);
        expect((await orderRow(carded))["status"]).toBe("ready");
        const mixed = await move(carded, { status: "picked_up", paid_method: "mixed", rest_paid_by: "cash" });
        expect(mixed.status, JSON.stringify(mixed.body).slice(0, 600)).toBe(200);
        const stored = await orderRow(carded);
        expect([stored["status"], stored["paid_method"], stored["rest_paid_by"]]).toEqual(["picked_up", "mixed", "cash"]);
        // Handed over, the card's money stays spent.
        expect(await balanceOf(card.id)).toBe("0.00");
      }, 120_000);

      it("cancelled: the card's money goes back, once, and so does the code's use", async () => {
        const back = await cardWith("60.00");
        const diner = await stand.dinerOf();
        // Two Pepperoni & honey alone: $32.00, the pair's $16.00 off, tax $1.32, $17.32.
        const whole = await worked(diner, { name: "Eli", email: `eli.${engine}@juniper-diners.dev`, pickup_at: at("13:15") }, { card: back.code });
        const body = { ...whole, children: { ...whole.children, order_items: whole.children.order_items.slice(0, 1) } };
        const made = await diner.place({ ...body, expect: { total: "17.32" } }, `eli-card-${engine}-0123456789abcdef`);
        // The card covers all of it: nothing is left for the counter.
        expect([cents(made.payment?.amount), cents(made.payment?.due)]).toEqual(["17.32", "0.00"]);
        expect(await balanceOf(back.id)).toBe("42.68");
        const paid = await orderRow(made.data.id);
        expect([Number(paid["prepaid"]), Number(paid["confirm_as"]), cents(paid["to_pay"])]).toEqual([1, 2, "0.00"]);
        expect((await move(made.data.id, { status: "cancelled", cancel_code: "customer_asked" })).status).toBe(200);
        expect(await balanceOf(back.id)).toBe("60.00");
        // Cancelled already: a second cancel is refused, and writes nothing.
        expect((await move(made.data.id, { status: "cancelled", cancel_code: "customer_asked" })).status).not.toBe(200);
        expect(await balanceOf(back.id)).toBe("60.00");
      }, 120_000);

      // (Last of the card cases: wrong cards count against the browser that sends them, and soon it is told to wait.)
      it("a card that is empty, or no card at all, is not valid — and says no more than that", async () => {
        const diner = await stand.dinerOf();
        for (const code of [card.code, "GC-AAAA-BBBB-CCCC"]) {
          const whole = await worked(diner, { name: "Dee", email: `dee.${engine}@juniper-diners.dev`, pickup_at: at("13:30") }, { card: code });
          // (The pizzas alone: the day's last Wild mushroom went with the order before.)
          const body = { ...whole, children: { ...whole.children, order_items: whole.children.order_items.slice(0, 1) } };
          const which = code === card.code ? "empty" : "unknown";
          // A card that is known and holds nothing: the quote prices the order and says the card would not pay.
          // A code that is no card's: the quote is refused outright. Either way the save is refused, and writes nothing.
          let total = "17.32";
          if (which === "empty") {
            const quote = await diner.quote(body);
            expect((quote.postings ?? []).filter((one) => one.ledger === "value" && one.state !== "ok").map((one) => [one.state, one.reason])).toEqual([["refused", "not-valid"]]);
            total = cents(quote.data["total"]);
          } else {
            const asked = await refusal(diner.quote(body));
            expect([asked.status, asked.code, asked.params["reason"]]).toEqual([409, "PUBLIC_CARD_REFUSED", "not-valid"]);
          }
          const error = await refusal(diner.place({ ...body, expect: { total } }, `dee-${which}-${engine}-0123456789abcdef`));
          expect([which, error.status, error.code, error.params["reason"]]).toEqual([which, 409, "PUBLIC_CARD_REFUSED", "not-valid"]);
          expect(JSON.stringify(error.params)).not.toMatch(/balance|status|expires/);
        }
      }, 60_000);

      it("nothing a guest sends sets a reduction, a payment's amount or how it was paid", async () => {
        const diner = await stand.dinerOf();
        const body = await worked(diner, { name: "Pat", email: `pat2.${engine}@juniper-diners.dev`, pickup_at: at("13:45") });
        for (const values of [{ discount: "60.00" }, { paid: "60.00" }, { due: "0" }, { paid_method: "gift_card" }, { customer_proved: true }, { to_pay: "0" }]) {
          const error = await refusal(diner.quote({ ...body, values: { ...body.values, ...values } }));
          expect([Object.keys(values)[0], error.status, error.code]).toEqual([Object.keys(values)[0], 400, "PUBLIC_WRITE_REFUSED"]);
        }
        const line = await refusal(diner.quote({ ...body, children: { order_items: body.children.order_items.map((one, i) => (i === 0 ? { ...one, values: { ...one.values, discount: "30.00" } } : one)) } }));
        expect([line.status, line.code]).toEqual([400, "PUBLIC_WRITE_REFUSED"]);
      }, 60_000);
    });
  });
});
