/**
 * WITH THE ADD-ONS AWAY, OR UNABLE TO ANSWER — tested, not assumed.
 *
 *   (a) Neither add-on installed: the order page and the kitchen are 0.2.3's.
 *       An order is priced and placed as it always was; nothing is offered,
 *       nothing is asked of an add-on, and a code or a gift card sent anyway
 *       is refused without a name — a row can never name an add-on that is not
 *       there for this app.
 *   (b) Offers & gift cards attached, then switched off for the app: it cannot
 *       answer, so nothing that would ask it is saved — an order with no code
 *       included, never a silent full-price order. Switched on again, orders
 *       are taken again.
 *
 * It runs with `CONTRACT=1`; (b) needs the built add-on. Its servers take the
 * ports after `stock.contract.test.ts`'s.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { Caller, ENGINES, missing, missingAddOn, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_ABSENT_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 120);
const offersWhy = missingAddOn("offers");

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

const body = async (diner: AdminiumDiner, who: string, engine: string, time: string, more: Partial<OrderBody["children"]> = {}): Promise<OrderBody> => {
  const menu = await diner.menu();
  return {
    values: { language: "en-US", name: who, email: `${who.toLowerCase()}.${engine}@juniper-diners.dev`, pickup_at: at(time) },
    children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Margherita")!.id, qty: 2 } }], ...more },
  };
};

describe.skipIf(why !== null)(`with the add-ons away, or unable to answer${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`neither add-on installed — ${engine}`, () => {
      let stand: Stand;
      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * 2 * PORTS_PER_ENGINE, `oo_absent_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);
      afterAll(async () => {
        await stand?.server.stop();
      });

      it("offers nothing: no code field, no gift card, no gift cards at the counter", async () => {
        const diner = await stand.dinerOf();
        expect((await diner.config()).offers).toBe(false);
        expect(await stand.kitchen.giftCards()).toBe(false);
        expect(await diner.cardBalance({ code: "GC-7K2M-W3HN-Q4XP" })).toBeNull();
        // Nothing is counted, so nothing is short: every dish reads as in.
        expect((await diner.stock([1, 2])).every((one) => one.state === "in" && one.left === undefined)).toBe(true);
      }, 60_000);

      it("prices and places an order as 0.2.3 did: no reduction, tax on the subtotal, the total to pay at the counter", async () => {
        const diner = await stand.dinerOf();
        const order = await body(diner, "Ana", engine, "12:30");
        const quote = await diner.quote(order);
        expect([cents(quote.data["subtotal"]), cents(quote.data["tax"]), cents(quote.data["total"])]).toEqual(["27.00", "2.23", "29.23"]);
        expect(quote.applied ?? []).toEqual([]);
        expect(quote.payment ?? null).toBeNull();
        const mailsBefore = await stand.mailCount();
        const made = await diner.place({ ...order, expect: { total: "29.23" } }, `ana-absent-${engine}-0123456789ab`);
        // The confirmation is 0.2.3's but for one row: what is paid at pickup, which is the total.
        const mail = (await stand.mailTo(`ana.${engine}@juniper-diners.dev`, mailsBefore)).text.replace(/\s+/g, " ");
        expect(mail).toContain("$29.23");
        expect(mail).toContain("To pay at pickup: $29.23");
        const stored = (await stand.rows("orders")).find((one) => one.id === made.data.id)!;
        // Nothing is decided where nobody answers: no reduction is written, and what is owed is the total.
        expect([stored["discount"] ?? null, cents(stored["total"]), cents(stored["to_pay"]), Number(stored["card_used"] ?? 0)]).toEqual([null, "29.23", "29.23", 0]);
        // The kitchen walks it to the shelf and hands it over for cash, as it always did.
        for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"], ["preparing", "ready"]] as const) await stand.kitchen.move(made.data.id, from, to);
        expect((await stand.kitchen.handOff(made.data.id, "cash"))["paid_method"]).toBe("cash");
      }, 180_000);

      it("refuses a code or a gift card sent anyway, without a name, and writes nothing", async () => {
        const diner = await stand.dinerOf();
        const before = (await stand.rows("orders")).length;
        const coded = await refusal(diner.place(await body(diner, "Ben", engine, "12:45", { order_codes: [{ values: { typed: "WELCOME10" } }] }), `ben-absent-${engine}-0123456789ab`));
        expect([coded.status >= 400 && coded.status < 500, coded.params["reason"] ?? null]).toEqual([true, null]);
        const carded = await refusal(diner.place(await body(diner, "Cy", engine, "13:15", { payments: [{ values: { card_code: "GC-7K2M-W3HN-Q4XP" } }] }), `cy-absent-${engine}-0123456789abc`));
        expect(carded.status >= 400 && carded.status < 500).toBe(true);
        expect((await stand.rows("orders")).length).toBe(before);
        expect(await stand.rows("order_codes")).toEqual([]);
        expect(await stand.rows("payments")).toEqual([]);
      }, 120_000);
    });

    describe.skipIf(!available)(`nobody types a reduction while no add-on decides one — ${engine}`, () => {
      let stand: Stand;
      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + 100 + index * PORTS_PER_ENGINE, `oo_typed_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);
      afterAll(async () => {
        await stand?.server.stop();
      });

      it("a kitchen user's phone order cannot carry a reduction, on the order or on a line, and a plain one goes through", async () => {
        const roles = ok(await stand.staff.get<{ roles: { id: string; name: string }[] }>("/api/v1/roles")).roles;
        const role = roles.find((one) => /kitchen/i.test(one.name))!;
        const email = `cook.absent.${engine}@juniper-kitchen.dev`;
        const invited = ok(await stand.staff.post<{ invite: { token: string } }>("/api/v1/users", { email, name: "Cook", roleIds: [role.id] }), 201);
        const password = `${randomBytes(18).toString("base64url")}Aa1!`;
        ok(await new Caller(stand.server.base, { origin: stand.server.base }).post("/api/v1/auth/password/reset", { token: invited.invite.token, newPassword: password }));
        const cook = new Caller(stand.server.base, { origin: stand.server.base });
        await cook.signInToScreens(email, password);
        const dish = (await stand.rows("menu_items")).find((one) => one["name"] === "Margherita")!;
        const schema = ok(await stand.staff.get<{ model: { relations: { id: string; from: { tableId: string; columns: string[] } }[] } }>(`/api/v1/connections/${stand.connectionId}/schema`));
        const lines = schema.model.relations.find((relation) => relation.from.tableId === stand.ids["order_items"] && relation.from.columns.join() === "order_id")!.id;
        const order = (values: Record<string, unknown>, line: Record<string, unknown>) =>
          cook.post<{ data: Row }>(stand.data("orders"), { values: { name: "Phone Guest", phone: "(555) 010-2030", pickup_at: at("15:00"), channel: "phone", ...values }, children: { [lines]: [{ values: { menu_item_id: dish.id, qty: 1, ...line } }] } });
        const before = (await stand.rows("orders")).length;
        for (const [values, line] of [[{ discount: "5.00" }, {}], [{}, { discount: "5.00" }], [{ paid: "5.00" }, {}], [{ to_pay: "0" }, {}]] as const) {
          const refused = await order(values, line);
          expect([JSON.stringify([values, line]), refused.status >= 400 && refused.status < 500]).toEqual([JSON.stringify([values, line]), true]);
        }
        expect((await stand.rows("orders")).length).toBe(before);
        const plain = await order({}, {});
        expect(plain.status, JSON.stringify(plain.body).slice(0, 400)).toBe(201);
        const stored = (await stand.rows("orders")).find((one) => one.id === (plain.body as { data: Row }).data.id)!;
        expect([stored["discount"] ?? null, cents(stored["total"])]).toEqual([null, "14.61"]);
      }, 240_000);
    });

    describe.skipIf(!available || offersWhy !== null)(`Offers & gift cards attached and switched off — ${engine}`, () => {
      let stand: Stand;
      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + (index * 2 + 1) * PORTS_PER_ENGINE, `oo_unable_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { addOns: ["offers"], addOnSamples: ["offers"] });
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);
      afterAll(async () => {
        await stand?.server.stop();
      });

      it("takes no order it could not price: one with no code is refused too, and nothing is written", async () => {
        ok(await stand.staff.patch("/api/v1/add-ons/offers", { attachedTo: "ordering", enabled: false }));
        const diner = await stand.dinerOf();
        const before = (await stand.rows("orders")).length;
        const refused = await refusal(diner.place(await body(diner, "Di", engine, "12:30"), `di-unable-${engine}-0123456789ab`));
        expect(refused.status >= 400 && refused.status < 500).toBe(true);
        expect((await stand.rows("orders")).length).toBe(before);
      }, 120_000);

      it("takes orders again once it is switched back on", async () => {
        ok(await stand.staff.patch("/api/v1/add-ons/offers", { attachedTo: "ordering", enabled: true }));
        const diner = await stand.dinerOf();
        const order = await body(diner, "Eve", engine, "12:45");
        const quote = await diner.quote(order);
        expect(cents(quote.data["total"])).toBe("29.23");
        expect((await diner.place({ ...order, expect: { total: "29.23" } }, `eve-unable-${engine}-0123456789a`)).data.id).toBeGreaterThan(0);
      }, 120_000);
    });
  });
});
