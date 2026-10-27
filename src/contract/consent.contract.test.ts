/**
 * THE TICK FOR THE KITCHEN'S NEWS, KEPT IN ADMINIUM'S CONSENT LOG, ON EVERY ENGINE.
 *
 * The order page's `AdminiumDiner` against a BUILT Adminium with the app
 * installed and its sample added at 11:40, the consent log read as the
 * diner's record page reads it: a stranger's tick at checkout is one row in
 * the log, from the form, with the wording shown and its language, kept for
 * the diner the address finds or makes (never the order), and sets their
 * "News from us"; a box left unticked writes nothing and takes back no
 * earlier yes; a diner on the do-not-email list still gets their order's
 * emails (every one is service mail); no door of the diner's side, and no
 * role of the kitchen's, sets the newsletter or an order's tick by hand; a
 * signed-in diner's tick is theirs whatever address they type; and
 * "Delete my details" takes the newsletter back, the log saying so first.
 *
 * It runs with `CONTRACT=1` (see `install.contract.test.ts`); its servers take
 * the ports after `limits.contract.test.ts`'s.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AdminiumDiner } from "../data/adminiumDiner.ts";
import { AdminiumKitchen } from "../data/adminiumKitchen.ts";
import { publicRefs } from "../data/publicRefs.ts";
import { createSessionTransport } from "../data/sessionSource.ts";
import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { loadStaffConfig } from "../staffConnection.ts";
import { Caller, ENGINES, missing, ok, PORTS_PER_ENGINE, solve, type Engine } from "./harness.ts";
import { standUp, tab, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_CONSENT_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 160);

const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const at = (time: string) => new Date(instantOf(TODAY, time, DEMO_ZONE)).toISOString();

/** The six-digit code a sign-in email carries. */
const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)?.[1] ?? "";
/** A yes/no as each engine hands it back. */
const ticked = (value: unknown) => value === true || value === 1 || value === "1";

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

type Panel = { declared: boolean; purposes: { purpose: string; state: string }[]; history: { state: string; source: string; detail: string | null; wordingVersion: string | null }[] };

