/**
 * THE OVERVIEW'S FIGURES, AS THE DASHBOARD READS THEM, ON EVERY ENGINE.
 *
 * The app installed on a BUILT Adminium and its sample added at 11:40; the
 * Overview page read back as the install wrote it, and every card's binding
 * asked of the server in one batch, as the dashboard asks: the figures the
 * design shows at 11:40 on Tuesday 28 July — today, the last 7 days, each
 * pickup time's orders from the slot limit itself, the next orders on the
 * board, what needs a person, orders and money by day, the portions of
 * today's dishes, the hours people pick up at and the dishes ordered most,
 * the tie for fifth place going by name. Then the kitchen finishes the day
 * as the demo's "After closing" does, and at 9:05 PM the day's figures are
 * the design's after-hours ones.
 *
 * It runs with `CONTRACT=1` (see `install.contract.test.ts`); its servers take
 * the port block after `emails.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { ENGINES, missing, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
/** After `emails.contract.test.ts`'s servers. */
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 12 * PORTS_PER_ENGINE;

const TODAY = venueDay(DEMO_START, DEMO_ZONE);

type Json = Record<string, unknown>;
interface Item {
  i: string;
  widget: string;
  config: { binding?: Json };
}

/** The layout somewhere in a page's envelope. */
function layoutIn(value: unknown): { items: Item[] } | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as Json;
  if (Array.isArray(v["items"]) && (v["items"] as unknown[]).every((item) => typeof (item as Json)["widget"] === "string")) return v as unknown as { items: Item[] };
  for (const child of Object.values(v)) {
    const found = layoutIn(child);
    if (found !== null) return found;
  }
  return null;
}

const cents = (value: unknown) => Math.round(Number(value) * 100) / 100;

