/**
 * THE APP INSTALLS ON A BUILT ADMINIUM, ON EVERY ENGINE.
 *
 * This repo's own `manifest.json` and sample, uploaded to a BUILT Adminium
 * (`ADMINIUM_REPO`) as an operator uploads them, planned and installed on
 * SQLite, Postgres and MySQL: every table made, every rule kept, both browser
 * keys and the outbox — and an install of the released 0.1.3 is not offered
 * this release as an update (its tables are another shape).
 *
 * It runs with `CONTRACT=1` where an Adminium checkout with its built server
 * and dashboard is, and says why it skipped otherwise;
 * `ADMINIUM_REQUIRE_CONTRACT=1` makes a skip a failure.
 *
 * Then the sample, added on each engine as an operator adds it: every row the
 * server writes is the row the demo's own loader works out for the same
 * moment (`resolveSample`), and the figures the design quotes at 11:40 are
 * read back from the server's rows. On a menu shared with Point of Sale that
 * already holds a real dish, the sample's menu and orders stay out. Postgres and MySQL run with `TEST_POSTGRES_URL` /
 * `TEST_MYSQL_URL`.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { COLUMNS, resolveSample, type ResolvedRow } from "../data/sampleRows.ts";
import { DEMO_BUNDLE, DEMO_CURRENCY, DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { ADMINIUM_REPO, appBundle, boot, Caller, ENGINES, missing, ok, PORTS_PER_ENGINE, until, type Engine, type Server } from "./harness.ts";

type Row = Record<string, unknown>;
type ManifestColumn = { ref: string; type: string };
const MANIFEST = JSON.parse(readFileSync(new URL("../../manifest.json", import.meta.url), "utf8")) as {
  requiredSchema: { tables: { ref: string; columns: ManifestColumn[] }[] };
  sampleData: { skipWhenShared: { skip: string[] } };
};
const TYPES = Object.fromEntries(MANIFEST.requiredSchema.tables.map((t) => [t.ref, Object.fromEntries(t.columns.map((c) => [c.ref, c.type]))]));

/**
 * One row as a value comparable across engines and with the demo's loader:
 * each engine spells a number, a yes/no and a moment its own way. A moment is
 * kept as epoch ms; a code the server draws at random is left out.
 */
function comparable(table: string, row: Row): Row {
  const out: Row = {};
  for (const [column, type] of Object.entries(TYPES[table]!)) {
    if (column === "link_token") continue;
    const value = row[column];
    if (value === null || value === undefined) out[column] = null;
    else if (["int", "decimal", "money", "fk"].includes(type)) out[column] = Number(value);
    else if (type === "bool") out[column] = value === true || value === 1 || value === "1" || value === "true";
    // A moment SQLite hands back without a zone is on the server's own clock — this machine's, the contract's server being here.
    else if (type === "timestamptz") out[column] = /[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? Date.parse(String(value)) : new Date(String(value).replace(" ", "T")).getTime();
    else if (type === "date") out[column] = String(value).slice(0, 10);
    else out[column] = String(value);
  }
  return out;
}

/** The kitchen's date and wall time of a moment, to the nearest minute (the sample went in a few seconds before 11:40). */
const local = (ms: unknown) => {
  const minute = Math.round(Number(ms) / 60_000) * 60_000;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(minute));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
};
const cents = (values: unknown[]) => values.reduce<number>((sum, v) => sum + Math.round(Number(v) * 100), 0) / 100;

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870);
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };

