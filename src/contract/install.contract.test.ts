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
 * `ADMINIUM_REQUIRE_CONTRACT=1` makes a skip a failure. Postgres and MySQL run with `TEST_POSTGRES_URL` /
 * `TEST_MYSQL_URL`.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { COLUMNS } from "../data/sampleRows.ts";
import { DEMO_START } from "../demo/world.ts";
import { ADMINIUM_REPO, appBundle, boot, Caller, ENGINES, missing, ok, PORTS_PER_ENGINE, type Engine, type Server } from "./harness.ts";

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
      async function install(options: { manifest?: string; answers?: Record<string, unknown>; connection?: string } = {}) {
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
      }, 240_000);
    });
  });
});