describe.skipIf(why !== null)(`the Overview on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      let items: Item[] = [];

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_overview_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        const pages = ok(await stand.staff.get<{ data: { id: string; slug: string }[] }>("/api/v1/pages")).data;
        const page = pages.find((p) => p.slug === "ordering-overview");
        if (page === undefined) throw new Error(`no Overview page among ${pages.map((p) => p.slug).join(", ")}`);
        const layout = layoutIn(ok(await stand.staff.get(`/api/v1/pages/${page.id}`)));
        if (layout === null) throw new Error("the Overview page has no layout");
        items = layout.items;
      }, 300_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** Every card with a binding, asked in one batch as the dashboard asks; each answer by card. */
      const read = async (): Promise<Record<string, Json>> => {
        const requests = items.filter((item) => item.config.binding !== undefined).map((item) => ({ instanceId: item.i, descriptor: item.config.binding }));
        const reply = ok(await stand.staff.post<{ results: Record<string, { ok: boolean; result?: Json; error?: Json }> }>("/api/v1/widget-data/batch", { requests }));
        const out: Record<string, Json> = {};
        for (const [id, answer] of Object.entries(reply.results)) {
          if (!answer.ok) throw new Error(`card ${id} refused: ${JSON.stringify(answer.error)}`);
          out[id] = answer.result!;
        }
        return out;
      };
      const value = (answer: Json | undefined) => Number(answer?.["value"] ?? 0);
      /** A list's rows, a ranking's or a count's items. */
      const rowsOf = (answer: Json | undefined) => (answer?.["rows"] ?? answer?.["items"]) as Json[];
      /** A chart over time: each bucket's figure. */
      const pointsOf = (answer: Json | undefined) => (answer?.["points"] as { t: unknown; v: unknown }[]).map((p) => cents(p.v));

      let at1140: Record<string, Json> = {};
      it("answers every card at 11:40, as the design's figures", async () => {
        await stand.server.setClock(DEMO_START);
        at1140 = await read();
        // Today.
        expect([value(at1140["orders-today"]), cents(value(at1140["collected-today"])), cents(value(at1140["to-collect"])), cents(value(at1140["average-today"]))]).toEqual([10, 138.29, 158.33, 29.66]);
        // The last 7 days.
        expect([value(at1140["orders-week"]), cents(value(at1140["collected-week"])), cents(value(at1140["average-week"])), value(at1140["cancelled-week"])]).toEqual([99, 2417.79, 26.32, 1]);
      }, 120_000);

      it("counts today's pickup times from the slot limit, and lists the next orders on the board", () => {
        const slots = rowsOf(at1140["pickups-today"]);
        expect(slots.length).toBe(40);
        expect(slots.slice(0, 8).map((s) => Number(s["value"]))).toEqual([1, 2, 2, 2, 1, 2, 0, 0]);
        const board = rowsOf(at1140["next-on-board"]);
        expect(board.map((o) => o["number"])).toEqual(["S2113", "S2114", "S2115", "S2116"]);
      });

      it("lists what needs a person: the new enquiry, the paused time, the order nobody collected", () => {
        expect(rowsOf(at1140["new-enquiries"]).map((e) => [e["heads"], String(e["wanted_on"]).slice(0, 10)])).toEqual([[24, "2026-07-31"]]);
        const paused = rowsOf(at1140["paused-slots"]);
        expect(paused.map((p) => [new Date(String(p["slot_at"])).getTime(), p["paused_by"]])).toEqual([[instantOf(TODAY, "13:00", DEMO_ZONE), "Sam"]]);
        expect(rowsOf(at1140["not-collected"]).map((o) => [o["number"], cents(o["total"])])).toEqual([["S2060", 29.77]]);
      });

      it("draws the last 7 days by day, today's portions, the hours people pick up at, and the dishes ordered most", () => {
        expect(pointsOf(at1140["orders-by-day"])).toEqual([12, 15, 19, 20, 14, 9, 10]);
        expect(pointsOf(at1140["collected-by-day"])).toEqual([311.5, 388.35, 463.85, 549.11, 363.72, 202.97, 138.29]);
        const portions = rowsOf(at1140["portions-today"]).map((d) => [d["name"], (d["portions"] as Json)["taken"], (d["portions"] as Json)["size"]]);
        expect(portions).toEqual([
          ["Diavola", 0, 0],
          ["Wild mushroom", 1, 3],
        ]);
        expect(pointsOf(at1140["pickup-hours"])).toEqual([13, 21, 14, 5, 4, 3, 6, 16, 11, 6]);
        // A four-way tie for fifth place at 12 goes by name.
        expect(rowsOf(at1140["top-dishes"]).map((d) => [d["label"], Number(d["value"])])).toEqual([
          ["Margherita", 33],
          ["Lemonade", 26],
          ["Hibiscus iced tea", 24],
          ["Signature grain bowl", 19],
          ["Build your own pizza", 12],
        ]);
      });

      it("reads the design's after-hours figures once the kitchen has finished the day", async () => {
        // The demo's "After closing": today's five orders on the board cooked and handed over.
        const kitchen = stand.kitchen;
        const walk: [string, string[]][] = [
          ["S2113", ["ready", "picked_up"]],
          ["S2114", ["preparing", "ready", "picked_up"]],
          ["S2115", ["confirmed", "preparing", "ready", "picked_up"]],
          ["S2116", ["placed", "confirmed", "preparing", "ready", "picked_up"]],
          ["S2117", ["placed", "confirmed", "preparing", "ready", "picked_up"]],
        ];
        for (const [number, path] of walk) {
          const id = (await stand.order(number)).id as number;
          for (let i = 1; i < path.length; i += 1) {
            if (path[i] === "picked_up") await kitchen.handOff(id, "card");
            else await kitchen.move(id, path[i - 1]!, path[i]!);
          }
        }
        await stand.server.setClock(instantOf(TODAY, "21:05", DEMO_ZONE));
        const after = await read();
        expect([value(after["orders-today"]), cents(value(after["collected-today"])), cents(value(after["to-collect"])), cents(value(after["average-today"]))]).toEqual([10, 296.62, 0, 29.66]);
        expect([value(after["orders-week"]), cents(value(after["collected-week"]))]).toEqual([99, 2576.12]);
        expect(rowsOf(after["next-on-board"])).toEqual([]);
      }, 180_000);
    });
  });
});
