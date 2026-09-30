/**
 * THE KITCHEN AND THE ORDER PAGE, THROUGH THEIR REAL DOORS, ON EVERY ENGINE.
 *
 * The app's own doors — `AdminiumKitchen` over the operator's session,
 * `AdminiumDiner` over the kitchen's two browser keys — against a BUILT
 * Adminium with the app installed and its sample added at 11:40: what the
 * kitchen and a diner read is what the demo's Adminium answers at the same
 * moment, and every write the screens make is judged as the demo judges it
 * — the moves and their Undo, the cancel and its reason, a phone order and a
 * diner's order priced by Adminium, the retry key, the caps, the last place
 * and the last portion when two ask at once, and the sweep at closing.
 *
 * It runs with `CONTRACT=1` (see `install.contract.test.ts`); its servers take
 * the port block after that file's.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import type { AdminiumKitchen } from "../data/adminiumKitchen.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DemoAdminium } from "../demo/adminium.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { addDays, instantOf, venueDay } from "../lib/venueTime.ts";
import type { StaffConfig } from "../staffConnection.ts";
import { phoneRefusal } from "../state/kitchen.ts";
import { ENGINES, missing, ok, PORTS_PER_ENGINE, until, type Caller, type Engine, type Server } from "./harness.ts";
import { standUp } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
/** After `install.contract.test.ts`'s three servers. */
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 3 * PORTS_PER_ENGINE;

