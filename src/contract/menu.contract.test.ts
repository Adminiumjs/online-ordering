/**
 * THE MENU'S PICTURES, AND A MENU SHARED WITH POINT OF SALE, ON EVERY ENGINE.
 *
 * The app installed on a BUILT Adminium with its sample: a dish photo and a
 * venue photo uploaded as the dashboard's forms upload them reach the order
 * page as addresses anyone's `<img>` may load, and nothing else of a row is
 * a picture. Then Point of Sale 0.2.2 (the released one) is installed beside
 * it and joins the kitchen's menu rather than making its own: a dish the till
 * adds is on the order page, a dish kept off the order page (its Online
 * switch) stays on the till, and uninstalling the till — tables and all —
 * leaves the kitchen its menu.
 *
 * (Ordering joining a till's menu, the other way round, is
 * `install.contract.test.ts`'s.) It runs with `CONTRACT=1`; its servers take
 * the port block after `overview.contract.test.ts`'s.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import { ApiError, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { addDays, instantOf, venueDay } from "../lib/venueTime.ts";
import { ADMINIUM_REPO, appBundle, ENGINES, missing, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
/** After `overview.contract.test.ts`'s servers. */
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 15 * PORTS_PER_ENGINE;

const TOMORROW = addDays(venueDay(DEMO_START, DEMO_ZONE), 1);

/** A one-pixel PNG: a picture as small as a picture gets. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe.skipIf(why !== null)(`the menu on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      let diner: AdminiumDiner;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_menu_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
        diner = await stand.dinerOf();
      }, 300_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** A picture uploaded into a row's column, as the dashboard's form uploads one. */
      const upload = async (ref: string, id: unknown, column: string, filename: string) => {
        const path = `/api/v1/files?${new URLSearchParams({ filename, connectionId: stand.connectionId, table: stand.ids[ref]!, recordId: String(id), column }).toString()}`;
        const sent = await stand.staff.send<{ ref?: string }>("POST", path, PNG, { "content-type": "image/png" });
        expect([200, 201], JSON.stringify(sent.body).slice(0, 400)).toContain(sent.status);
        ok(await stand.staff.patch(`${stand.data(ref)}/${String(id)}`, { values: { [column]: sent.body.ref } }));
      };
      const fetched = async (url: string | null) => {
        expect(url).not.toBeNull();
        const res = await fetch(new URL(url!, stand.server.base));
        return { status: res.status, type: res.headers.get("content-type"), bytes: Buffer.from(await res.arrayBuffer()) };
      };

      it("shows a dish's photo and the venue's on the order page, to anyone", async () => {
        const mushroom = (await stand.rows("menu_items")).find((d) => d["name"] === "Wild mushroom")!;
        await upload("menu_items", mushroom.id, "image", "wild-mushroom.png");
        const settings = (await stand.rows("settings"))[0]!;
        await upload("settings", settings.id, "photo_hero", "counter.png");
        const menu = await diner.menu();
        const dish = menu.items.find((d) => d.id === mushroom.id)!;
        const photo = await fetched(dish["image"] as string);
        expect([photo.status, photo.type, photo.bytes.equals(PNG)]).toEqual([200, "image/png", true]);
        // A dish with no photo has no address: the page draws its tile.
        expect(menu.items.find((d) => d["name"] === "Margherita")!["image"]).toBeNull();
        const hero = await fetched((await diner.settings())["photo_hero"] as string);
        expect([hero.status, hero.bytes.equals(PNG)]).toEqual([200, true]);
        expect((await diner.settings())["photo_store"]).toBeNull();
      }, 120_000);

      it("serves no column as a picture that the page does not show as one", async () => {
        const dish = (await diner.menu()).items.find((d) => d["name"] === "Wild mushroom")!;
        const url = String(dish["image"]);
        // The same address with another of the row's columns in the picture's place.
        const other = url.replace("/image/", "/name/");
        expect(other).not.toBe(url);
        expect((await fetch(new URL(other, stand.server.base))).status).toBe(404);
      }, 60_000);

      let tillDish: Row;
      it("installs Point of Sale beside it, joining the kitchen's menu rather than making its own", async () => {
        const released = join(ADMINIUM_REPO, "packages", "manifest", "test", "fixtures", "released");
        const pos = appBundle({ manifest: readFileSync(join(released, "point-of-sale-0.2.2.manifest.json"), "utf8"), sample: readFileSync(join(released, "point-of-sale-0.2.2.sample.json"), "utf8") });
        const staged = await stand.staff.post(`/api/v1/apps/upload?expectedSha512=${encodeURIComponent(pos.integrity)}`, pos.buffer);
        expect([200, 201]).toContain(staged.status);
        const body = { key: pos.key, version: pos.version, connectionId: stand.connectionId };
        const plan = ok(await stand.staff.post<{ plan: { checksum: string; installable: boolean; shareOffers?: { ref?: string; action: string }[] } }>("/api/v1/apps/plan", body)).plan;
        expect(plan.installable).toBe(true);
        expect((plan.shareOffers ?? []).map((o) => o.action)).toEqual(["share"]);
        const installed = ok(await stand.staff.post<{ schema: { created: string[] } }>("/api/v1/apps/install", { ...body, planChecksum: plan.checksum }));
        // The till made its own tables, and none of the menu's.
        const menuTables = ["menu_categories", "menu_items", "modifier_groups", "modifiers"];
        expect(installed.schema.created.filter((name) => menuTables.includes(name.replace(/^pos_/, "")))).toEqual([]);
        // A dish the till adds, through the one menu table, is on the order page.
        const categories = await stand.rows("menu_categories");
        tillDish = ok(
          await stand.staff.post<{ data: Row }>(stand.data("menu_items"), { values: { name: "House soup", price: "6.50", category_id: categories[0]!.id, available: true } }),
          201,
        ).data;
        const menu = await diner.menu();
        expect(menu.items.find((d) => d.id === tillDish.id)?.["name"]).toBe("House soup");
      }, 240_000);

      it("keeps a dish the till sells off the order page, when it is switched off online", async () => {
        await stand.kitchen.setDish(tillDish.id, { online: false });
        expect((await diner.menu()).items.some((d) => d.id === tillDish.id)).toBe(false);
        const error = await refusal(
          diner.quote({ values: { name: "Io", email: "io@juniper-diners.dev", pickup_at: new Date(instantOf(TOMORROW, "12:30", DEMO_ZONE)).toISOString() }, children: { order_items: [{ values: { menu_item_id: tillDish.id, qty: 1 } }] } }),
        );
        expect([error.code, error.params["reason"]]).toEqual(["PUBLIC_WRITE_REFUSED", "not-offered"]);
        // Still on the till: its row is there, available.
        expect((await stand.rows("menu_items")).find((d) => d.id === tillDish.id)!["available"]).toBeTruthy();
      }, 60_000);

      it("leaves the kitchen its menu when the till is uninstalled with its tables", async () => {
        const gone = ok(await stand.staff.send<{ uninstalled: boolean }>("DELETE", "/api/v1/apps/pos", { dropTables: true, confirmKey: "pos" }));
        expect(gone.uninstalled).toBe(true);
        const menu = await diner.menu();
        expect(menu.items.some((d) => d["name"] === "Wild mushroom")).toBe(true);
        expect((await stand.rows("menu_items")).some((d) => d.id === tillDish.id)).toBe(true);
      }, 240_000);
    });
  });
});