describe.skipIf(why !== null)(`the app installs on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let server: Server;
      let staff: Caller;
      let connectionId = "";

      beforeAll(async () => {
        server = await boot(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, DEMO_START);
        staff = new Caller(server.base, { origin: server.base });
        await staff.signIn(ADMIN.email, ADMIN.password);
        const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
        connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
      }, 240_000);

      afterAll(async () => {
        await server?.stop();
      });

      /** Upload a package, plan it and install it; the install's reply. */
      async function install(options: { manifest?: string; sample?: string; answers?: Record<string, unknown>; connection?: string } = {}) {
        const app = appBundle(options);
        const staged = await staff.post(`/api/v1/apps/upload?expectedSha512=${encodeURIComponent(app.integrity)}`, app.buffer);
        expect([200, 201], JSON.stringify(staged.body).slice(0, 800)).toContain(staged.status);
        const body = { key: app.key, version: app.version, connectionId: options.connection ?? connectionId, ...(options.answers ?? {}) };
        const plan = ok(await staff.post<{ plan: { installable: boolean; checksum: string; addOns?: { key: string; need: string; checked: boolean; state: string }[] } }>("/api/v1/apps/plan", body)).plan;
        const { create: _create, ...said } = plan as unknown as Record<string, unknown>;
        expect(plan.installable, JSON.stringify(said).slice(0, 3000)).toBe(true);
        const installed = ok(
          await staff.post<{ rules: { skipped: unknown[] }; schema: { created: string[] }; publicAccess: { keys: Record<string, string> }; outbox: { defined: boolean } }>("/api/v1/apps/install", {
            ...body,
            planChecksum: plan.checksum,
          }),
        );
        return { plan, installed };
      }

      it.skipIf(engine !== "sqlite")("refuses 0.2.0 as an update of an install of 0.1.3 — it is uninstalled first, its tables kept", async () => {
        const released = readFileSync(join(ADMINIUM_REPO, "packages", "manifest", "test", "fixtures", "released", "online-ordering-0.1.3.manifest.json"), "utf8");
        expect((JSON.parse(released) as { version: string }).version).toBe("0.1.3");
        // 0.1.3's tables had no prefix: it goes on an empty database of its own.
        const file = join(tmpdir(), `oo-contract-013-${String(PORT_BASE)}.db`);
        rmSync(file, { force: true });
        writeFileSync(file, "");
        const empty = ok(await staff.post<{ id: string }>("/api/v1/connections", { name: "juniper-013", engine: "sqlite", dsn: `sqlite:${file}` }), 201);
        await install({ manifest: released, connection: empty.id });
        const next = appBundle();
        const refused = await staff.post(`/api/v1/apps/upload?expectedSha512=${encodeURIComponent(next.integrity)}`, next.buffer);
        expect([refused.status, refused.code, refused.details]).toEqual([422, "VALIDATION_FAILED", { reason: "UPDATE_NOT_SUPPORTED", from: "0.1.3", to: "0.2.0", updatesFrom: ">=0.2.0" }]);
        const gone = ok(await staff.send<{ uninstalled: boolean }>("DELETE", "/api/v1/apps/ordering", {}));
        expect(gone.uninstalled).toBe(true);
      }, 240_000);

      it("plans and installs 0.2.0: every table, every rule kept, both browser keys, the outbox", async () => {
        const { plan, installed } = await install();
        // Both add-ons are offered for a feature each; Invoices & Receipts ticked. Neither is here, and nothing waits on them.
        expect((plan.addOns ?? []).map((a) => [a.key, a.need, a.checked])).toEqual([
          ["invoices", "feature", true],
          ["holiday-calendars", "feature", false],
        ]);
        const created = installed.schema.created.map((name) => name.replace(/^ordering_/, ""));
        expect(created.sort()).toEqual(Object.keys(COLUMNS).sort());
        expect(JSON.stringify(installed.rules.skipped)).toBe("[]");
        expect(Object.keys(installed.publicAccess.keys).sort()).toEqual(["customer", "link"]);
        expect(installed.outbox.defined).toBe(true);
        real = Object.fromEntries(installed.schema.created.map((name) => [name.replace(/^ordering_/, ""), name]));
      }, 240_000);

      let real: Record<string, string> = {};
      /** Every row of one of the app's tables on a connection, as the staff API reads them. */
      async function rowsOf(connection: string, table: string): Promise<Row[]> {
        const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connection}/schema`));
        const id = schema.model.tables.find((t) => t.name === table)!.id;
        const out: Row[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = ok(await staff.get<{ data: Row[] }>(`/api/v1/data/${connection}/${encodeURIComponent(id)}?limit=200&offset=${String(offset)}`)).data;
          out.push(...page);
          if (page.length < 200) return out;
        }
      }
      async function addSample(): Promise<number> {
        ok(await staff.post("/api/v1/apps/ordering/sample-data"));
        const status = await until(async () => {
          const now = ok(await staff.get<{ loaded: boolean; addedAt: number | null }>("/api/v1/apps/ordering/sample-data"));
          return now.loaded ? now : undefined;
        }, "the sample to be added");
        return status.addedAt!;
      }

      it("adds the sample: every row the one the demo works out, and the design's figures at 11:40", async () => {
        // The kitchen's clock and currency, as the demo's kitchen sets them.
        ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: DEMO_CURRENCY }));
        // The sample's board is written for 11:40 on the dot: a moment later, "5 minutes on" is past 11:45 and #2113 would
        // be placed at 12:00 (as the demo's own loader places it). The clock is set a few seconds before, then.
        await server.setClock(DEMO_START - 5_000);
        const addedAt = await addSample();
        expect(addedAt).toBeGreaterThan(DEMO_START - 5_000);
        expect(addedAt).toBeLessThanOrEqual(DEMO_START);
        const expected = resolveSample(DEMO_BUNDLE, { now: addedAt, zone: DEMO_ZONE, locale: "en-US", currency: DEMO_CURRENCY });
        const held: Record<string, Row[]> = {};
        for (const table of Object.keys(COLUMNS)) {
          held[table] = (await rowsOf(connectionId, real[table]!)).map((row) => comparable(table, row)).sort((a, b) => Number(a["id"]) - Number(b["id"]));
          const want = (expected[table] ?? []).map((row: ResolvedRow) => comparable(table, row));
          expect(held[table]!.length, table).toBe(want.length);
          held[table]!.forEach((row, i) => {
            for (const [column, value] of Object.entries(want[i]!)) {
              // A moment the add spelled from its own "now" may differ by the milliseconds between the two reads of the clock.
              if (TYPES[table]![column] === "timestamptz" && typeof value === "number" && typeof row[column] === "number") expect(Math.abs(row[column] - value), `${table} ${String(row["id"])} ${column}`).toBeLessThan(5_000);
              else expect(row[column], `${table} ${String(row["id"])} ${column}`).toEqual(value);
            }
          });
        }
        // The design's figures, off the server's rows.
        const orders = held["orders"]!;
        const today = orders.filter((o) => /^S21(0[7-9]|1[0-7])$/.test(String(o["number"])));
        expect(today.map((o) => [o["number"], local(o["pickup_at"]), o["status"], o["item_count"], o["subtotal"], o["tax"], o["total"]])).toEqual([
          ["S2107", "2026-07-29 12:30", "placed", 2, 22, 1.82, 23.82],
          ["S2108", "2026-07-28 11:00", "picked_up", 2, 17.5, 1.44, 18.94],
          ["S2109", "2026-07-28 11:15", "picked_up", 2, 21.5, 1.77, 23.27],
          ["S2110", "2026-07-28 11:15", "picked_up", 3, 34.75, 2.87, 37.62],
          ["S2111", "2026-07-28 11:30", "picked_up", 3, 34.25, 2.83, 37.08],
          ["S2112", "2026-07-28 11:30", "picked_up", 2, 19.75, 1.63, 21.38],
          ["S2113", "2026-07-28 11:45", "ready", 3, 31, 2.56, 33.56],
          ["S2114", "2026-07-28 11:45", "preparing", 2, 30.5, 2.52, 33.02],
          ["S2115", "2026-07-28 12:00", "confirmed", 3, 26.5, 2.19, 28.69],
          ["S2116", "2026-07-28 12:15", "placed", 4, 38.5, 3.18, 41.68],
          ["S2117", "2026-07-28 12:15", "placed", 3, 19.75, 1.63, 21.38],
        ]);
        // The Overview's last 7 days: every order but the cancelled one, and what was collected.
        const week = orders.filter((o) => local(o["pickup_at"]).slice(0, 10) >= "2026-07-22" && local(o["pickup_at"]).slice(0, 10) <= "2026-07-28");
        const counted = week.filter((o) => o["status"] !== "cancelled");
        const collected = week.filter((o) => o["status"] === "picked_up");
        expect([counted.length, cents(collected.map((o) => o["total"])), cents(counted.map((o) => o["total"]))]).toEqual([99, 2417.79, 2605.89]);
        // Nothing the sample added was stamped again, and no email went out for it.
        expect(held["messages"]!.every((m) => m["status"] !== "queued")).toBe(true);
      }, 240_000);

      it.skipIf(engine !== "sqlite")("leaves the sample's menu and orders out of a menu shared with Point of Sale that holds a real dish", async () => {
        const file = join(tmpdir(), `oo-contract-shared-${String(PORT_BASE)}.db`);
        rmSync(file, { force: true });
        writeFileSync(file, "");
        const shared = ok(await staff.post<{ id: string }>("/api/v1/connections", { name: "juniper-shared", engine: "sqlite", dsn: `sqlite:${file}` }), 201).id;
        ok(await staff.patch(`/api/v1/connections/${shared}`, { timezone: DEMO_ZONE, currency: DEMO_CURRENCY }));
        const released = join(ADMINIUM_REPO, "packages", "manifest", "test", "fixtures", "released");
        const pos = readFileSync(join(released, "point-of-sale-0.2.2.manifest.json"), "utf8");
        await install({ manifest: pos, connection: shared, sample: readFileSync(join(released, "point-of-sale-0.2.2.sample.json"), "utf8") });
        // The till's own dish: a real row, not a sample's.
        const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${shared}/schema`));
        const items = schema.model.tables.find((t) => t.name.endsWith("menu_items"))!;
        ok(await staff.post(`/api/v1/data/${shared}/${encodeURIComponent(items.id)}`, { values: { name: "House soup", price: "6.50" } }), 201);
        // One install of an app per workspace: the northwind one goes first, its tables kept.
        expect(ok(await staff.send<{ uninstalled: boolean }>("DELETE", "/api/v1/apps/ordering", {})).uninstalled).toBe(true);
        // Ordering joins the till's menu (the check's recommended answer), and offers its sample without the menu, its orders and diners.
        const { plan, installed } = await install({ connection: shared });
        expect((plan as unknown as { shareOffers?: { action: string }[] }).shareOffers?.[0]?.action).toBe("share");
        const skip = MANIFEST.sampleData.skipWhenShared.skip;
        const offered = ok(await staff.get<{ available: { tables: { ref: string }[] } }>("/api/v1/apps/ordering/sample-data")).available.tables.map((t) => t.ref);
        expect(offered.filter((ref) => skip.includes(ref))).toEqual([]);
        // The kitchen's words, hours and enquiries go in; the sample's diners stay out with the orders they placed.
        expect(offered).toEqual(expect.arrayContaining(["settings", "hours", "enquiries"]));
        expect(offered).not.toContain("customers");
        await addSample();
        const names = Object.fromEntries(installed.schema.created.map((name) => [name.replace(/^ordering_/, ""), name]));
        expect((await rowsOf(shared, names["orders"]!)).length).toBe(0);
        expect((await rowsOf(shared, names["settings"]!)).length).toBe(1);
        expect((await rowsOf(shared, items.name)).map((d) => d["name"])).toEqual(["House soup"]);
      }, 240_000);
    });
  });
});
