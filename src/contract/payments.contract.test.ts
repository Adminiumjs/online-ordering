/**
 * PAYING ONLINE, ON A BUILT ADMINIUM: THE UPDATE THAT ADDS IT, AND WHAT IT KEEPS.
 *
 * On SQLite, Postgres and MySQL, along the path a kitchen takes:
 *
 *   1. the released 0.3.2's own manifest (from its tag) installed with its
 *      sample, and gift card money in its rows: two payments by gift card and
 *      a refund of one to its card — rows 0.3.2 holds as "gift card
 *      payments";
 *   2. THIS build uploaded: the plan only adds — the columns paying online
 *      needs, and the new values of four lists — and it applies;
 *   3. every gift card payment and refund that was there is still a gift
 *      card's (`method` filled with `gift_card` by the update), with the money
 *      it held, and every order's money is what it was;
 *   4. the orders' payable arrives switched off, and someone who manages
 *      payments switches the app on and off in one place;
 *   5. with payments off, the order page reads "not now", and an order placed
 *      to pay now waits for its payment (no pay link): no confirmation goes;
 *      the diner pays at pickup instead, and the confirmation goes, once;
 *   6. one left waiting past the kitchen's hold is cancelled as not paid in
 *      time, and nobody is emailed;
 *   7. the diner's own cancel still says it is theirs;
 *   8. a payment taken online (written here by the workspace's admin, as no
 *      payment service runs in the contract): the order is paid, reaches the
 *      shelf with the "paid online" ready email, is handed over as paid
 *      online and never as cash; and money given back of it is a refund row
 *      that names it, with its email;
 *   9. nobody but a payment writes an online payment's reference.
 *
 * It runs where the plain contract runs, and needs the tag `v0.3.2` in the
 * checkout (a shallow clone has none: then it says so and skips). Its servers
 * take ports from `CONTRACT_PAYMENTS_PORT_BASE`.
 */
import { execFileSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AdminiumDiner } from "../data/adminiumDiner.ts";
import type { OrderBody } from "../data/wire.ts";
import { DEMO_CURRENCY, DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { addDays, instantOf, venueDay } from "../lib/venueTime.ts";
import { appBundle, boot, Caller, ENGINES, missing, ok, PORTS_PER_ENGINE, until, type Engine, type Server } from "./harness.ts";

type Row = Record<string, unknown> & { id: number };

const REQUIRED = ["1", "true"].includes(process.env["ADMINIUM_REQUIRE_CONTRACT"] ?? "");
const RELEASED_TAG = "v0.3.2";
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };
const PREFIX = "ordering_";
const PORT_BASE = Number(process.env["CONTRACT_PAYMENTS_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 200);
const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const TOMORROW = addDays(TODAY, 1);

/** A file of the released 0.3.2, from its tag; null when the checkout has no such tag. */
function released(path: string): string | null {
  try {
    return execFileSync("git", ["show", `${RELEASED_TAG}:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}
const OLD_MANIFEST = released("manifest.json");
const OLD_SAMPLE = released("seeds/ordering.sample.json");
const why = missing() ?? (OLD_MANIFEST === null || OLD_SAMPLE === null ? `no ${RELEASED_TAG} tag in this checkout` : null);
if (why !== null && REQUIRED && missing() !== null) throw new Error(`the payments contract must run here, and cannot: ${why}`);

/**
 * The released sample, with gift card money in it: what a kitchen on 0.3.2
 * with Offers & gift cards has (here written as history, the add-on away). A
 * card paid $10.00 of a picked-up order and $2.00 of it went back to the card;
 * another paid all of a second order.
 */
function sampleWithCards(): string {
  const bundle = JSON.parse(OLD_SAMPLE!) as { tables: { ref: string; rows: Record<string, unknown>[] }[] };
  const orders = bundle.tables.find((t) => t.ref === "orders")!.rows;
  const done = orders.filter((o) => o["status"] === "picked_up").slice(0, 2);
  const at = (o: Record<string, unknown>) => o["placed_at"];
  bundle.tables.push({
    ref: "payments",
    rows: done.map((o, i) => ({
      "@label": `payment:card-${String(i)}`,
      order_id: { "@ref": o["@label"] },
      card_code: `GC-4417-2208-000${String(i)}`,
      card_id: 9000 + i,
      card_last4: `000${String(i)}`,
      amount: i === 0 ? 10 : 5,
      card_balance_after: 1,
      made_at: at(o),
      made_by: "Sam",
    })),
  });
  bundle.tables.push({
    ref: "payment_refunds",
    rows: [{ payment_id: { "@ref": "payment:card-0" }, order_id: { "@ref": done[0]!["@label"] }, amount: 2, reason: "Made smaller", made_at: at(done[0]!), made_by: "Sam" }],
  });
  return JSON.stringify(bundle);
}

/** What this build adds to 0.3.2's tables, and the lists it widens: the update's plan must be exactly this. */
const NEW_COLUMNS: Record<string, string[]> = {
  settings: ["auto_refund", "pay_hold_minutes"],
  orders: ["card_paid", "online_paid", "online_refunded", "online_taken", "online_used", "paid_as"],
  payments: ["method", "paid_at", "payment_ref", "provider", "refunded_elsewhere"],
  payment_refunds: ["automatic", "counted", "method", "provider_ref", "refund_state"],
};
const WIDER: Record<string, string[]> = { orders: ["cancel_code", "paid_method", "status"], messages: ["kind"] };

describe.skipIf(why !== null)(`paying online, updating ${RELEASED_TAG}${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      const port = PORT_BASE + index * PORTS_PER_ENGINE;
      let server: Server;
      let staff: Caller;
      let connectionId = "";
      let tableIds: Record<string, string> = {};
      let before: { payments: Row[]; refunds: Row[]; orders: Row[] } = { payments: [], refunds: [], orders: [] };

      const learnTables = async () => {
        const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connectionId}/schema`));
        tableIds = Object.fromEntries(schema.model.tables.map((t) => [t.name, t.id]));
      };
      const data = (ref: string) => `/api/v1/data/${connectionId}/${encodeURIComponent(tableIds[`${PREFIX}${ref}`]!)}`;
      const rows = async (ref: string): Promise<Row[]> => {
        const out: Row[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = ok(await staff.get<{ data: Row[] }>(`${data(ref)}?limit=200&offset=${String(offset)}`)).data;
          out.push(...page);
          if (page.length < 200) return out.sort((a, b) => Number(a.id) - Number(b.id));
        }
      };
      const order = async (id: number) => (await rows("orders")).find((o) => Number(o.id) === id)!;
      const messagesOf = async (id: number) => (await rows("messages")).filter((m) => Number(m["order_id"]) === id);
      const upload = async (bundle: { buffer: Buffer; integrity: string }) => {
        const reply = await staff.post(`/api/v1/apps/upload?expectedSha512=${encodeURIComponent(bundle.integrity)}`, bundle.buffer);
        expect([200, 201], JSON.stringify(reply.body).slice(0, 800)).toContain(reply.status);
      };
      const cents = (value: unknown) => (value === null || value === undefined ? null : Number(value).toFixed(2));

      /** The order page's door, as the page builds it from the customer side's config. */
      const dinerDoor = async () => {
        const served = ok(await new Caller(server.base).get<{ publishableKey: string; publicKeys?: Record<string, string>; tables?: Record<string, string> }>("/apps/ordering/customer/surface-config.json"));
        const originFetch: typeof fetch = (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set("origin", server.base);
          return fetch(input, { ...init, headers });
        };
        return new AdminiumDiner(
          { baseUrl: server.base, publishableKey: served.publishableKey, ...(served.tables === undefined ? {} : { tables: served.tables }), ...(served.publicKeys === undefined ? {} : { publicKeys: served.publicKeys }) },
          { fetch: originFetch, storage: null },
        );
      };
      let free = ["18:00", "18:15", "18:30", "18:45", "19:00"];
      /** An order of a lemonade for tomorrow, placed as the page places it: to pay at pickup, or now. */
      const placeOrder = async (diner: AdminiumDiner, name: string, payNow: boolean) => {
        const menu = await diner.menu();
        const time = free.shift()!;
        const body: OrderBody = {
          values: { name, email: `${name.toLowerCase()}.${engine}@juniper-diners.dev`, language: "en-US", pickup_at: new Date(instantOf(TOMORROW, time, DEMO_ZONE)).toISOString() },
          children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] },
        };
        const quote = await diner.quote(body);
        const made = await diner.place({ ...body, expect: { total: String(quote.data["total"]) } }, `${engine}-${name}-${time}-0123456789abcdef`.replace(/[^A-Za-z0-9-]/g, ""), payNow ? { payNow: true } : {});
        await diner.openLink(made.link!.token);
        return made;
      };

      beforeAll(async () => {
        server = await boot(engine as Engine, port, DEMO_START);
        staff = new Caller(server.base, { origin: server.base });
        await staff.signIn(ADMIN.email, ADMIN.password);
        const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
        connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
        ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: DEMO_CURRENCY }));
      }, 240_000);

      afterAll(async () => {
        await server?.stop();
      });

      // ── 0.3.2, with gift card money ───────────────────────────────────────

      it(`installs ${RELEASED_TAG}'s own manifest and sample, with gift card payments and a refund to a card in its rows`, async () => {
        const app = appBundle({ manifest: OLD_MANIFEST!, sample: sampleWithCards() });
        await upload(app);
        const body = { key: app.key, version: app.version, connectionId };
        const plan = ok(await staff.post<{ plan: { installable: boolean; checksum: string } }>("/api/v1/apps/plan", body)).plan;
        expect(plan.installable).toBe(true);
        ok(await staff.post("/api/v1/apps/install", { ...body, planChecksum: plan.checksum }));
        await learnTables();
        await server.setClock(DEMO_START, true);
        ok(await staff.post("/api/v1/apps/ordering/sample-data"));
        await until(async () => (ok(await staff.get<{ loaded: boolean }>("/api/v1/apps/ordering/sample-data")).loaded ? true : undefined), "the sample to be added");
        await server.setClock(DEMO_START);
        before = { payments: await rows("payments"), refunds: await rows("payment_refunds"), orders: await rows("orders") };
        expect([before.payments.length, before.refunds.length]).toEqual([2, 1]);
      }, 300_000);

      // ── the update ────────────────────────────────────────────────────────

      it("plans the update: the columns paying online needs and four lists widened, nothing dropped, renamed or rewritten", async () => {
        const app = appBundle();
        await upload(app);
        const plan = ok(
          await staff.post<{ plan: { installable: boolean; checksum: string; problems: unknown[]; tables: { ref: string; action: string; edits: { kind: string; column: string; values?: string[] }[]; blocked: unknown[] }[] } }>("/api/v1/apps/plan", {
            key: app.key,
            version: app.version,
            connectionId,
          }),
        ).plan;
        console.info(`[payments update plan, ${engine}] ${JSON.stringify(plan.tables.filter((t) => t.edits.length > 0).map((t) => ({ ref: t.ref, edits: t.edits })))}`);
        expect([plan.installable, plan.problems]).toEqual([true, []]);
        for (const table of plan.tables) {
          expect([table.ref, table.action, table.blocked]).toEqual([table.ref, "reuse", []]);
          expect([table.ref, table.edits.filter((e) => e.kind === "add-column").map((e) => e.column).sort()]).toEqual([table.ref, NEW_COLUMNS[table.ref] ?? []]);
          const others = table.edits.filter((e) => e.kind !== "add-column");
          expect([table.ref, [...new Set(others.map((e) => e.column))].sort()]).toEqual([table.ref, WIDER[table.ref] ?? []]);
          for (const edit of others) expect([table.ref, edit.column, edit.kind]).toEqual([table.ref, edit.column, expect.stringMatching(/enum/i)]);
        }
        const update = await staff.post<{ from: string; to: string }>("/api/v1/apps/ordering/update", {
          planChecksum: plan.checksum,
          // The order page's new doors (pay now; pay at pickup instead) and the manager's right to refund: the operator's to allow.
          publicAccess: true,
          publicWider: true,
          roleGrants: true,
        });
        expect(update.status, JSON.stringify(update.body).slice(0, 1500)).toBe(200);
        expect([update.body.from, update.body.to]).toEqual([JSON.parse(OLD_MANIFEST!).version, app.version]);
        await learnTables();
      }, 240_000);

      it("keeps every gift card payment and refund a gift card's, with the money it held, and every order's money as it was", async () => {
        const payments = await rows("payments");
        const refunds = await rows("payment_refunds");
        expect(payments.map((p) => [p.id, p["method"], p["card_id"], cents(p["amount"]), p["payment_ref"]])).toEqual(before.payments.map((p) => [p.id, "gift_card", p["card_id"], cents(p["amount"]), null]));
        // What each kept is what it kept: a refund to a card counts as it always did.
        expect(payments.map((p) => [p.id, cents(p["returned"]), cents(p["kept"])])).toEqual(before.payments.map((p) => [p.id, cents(p["returned"]), cents(p["kept"])]));
        expect(refunds.map((r) => [r.id, r["method"], cents(r["amount"]), r["refund_state"], r["automatic"] === true || r["automatic"] === 1])).toEqual(before.refunds.map((r) => [r.id, "gift_card", cents(r["amount"]), null, false]));
        const orders = await rows("orders");
        // What the update wrote into the new columns of the rows that were there, for the update contract to hold to.
        const filled: Record<string, Record<string, unknown[]>> = {};
        for (const [ref, list] of [["orders", orders], ["payments", payments], ["payment_refunds", refunds], ["settings", await rows("settings")]] as const) {
          filled[ref] = Object.fromEntries((NEW_COLUMNS[ref] ?? []).map((c) => [c, [...new Set(list.map((r) => r[c] ?? null))].slice(0, 6)]));
        }
        console.info(`[payments update filled, ${engine}] ${JSON.stringify(filled)}`);
        const money = (o: Row) => [o.id, o["status"], cents(o["total"]), cents(o["paid"]), cents(o["due"])];
        expect(orders.map(money)).toEqual(before.orders.map(money));
        // The settings row's new switches, as they arrive: refunds by themselves, and a ten-minute hold.
        const settings = (await rows("settings"))[0]!;
        expect([settings["auto_refund"] === true || settings["auto_refund"] === 1, Number(settings["pay_hold_minutes"])]).toEqual([true, 10]);
      }, 120_000);

      // ── the payable ───────────────────────────────────────────────────────

      it("arrives with the orders' payable switched off, and is switched on and off again in one place", async () => {
        type Apps = { data: { apps: { appKey: string; connectionId: string; enabled: boolean; tables: { tableName: string; valid: boolean }[] }[] } };
        const listed = () => staff.get<Apps>("/api/v1/payments/apps").then((reply) => ok(reply).data.apps.filter((a) => a.appKey === "ordering"));
        // The table by its real name (a schema may stand before it, as on SQLite's `main.`).
        expect((await listed()).map((a) => [a.connectionId, a.enabled, a.tables.map((t) => [t.tableName.replace(/^.*\./, ""), t.valid])])).toEqual([[connectionId, false, [[`${PREFIX}orders`, true]]]]);
        expect(ok(await staff.post<{ data: { changed: number } }>("/api/v1/payments/apps/switch", { connectionId, appKey: "ordering", enabled: true })).data.changed).toBe(1);
        expect((await listed()).map((a) => a.enabled)).toEqual([true]);
        ok(await staff.post("/api/v1/payments/apps/switch", { connectionId, appKey: "ordering", enabled: false }));
        expect((await listed()).map((a) => a.enabled)).toEqual([false]);
      }, 60_000);

      // ── the order page, payments off ──────────────────────────────────────

      it("holds an order placed to pay now while payments are off: no pay link, no confirmation; paid at pickup instead, confirmed once", async () => {
        ok(await staff.put("/api/v1/settings/email", { publicOrigin: server.base }));
        ok(await staff.put("/api/v1/public-api", { enabled: true }));
        const diner = await dinerDoor();
        // Nobody switched the app on in Payments: "Pay now" is not offered.
        expect(await diner.payments()).toEqual({ online: false, test: false });
        const made = await placeOrder(diner, "Kwame", true);
        expect([made.data["status"], made.payUrl]).toEqual(["paying", null]);
        const id = made.data.id;
        // Its confirmation waits, and is dropped: an order waiting for its payment is not confirmed.
        const dropped = await until(async () => (await messagesOf(id)).find((m) => m["kind"] === "order-confirmation" && m["status"] !== "queued"), "the held confirmation");
        expect([dropped["status"], dropped["skip_reason"]]).toEqual(["skipped", "no-longer-needed"]);
        // The diner pays at pickup instead: new, unpaid, and confirmed as any order paid at pickup.
        const placed = await diner.payAtPickup("link", id);
        expect([placed["status"], placed["cancel_code"]]).toEqual(["placed", null]);
        const sent = await until(async () => (await messagesOf(id)).find((m) => m["kind"] === "order-confirmation" && m["status"] === "sent"), "the confirmation");
        expect(sent["status"]).toBe("sent");
        expect((await messagesOf(id)).filter((m) => m["status"] === "sent").map((m) => m["kind"])).toEqual(["order-confirmation"]);
        // Once new, it is not waiting for anything: the move is refused (nothing matches).
        expect(await diner.payAtPickup("link", id).then(() => "moved", (error: { status?: number }) => error.status)).toBe(404);
      }, 300_000);

      it("lets an order go when its hold ends unpaid: cancelled as not paid in time, and nobody emailed", async () => {
        const diner = await dinerDoor();
        const made = await placeOrder(diner, "Ines", true);
        const id = made.data.id;
        const placedAt = Date.parse(String((await order(id))["placed_at"]));
        await server.setClock(placedAt + 11 * 60_000);
        const gone = await until(async () => {
          const now = await order(id);
          return now["status"] === "cancelled" ? now : undefined;
        }, "the timed cancel of an unpaid order", 240_000);
        expect([gone["status"], gone["cancel_code"]]).toEqual(["cancelled", "unpaid"]);
        await new Promise((resolve) => setTimeout(resolve, 8_000));
        expect((await messagesOf(id)).filter((m) => m["status"] === "sent")).toEqual([]);
      }, 300_000);

      it("still marks the diner's own cancel as theirs", async () => {
        const diner = await dinerDoor();
        const made = await placeOrder(diner, "Lena", false);
        expect(made.data["status"]).toBe("placed");
        const cancelled = await diner.cancelLinked(made.data.id);
        expect([cancelled["status"], cancelled["cancel_code"]]).toEqual(["cancelled", "self"]);
      }, 180_000);

      // ── an order paid online ─────────────────────────────────────────────

      it("hands over an order paid online as paid online, never as cash; and money given back of it is a refund row that names it", async () => {
        const diner = await dinerDoor();
        const made = await placeOrder(diner, "Omar", false);
        const id = made.data.id;
        const total = String((await order(id))["total"]);
        // Nobody but a payment fills an online payment's reference.
        const forged = await staff.post(data("payments"), { values: { order_id: id, method: "online", amount: total, payment_ref: "pi_forged" } });
        expect([forged.status, forged.code]).toEqual([403, "TABLE_FORBIDDEN"]);
        // The money taken online, as the payment writes it (the workspace's admin stands in for the service here).
        const paid = ok(await staff.post<{ data: Row }>(data("payments"), { values: { order_id: id, method: "online", amount: total, provider: "Stripe" } }), 201).data;
        const now = await order(id);
        expect([cents(now["paid"]), cents(now["online_paid"]), cents(now["to_pay"]), Number(now["paid_as"]), Number(now["online_used"])]).toEqual([cents(total), cents(total), "0.00", 2, 1]);
        for (const status of ["confirmed", "preparing", "ready"]) ok(await staff.patch(`${data("orders")}/${String(id)}`, { values: { status } }));
        const ready = await until(async () => (await messagesOf(id)).find((m) => m["kind"] === "order-ready-paid" && m["status"] !== "queued"), "the ready email of an order paid online");
        expect(ready["status"]).toBe("sent");
        // Paid by cash does not agree with what was paid: refused. Paid online does.
        const cash = await staff.patch(`${data("orders")}/${String(id)}`, { values: { status: "picked_up", paid_method: "cash" } });
        expect(cash.status, JSON.stringify(cash.body).slice(0, 600)).toBe(409);
        ok(await staff.patch(`${data("orders")}/${String(id)}`, { values: { status: "picked_up", paid_method: "online" } }));
        expect([(await order(id))["status"], (await order(id))["paid_method"]]).toEqual(["picked_up", "online"]);
        // A refund of it, online: the row names the payment and its order, and goes back through the service. No
        // service took this payment, so Adminium stamps it not sent, and it counts for nothing in what the payment kept.
        const refund = ok(await staff.post<{ data: Row }>(data("payment_refunds"), { values: { payment_id: paid.id, method: "online", amount: "1.00", reason: "A drink was missing", client_key: `refund-${engine}-0123456789abcdef` } }), 201).data;
        expect([refund["order_id"], refund["method"]]).toEqual([id, "online"]);
        const stamped = await until(async () => (await rows("payment_refunds")).find((r) => r.id === refund.id && r["refund_state"] !== null), "the refund's stamp");
        expect(stamped["refund_state"]).toBe("not-sent");
        expect(cents((await rows("payments")).find((p) => p.id === paid.id)!["kept"])).toBe(cents(total));
      }, 300_000);
    });
  });
});
