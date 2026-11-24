/**
 * THE READY TEXT AND THE BOX FOR IT, ON A BUILT ADMINIUM.
 *
 * The app installed on an Adminium that reads texts (0.3.76), its sample
 * added at 11:40, and no text provider connected — as most kitchens start.
 * A diner who ticks "Text me when my order is ready" with a mobile typed has
 * the box kept on their order; the kitchen marks it ready, and the ready text
 * waits out the Undo, then ends as Adminium says, by its code: here
 * `not-set-up`, which the board says nothing of. Both doors hear that texts
 * are not set up, so the order page draws no box. The text goes to the
 * number typed on the order, so a diner already on file with no number of
 * their own is not refused for having none. An Undo within the wait drops
 * it, and a diner who left the box empty gets no text at all. While the
 * kitchen has switched its ready text off, nothing is queued even for a
 * ticked box.
 *
 * It runs with `CONTRACT=1` (see `install.contract.test.ts`); its servers
 * take their own port block (`CONTRACT_TEXTS_PORT_BASE`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import type { OrderBody, Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { textOutcome } from "../kitchen/textState.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { ENGINES, missing, ok, PORTS_PER_ENGINE, until, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_TEXTS_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 230);

const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const at = (time: string) => new Date(instantOf(TODAY, time, DEMO_ZONE)).toISOString();

describe.skipIf(why !== null)(`the ready text on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      let diner: AdminiumDiner;
      let settingsId: unknown;
      /** Each order's own retry key: a second order for the same diner is a new one. */
      let made = 0;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_texts_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
        diner = await stand.dinerOf();
        settingsId = (await stand.rows("settings"))[0]!.id;
      }, 300_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      const offer = async (on: boolean) => ok(await stand.staff.patch(`${stand.data("settings")}/${String(settingsId)}`, { values: { ready_text_on: on } }));

      /** A lemonade for a new diner, placed through the order page's door, then cooked to the edge of ready. */
      const placed = async (who: string, values: Record<string, unknown>): Promise<Row> => {
        const menu = await diner.menu();
        const lemonade = menu.items.find((d) => d["name"] === "Lemonade")!;
        const body: OrderBody = {
          values: { name: "Noor", email: `${who}.${engine}@juniper-diners.dev`, language: "en-US", pickup_at: at("12:30"), ...values },
          children: { order_items: [{ values: { menu_item_id: lemonade.id, qty: 1 } }] },
        };
        const quote = await diner.quote(body);
        const reply = await diner.place({ ...body, expect: { total: String(quote.data["total"]) } }, `texts-${who}-${String((made += 1))}-${engine}-0123456789abcdef`);
        for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"]] as const) await stand.kitchen.move(reply.data.id, from, to);
        return reply.data;
      };
      const texts = async (id: unknown) => (await stand.messagesOf(id)).filter((m) => m["kind"] === "order-ready-text");
      /** The text once its wait is over and Adminium has said how it ended. */
      const settled = (id: unknown) => until(async () => {
        const rows = await texts(id);
        return rows.length > 0 && rows.every((m) => m["status"] !== "queued") ? rows : undefined;
      }, "the ready text to end", 90_000);

      it("says on both doors that texts are not set up, so the order page draws no box", async () => {
        expect(await diner.textsReady()).toBe(false);
        expect(await stand.kitchen.textsReady()).toBe(false);
      }, 60_000);

      it("keeps the box on the order, holds the text for the Undo, and ends it as Adminium says: no provider here", async () => {
        await offer(true);
        const order = await placed("ticked", { phone: "+1 415 555 0134", texts_ok: true });
        expect((await stand.order(String(order["number"])))["texts_ok"]).toBeTruthy();
        await stand.kitchen.move(order.id, "preparing", "ready");
        // Queued at once, due when the Undo's wait is over.
        const [held] = await until(async () => {
          const rows = await texts(order.id);
          return rows.length > 0 ? rows : undefined;
        }, "the ready text queued");
        expect(held!["status"]).toBe("queued");
        expect(Date.parse(String(held!["due"])) - Date.parse(String((await stand.order(String(order["number"])))["ready_at"]))).toBeGreaterThanOrEqual(19_000);
        const [ended] = await settled(order.id);
        expect([ended!["status"], ended!["text_reason"]]).toEqual(["skipped", "not-set-up"]);
        // …which the board says nothing of: there is no text to speak of.
        const read = await stand.kitchen.order(order.id);
        expect(textOutcome(read.order, read.texts, { offered: true })).toBeNull();
      }, 180_000);

      it("drops the text when the Undo takes the ready back, so nothing is sent", async () => {
        await offer(true);
        const order = await placed("undone", { phone: "+1 415 555 0135", texts_ok: true });
        await stand.kitchen.move(order.id, "preparing", "ready");
        await stand.kitchen.move(order.id, "ready", "preparing");
        const [dropped] = await settled(order.id);
        expect([dropped!["status"], dropped!["skip_reason"]]).toEqual(["skipped", "no-longer-needed"]);
      }, 180_000);

      it("goes to the number typed on the order: a diner on file with no number of their own is not refused for it", async () => {
        await offer(true);
        // On file from an earlier order with no mobile: their account holds none.
        const first = await placed("returning", {});
        expect((await stand.rows("customers")).find((c) => c.id === first["customer_id"] || c["email"] === `returning.${engine}@juniper-diners.dev`)?.["phone"] ?? null).toBeNull();
        const again = await placed("returning", { phone: "+1 415 555 0138", texts_ok: true });
        await stand.kitchen.move(again.id, "preparing", "ready");
        const [ended] = await settled(again.id);
        // Read past the number: it stops only where nothing can go out here.
        expect([ended!["status"], ended!["text_reason"]]).toEqual(["skipped", "not-set-up"]);
      }, 180_000);

      it("queues no text for a diner who left the box empty, nor while the kitchen offers none", async () => {
        await offer(true);
        const empty = await placed("empty", { phone: "+1 415 555 0136" });
        await stand.kitchen.move(empty.id, "preparing", "ready");
        await offer(false);
        const off = await placed("off", { phone: "+1 415 555 0137", texts_ok: true });
        await stand.kitchen.move(off.id, "preparing", "ready");
        // The ready email of each is the proof the producers ran.
        await until(async () => ((await stand.messagesOf(off.id)).some((m) => m["kind"] === "order-ready") ? true : undefined), "the ready email queued");
        expect(await texts(empty.id)).toEqual([]);
        expect(await texts(off.id)).toEqual([]);
      }, 180_000);
    });
  });
});
