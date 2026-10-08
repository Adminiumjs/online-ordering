/**
 * THE HAND-OVER OF AN ORDER A GIFT CARD PAID, ON A BUILT ADMINIUM.
 *
 * Through the kitchen's own door, as its tablet speaks: what gift cards paid
 * comes with the order; a card at the counter is asked first and taken in a
 * save of its own; "Paid by" is said by the screen and judged by Adminium
 * against what the cards paid; a kitchen user gives no money back — a manager
 * does, with a row that names the payment, and never a cent more than it kept.
 *
 * It runs with `CONTRACT=1` where the built add-on is; its servers take the
 * ports after `offers.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { randomBytes } from "node:crypto";

import { Caller, ENGINES, missing, missingAddOn, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing() ?? missingAddOn("offers");
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_HANDOVER_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 100);

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

describe.skipIf(why !== null)(`the hand-over of an order a gift card paid${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_handover_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { addOns: ["offers"], addOnSamples: ["offers"] });
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** Two Margheritas: $27.00 and tax $2.23, $29.23 — no offer of the sample is for them. */
      const order = async (diner: AdminiumDiner, who: string, time: string, card?: string): Promise<OrderBody> => {
        const menu = await diner.menu();
        return {
          values: { language: "en-US", name: who, email: `${who.toLowerCase()}.${engine}@juniper-diners.dev`, pickup_at: at(time) },
          children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Margherita")!.id, qty: 2 } }], ...(card === undefined ? {} : { payments: [{ values: { card_code: card } }] }) },
        };
      };
      const cardWith = async (amount: string): Promise<{ id: number; code: string }> => {
        const schema = ok(await stand.staff.get<{ model: { relations: { id: string; from: { tableId: string; columns: string[] } }[] } }>(`/api/v1/connections/${stand.connectionId}/schema`));
        const actions = schema.model.relations.find((relation) => relation.from.tableId === stand.ids["offers_card_actions"] && relation.from.columns.join() === "card_id")!.id;
        const made = ok(await stand.staff.post<{ data: Row }>(stand.data("offers_gift_cards"), { values: { kind: "card" }, children: { [actions]: [{ values: { action: "issue", amount, reason: "Sold at the desk", paid_by: "cash" } }] } }), 201).data;
        return { id: made.id, code: String(ok(await stand.staff.get<{ data: Row }>(`${stand.data("offers_gift_cards")}/${String(made.id)}`)).data["code"]) };
      };
      const balanceOf = async (id: number) => cents(ok(await stand.staff.get<{ data: Row }>(`${stand.data("offers_gift_cards")}/${String(id)}`)).data["balance"]);
      const toShelf = async (id: number) => {
        for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"], ["preparing", "ready"]] as const) await stand.kitchen.move(id, from, to);
      };
      const placed = async (who: string, time: string, card?: string): Promise<number> => {
        const diner = await stand.dinerOf();
        const body = await order(diner, who, time, card);
        const quote = await diner.quote(body);
        return (await diner.place({ ...body, expect: { total: cents(quote.data["total"]) } }, `${who}-${engine}-0123456789abcdefgh`)).data.id;
      };

      it("says the kitchen takes gift cards, while Offers & gift cards is in use", async () => {
        expect(await stand.kitchen.giftCards()).toBe(true);
      });

      it("paid in full by card: the order comes with its payment, and is handed over with no tender", async () => {
        const card = await cardWith("50.00");
        const id = await placed("Ana", "12:30", card.code);
        await toShelf(id);
        const read = await stand.kitchen.order(id);
        expect([cents(read.order["total"]), cents(read.order["paid"]), cents(read.order["to_pay"])]).toEqual(["29.23", "29.23", "0.00"]);
        expect((read.payments ?? []).map((one) => [cents(one["amount"]), one["card_last4"]])).toEqual([["29.23", card.code.slice(-4)]]);
        // "Cash" does not agree with a card that paid it all; "Gift card" does.
        const cash = await refusal(stand.kitchen.handOff(id, "cash"));
        expect([cash.status, cash.code]).toEqual([409, "STATE_MOVE_REFUSED"]);
        const done = await stand.kitchen.handOff(id, "gift_card");
        expect([done["status"], done["paid_method"]]).toEqual(["picked_up", "gift_card"]);
      }, 180_000);

      it("a card at the counter: asked first, taken in its own save; then a card and cash — and a refused hand-over keeps the payment", async () => {
        const card = await cardWith("19.00");
        const id = await placed("Ben", "12:45");
        await toShelf(id);
        // Asked: what it would pay, and what would be left. Nothing moved.
        const would = await stand.kitchen.cardCheck(id, card.code);
        expect([cents(would.amount), cents(would.due)]).toEqual(["19.00", "10.23"]);
        expect(await balanceOf(card.id)).toBe("19.00");
        // Taken: the same figures, from the save.
        const took = await stand.kitchen.cardUse(id, card.code, `ben-card-${engine}-0001`);
        expect([cents(took.amount), cents(took.due)]).toEqual(["19.00", "10.23"]);
        expect(await balanceOf(card.id)).toBe("0.00");
        // The same save sent again is the same payment.
        const again = await stand.kitchen.cardUse(id, card.code, `ben-card-${engine}-0001`).then(
          () => "answered",
          (error: unknown) => (error as ApiError).code,
        );
        expect(["answered", "UNIQUE_VIOLATION", "POSTING_REFUSED"]).toContain(again);
        expect((await stand.rows("payments")).filter((one) => one["order_id"] === id)).toHaveLength(1);
        // A hand-over that says "gift card" for an order a card paid only part of is refused; the payment stands.
        const wrong = await refusal(stand.kitchen.handOff(id, "gift_card"));
        expect([wrong.status, wrong.code]).toEqual([409, "STATE_MOVE_REFUSED"]);
        const read = await stand.kitchen.order(id);
        expect([read.order["status"], cents(read.order["paid"]), cents(read.order["to_pay"])]).toEqual(["ready", "19.00", "10.23"]);
        const done = await stand.kitchen.handOff(id, "mixed", "cash");
        expect([done["status"], done["paid_method"], done["rest_paid_by"]]).toEqual(["picked_up", "mixed", "cash"]);
      }, 180_000);

      it("a card that is spent says so in a plain reason, to staff", async () => {
        // (The smallest card this shop sells holds $10.00.)
        const card = await cardWith("10.00");
        const first = await placed("Cy", "13:15");
        await toShelf(first);
        await stand.kitchen.cardUse(first, card.code, `cy-card-${engine}-0001`);
        const second = await placed("Di", "13:30");
        await toShelf(second);
        const empty = await refusal(stand.kitchen.cardCheck(second, card.code));
        // (A card with nothing left on it is no longer one that pays: "empty" where it is still found, "not valid" once it is not.)
        expect([empty.status, empty.code]).toEqual([409, "POSTING_REFUSED"]);
        expect(["empty", "not-valid"]).toContain(empty.params["reason"]);
        const unknown = await refusal(stand.kitchen.cardCheck(second, "GC-AAAA-BBBB-CCCC"));
        // A code that is no card's is a typed value nothing was found for: the field's own refusal.
        expect([unknown.status, unknown.code]).toEqual([422, "VALIDATION_FAILED"]);
      }, 180_000);

      it("a kitchen user reads what a card paid and its last four, never its code — and gives no money back", async () => {
        // Somebody holding the kitchen's role and no other, signed in to the kitchen's own screens.
        const roles = ok(await stand.staff.get<{ roles: { id: string; name: string }[] }>("/api/v1/roles")).roles;
        const role = roles.find((one) => /kitchen/i.test(one.name))!;
        const email = `cook.${engine}@juniper-kitchen.dev`;
        const invited = ok(await stand.staff.post<{ invite: { token: string } }>("/api/v1/users", { email, name: "Cook", roleIds: [role.id] }), 201);
        const password = `${randomBytes(18).toString("base64url")}Aa1!`;
        ok(await new Caller(stand.server.base, { origin: stand.server.base }).post("/api/v1/auth/password/reset", { token: invited.invite.token, newPassword: password }));
        const cook = new Caller(stand.server.base, { origin: stand.server.base });
        await cook.signInToScreens(email, password);
        const card = await cardWith("25.00");
        const id = await placed("Fay", "14:30", card.code);
        const read = ok(await cook.get<{ data: Row[] }>(`${stand.data("payments")}?limit=200`)).data.filter((one) => one["order_id"] === id);
        expect(read.map((one) => [cents(one["amount"]), one["card_last4"]])).toEqual([["25.00", card.code.slice(-4)]]);
        expect(read.every((one) => !("card_code" in one))).toBe(true);
        expect(JSON.stringify(read)).not.toContain(card.code);
        // Giving money back to a card is a manager's.
        const refund = await cook.post(stand.data("payment_refunds"), { values: { payment_id: read[0]!.id, order_id: id, amount: "1.00", reason: "No" } });
        expect(refund.status).toBe(403);
        expect(await balanceOf(card.id)).toBe("0.00");
      }, 180_000);

      it("not collected: the money stays; a manager gives it back with a refund row, and never a cent more than the payment kept", async () => {
        const card = await cardWith("40.00");
        const id = await placed("Eve", "14:15", card.code);
        await toShelf(id);
        expect(await balanceOf(card.id)).toBe("10.77");
        const moved = await stand.staff.patch(`${stand.data("orders")}/${String(id)}`, { values: { status: "not_collected" } });
        expect(moved.status, JSON.stringify(moved.body).slice(0, 600)).toBe(200);
        // Nothing comes back by itself.
        expect(await balanceOf(card.id)).toBe("10.77");
        const [payment] = (await stand.rows("payments")).filter((one) => one["order_id"] === id);
        const over = await stand.staff.post(stand.data("payment_refunds"), { values: { payment_id: payment!.id, order_id: id, amount: "29.24", reason: "Not collected" } });
        expect([over.status, over.code]).toEqual([409, "POSTING_REFUSED"]);
        expect(await balanceOf(card.id)).toBe("10.77");
        ok(await stand.staff.post(stand.data("payment_refunds"), { values: { payment_id: payment!.id, order_id: id, amount: "29.23", reason: "Not collected" } }), 201);
        expect(await balanceOf(card.id)).toBe("40.00");
        const kept = (await stand.rows("payments")).find((one) => one.id === payment!.id)!;
        expect([cents(kept["returned"]), cents(kept["kept"])]).toEqual(["29.23", "0.00"]);
      }, 180_000);
    });
  });
});