const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const TOMORROW = addDays(TODAY, 1);
const at = (time: string, day = TODAY) => new Date(instantOf(day, time, DEMO_ZONE)).toISOString();

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe.skipIf(why !== null)(`the doors on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let server: Server;
      let staff: Caller;
      let cfg: StaffConfig;
      let kitchen: AdminiumKitchen;
      let diner: AdminiumDiner;
      /** The demo's Adminium at 11:40: what the real one must agree with. */
      const demo = new DemoAdminium();
      /** Every save the order page made with no one signed in: the caps count them all. */
      let strangerSaves = 0;
      /** The diner who got the last Wild mushrooms: a real order, which emails are about (the sample's never are). */
      let mushroomWinner = 0;

      let data: (ref: string) => string;
      let rows: (ref: string) => Promise<Row[]>;
      let order: (number: string) => Promise<Row>;
      let messagesOf: (orderId: unknown) => Promise<Row[]>;
      const dish = async (name: string) => (await rows("menu_items")).find((d) => d["name"] === name)!;

      beforeAll(async () => {
        const stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_doors_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        ({ server, staff, cfg, kitchen, data, rows, order, messagesOf } = stand);
        diner = await stand.dinerOf();
        // Just before 11:40, where the demo stands: a time 20 minutes on is still one a diner may take.
        await server.setClock(DEMO_START - 30_000);
      }, 300_000);

      afterAll(async () => {
        await server?.stop();
      });

      // ── the order page ────────────────────────────────────────────────────

      it("reads the kitchen as the demo does: its words, its menu, the free times and the portions", async () => {
        const [settings, menu, slots, dishes] = await Promise.all([diner.settings(), diner.menu(), diner.slots(TODAY), diner.dishes(TODAY)]);
        expect(settings["venue_name"]).toBe("Juniper Kitchen");
        const shown = await demo.diner.menu();
        expect(menu.items.map((d) => [d["name"], Number(d["price"])])).toEqual(shown.items.map((d) => [d["name"], Number(d["price"])]));
        expect(slots).toEqual(await demo.diner.slots(TODAY));
        // A dish is named by its id, which is each Adminium's own: compare by name.
        const byName = async (answer: { id: string; state: string; left?: number }[], names: Map<string, string>) =>
          answer.map((d) => [names.get(d.id), d.state, d.left ?? null]).sort();
        const realNames = new Map(menu.items.map((d) => [String(d.id), String(d["name"])]));
        const demoNames = new Map(shown.items.map((d) => [String(d.id), String(d["name"])]));
        expect(await byName(dishes, realNames)).toEqual(await byName(await demo.diner.dishes(TODAY), demoNames));
        expect(dishes.find((d) => realNames.get(d.id) === "Wild mushroom")).toMatchObject({ state: "on", left: 2 });
      }, 60_000);

      it("refuses what the demo's Adminium refuses, in the same words", async () => {
        const [menu, shown] = await Promise.all([diner.menu(), demo.diner.menu()]);
        /** A cart by dish names, in each Adminium's own ids. */
        const cart = (m: typeof menu, lines: [string, number, string?][], time: string | null): OrderBody => ({
          values: { name: "Pat", email: "pat@mail.example", language: "en-US", ...(time === null ? {} : { pickup_at: at(time) }) },
          children: { order_items: lines.map(([name, qty, note]) => ({ values: { menu_item_id: m.items.find((d) => d["name"] === name)!.id, qty, ...(note === undefined ? {} : { note }) } })) },
        });
        const cases: [string, [string, number, string?][], string | null][] = [
          ["no time", [["Lemonade", 1]], null],
          ["a paused time", [["Lemonade", 1]], "13:00"],
          ["too soon", [["Lemonade", 1]], "11:45"],
          ["too many of a dish", [["Lemonade", 21]], "12:30"],
          ["more than an order holds", [["Lemonade", 20], ["Margherita", 20]], "12:30"],
          ["a note with more digits than a note holds", [["Lemonade", 1, "2 straws, 12345"]], "12:30"],
          ["a note with an address", [["Lemonade", 1, "see evil.com"]], "12:30"],
        ];
        for (const [what, lines, time] of cases) {
          const real = await refusal(diner.quote(cart(menu, lines, time)));
          const played = await refusal(demo.diner.quote(cart(shown, lines, time)));
          expect([played.status, played.code, played.params], what).toEqual([real.status, real.code, real.params]);
        }
        // A note's few digits and the diner's own punctuation pass on both (Adminium 0.3.8).
        for (const note of ["2 straws", "少放辣，切六块", "¡Sin cebolla!"]) {
          const real = await diner.quote(cart(menu, [["Lemonade", 1, note]], "12:30"));
          const played = await demo.diner.quote(cart(shown, [["Lemonade", 1, note]], "12:30"));
          expect([note, Number(played.data["total"])]).toEqual([note, Number(real.data["total"])]);
        }
      }, 60_000);

      /** Kwame's cart, by this Adminium's ids. */
      const kwame = async (values: Record<string, unknown> = {}): Promise<OrderBody> => {
        const menu = await diner.menu();
        const bowl = menu.items.find((d) => d["name"] === "Signature grain bowl")!;
        const cookie = menu.items.find((d) => d["name"] === "Brown butter cookie")!;
        const groups = menu.groups.filter((g) => g["item_id"] === bowl.id).map((g) => g.id);
        const option = (name: string) => menu.options.find((o) => o["name"] === name && groups.includes(o["group_id"] as number))!.id;
        return {
          values: { name: "Kwame", email: "kwame.b@mail.example", phone: "(555) 019-2205", language: "en-US", pickup_at: at("12:30"), ...values },
          children: {
            order_items: [
              { values: { menu_item_id: bowl.id, qty: 1 }, children: { order_item_modifiers: ["Farro", "Grilled chicken", "Avocado"].map((n) => ({ values: { modifier_id: option(n) } })) } },
              { values: { menu_item_id: cookie.id, qty: 1 } },
            ],
          },
        };
      };

      it("prices an order only on a time it could hold, at the demo's figures", async () => {
        const noTime = await kwame({ pickup_at: undefined });
        delete noTime.values["pickup_at"];
        const error = await refusal(diner.quote(noTime));
        expect([error.status, error.code, error.params]).toEqual([400, "PUBLIC_WRITE_REFUSED", {}]);
        const quote = await diner.quote(await kwame());
        expect([Number(quote.data["subtotal"]), Number(quote.data["tax"]), Number(quote.data["total"])]).toEqual([21.5, 1.77, 23.27]);
      }, 60_000);

      let placed: { id: number; number: string };
      it("places Kwame's order once — the price shown, the retry key — and follows it by its own link", async () => {
        const body = { ...(await kwame()), expect: { total: "23.27" } };
        const key = "kwame-0123456789abcdefghij";
        const first = await diner.place(body, key);
        strangerSaves += 1;
        // A real kitchen numbers its own orders from the first number in Settings, never the sample's.
        expect([first.data["number"], Number(first.data["total"]), first.link?.key]).toEqual(["1001", 23.27, "link"]);
        const again = await diner.place(body, key);
        expect([again.data.id, again.replayed, again.link]).toEqual([first.data.id, true, undefined]);
        const followed = await diner.linkedOrder();
        expect([followed.order["number"], followed.order["status"], followed.lines.length]).toEqual(["1001", "placed", 2]);
        placed = { id: first.data.id, number: "1001" };
        const mail = await messagesOf(first.data.id);
        expect(mail.map((m) => m["kind"])).toEqual(["order-confirmation"]);
      }, 60_000);

      it("lets the diner cancel it through its link while it is new, and tells them why, once", async () => {
        const cancelled = await diner.cancelLinked(placed.id);
        expect([cancelled["status"], cancelled["cancel_code"]]).toEqual(["cancelled", "self"]);
        expect((await refusal(diner.cancelLinked(placed.id))).status).toBe(404);
        await until(async () => ((await messagesOf(placed.id)).some((m) => m["kind"] === "order-cancelled-by-you") ? true : undefined), "the cancelled-by-you email");
        expect((await messagesOf(placed.id)).filter((m) => m["kind"] === "order-cancelled-by-you")).toHaveLength(1);
      }, 150_000);

      it("writes nothing when the price moved since the diner saw it", async () => {
        const cookie = await dish("Brown butter cookie");
        ok(await staff.patch(`${data("menu_items")}/${String(cookie.id)}`, { values: { price: (Number(cookie["price"]) + 0.5).toFixed(2) } }));
        const error = await refusal(diner.place({ ...(await kwame({ pickup_at: at("12:45") })), expect: { total: "23.27" } }, "moved-0123456789abcdefghij"));
        strangerSaves += 1;
        // $22.00 and its tax, 8.25 % rounded once, half up: $1.82.
        expect([error.status, error.code, Number(error.params["total"])]).toEqual([409, "PUBLIC_PRICE_CHANGED", 23.82]);
        const lines = (error.params["lines"] as { order_items: { data: Row }[] }).order_items;
        expect(lines.map((l) => Number(l.data["unit_total"]))).toEqual([18, 4]);
        ok(await staff.patch(`${data("menu_items")}/${String(cookie.id)}`, { values: { price: cookie["price"] } }));
      }, 60_000);

      it("sells the last two Wild mushrooms to one of two diners asking at once", async () => {
        const menu = await diner.menu();
        const mushroom = menu.items.find((d) => d["name"] === "Wild mushroom")!;
        const ask = (who: string) =>
          diner.place({ values: { name: who, email: `${who.toLowerCase()}@mail.example`, language: "en-US", pickup_at: at("13:15") }, children: { order_items: [{ values: { menu_item_id: mushroom.id, qty: 2 } }] } }, `${who}-mushroom-0123456789abcdef`);
        const settled = await Promise.allSettled([ask("Ada"), ask("Ben")]);
        strangerSaves += 2;
        expect(settled.map((s) => s.status).sort()).toEqual(["fulfilled", "rejected"]);
        const lost = (settled.find((s) => s.status === "rejected") as PromiseRejectedResult).reason as ApiError;
        expect([lost.code, lost.params["column"], lost.params["path"]]).toEqual(["PUBLIC_SOLD_OUT", "menu_item_id", ["order_items", 0]]);
        mushroomWinner = (settled.find((s) => s.status === "fulfilled") as PromiseFulfilledResult<{ data: Row }>).value.data.id;
        expect((await diner.dishes(TODAY)).find((d) => d.id === String(mushroom.id))!.state).toBe("soldout");
      }, 60_000);

      // ── the kitchen ───────────────────────────────────────────────────────

      it("reads the board as the demo does: the orders, what each slot holds, what each dish has sold", async () => {
        const board = await kitchen.orders(TODAY, TODAY);
        const shown = await demo.kitchen.orders(TODAY, TODAY);
        const strip = (n: string) => n.replace(/^S/, "");
        const sampleOnly = board.filter((o) => String(o.order["number"]).startsWith("S"));
        // A past pickup is "so long ago": read to the minute (the sample went in a few seconds before 11:40).
        const minute = (iso: unknown) => new Date(Math.round(Date.parse(String(iso)) / 60_000) * 60_000).toISOString();
        const view = (list: typeof board, number: (o: (typeof board)[number]) => string) =>
          list.map((o) => [number(o), o.order["status"], minute(o.order["pickup_at"]), Number(o.order["total"])]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        expect(view(sampleOnly, (o) => strip(String(o.order["number"])))).toEqual(view(shown, (o) => String(o.order["number"])));
        const counts = await kitchen.slotCounts(TOMORROW);
        expect(counts.map((c) => [c.time, c.taken, c.size, c.pause === null])).toEqual((await demo.kitchen.slotCounts(TOMORROW)).map((c) => [c.time, c.taken, c.size, c.pause === null]));
        expect((await kitchen.me()).name).not.toBe("");
      }, 60_000);

      it("takes a phone order once, at the price the screen showed, and confirms it", async () => {
        const menu = await kitchen.menu();
        const margherita = menu.items.find((d) => d["name"] === "Margherita")!;
        const body: OrderBody = { values: { name: "Grace T.", phone: "(555) 014-2290", pickup_at: at("14:00") }, children: { order_items: [{ values: { menu_item_id: margherita.id, qty: 2 } }] } };
        const quote = await kitchen.phoneQuote({ ...body, values: { pickup_at: at("14:00") } });
        const total = Number(quote.data["total"]).toFixed(2);
        const wrong = await refusal(kitchen.phoneOrder({ ...body, expect: { total: "1.00" } }, "grace-wrong-0123456789abcdef"));
        expect([wrong.code, phoneRefusal(wrong), wrong.params["total"]]).toEqual(["PRICE_CHANGED", "price", total]);
        const key = "grace-0123456789abcdefghij";
        const first = await kitchen.phoneOrder({ ...body, expect: { total } }, key);
        const again = await kitchen.phoneOrder({ ...body, expect: { total } }, key);
        expect([again.data.id, again.replayed]).toEqual([first.data.id, true]);
        const confirmed = await kitchen.move(first.data.id, "placed", "confirmed");
        expect([confirmed["status"], confirmed["channel"], confirmed["confirmed_by"]]).toEqual(["confirmed", "phone", cfg.user!.name]);
      }, 60_000);

      it("moves an order on and takes it back within the minute; names who got there first; refuses a stale tablet", async () => {
        const o = await order("S2116");
        const on = await kitchen.move(o.id as number, "placed", "confirmed");
        expect(on["confirmed_at"]).not.toBeNull();
        // The second screen's same tap: already done, by whom and when.
        const repeat = await refusal(kitchen.move(o.id as number, "placed", "confirmed"));
        expect([repeat.code, repeat.params["state"], repeat.params["by"]]).toEqual(["STATE_UNCHANGED", "confirmed", cfg.user!.name]);
        expect(Date.parse(String(repeat.params["at"]))).toBeGreaterThan(0);
        const stale = await refusal(kitchen.move(o.id as number, "preparing", "ready"));
        expect([stale.code, stale.params["from"]]).toEqual(["STATE_MOVE_REFUSED", "confirmed"]);
        const back = await kitchen.move(o.id as number, "confirmed", "placed");
        expect([back["status"], back["confirmed_at"], back["confirmed_by"]]).toEqual(["placed", null, null]);
        // Two minutes later, a move is no longer taken back.
        await kitchen.move(o.id as number, "placed", "confirmed");
        const later = (await staff.get<{ now?: string }>("/apps/ordering/staff/surface-config.json")).body.now;
        await server.setClock(Date.parse(String(later)) + 2 * 60_000);
        const late = await refusal(kitchen.move(o.id as number, "confirmed", "placed"));
        expect([late.code, late.params["requires"]]).toEqual(["STATE_MOVE_REFUSED", "time"]);
      }, 60_000);

      it("cancels only with its reason, and tells a real order's diner why", async () => {
        const o = await order("S2117");
        const bare = await staff.patch(`${data("orders")}/${String(o.id)}`, { values: { status: "cancelled" }, from: "placed" });
        expect([bare.status, bare.code, bare.details["requires"]]).toEqual([409, "STATE_MOVE_REFUSED", "cancel_code"]);
        await kitchen.cancel(o.id as number, "placed", "too_busy", null, null);
        // The sample's orders are sample data: no email is ever about one. A real order's diner is told why.
        expect((await messagesOf(o.id)).filter((m) => String(m["kind"]).startsWith("order-cancelled"))).toEqual([]);
        const menu = await kitchen.menu();
        const taken = await kitchen.phoneOrder(
          { values: { name: "Hal P.", phone: "(555) 011-2233", email: "hal.p@mail.example", pickup_at: at("14:15") }, children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] } },
          "hal-0123456789abcdefghijkl",
        );
        await kitchen.cancel(taken.data.id, "placed", "too_busy", null, null);
        await until(async () => ((await messagesOf(taken.data.id)).some((m) => m["kind"] === "order-cancelled-too-busy") ? true : undefined), "the too-busy email");
        expect((await messagesOf(taken.data.id)).map((m) => m["kind"]).sort()).toEqual(["order-cancelled-too-busy", "order-confirmation-phone"]);
      }, 150_000);

      it("hands an order over paid, and queues no receipt without Invoices & Receipts", async () => {
        // A real order (a sample one is never emailed about at all), with an address to email.
        const menu = await kitchen.menu();
        const made = await kitchen.phoneOrder(
          { values: { name: "Una V.", phone: "(555) 015-6677", email: "una.v@mail.example", pickup_at: at("14:30") }, children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] } },
          "una-0123456789abcdefghijkl",
        );
        const id = made.data.id;
        for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"], ["preparing", "ready"]] as const) await kitchen.move(id, from, to);
        const handed = await kitchen.handOff(id, "cash");
        expect([handed["status"], handed["paid_method"], handed["picked_up_by"]]).toEqual(["picked_up", "cash", cfg.user!.name]);
        const kinds = (await messagesOf(id)).map((m) => m["kind"]);
        expect(kinds).toContain("order-ready");
        expect(kinds).not.toContain("order-receipt");
      }, 60_000);

      it("takes back a hand-over unpaid, and nothing else of a finished order opens", async () => {
        const shelf = await order("S2113");
        await kitchen.handOff(shelf.id as number, "cash");
        const path = `${data("orders")}/${String(shelf.id)}`;
        // The take-back empties how it was paid: a way sent with it is refused, never written.
        const paid = await staff.patch(path, { values: { status: "ready", paid_method: "card" }, from: "picked_up" });
        expect([paid.status, paid.code, paid.details["clears"]]).toEqual([409, "STATE_MOVE_REFUSED", "paid_method"]);
        // Nothing else of it opens: a note is locked, and a stamp written by hand is not taken (the move's alone empties it).
        const note = await staff.patch(path, { values: { note: "changed" } });
        expect([note.status, note.code, note.details["column"]]).toEqual([409, "RECORD_LOCKED", "note"]);
        const handed = (await rows("orders")).find((r) => r.id === shelf.id)!;
        await staff.patch(path, { values: { picked_up_at: null, picked_up_by: "Someone else" } });
        const kept = (await rows("orders")).find((r) => r.id === shelf.id)!;
        expect([kept["picked_up_at"], kept["picked_up_by"]]).toEqual([handed["picked_up_at"], handed["picked_up_by"]]);
        const back = await kitchen.move(shelf.id as number, "picked_up", "ready");
        expect([back["status"], back["paid_method"], back["picked_up_at"], back["picked_up_by"]]).toEqual(["ready", null, null, null]);
        expect((await messagesOf(shelf.id)).filter((m) => m["kind"] === "order-receipt")).toEqual([]);
      }, 150_000);

      it("takes back the ready email with the Undo, and sends the next one", async () => {
        const id = mushroomWinner;
        for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"], ["preparing", "ready"]] as const) await kitchen.move(id, from, to);
        await kitchen.move(id, "ready", "preparing");
        await until(async () => ((await messagesOf(id)).some((m) => m["kind"] === "order-ready" && m["status"] === "skipped") ? true : undefined), "the ready email dropped", 150_000);
        await kitchen.move(id, "preparing", "ready");
        const ready = (await messagesOf(id)).filter((m) => m["kind"] === "order-ready");
        expect(ready.map((m) => m["status"]).sort()).toEqual(["queued", "skipped"]);
      }, 200_000);

      it("pauses a time for the order page, and opens it again", async () => {
        const time = "15:30";
        const pause = await kitchen.pause(at(time, TOMORROW));
        expect((await diner.slots(TOMORROW)).find((s) => s.time === time)!.state).toBe("paused");
        expect((await kitchen.slotCounts(TOMORROW)).find((s) => s.time === time)!.pause).toEqual({ id: pause.id, by: cfg.user!.name });
        await kitchen.reopen(pause.id);
        expect((await diner.slots(TOMORROW)).find((s) => s.time === time)!.state).toBe("free");
      }, 60_000);

      it("switches a dish off the order page, and sells one out for today: the page and the phone say so", async () => {
        const menu = await kitchen.menu();
        const soup = menu.items.find((d) => d["name"] === "Tomato & fennel soup")!;
        await kitchen.setDish(soup.id, { available: false });
        expect((await diner.menu()).items.some((d) => d.id === soup.id)).toBe(false);
        await kitchen.setDish(soup.id, { available: true });
        const salad = menu.items.find((d) => d["name"] === "Little gem salad")!;
        // "Sold out" is none left today, whatever was ordered.
        await kitchen.setDish(salad.id, { stock_today: 0, stock_on: TODAY });
        expect((await diner.dishes(TODAY)).find((d) => d.id === String(salad.id))).toMatchObject({ state: "soldout", left: 0 });
        const refused = await refusal(kitchen.phoneOrder({ values: { name: "Jo", phone: "(555) 010-1111", pickup_at: at("15:00") }, children: { order_items: [{ values: { menu_item_id: salad.id, qty: 1 } }] } }, "jo-salad-0123456789abcdef"));
        expect([refused.code, phoneRefusal(refused), refused.params["pool"]]).toEqual(["CAPACITY_FULL", "soldout", { key: String(salad.id), at: TODAY }]);
        // Tomorrow it sells.
        expect((await diner.dishes(TOMORROW)).find((d) => d.id === String(salad.id))!.state).toBe("on");
      }, 60_000);

      it("stops online orders for today, one pause a time, and leaves tomorrow open", async () => {
        const counts = await kitchen.slotCounts(TODAY);
        const now = Date.parse(String((await staff.get<{ now: string }>("/apps/ordering/staff/surface-config.json")).body.now));
        const left = counts.filter((c) => Date.parse(c.at) > now && c.pause === null);
        for (const slot of left) await kitchen.pause(slot.at);
        expect((await diner.slots(TODAY)).filter((s) => s.state === "free")).toEqual([]);
        expect((await diner.slots(TOMORROW)).some((s) => s.state === "free")).toBe(true);
        // Taking orders again: every pause of today reopened.
        for (const slot of await kitchen.slotCounts(TODAY)) if (slot.pause !== null && Date.parse(slot.at) > now) await kitchen.reopen(slot.pause.id);
        expect((await diner.slots(TODAY)).some((s) => s.state === "free")).toBe(true);
      }, 120_000);

      it("takes the last place of a time for one of two phone orders at once, and numbers every order without a gap", async () => {
        const menu = await kitchen.menu();
        const lemonade = menu.items.find((d) => d["name"] === "Lemonade")!;
        const phone = (name: string, time: string) => kitchen.phoneOrder({ values: { name, phone: "(555) 010-0000", pickup_at: at(time, TOMORROW) }, children: { order_items: [{ values: { menu_item_id: lemonade.id, qty: 1 } }] } }, `${name}-${time}-0123456789abcdef`.replace(":", ""));
        for (const name of ["A", "B", "C", "D", "E"]) await phone(name, "16:00");
        const settled = await Promise.allSettled([phone("F", "16:00"), phone("G", "16:00")]);
        expect(settled.map((s) => s.status).sort()).toEqual(["fulfilled", "rejected"]);
        const lost = (settled.find((s) => s.status === "rejected") as PromiseRejectedResult).reason as ApiError;
        expect([lost.code, lost.params["kind"], phoneRefusal(lost)]).toEqual(["CAPACITY_FULL", "slot", "slot"]);
        const many = await Promise.all(["H", "I", "J", "K", "L", "M"].map((n, i) => phone(n, ["17:00", "17:15", "17:30", "17:45", "18:00", "18:15"][i]!)));
        const numbers = (await rows("orders")).map((o) => String(o["number"])).filter((n) => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b);
        expect(numbers).toEqual(numbers.map((_, i) => 1001 + i));
        expect(many).toHaveLength(6);
      }, 120_000);

      it("caps what one stranger may send in an hour: the eleventh save is refused, refused ones counted", async () => {
        for (let i = strangerSaves; i < 10; i += 1) {
          await diner.place({ ...(await kwame({ email: `cap${String(i)}@mail.example`, pickup_at: at("19:00", TOMORROW) })) }, `cap-${String(i)}-0123456789abcdef`);
        }
        const error = await refusal(diner.place(await kwame({ email: "cap-last@mail.example", pickup_at: at("19:15", TOMORROW) }), "cap-last-0123456789abcdef"));
        expect([error.status, error.code]).toEqual([409, "PUBLIC_LIMIT_REACHED"]);
      }, 120_000);

      // ── closing ───────────────────────────────────────────────────────────

      it("marks the ready order not collected at closing, and cancels what was never finished half an hour on", async () => {
        // A real order still new at closing, whose diner is told why when it goes; the Wild mushroom winner is on the shelf.
        const menu = await kitchen.menu();
        const late = await kitchen.phoneOrder(
          { values: { name: "Ivy Q.", phone: "(555) 012-3344", email: "ivy.q@mail.example", pickup_at: at("20:45") }, children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] } },
          "ivy-0123456789abcdefghijkl",
        );
        await server.setClock(instantOf(TODAY, "21:00", DEMO_ZONE) + 5_000);
        await until(async () => ((await rows("orders")).find((o) => o.id === mushroomWinner)?.["status"] === "not_collected" ? true : undefined), "the closing sweep", 180_000);
        expect((await order("S2116"))["status"]).not.toBe("cancelled");
        await server.setClock(instantOf(TODAY, "21:30", DEMO_ZONE) + 5_000);
        await until(async () => ((await order("S2116"))["status"] === "cancelled" ? true : undefined), "the half-hour sweep", 180_000);
        const swept = await order("S2116");
        expect(swept["cancel_code"]).toBe("closed");
        await until(async () => ((await messagesOf(late.data.id)).some((m) => m["kind"] === "order-cancelled-closed") ? true : undefined), "the closed email", 150_000);
        // Tomorrow's pre-order is not today's to sweep.
        expect((await order("S2107"))["status"]).toBe("placed");
      }, 400_000);
    });
  });
});
