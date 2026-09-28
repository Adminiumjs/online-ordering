/**
 * WHO SEES WHAT, THROUGH EVERY PUBLIC DOOR, ON EVERY ENGINE.
 *
 * The app installed on a BUILT Adminium with its sample; two diners, Ama and
 * Ben, each with an order placed online. Every entry the two browser keys
 * offer is asked as every kind of caller — nobody, Ama signed in, the holder
 * of Ama's order link — and each answer is held to what that caller may see:
 * the keys offer exactly the entries the order page uses; no answer carries a
 * column the kitchen keeps to itself (who moved an order, the portions, the
 * retry key, the link's code); nobody reads a diner's order without being
 * that diner or holding its link; a session or a link reaches only its own
 * order, its lines and their options; and no caller writes what Adminium
 * decides — a price, a total, a number, a status other than the diner's own
 * cancel, a reason other than "cancelled by me", another order.
 *
 * It runs with `CONTRACT=1`; its servers take the port block after
 * `menu.contract.test.ts`'s.
 */
import { createPublicClient, PublicApiError, type PublicClient, type PublicConfig } from "@adminiumjs/public-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { publicRefs, PUBLIC_REFS, type RefName, type Refs } from "../data/publicRefs.ts";
import type { Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { addDays, instantOf, venueDay } from "../lib/venueTime.ts";
import { Caller, ENGINES, missing, ok, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
/** After `menu.contract.test.ts`'s servers. */
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 18 * PORTS_PER_ENGINE;

const TOMORROW = addDays(venueDay(DEMO_START, DEMO_ZONE), 1);

/** Columns no public answer may carry, whoever asks. */
const KEPT = /(^|_)by$|^stock_(today|on)$|^client_key$|^link_(token|stopped)$|^customer_id$|^forgotten_at$|^online$|^available$/;

const LINK_REFS: RefName[] = ["linkOrder", "linkLines", "linkOptions"];
const CUSTOMER_REFS = (Object.keys(PUBLIC_REFS) as RefName[]).filter((name) => !LINK_REFS.includes(name));
/** What nobody may read: a diner's own rows. */
const OWN_REFS: RefName[] = ["account", "myOrders", "myLines", "myOptions", "linkOrder", "linkLines", "linkOptions"];
/** Read with `availability`, never listed. */
const AVAILABILITY: RefName[] = ["slots", "portions"];
/** Written, never read. */
const WRITE_ONLY: RefName[] = ["place", "enquire"];

/** The refusal a call answered, or "ANSWERED". */
async function outcome(call: () => Promise<unknown>): Promise<string> {
  try {
    await call();
    return "ANSWERED";
  } catch (error) {
    if (error instanceof PublicApiError) return error.code;
    throw error;
  }
}
const REFUSED = (code: string) => code !== "ANSWERED";

describe.skipIf(why !== null)(`who sees what on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      let refs: Refs;
      let served: { publishableKey: string; publicKeys: Record<string, string> };
      const client = (key: "customer" | "link"): PublicClient =>
        createPublicClient({
          baseUrl: stand.server.base,
          publishableKey: key === "customer" ? served.publishableKey : served.publicKeys["link"]!,
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            headers.set("origin", stand.server.base);
            return fetch(input, { ...init, headers });
          },
          humanCheck: true,
        })!;
      const order: Record<"ama" | "ben", { id: number; token: string }> = { ama: { id: 0, token: "" }, ben: { id: 0, token: "" } };
      const address = (who: string) => `${who}.${engine}@juniper-diners.dev`;
      let ama: PublicClient;
      let amaLink: PublicClient;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_isolation_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
        served = ok(await new Caller(stand.server.base).get<typeof served & { tables?: Record<string, string> }>("/apps/ordering/customer/surface-config.json"));
        refs = publicRefs((served as { tables?: Record<string, string> }).tables);
        // Two diners' orders, placed as the page places them; each link's code from its confirmation.
        const menu = (await client("customer").list<Row>(refs.dishes, { limit: 200 })).data;
        const lemonade = menu.find((d) => d["name"] === "Lemonade")!;
        for (const who of ["ama", "ben"] as const) {
          const page = client("customer");
          const before = await stand.mailCount();
          const made = await page.createTree<Row>(refs.place, {
            values: { name: who, email: address(who), language: "en-US", pickup_at: new Date(instantOf(TOMORROW, who === "ama" ? "12:30" : "13:30", DEMO_ZONE)).toISOString(), client_key: `${who}-${engine}-0123456789abcdefghij` },
            children: { order_items: [{ values: { menu_item_id: lemonade["id"], qty: 1 } }] },
          });
          const mail = await stand.mailTo(address(who), before);
          order[who] = { id: made.data["id"] as number, token: /\/o#([A-Za-z0-9]+)/.exec(mail.text)?.[1] ?? "" };
        }
        // Ama signed in with the code her sign-in email carries; and Ama's order opened by its link.
        ama = client("customer");
        const before = await stand.mailCount();
        await ama.requestLink({ email: address("ama") });
        const code = /\b(\d{6})\b/.exec((await stand.mailTo(address("ama"), before)).text)?.[1] ?? "";
        expect((await ama.verifyLinkCode({ email: address("ama"), code })).ok).toBe(true);
        amaLink = client("link");
        expect(await amaLink.openShared(order.ama.token)).toBe("opened");
      }, 400_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      it("offers through each key exactly the entries the order page uses, and none shows a column the kitchen keeps", async () => {
        const configs: [PublicConfig, RefName[]][] = [
          [await client("customer").config(), CUSTOMER_REFS],
          [await client("link").config(), LINK_REFS],
        ];
        for (const [config, names] of configs) {
          expect(Object.keys(config.refs).sort()).toEqual(names.map((n) => refs[n]).sort());
          for (const [ref, entry] of Object.entries(config.refs)) expect(entry.expose.filter((c) => KEPT.test(c)), ref).toEqual([]);
        }
      }, 60_000);

      it("reads nobody's own rows to nobody, and no personal detail to nobody", async () => {
        const nobody = client("customer");
        const nobodyLink = client("link");
        const config = await nobody.config();
        for (const name of CUSTOMER_REFS.filter((n) => !AVAILABILITY.includes(n))) {
          const answer = await outcome(() => nobody.list<Row>(refs[name], { limit: 200 }));
          if (OWN_REFS.includes(name) || WRITE_ONLY.includes(name)) {
            expect(REFUSED(answer), `${name} answered nobody`).toBe(true);
            continue;
          }
          expect(answer, name).toBe("ANSWERED");
          // The kitchen's own words and menu: only what the entry says it shows, nothing the kitchen keeps.
          const exposed = new Set(config.refs[refs[name]]!.expose);
          const rows = (await nobody.list<Row>(refs[name], { limit: 200 })).data;
          for (const row of rows) expect(Object.keys(row).filter((c) => KEPT.test(c) || !exposed.has(c)), name).toEqual([]);
        }
        for (const name of LINK_REFS) expect(REFUSED(await outcome(() => nobodyLink.list<Row>(refs[name], { limit: 200 }))), `${name} answered nobody`).toBe(true);
        expect(REFUSED(await outcome(() => nobody.get<Row>(refs.myOrders, String(order.ama.id))))).toBe(true);
      }, 120_000);

      /** Every row an own-rows entry answers, and each order they belong to. */
      const ownOrders = async (who: PublicClient, names: [RefName, RefName, RefName]) => {
        const [orders, lines, options] = await Promise.all(names.map(async (n) => (await who.list<Row>(refs[n], { limit: 200 })).data));
        const lineOrder = new Map(lines!.map((l) => [l["id"], l["order_id"]]));
        return {
          orders: new Set(orders!.map((o) => o["id"])),
          lines: new Set(lines!.map((l) => l["order_id"])),
          options: new Set(options!.map((o) => lineOrder.get(o["order_item_id"] as number) ?? "someone else's")),
          columns: [...orders!, ...lines!, ...options!].flatMap((row) => Object.keys(row)),
        };
      };

      it("reads a signed-in diner her own order, its lines and options, and nobody else's", async () => {
        const mine = await ownOrders(ama, ["myOrders", "myLines", "myOptions"]);
        expect([...mine.orders]).toEqual([order.ama.id]);
        expect([...mine.lines]).toEqual([order.ama.id]);
        expect([...mine.options].every((id) => id === order.ama.id)).toBe(true);
        expect(mine.columns.filter((c) => KEPT.test(c))).toEqual([]);
        for (const name of ["myOrders", "myLines", "myOptions"] as const) expect(REFUSED(await outcome(() => ama.get<Row>(refs[name], String(order.ben.id)))), name).toBe(true);
      }, 60_000);

      it("reads a link's holder that one order, its lines and options, and nothing else", async () => {
        const held = await ownOrders(amaLink, ["linkOrder", "linkLines", "linkOptions"]);
        expect([...held.orders]).toEqual([order.ama.id]);
        expect([...held.lines]).toEqual([order.ama.id]);
        expect(held.columns.filter((c) => KEPT.test(c))).toEqual([]);
        expect(REFUSED(await outcome(() => amaLink.get<Row>(refs.linkOrder, String(order.ben.id))))).toBe(true);
      }, 60_000);

      it("lets no caller write what Adminium decides, nor touch another's order", async () => {
        // Placing: a price, a total, a number, a status, a reason, a customer are not the page's to send.
        const page = client("customer");
        const menu = (await page.list<Row>(refs.dishes, { limit: 200 })).data;
        const base = { name: "Cy", email: address("cy"), language: "en-US", pickup_at: new Date(instantOf(TOMORROW, "14:30", DEMO_ZONE)).toISOString() };
        const line = { order_items: [{ values: { menu_item_id: menu[0]!["id"], qty: 1 } }] };
        for (const extra of [{ total: "0.01" }, { subtotal: "0.01" }, { number: "1" }, { status: "confirmed" }, { cancel_code: "closed" }, { customer_id: 1 }, { channel: "phone" }, { paid_method: "cash" }]) {
          expect(REFUSED(await outcome(() => page.createTree<Row>(refs.place, { values: { ...base, ...extra }, children: line }))), JSON.stringify(extra)).toBe(true);
        }
        expect(REFUSED(await outcome(() => page.createTree<Row>(refs.place, { values: base, children: { order_items: [{ values: { menu_item_id: menu[0]!["id"], qty: 1, unit_price: "0.01" } }] } }))), "a line's price").toBe(true);
        // Her own order: only her cancel, only as hers; never another's.
        for (const values of [{ status: "confirmed" }, { status: "picked_up" }, { cancel_code: "ran_out" }, { total: "0.01" }, { name: "Mallory" }, { pickup_at: new Date(instantOf(TOMORROW, "15:00", DEMO_ZONE)).toISOString() }]) {
          expect(REFUSED(await outcome(() => ama.update<Row>(refs.myOrders, String(order.ama.id), values))), `signed in ${JSON.stringify(values)}`).toBe(true);
          expect(REFUSED(await outcome(() => amaLink.update<Row>(refs.linkOrder, String(order.ama.id), values))), `link ${JSON.stringify(values)}`).toBe(true);
        }
        expect(REFUSED(await outcome(() => ama.update<Row>(refs.myOrders, String(order.ben.id), { status: "cancelled" })))).toBe(true);
        expect(REFUSED(await outcome(() => amaLink.update<Row>(refs.linkOrder, String(order.ben.id), { status: "cancelled" })))).toBe(true);
        for (const name of ["myOrders", "myLines", "linkOrder", "linkLines"] as const) {
          const who = LINK_REFS.includes(name) ? amaLink : ama;
          expect(REFUSED(await outcome(() => who.remove(refs[name], String(order.ama.id)))), `remove ${name}`).toBe(true);
        }
        // Nothing moved: Ben's order is as he placed it, and Ama's too.
        const rows = await stand.rows("orders");
        for (const who of ["ama", "ben"] as const) expect(rows.find((o) => o.id === order[who].id)!["status"]).toBe("placed");
        // Her own cancel goes, as hers.
        const cancelled = await amaLink.update<Row>(refs.linkOrder, String(order.ama.id), { status: "cancelled" });
        expect([cancelled["status"], cancelled["cancel_code"]]).toEqual(["cancelled", "self"]);
      }, 180_000);
    });
  });
});
