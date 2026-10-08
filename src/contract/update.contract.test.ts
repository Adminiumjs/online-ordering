/**
 * ONLINE ORDERING'S UPDATE CONTRACT: THE RELEASED 0.2.3, UPDATED IN PLACE.
 *
 * On SQLite, Postgres and MySQL, along the path a kitchen takes:
 *
 *   1. install the RELEASED 0.2.3 — the published package's own bytes
 *      (`CONTRACT_FROM_TARBALL`), refused unless they hash to what
 *      RELEASES.json recorded — on the Adminium it was released for
 *      (`CONTRACT_FROM_ADMINIUM`, 0.3.9);
 *   2. its own sample, added at the demo's moment (11:40);
 *   3. a kitchen at work in 0.2.3, through 0.2.3's own doors: one order walked
 *      to the shelf and left there, one handed over for cash;
 *   4. ADMINIUM UPGRADED IN PLACE: that Adminium stopped, and the one this
 *      build needs (`ADMINIUM_REPO`) started on the same data directory,
 *      secret and database — the app still 0.2.3, and nothing in its tables
 *      moved by the upgrade;
 *   5. every table of the app read straight from the database (each value as
 *      the engine spells it, each column as the engine declares it) and over
 *      HTTP: the snapshot;
 *   6. THIS build uploaded: the plan is exactly three new tables (a typed
 *      code, a gift card's payment, money given back to a card), the new
 *      columns of an order and of a line, and the new values of two lists —
 *      nothing dropped, renamed or rewritten — and it applies;
 *   7. every row that was there is unchanged, byte for byte: every order's
 *      tax and total are the cents 0.2.3 stored; every column declaration too;
 *      the new tables exist and are empty; the new columns are empty on the
 *      rows that were there;
 *   8. ONE WRITE ON AN OLD ROW: the order left on the shelf under 0.2.3 is
 *      handed over for cash, exactly as a 0.2.3 kitchen screen sends it, and
 *      its money is what it was;
 *   9. THE SAMPLE ON UPDATE: the update adds no sample rows; removing the
 *      sample afterwards keeps what the kitchen itself moved.
 *
 * It runs twice on each engine: as above, and once more with Offers & gift
 * cards and Inventory installed BEFORE the update and connected by it. Then
 * the same must hold — connecting an add-on writes nothing into the kitchen's
 * rows — and an order placed under 0.2.3 takes a gift card at the counter.
 *
 * It runs where the plain contract runs, with the published package of the
 * release it updates and a built checkout of the Adminium that release was
 * made for; `ADMINIUM_REQUIRE_CONTRACT=1` makes a missing one a failure. Its
 * servers take ports from `CONTRACT_UPDATE_PORT_BASE`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_CURRENCY, DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { TABLES } from "../manifest/tables.ts";
import { addOnBundle, appBundle, boot, Caller, ENGINES, FROM_ADMINIUM, missing, missingAddOn, ok, PORTS_PER_ENGINE, rawTables, releasedBundle, releasedMissing, until, type Engine, type RawTable, type Server } from "./harness.ts";

type Row = Record<string, unknown> & { id: number };

const REQUIRED = ["1", "true"].includes(process.env["ADMINIUM_REQUIRE_CONTRACT"] ?? "");
const why = missing() ?? releasedMissing();
if (why !== null && REQUIRED) throw new Error(`the update contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_UPDATE_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 65);
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };
const PREFIX = "ordering_";

/** What 0.3.0 adds to 0.2.3's tables, from the manifest: the update's plan must be exactly this. */
const NEW_TABLES = ["order_codes", "payments", "payment_refunds"];
const NEW_COLUMNS: Record<string, string[]> = {
  orders: ["card_used", "confirm_as", "customer_proved", "discount", "due", "hold_until", "method_ok", "net", "paid", "prepaid", "rest_paid_by", "to_pay"],
  order_items: ["category_id", "discount"],
};
const NEW_ENUM_VALUES: Record<string, Record<string, string[]>> = {
  orders: { paid_method: ["gift_card", "mixed"] },
  messages: { kind: ["order-confirmation-prepaid", "order-ready-prepaid", "card-money-returned", "card-money-kept"] },
};

const yesNoColumns = (ref: string): string[] => (TABLES.find((t) => t.ref === ref)?.columns ?? []).filter((c) => c.type === "bool").map((c) => c.ref);
const realNow = () => performance.timeOrigin + performance.now();

const released = why === null ? releasedBundle() : null;
const FROM = released?.version ?? "0.2.3";
const TO = why === null ? appBundle().version : "0.3.0";
const addOnsWhy = missingAddOn("offers") ?? missingAddOn("inventory");

