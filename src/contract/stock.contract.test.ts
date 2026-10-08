/**
 * DISHES RUN OUT WITH THEIR INGREDIENTS, ON A BUILT ADMINIUM.
 *
 * The app installed with Inventory ticked and Inventory's own sample in. A
 * dish is linked to a stock item as its owner links one (a row of Inventory's
 * links, naming the dish by the app's table as Adminium stores it). Then,
 * through the app's own doors: the item is held when an order is placed,
 * taken when the kitchen starts cooking, and let go when the order is
 * cancelled before that; an order for more than is in is refused naming its
 * line; and the page is told "out", "low" or nothing, as Inventory words it.
 *
 * "Portions today" is untouched: it is the kitchen's own count of a dish, a
 * second and separate check, and the first cases here run with none set.
 *
 * It runs with `CONTRACT=1` where the built add-on is; its servers take the
 * ports after `handover.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { ENGINES, missing, missingAddOn, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { phoneRefusal } from "../state/kitchen.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing() ?? missingAddOn("inventory");
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_STOCK_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 110);

const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const at = (time: string) => new Date(instantOf(TODAY, time, DEMO_ZONE)).toISOString();

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe.skipIf(why !== null)(`dishes run out with their ingredients${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      /** The dish, the item it is made of, and the stock point the item is taken from. */
      let dish: Row;
      let item: Row;
      let point: Row;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_stock_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { addOns: ["inventory"], addOnSamples: ["inventory"] });
        await stand.server.setClock(DEMO_START - 30_000);
      }, 400_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      const inv = async (table: string): Promise<Row[]> => {
        const out: Row[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = ok(await stand.staff.get<{ data: Row[] }>(`${stand.data(`inventory_${table}`)}?limit=200&offset=${String(offset)}`)).data;
          out.push(...page);
          if (page.length < 200) return out;
        }
      };
      const stock = async () => {
        const now = (await inv("stock_points")).find((one) => one.id === point.id)!;
        return [Number(now["on_hand"]), Number(now["reserved"] ?? 0), Number(now["available"])];
      };
      const order = async (_diner: AdminiumDiner, who: string, time: string, qty: number): Promise<OrderBody> => ({
        values: { language: "en-US", name: who, email: `${who.toLowerCase()}.${engine}@juniper-diners.dev`, pickup_at: at(time) },
        children: { order_items: [{ values: { menu_item_id: dish.id, qty } }] },
      });
      const place = async (who: string, time: string, qty: number): Promise<number> => {
        const diner = await stand.dinerOf();
        const body = await order(diner, who, time, qty);
        const quote = await diner.quote(body);
        return (await diner.place({ ...body, expect: { total: Number(quote.data["total"]).toFixed(2) } }, `${who}-${engine}-0123456789abcdefgh`)).data.id;
      };

      it("the owner links a dish to the item it is made of", async () => {
        dish = (await stand.rows("menu_items")).find((one) => one["name"] === "Lemonade")!;
        // An item with plenty on a shelf, and that shelf named on the link: where this dish's ingredient is taken from.
        const points = await inv("stock_points");
        point = points.filter((one) => Number(one["available"]) >= 8 && Number(one["available"]) <= 60).sort((a, b) => Number(a["available"]) - Number(b["available"]))[0]!;
        expect(point, `a stock point with eight or more: ${JSON.stringify(points.slice(0, 3))}`).toBeDefined();
        item = (await inv("items")).find((one) => one.id === point["item_id"])!;
        ok(await stand.staff.post(stand.data("inventory_links"), { values: { source_table: "ordering:menu_items", source_row: String(dish.id), kind: "item", item_id: item.id, qty: "1", place_id: point["place_id"] } }), 201);
      }, 60_000);

      let held = 0;
      it("held when the order is placed, taken when the kitchen starts, and nothing more at the hand-over", async () => {
        const [onHand, reserved, free] = await stock();
        held = await place("Ana", "12:30", 2);
        expect(await stock()).toEqual([onHand, reserved + 2, free - 2]);
        await stand.kitchen.move(held, "placed", "confirmed");
        expect(await stock()).toEqual([onHand, reserved + 2, free - 2]);
        await stand.kitchen.move(held, "confirmed", "preparing");
        // Cooking: it is off the shelf, and no longer only promised.
        expect(await stock()).toEqual([onHand - 2, reserved, free - 2]);
        await stand.kitchen.move(held, "preparing", "ready");
        await stand.kitchen.handOff(held, "cash");
        expect(await stock()).toEqual([onHand - 2, reserved, free - 2]);
      }, 180_000);

      it("let go when the order is cancelled before the kitchen starts", async () => {
        const before = await stock();
        const id = await place("Ben", "12:45", 3);
        expect(await stock()).toEqual([before[0], before[1]! + 3, before[2]! - 3]);
        await stand.kitchen.cancel(id, "placed", "customer_asked", null, null);
        expect(await stock()).toEqual(before);
      }, 180_000);

      it("more than is in is refused, naming the line; what is in is still sold", async () => {
        const [, , free] = await stock();
        const diner = await stand.dinerOf();
        const tooMany = await order(diner, "Cy", "13:15", free! + 1 > 20 ? 20 : free! + 1);
        if (free! + 1 <= 20) {
          const error = await refusal(diner.place(tooMany, `cy-${engine}-0123456789abcdefgh`));
          expect([error.status, error.code]).toEqual([409, "PUBLIC_OUT_OF_STOCK"]);
          expect(error.params["index"] ?? (error.params["path"] as unknown[] | undefined)?.[1]).toBe(0);
          expect(await stock()).toEqual([expect.any(Number), expect.any(Number), free]);
        }
        expect(await place("Di", "13:30", 1)).toBeGreaterThan(0);
      }, 180_000);

      it("a phone order for more than is in is refused at the kitchen's door where the owner said staff stop too, and the screen says the dish ran out", async () => {
        const [, , free] = await stock();
        if (free! + 1 > 20) return;
        // Inventory lets staff sell past what is in unless its owner says stop: here the owner says stop.
        const settings = (await inv("settings"))[0]!;
        ok(await stand.staff.patch(`${stand.data("inventory_settings")}/${String(settings.id)}`, { values: { when_out_staff: "stop" } }));
        const body = { values: { language: "en-US", name: "Fay", phone: "+1 555 0100", pickup_at: at("13:45") }, children: { order_items: [{ values: { menu_item_id: dish.id, qty: free! + 1 } }] } } as OrderBody;
        const error = await refusal(stand.kitchen.phoneOrder(body, `fay-${engine}-0123456789abcdefgh`));
        expect([error.code, error.params["family"]]).toEqual(["POSTING_REFUSED", "stock"]);
        expect(phoneRefusal(error)).toBe("soldout");
        expect((await stock())[2]).toBe(free);
        ok(await stand.staff.patch(`${stand.data("inventory_settings")}/${String(settings.id)}`, { values: { when_out_staff: settings["when_out_staff"] ?? "allow" } }));
      }, 120_000);

      it("the kitchen is told the figure itself, and that it is the ingredient that counts", async () => {
        const [, , free] = await stock();
        const other = (await stand.rows("menu_items")).find((one) => one["name"] === "Margherita")!;
        const words = Object.fromEntries((await stand.kitchen.stockWords([dish.id, other.id])).map((one) => [one.id, one]));
        expect([words[String(dish.id)]?.exact, words[String(dish.id)]?.cause]).toEqual([free, "stock"]);
        // A dish linked to nothing is in, with no figure to tell.
        expect([words[String(other.id)]?.state ?? "in", words[String(other.id)]?.exact]).toEqual(["in", undefined]);
      }, 60_000);

      it("cancelled once the kitchen has started: what was cooked is not put back", async () => {
        const id = await place("Gil", "14:15", 1);
        await stand.kitchen.move(id, "placed", "confirmed");
        await stand.kitchen.move(id, "confirmed", "preparing");
        const cooking = await stock();
        await stand.kitchen.cancel(id, "preparing", "too_busy", null, null);
        expect(await stock()).toEqual(cooking);
      }, 180_000);

      it("a dish added to a placed order is held in its own save; added once the kitchen has started, it is taken at once", async () => {
        const other = (await stand.rows("menu_items")).find((one) => one["name"] === "Margherita")!;
        const add = (order: number) => stand.staff.post<{ data: Row }>(stand.data("order_items"), { values: { order_id: order, menu_item_id: dish.id, qty: 1 } });
        // An order of something else, so the dish's only line is the one added.
        const diner = await stand.dinerOf();
        const body: OrderBody = { values: { language: "en-US", name: "Hal", email: `hal.${engine}@juniper-diners.dev`, pickup_at: at("14:30") }, children: { order_items: [{ values: { menu_item_id: other.id, qty: 1 } }] } };
        const quote = await diner.quote(body);
        const id = (await diner.place({ ...body, expect: { total: Number(quote.data["total"]).toFixed(2) } }, `hal-${engine}-0123456789abcdefgh`)).data.id;
        const before = await stock();
        const held = await add(id);
        expect(held.status, JSON.stringify(held.body).slice(0, 500)).toBe(201);
        expect(await stock()).toEqual([before[0], before[1]! + 1, before[2]! - 1]);
        await stand.kitchen.move(id, "placed", "confirmed");
        await stand.kitchen.move(id, "confirmed", "preparing");
        expect(await stock()).toEqual([before[0]! - 1, before[1], before[2]! - 1]);
        // Cooking already: one more is off the shelf with the save that adds it.
        const late = await add(id);
        expect(late.status, JSON.stringify(late.body).slice(0, 500)).toBe(201);
        expect(await stock()).toEqual([before[0]! - 2, before[1], before[2]! - 2]);
      }, 180_000);

      it("Inventory switched off for the app: orders are still placed, and nothing is held", async () => {
        ok(await stand.staff.patch("/api/v1/add-ons/inventory", { attachedTo: "ordering", enabled: false }));
        const before = await stock();
        const diner = await stand.dinerOf();
        expect((await diner.stock([dish.id])).every((one) => one.state === "in")).toBe(true);
        expect(await place("Ivy", "14:45", 2)).toBeGreaterThan(0);
        expect(await stock()).toEqual(before);
        ok(await stand.staff.patch("/api/v1/add-ons/inventory", { attachedTo: "ordering", enabled: true }));
      }, 180_000);

      it("the page is told what Inventory says of a dish — in, or low — and of a dish linked to nothing, that it is in", async () => {
        const diner = await stand.dinerOf();
        const other = (await stand.rows("menu_items")).find((one) => one["name"] === "Margherita")!;
        const words = await diner.stock([dish.id, other.id]);
        const said = Object.fromEntries(words.map((one) => [one.id, one.state]));
        // Some are in: "in", or "low" where the shelf is near the level its owner reorders at. Never "out" while one can be sold.
        expect(["in", "low"]).toContain(said[String(dish.id)]);
        expect(said[String(other.id)] ?? "in").toBe("in");
        // How many are left is told only as Inventory's owner set it; here nothing was set.
        expect(words.every((one) => one.left === undefined || Number.isFinite(one.left))).toBe(true);
      }, 60_000);
    });
  });
});