describe.skipIf(why !== null)(`the tick for the kitchen's news on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      /** Diners with a mailbox the sink reads (a reserved address is never sent to). */
      const noor = `noor.${engine}@juniper-diners.dev`;
      const omar = `omar.${engine}@juniper-diners.dev`;
      const pia = `pia.${engine}@juniper-diners.dev`;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_consent_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
      }, 300_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      // ── the order page, as a tab of its own ─────────────────────────────

      /** What the customer build is served: its keys and the tables' real names. */
      const served = async () =>
        ok(await new Caller(stand.server.base).get<{ publishableKey: string; publicKeys?: Record<string, string>; tables?: Record<string, string> }>("/apps/ordering/customer/surface-config.json"));
      /** A fresh tab of the order page, whose storage the test reads: the sessions it keeps, by key. */
      const tabOf = async () => {
        const s = await served();
        const storage = tab();
        const originFetch: typeof fetch = (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set("origin", stand.server.base);
          return fetch(input, { ...init, headers });
        };
        const diner = new AdminiumDiner(
          { baseUrl: stand.server.base, publishableKey: s.publishableKey, ...(s.tables === undefined ? {} : { tables: s.tables }), ...(s.publicKeys === undefined ? {} : { publicKeys: s.publicKeys }) },
          { fetch: originFetch, storage },
        );
        const session = (key: "customer" | "link") => (JSON.parse(storage.getItem(`ordering.session.${key}`) ?? "null") as { token: string } | null)?.token;
        return { diner, session };
      };
      /** The public API called by hand, as a crafted request would be: a key, a session, a human check. */
      const door = async () => {
        const s = await served();
        const refs = publicRefs(s.tables);
        const call = async (key: string, session: string | undefined, path: string, method: string, body?: unknown) => {
          const headers: Record<string, string> = { authorization: `Bearer ${key}`, origin: stand.server.base, "content-type": "application/json", ...(session === undefined ? {} : { "x-adminium-public-session": session }) };
          const challenge = ok(await new Caller(stand.server.base, { authorization: `Bearer ${key}`, origin: stand.server.base }).get<{ data: { id: string; salt: string; difficulty: number } }>("/api/v1/public/challenge?purpose=write")).data;
          headers["x-adminium-proof"] = `${challenge.id}.${solve(challenge.salt, challenge.difficulty)}`;
          const res = await fetch(new URL(path, stand.server.base), { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
          return { status: res.status, body: (await res.json().catch(() => ({}))) as { error?: { code?: string } } };
        };
        return { keys: { customer: s.publishableKey, link: s.publicKeys?.["link"] ?? "" }, refs, call };
      };

      /** A Lemonade, by this Adminium's ids, for a diner and a time; the tick given or not. */
      const order = async (diner: AdminiumDiner, values: Record<string, unknown>): Promise<OrderBody> => {
        const menu = await diner.menu();
        return { values: { language: "en-US", ...values }, children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] } };
      };
      let keys = 0;
      /** An order placed through the order page's own door, at the price it was shown; the order and its diner as Adminium keeps them. */
      const placeAs = async (diner: AdminiumDiner, values: Record<string, unknown>) => {
        const body = await order(diner, values);
        const quote = await diner.quote(body);
        keys += 1;
        const made = await diner.place({ ...body, expect: { total: String(quote.data["total"]) } }, `consent-${engine}-${String(keys)}-0123456789abcdefghij`);
        const row = (await stand.rows("orders")).find((o) => o.id === made.data.id)!;
        return { order: row, customer: (await stand.rows("customers")).find((c) => c.id === row["customer_id"])! };
      };
      /** How a diner stands in the consent log, as their record page's panel reads it. */
      const panelOf = async (customerId: unknown) =>
        ok(await stand.staff.post<{ data: Panel }>("/api/v1/consent/panel", { connectionId: stand.connectionId, table: stand.ids["customers"]!, recordId: String(customerId) })).data;
      const said = (panel: Panel) => panel.history.map((e) => [e.state, e.source, e.detail, e.wordingVersion]);
      const newsOf = (panel: Panel) => panel.purposes.find((p) => p.purpose === "newsletter")!.state;
      const customerBy = async (id: unknown) => (await stand.rows("customers")).find((c) => c.id === id)!;

      // ── a stranger at checkout ──────────────────────────────────────────

      let noorId: unknown;
      it("keeps a stranger's tick in the consent log, for the diner the address makes, in the order's language", async () => {
        const { diner } = await tabOf();
        const made = await placeAs(diner, { name: "Noor Haddad", email: noor, language: "fr-FR", pickup_at: at("12:30"), opt_in: true });
        noorId = made.customer.id;
        // The order keeps the tick; the diner met for the first time is named, in the order's language, with the newsletter's yes.
        expect([ticked(made.order["opt_in"]), made.customer["email"], made.customer["name"], made.customer["language"], ticked(made.customer["opt_in"])]).toEqual([true, noor, "Noor Haddad", "fr-FR", true]);
        // One row in the log: from the form, the wording shown and its language — kept for the diner, never the order.
        const panel = await panelOf(noorId);
        expect([panel.declared, newsOf(panel), said(panel)]).toEqual([true, "yes", [["yes", "form", "ordering:orders", "v1 fr-FR"]]]);
      }, 240_000);

      let omarId: unknown;
      it("writes nothing for a box left unticked, and takes back no earlier yes", async () => {
        const { diner } = await tabOf();
        const plain = await placeAs(diner, { name: "Omar Saleh", email: omar, pickup_at: at("12:45"), opt_in: false });
        omarId = plain.customer.id;
        expect([ticked(plain.order["opt_in"]), plain.customer["name"], plain.customer["language"], ticked(plain.customer["opt_in"]), said(await panelOf(omarId))]).toEqual([false, "Omar Saleh", "en-US", false, []]);
        // Noor orders again, the box left empty, in another language: her yes and her language stay as they were.
        const again = await placeAs(diner, { name: "Noor Haddad", email: noor, language: "de-DE", pickup_at: at("13:15"), opt_in: false });
        expect([again.order["customer_id"], ticked(again.order["opt_in"]), again.customer["language"], ticked(again.customer["opt_in"])]).toEqual([noorId, false, "fr-FR", true]);
        expect(said(await panelOf(noorId))).toEqual([["yes", "form", "ordering:orders", "v1 fr-FR"]]);
      }, 240_000);

      it("still sends the confirmation to a diner on the do-not-email list: every email of the kitchen is service mail", async () => {
        const added = ok(await stand.staff.post<{ data: { added: number } }>("/api/v1/consent/stop-list", { addresses: [pia] })).data;
        expect(added.added).toBe(1);
        const before = await stand.mailCount();
        const { diner } = await tabOf();
        const made = await placeAs(diner, { name: "Pia", email: pia, pickup_at: at("13:30") });
        const mail = await stand.mailTo(pia, before);
        expect(mail.subject).toContain(String(made.order["number"]));
        const sent = (await stand.messagesOf(made.order.id)).filter((m) => m["kind"] === "order-confirmation");
        expect(sent.map((m) => m["status"])).toEqual(["sent"]);
      }, 240_000);

      // ── the diner's own doors ────────────────────────────────────────────

      /** Omar's tab, signed in with the code his email carries; and the order he placed in it, with its link. */
      let omarTab: Awaited<ReturnType<typeof tabOf>>;
      let omarOrder: Row;
      it("never lets a diner's own account, their orders or an order's link set the news by hand", async () => {
        omarTab = await tabOf();
        omarOrder = (await placeAs(omarTab.diner, { name: "Omar Saleh", email: omar, pickup_at: at("14:00") })).order;
        const linkSession = omarTab.session("link");
        expect(linkSession).toBeTruthy();
        // His two orders' confirmations in his mailbox first: the next email to him is the sign-in's, and its code the one read.
        await stand.mailsTo(omar, 0, 2);
        const before = await stand.mailCount();
        await omarTab.diner.requestSignIn(omar, "en-US");
        await omarTab.diner.verifyCode(omar, codeIn((await stand.mailTo(omar, before)).text));
        const session = omarTab.session("customer");
        expect(session).toBeTruthy();
        const d = await door();
        const record = (ref: string, id: unknown) => `/api/v1/public/records/${ref}/${String(id)}`;
        // His own account, by its own door: his name is his to change, the newsletter is not.
        const named = await d.call(d.keys.customer, session, record(d.refs.account, omarId), "PATCH", { values: { name: "Omar S." } });
        expect(named.status, JSON.stringify(named.body).slice(0, 400)).toBe(200);
        const byHand = await d.call(d.keys.customer, session, record(d.refs.account, omarId), "PATCH", { values: { opt_in: true } });
        expect(byHand.status, JSON.stringify(byHand.body).slice(0, 400)).toBeGreaterThanOrEqual(400);
        // Nor an order's tick: from his signed-in orders, or by the order's own link.
        const mine = await d.call(d.keys.customer, session, record(d.refs.myOrders, omarOrder.id), "PATCH", { values: { opt_in: true } });
        expect(mine.status, JSON.stringify(mine.body).slice(0, 400)).toBeGreaterThanOrEqual(400);
        const linked = await d.call(d.keys.link, linkSession, record(d.refs.linkOrder, omarOrder.id), "PATCH", { values: { opt_in: true } });
        expect(linked.status, JSON.stringify(linked.body).slice(0, 400)).toBeGreaterThanOrEqual(400);
        const after = await customerBy(omarId);
        expect([after["name"], ticked(after["opt_in"]), ticked((await stand.rows("orders")).find((o) => o.id === omarOrder.id)!["opt_in"]), said(await panelOf(omarId))]).toEqual(["Omar S.", false, false, []]);
      }, 300_000);

      it("keeps a signed-in diner's tick for them, whatever address they type, in their own language", async () => {
        const made = await placeAs(omarTab.diner, { name: "Omar S.", email: `someone.else.${engine}@juniper-diners.dev`, language: "fr-FR", pickup_at: at("14:15"), opt_in: true });
        expect([made.order["customer_id"], ticked(made.order["opt_in"])]).toEqual([omarId, true]);
        const panel = await panelOf(omarId);
        expect([ticked((await customerBy(omarId))["opt_in"]), newsOf(panel), said(panel)]).toEqual([true, "yes", [["yes", "form", "ordering:orders", "v1 en-US"]]]);
      }, 240_000);

      it("deletes a diner's details at their asking: the newsletter taken back, and the log says so first", async () => {
        await omarTab.diner.forget();
        const panel = await panelOf(omarId);
        const gone = await customerBy(omarId);
        expect([gone["email"], gone["name"], ticked(gone["opt_in"]), newsOf(panel), said(panel)]).toEqual([
          null,
          null,
          false,
          "no",
          [
            ["no", "person", "forget", null],
            ["yes", "form", "ordering:orders", "v1 en-US"],
          ],
        ]);
      }, 240_000);

      // ── the kitchen's side ───────────────────────────────────────────────

      /** Somebody holding one of the app's roles and no other, signed in; and the kitchen's door over their session. */
      const person = async (pattern: RegExp, email: string, name: string, screens: boolean) => {
        const roles = ok(await stand.staff.get<{ roles: { id: string; name: string }[] }>("/api/v1/roles")).roles;
        const role = roles.find((one) => pattern.test(one.name))!;
        const invited = ok(await stand.staff.post<{ invite: { token: string } }>("/api/v1/users", { email, name, roleIds: [role.id] }), 201);
        const password = `${randomBytes(18).toString("base64url")}Aa1!`;
        ok(await new Caller(stand.server.base, { origin: stand.server.base }).post("/api/v1/auth/password/reset", { token: invited.invite.token, newPassword: password }));
        const caller = new Caller(stand.server.base, { origin: stand.server.base });
        if (screens) await caller.signInToScreens(email, password);
        else await caller.signIn(email, password);
        const cfg = (await loadStaffConfig({ hostedStaff: true, base: "/apps/ordering/staff/", fetchImpl: caller.fetchAs() }))!;
        const transport = createSessionTransport({
          tableOfRef: cfg.tables,
          connectionId: cfg.connectionId ?? undefined,
          staff: { csrfToken: cfg.csrfToken, timezone: cfg.timezone, timezoneSource: cfg.timezoneSource, serverTimezone: cfg.serverTimezone, currency: cfg.currency },
          fetchImpl: caller.fetchAs(),
        });
        const kitchen = new AdminiumKitchen(transport, cfg);
        await kitchen.config();
        return { caller, kitchen };
      };

      it("takes the diner's address on a phone order, and no tick: in the kitchen or as the manager", async () => {
        const cook = await person(/kitchen/i, `cook.${engine}@juniper-kitchen.dev`, "Cook", true);
        const menu = await cook.kitchen.menu();
        const call = (name: string, time: string, more: Record<string, unknown> = {}): OrderBody => ({
          values: { name, phone: "(555) 010-2020", email: `${name.toLowerCase()}.${engine}@juniper-diners.dev`, pickup_at: at(time), ...more },
          children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] },
        });
        // A caller's address is the kitchen's to take, so their order's emails reach them.
        const taken = await cook.kitchen.phoneOrder(call("Rafa", "14:30"), `rafa-${engine}-0123456789abcdefghij`);
        const rafa = (await stand.rows("orders")).find((o) => o.id === taken.data.id)!;
        expect([rafa["email"], rafa["channel"], ticked(rafa["opt_in"]), rafa["customer_id"] ?? null]).toEqual([`rafa.${engine}@juniper-diners.dev`, "phone", false, null]);
        // The news is the diner's own to ask for: a phone order that says yes for them is refused, and writes nothing.
        const cooked = await refusal(cook.kitchen.phoneOrder(call("Sol", "14:45", { opt_in: true }), `sol-${engine}-0123456789abcdefghijk`));
        expect([cooked.status, cooked.code]).toEqual([403, "COLUMN_FORBIDDEN"]);
        expect((await stand.rows("orders")).some((o) => o["name"] === "Sol")).toBe(false);
        // The manager, who may change everything else a person types on an order, neither.
        const manager = await person(/manager/i, `lea.${engine}@juniper-kitchen.dev`, "Lea", false);
        const managed = await refusal(manager.kitchen.phoneOrder(call("Tam", "15:00", { opt_in: true }), `tam-${engine}-0123456789abcdefghijk`));
        expect([managed.status, managed.code]).toEqual([403, "COLUMN_FORBIDDEN"]);
        const changed = await manager.caller.patch(`${stand.data("orders")}/${String(rafa.id)}`, { values: { opt_in: true } });
        expect([changed.status, changed.code]).toEqual([403, "COLUMN_FORBIDDEN"]);
        expect(ticked((await stand.rows("orders")).find((o) => o.id === rafa.id)!["opt_in"])).toBe(false);
      }, 300_000);
    });
  });
});