const RUNS = [
  { id: "plain", addOns: false, title: "" },
  { id: "addons", addOns: true, title: ", with Offers & gift cards and Inventory installed before the update" },
] as const;

describe.skipIf(why !== null)(`the update of a live ${FROM} kitchen to ${TO}${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    RUNS.forEach((run, r) => {
      describe.skipIf(!available || (run.addOns && addOnsWhy !== null))(`on ${engine}${run.title}`, () => {
        const port = PORT_BASE + (index * RUNS.length + r) * PORTS_PER_ENGINE;
        const database = `oo_update_${run.id}_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`;
        let server: Server;
        let staff: Caller;
        let connectionId = "";
        let tableIds: Record<string, string> = {};
        let before: Record<string, RawTable> = {};
        let beforeHttp: Record<string, Row[]> = {};
        let sampleBefore = { loaded: false, total: 0 };
        /** What the kitchen did in 0.2.3: the rows the later steps come back to. */
        const made = { shelf: 0, handed: 0 };
        const startedAt = realNow();
        const kitchen = mkdtempSync(join(tmpdir(), `oo-update-${run.id}-${engine}-`));
        const ran = { from: "", to: "" };

        const signIn = async () => {
          staff = new Caller(server.base, { origin: server.base });
          await staff.signIn(ADMIN.email, ADMIN.password);
          const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
          connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
          return ok(await staff.get<{ version: string }>("/api/v1/healthz")).version;
        };
        const learnTables = async () => {
          const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connectionId}/schema`));
          tableIds = Object.fromEntries(schema.model.tables.map((t) => [t.name, t.id]));
        };
        const dataOf = (table: string) => `/api/v1/data/${connectionId}/${encodeURIComponent(tableIds[table]!)}`;
        const data = (ref: string) => dataOf(`${PREFIX}${ref}`);
        const rowsOf = async (table: string): Promise<Row[]> => {
          const out: Row[] = [];
          for (let offset = 0; ; offset += 200) {
            const page = ok(await staff.get<{ data: Row[] }>(`${dataOf(table)}?limit=200&offset=${String(offset)}`)).data;
            out.push(...page);
            if (page.length < 200) return out.sort((a, b) => Number(a.id) - Number(b.id));
          }
        };
        const rows = (ref: string) => rowsOf(`${PREFIX}${ref}`);
        const row = async (ref: string, id: number) => (await rows(ref)).find((found) => Number(found.id) === id)!;
        const appRefs = () => Object.keys(tableIds).filter((name) => name.startsWith(PREFIX) && name !== `${PREFIX}sample_data`).map((name) => name.slice(PREFIX.length));
        const all = async () => Object.fromEntries(await Promise.all(appRefs().map(async (ref) => [ref, await rows(ref)] as const)));
        const raw = () => rawTables(engine as Engine, port, database, PREFIX);
        const sample = async () => ok(await staff.get<{ loaded: boolean; total: number }>("/api/v1/apps/ordering/sample-data"));
        const upload = async (kind: "add-ons" | "apps", bundle: { buffer: Buffer; integrity: string }) => {
          const reply = await staff.post(`/api/v1/${kind}/upload?expectedSha512=${encodeURIComponent(bundle.integrity)}`, bundle.buffer);
          expect([200, 201], JSON.stringify(reply.body).slice(0, 800)).toContain(reply.status);
        };
        const move = async (id: number, values: Record<string, unknown>) => {
          const reply = await staff.patch(`${data("orders")}/${String(id)}`, { values });
          expect(reply.status, JSON.stringify(reply.body).slice(0, 800)).toBe(200);
        };
        /** The money of an order, as Adminium keeps it. */
        const money = (order: Row) => [Number(order["subtotal"]), Number(order["tax"]), Number(order["total"])];

        beforeAll(async () => {
          server = await boot(engine as Engine, port, DEMO_START - 60_000, { database, adminium: FROM_ADMINIUM, keep: kitchen });
          ran.from = await signIn();
          ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: DEMO_CURRENCY }));
        }, 240_000);

        afterAll(async () => {
          await server?.stop();
          rmSync(kitchen, { recursive: true, force: true });
          rmSync(join(tmpdir(), `adminium-e2e-source-sqlite-${String(port)}.db`), { force: true });
        });

        // ── 0.2.3, released, at work ──────────────────────────────────────────

        it(`installs the RELEASED ${FROM} — the published package, byte for byte — on the Adminium it was released for`, async () => {
          const app = released!;
          await upload("apps", app);
          const body = { key: app.key, version: app.version, connectionId };
          const plan = ok(await staff.post<{ plan: { installable: boolean; checksum: string } }>("/api/v1/apps/plan", body)).plan;
          expect(plan.installable).toBe(true);
          ok(await staff.post("/api/v1/apps/install", { ...body, planChecksum: plan.checksum }));
          await learnTables();
          expect(appRefs().sort()).toEqual(TABLES.map((t) => t.ref).filter((ref) => !NEW_TABLES.includes(ref)).sort());
        }, 180_000);

        it(`adds ${FROM}'s own sample at the demo's moment`, async () => {
          await server.setClock(DEMO_START, true);
          ok(await staff.post("/api/v1/apps/ordering/sample-data"));
          await until(async () => ((await sample()).loaded ? true : undefined), "the sample to be added");
          await server.setClock(DEMO_START);
          expect((await rows("orders")).length).toBeGreaterThan(50);
        }, 240_000);

        it(`lets the kitchen work in ${FROM}, through its own doors: one order to the shelf, one handed over for cash`, async () => {
          const orders = await rows("orders");
          const walk = async (from: string, to: string[]): Promise<number> => {
            const found = orders.find((o) => o["status"] === from && Number(o.id) !== made.shelf && Number(o.id) !== made.handed)!;
            expect(found, `an order that is ${from}`).toBeDefined();
            for (const status of to) await move(Number(found.id), status === "picked_up" ? { status, paid_method: "cash" } : { status });
            return Number(found.id);
          };
          const next: Record<string, string[]> = { placed: ["confirmed", "preparing", "ready"], confirmed: ["preparing", "ready"], preparing: ["ready"], ready: [] };
          const open = (taken: number) => orders.find((o) => String(o["status"]) in next && Number(o.id) !== taken)!;
          const first = open(0);
          made.shelf = await walk(String(first["status"]), next[String(first["status"])]!);
          const second = open(made.shelf);
          made.handed = await walk(String(second["status"]), [...next[String(second["status"])]!, "picked_up"]);
          expect((await row("orders", made.shelf))["status"]).toBe("ready");
          const handed = await row("orders", made.handed);
          expect([handed["status"], handed["paid_method"]]).toEqual(["picked_up", "cash"]);
        }, 120_000);

        // ── Adminium upgraded ─────────────────────────────────────────────────

        it("upgrades Adminium in place to the one this build needs, on the same data, the app still at its release", async () => {
          const rawUnder = await raw();
          await server.stop();
          server = await boot(engine as Engine, port, Math.round(DEMO_START + (realNow() - startedAt)), { database, keep: kitchen });
          ran.to = await signIn();
          console.info(`[upgrade, ${engine}${run.title}] Adminium ${ran.from} → ${ran.to}`);
          expect(ran.to).not.toBe(ran.from);
          const apps = ok(await staff.get<{ apps: { key: string; version: string; connectionId: string }[] }>("/api/v1/apps"));
          expect(apps.apps.filter((a) => a.key === "ordering").map((a) => [a.version, a.connectionId])).toEqual([[FROM, connectionId]]);
          // The upgrade itself writes nothing into the app's tables.
          expect(await raw()).toEqual(rawUnder);
        }, 300_000);

        it.skipIf(!run.addOns)("installs Offers & gift cards and Inventory beside the kitchen, and writes nothing into the kitchen's rows", async () => {
          const rawUnder = await raw();
          for (const key of ["inventory", "offers"]) {
            const addOn = addOnBundle(key);
            await upload("add-ons", addOn);
            const installed = await staff.post("/api/v1/add-ons", { key, version: addOn.version, attachTo: [] });
            expect(installed.status, JSON.stringify(installed.body).slice(0, 1200)).toBeLessThan(300);
          }
          expect(await raw()).toEqual(rawUnder);
        }, 300_000);

        it("reads every table of the app, straight from the database and over HTTP, once nothing is moving", async () => {
          await until(
            async () => {
              const a = await raw();
              await new Promise((resolve) => setTimeout(resolve, 3_000));
              const b = await raw();
              return JSON.stringify(a) === JSON.stringify(b) ? (before = b) : undefined;
            },
            "the database to be still",
            120_000,
          );
          await learnTables();
          beforeHttp = await all();
          expect(Object.keys(beforeHttp).sort()).toEqual(TABLES.map((t) => t.ref).filter((ref) => !NEW_TABLES.includes(ref)).sort());
          sampleBefore = await sample();
          expect(sampleBefore.loaded).toBe(true);
        }, 180_000);

        // ── the update ────────────────────────────────────────────────────────

        let plan: {
          installable: boolean;
          checksum: string;
          problems: unknown[];
          tables: { ref: string; table: string; class: string; action: string; edits: { kind: string; column: string; values?: string[] }[]; blocked: unknown[]; renameExistingTo?: string }[];
          addOns?: { key: string; need: string; action: string | null }[];
        };

        it(`plans the update to ${TO}: three new tables, the new columns and the new values, nothing dropped, renamed or rewritten`, async () => {
          const app = appBundle();
          await upload("apps", app);
          plan = ok(await staff.post<{ plan: typeof plan }>("/api/v1/apps/plan", { key: app.key, version: app.version, connectionId })).plan;
          console.info(
            `[update plan, ${engine}${run.title}] ` +
              JSON.stringify({
                installable: plan.installable,
                problems: plan.problems,
                changed: plan.tables.filter((t) => t.action !== "reuse" || t.edits.length > 0 || t.blocked.length > 0).map((t) => ({ ref: t.ref, action: t.action, edits: t.edits, blocked: t.blocked })),
                addOns: plan.addOns?.map((a) => ({ key: a.key, need: a.need, action: a.action })),
              }),
          );
          expect([plan.installable, plan.problems]).toEqual([true, []]);
          const byRef = Object.fromEntries(plan.tables.map((t) => [t.ref, t]));
          expect(Object.keys(byRef).sort()).toEqual(TABLES.map((t) => t.ref).sort());
          for (const ref of NEW_TABLES) expect([ref, byRef[ref]!.action, byRef[ref]!.table, byRef[ref]!.class]).toEqual([ref, "create", `${PREFIX}${ref}`, "new"]);
          for (const ref of Object.keys(beforeHttp)) {
            const planned = byRef[ref]!;
            // The app's own table, kept where it is, under its name.
            expect([ref, planned.action, planned.class, planned.table, planned.renameExistingTo, planned.blocked]).toEqual([ref, "reuse", "own-leftover", `${PREFIX}${ref}`, undefined, []]);
            // Only additions: a column, a value of a list. Never a column changed in type or width.
            expect([ref, planned.edits.filter((e) => e.kind === "add-column").map((e) => e.column).sort()]).toEqual([ref, NEW_COLUMNS[ref] ?? []]);
            expect([ref, Object.fromEntries(planned.edits.filter((e) => e.kind === "enum-values").map((e) => [e.column, e.values]))]).toEqual([ref, NEW_ENUM_VALUES[ref] ?? {}]);
            expect([ref, planned.edits.filter((e) => !["add-column", "enum-values"].includes(e.kind))]).toEqual([ref, []]);
          }
        }, 120_000);

        it(`updates in place to ${TO}, as planned`, async () => {
          const reply = await staff.post<{ from: string; to: string; app: { version: string; schema?: { created: string[] }; rules?: { skipped: unknown[] } } }>("/api/v1/apps/ordering/update", {
            planChecksum: plan.checksum,
            // What the new version lets a diner's page do (a code, a gift card, their payments) is the operator's to allow.
            publicAccess: true,
            // The kitchen that set the add-ons up first connects them as it updates.
            ...(run.addOns ? { addOns: ["inventory", "offers"].map((key) => ({ key, version: addOnBundle(key).version })) } : {}),
          });
          expect(reply.status, JSON.stringify(reply.body).slice(0, 1500)).toBe(200);
          const updated = reply.body;
          console.info(`[update reply, ${engine}${run.title}] ${JSON.stringify({ from: updated.from, to: updated.to, schema: updated.app.schema, rulesSkipped: updated.app.rules?.skipped })}`);
          expect([updated.from, updated.to, updated.app.version]).toEqual([FROM, TO, TO]);
          expect([...(updated.app.schema?.created ?? [])].sort()).toEqual(NEW_TABLES.map((t) => `${PREFIX}${t}`).sort());
          expect(JSON.stringify(updated.app.rules?.skipped ?? [])).toBe("[]");
          await learnTables();
          const staffConfig = ok(await staff.get<{ addOns?: Record<string, unknown> }>("/apps/ordering/staff/surface-config.json"));
          expect(Object.keys(staffConfig.addOns ?? {}).sort()).toEqual(run.addOns ? ["inventory", "offers"] : []);
        }, 240_000);

        it("keeps every row that was there, byte for byte — every order's tax and total the cents it stored — and every column as it was", async () => {
          const after = await raw();
          const added: Record<string, string[]> = {};
          const redeclared: string[] = [];
          for (const [name, was] of Object.entries(before)) {
            const now = after[name];
            expect(now, `${name} is still there`).toBeDefined();
            expect([name, now!.key]).toEqual([name, was.key]);
            added[name] = Object.keys(now!.columns).filter((c) => !(c in was.columns)).sort();
            const widened = Object.keys(NEW_ENUM_VALUES[name.slice(PREFIX.length)] ?? {});
            for (const [column, declared] of Object.entries(was.columns)) {
              expect(now!.columns[column], `${name}.${column} is still there`).toBeDefined();
              // A list that gained values is declared with them (MySQL's enum, a check elsewhere): that is the addition.
              if (now!.columns[column] !== declared && !widened.includes(column)) redeclared.push(`${name}.${column}: ${declared} → ${now!.columns[column]!}`);
            }
            expect([name, now!.rows.length]).toEqual([name, was.rows.length]);
            const kept = now!.rows.map((found) => Object.fromEntries(Object.keys(was.columns).map((c) => [c, found[c]])));
            expect(kept, `the rows of ${name}`).toEqual(was.rows);
            // A column the update adds holds nothing on a row that was there.
            for (const column of added[name]!) expect([name, column, now!.rows.filter((found) => found[column] !== null).length]).toEqual([name, column, 0]);
          }
          console.info(`[redeclared, ${engine}${run.title}] ${JSON.stringify(redeclared)}`);
          expect(redeclared).toEqual([]);
          expect(Object.fromEntries(Object.entries(added).filter(([, list]) => list.length > 0))).toEqual(Object.fromEntries(Object.entries(NEW_COLUMNS).map(([ref, list]) => [`${PREFIX}${ref}`, list])));
          // And over HTTP: every row Adminium hands out is the one it handed out before.
          const nowHttp = await all();
          for (const [ref, list] of Object.entries(beforeHttp)) {
            const extra = NEW_COLUMNS[ref] ?? [];
            const trimmed = nowHttp[ref]!.map((found) => Object.fromEntries(Object.entries(found).filter(([column]) => !extra.includes(column))));
            const bools = yesNoColumns(ref);
            const said = (list2: Record<string, unknown>[]) => list2.map((found) => Object.fromEntries(Object.entries(found).map(([column, value]) => [column, bools.includes(column) && (value === 1 || value === 0) ? value === 1 : value])));
            expect(said(trimmed), `${ref} over HTTP`).toEqual(said(list));
          }
          // The new tables, with the manifest's columns, and nothing in them.
          for (const ref of NEW_TABLES) {
            const table = after[`${PREFIX}${ref}`];
            expect(table, `${PREFIX}${ref} exists`).toBeDefined();
            expect([ref, Object.keys(table!.columns).sort()]).toEqual([ref, TABLES.find((t) => t.ref === ref)!.columns.map((c) => c.ref).sort()]);
            expect([ref, table!.rows.length]).toEqual([ref, 0]);
          }
        }, 120_000);

        // ── one write on an old row ───────────────────────────────────────────

        it(`hands over, for cash, the order left on the shelf under ${FROM}: as a ${FROM} screen sends it, and its money is what it was`, async () => {
          const was = await row("orders", made.shelf);
          await move(made.shelf, { status: "picked_up", paid_method: "cash" });
          const now = await row("orders", made.shelf);
          expect([now["status"], now["paid_method"]]).toEqual(["picked_up", "cash"]);
          expect(money(now)).toEqual(money(was));
          // Nothing was paid by gift card, so cash agrees; what it owed at the counter was its total. The figures an
          // email tests are worked out at the move, though the order was placed before they existed.
          expect([Number(now["method_ok"]), Number(now["to_pay"]), now["prepaid"], now["card_used"]].map(Number)).toEqual([1, Number(was["total"]), 0, 0]);
        }, 120_000);

        // ── the sample on update ──────────────────────────────────────────────

        it(`leaves the sample as ${FROM} added it: the update adds no sample rows`, async () => {
          const now = await sample();
          expect([now.loaded, now.total]).toEqual([sampleBefore.loaded, sampleBefore.total]);
        }, 60_000);

        it("removes the sample afterwards, keeping what the kitchen itself moved", async () => {
          const removed = await staff.post<{ removed: number; kept: number }>("/api/v1/apps/ordering/sample-data/remove", { keepChanged: true });
          expect(removed.status, JSON.stringify(removed.body).slice(0, 800)).toBe(200);
          expect(removed.body.removed).toBeGreaterThan(0);
          expect((await sample()).loaded).toBe(false);
          const orders = (await rows("orders")).map((order) => Number(order.id));
          expect(orders).toContain(made.shelf);
          expect(orders).toContain(made.handed);
        }, 180_000);
      });
    });
  });
});
