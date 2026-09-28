/**
 * A DINER'S OWN ORDERS, THROUGH THE ORDER PAGE'S REAL DOOR, ON EVERY ENGINE.
 *
 * The order page's `AdminiumDiner` against a BUILT Adminium with the app
 * installed and its sample added at 11:40, and the emails read from the
 * server's own mail sink: a diner who ordered as a stranger finds the order
 * again by the code their email carries, orders it again at Adminium's price,
 * follows it by the link its confirmation carries, cancels one from their
 * session while it is new (and not once the kitchen has it), never reaches
 * another diner's order by any door, signs out here and everywhere, and
 * deletes their details — asked to sign in again first when their sign-in is
 * old — after which the links their orders were emailed with open nothing.
 * An order's own link stops thirty days after its pickup.
 *
 * It runs with `CONTRACT=1` (see `install.contract.test.ts`); its servers take
 * the port block after `doors.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import type { OrderWithLines } from "../data/ports.ts";
import { ApiError, type OrderBody } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import { EMAIL_TRANSLATIONS } from "../manifest/emails-i18n.ts";
import { ENGINES, missing, PORTS_PER_ENGINE, type Engine } from "./harness.ts";
import { standUp, type Stand } from "./stand.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
/** After `install.contract.test.ts`'s and `doors.contract.test.ts`'s servers. */
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 6 * PORTS_PER_ENGINE;

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

/** The six-digit code a sign-in email carries. */
const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)?.[1] ?? "";
/** The code in a link's fragment (`…#t=<code>` or the last `#…` part). */
const fragmentIn = (text: string, path: string): string => {
  const link = new RegExp(`https?://[^\\s"'<>]*${path}[^\\s"'<>]*`).exec(text)?.[0] ?? "";
  const hash = link.split("#")[1] ?? "";
  return new URLSearchParams(hash).get("t") ?? hash;
};

describe.skipIf(why !== null)(`a diner's own orders on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      /** Two diners, each with a mailbox the sink reads (a reserved address is never sent to). */
      const ama = `ama.${engine}@juniper-diners.dev`;
      const ben = `ben.${engine}@juniper-diners.dev`;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_identity_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        await stand.server.setClock(DEMO_START - 30_000);
      }, 300_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** A bowl with three options and a cookie, by this Adminium's ids. */
      const cart = async (diner: AdminiumDiner, values: Record<string, unknown>): Promise<OrderBody> => {
        const menu = await diner.menu();
        const bowl = menu.items.find((d) => d["name"] === "Signature grain bowl")!;
        const cookie = menu.items.find((d) => d["name"] === "Brown butter cookie")!;
        const groups = menu.groups.filter((g) => g["item_id"] === bowl.id).map((g) => g.id);
        const option = (name: string) => menu.options.find((o) => o["name"] === name && groups.includes(o["group_id"] as number))!.id;
        return {
          values: { language: "en-US", pickup_at: at("12:30"), ...values },
          children: {
            order_items: [
              { values: { menu_item_id: bowl.id, qty: 1 }, children: { order_item_modifiers: ["Farro", "Grilled chicken", "Avocado"].map((n) => ({ values: { modifier_id: option(n) } })) } },
              { values: { menu_item_id: cookie.id, qty: 2 } },
            ],
          },
        };
      };

      /** Signs a fresh tab in with the code an emailed sign-in carries. */
      const signIn = async (email: string): Promise<AdminiumDiner> => {
        const diner = await stand.dinerOf();
        const before = await stand.mailCount();
        // The page is told where it went only as far as the address shows nobody's workplace.
        expect(await diner.requestSignIn(email, "en-US")).toEqual({ sentTo: `${email.slice(0, 1)}•••@j•••.dev` });
        const mail = await stand.mailTo(email, before);
        await diner.verifyCode(email, codeIn(mail.text));
        return diner;
      };

      let first: { id: number; token: string; total: string };
      it("sends a stranger's order its confirmation with the link to follow it", async () => {
        const diner = await stand.dinerOf();
        const body = await cart(diner, { name: "Ama", email: ama, phone: "(555) 019-7711" });
        const quote = await diner.quote(body);
        const before = await stand.mailCount();
        const placed = await diner.place({ ...body, expect: { total: String(quote.data["total"]) } }, `ama-first-${engine}-0123456789abcdef`);
        const mail = await stand.mailTo(ama, before);
        expect(mail.subject).toContain(String(placed.data["number"]));
        const token = fragmentIn(mail.text, "/o");
        expect(token).not.toBe("");
        first = { id: placed.data.id, token, total: String(placed.data["total"]) };
      }, 240_000);

      let ama1: AdminiumDiner;
      let mine: OrderWithLines[];
      it("finds that order again by the code the sign-in email carries", async () => {
        ama1 = await signIn(ama);
        const person = await ama1.signedIn();
        expect(person).toMatchObject({ email: ama });
        mine = await ama1.myOrders();
        expect(mine.map((o) => o.order.id)).toEqual([first.id]);
        const [bowl, cookie] = mine[0]!.lines;
        expect([bowl!["name"], bowl!["qty"], bowl!.options.map((o) => o["name"])]).toEqual(["Signature grain bowl", 1, ["Farro", "Grilled chicken", "Avocado"]]);
        expect([cookie!["name"], cookie!["qty"]]).toEqual(["Brown butter cookie", 2]);
        // An address with no orders is answered the same, and learns nothing.
        expect(await (await stand.dinerOf()).requestSignIn(`nobody.${engine}@juniper-diners.dev`)).toEqual({ sentTo: "n•••@j•••.dev" });
      }, 300_000);

      let again: number;
      it("orders it again, signed in, at Adminium's price, and it joins their orders", async () => {
        const past = mine[0]!;
        // Rebuilt from the ids the order kept: each line's dish and options.
        const rebuilt: OrderBody = {
          // Placed in French this time: its emails follow the order's language, not what she used before.
          values: { name: "Ama", email: ama, language: "fr-FR", pickup_at: at("13:00") } as Record<string, unknown>,
          children: {
            order_items: past.lines.map((line) => ({
              values: { menu_item_id: line["menu_item_id"], qty: line["qty"] },
              ...(line.options.length === 0 ? {} : { children: { order_item_modifiers: line.options.map((o) => ({ values: { modifier_id: o["modifier_id"] } })) } }),
            })),
          },
        };
        // 1:00 PM is paused (by Sam, in the sample): a time the page never offers is refused, and says which.
        const paused = await refusal(ama1.quote(rebuilt));
        expect([paused.status, paused.code, paused.params]).toEqual([400, "PUBLIC_WRITE_REFUSED", { column: "pickup_at", reason: "paused" }]);
        rebuilt.values["pickup_at"] = at("13:15");
        const quote = await ama1.quote(rebuilt);
        expect(Number(quote.data["total"])).toBe(Number(first.total));
        const before = await stand.mailCount();
        const placed = await ama1.place({ ...rebuilt, expect: { total: String(quote.data["total"]) } }, `ama-again-${engine}-0123456789abcdef`);
        again = placed.data.id;
        expect((await ama1.myOrders()).map((o) => o.order.id)).toEqual([again, first.id]);
        // Addressed to her through her own row, in the order's language.
        const mail = await stand.mailTo(ama, before);
        expect(mail.subject).toBe(EMAIL_TRANSLATIONS["fr-FR"]["order-confirmation"].subject.replace("{{order.number}}", String(placed.data["number"])));
      }, 120_000);

      it("follows an order by the link its confirmation carries", async () => {
        const byLink = await stand.dinerOf();
        await byLink.openLink(first.token);
        const followed = await byLink.linkedOrder();
        expect([followed.order.id, followed.order["status"], followed.lines.length]).toEqual([first.id, "placed", 2]);
      }, 60_000);

      it("cancels one from the session while it is new, and not once the kitchen has it", async () => {
        const before = await stand.mailCount();
        const cancelled = await ama1.cancelMine(again);
        expect([cancelled["status"], cancelled["cancel_code"]]).toEqual(["cancelled", "self"]);
        const told = await stand.mailTo(ama, before);
        expect(told.subject.length).toBeGreaterThan(0);
        expect((await stand.messagesOf(again)).filter((m) => m["kind"] === "order-cancelled-by-you")).toHaveLength(1);
        await stand.kitchen.move(first.id, "placed", "confirmed");
        const taken = await refusal(ama1.cancelMine(first.id));
        expect(taken.status).toBe(404);
        expect((await ama1.myOrders()).find((o) => o.order.id === first.id)!.order["status"]).toBe("confirmed");
      }, 240_000);

      let benOrder: { id: number; token: string };
      it("keeps each diner to their own orders, by every door", async () => {
        const diner = await stand.dinerOf();
        const body = await cart(diner, { name: "Ben", email: ben, pickup_at: at("14:00") });
        const quote = await diner.quote(body);
        const before = await stand.mailCount();
        const placed = await diner.place({ ...body, expect: { total: String(quote.data["total"]) } }, `ben-first-${engine}-0123456789abcdef`);
        benOrder = { id: placed.data.id, token: fragmentIn((await stand.mailTo(ben, before)).text, "/o") };
        // Ama's session: Ben's order is as if it were not there.
        expect((await ama1.myOrders()).some((o) => o.order.id === benOrder.id)).toBe(false);
        expect((await refusal(ama1.cancelMine(benOrder.id))).status).toBe(404);
        // Ben's link opens Ben's order, and cancels no other.
        const byLink = await stand.dinerOf();
        await byLink.openLink(benOrder.token);
        expect((await byLink.linkedOrder()).order.id).toBe(benOrder.id);
        expect((await refusal(byLink.cancelLinked(first.id))).status).toBe(404);
      }, 240_000);

      it("signs out on this device, and on every device", async () => {
        const other = await signIn(ama);
        expect((await other.myOrders()).length).toBe(2);
        await other.signOut();
        expect(await other.signedIn()).toBeNull();
        // Still signed in on the first device, until it signs out everywhere.
        expect((await ama1.myOrders()).length).toBe(2);
        const third = await signIn(ama);
        await third.signOutEverywhere();
        expect(await ama1.signedIn()).toBeNull();
        expect((await refusal(ama1.myOrders())).status).toBe(404);
      }, 400_000);

      it("deletes a diner's details, asking an old sign-in to sign in again, and their order's link then opens nothing", async () => {
        const stale = await signIn(ben);
        // Eleven minutes on, the sign-in is too old to delete with.
        await stand.server.setClock((await stand.now()) + 11 * 60_000);
        expect((await refusal(stale.forget())).code).toBe("PUBLIC_CODE_STEP_UP");
        const fresh = await signIn(ben);
        await fresh.forget();
        expect(await fresh.signedIn()).toBeNull();
        const customer = (await stand.rows("customers")).find((c) => c["forgotten_at"] !== null && c["forgotten_at"] !== undefined)!;
        expect([customer["email"], customer["name"]]).toEqual([null, null]);
        // The order keeps what the kitchen needs of it; the link Ben was emailed opens nothing now.
        const kept = (await stand.rows("orders")).find((o) => o.id === benOrder.id)!;
        expect(kept["status"]).toBe("placed");
        // Its code was made afresh, and the new one went to nobody: the old one is unknown (the page says it has expired).
        expect((await refusal((await stand.dinerOf()).openLink(benOrder.token))).code).toBe("PUBLIC_REF_NOT_FOUND");
      }, 400_000);

      it("stops an order's own link thirty days after its pickup", async () => {
        const still = await stand.dinerOf();
        await still.openLink(first.token);
        await stand.server.setClock(instantOf(TODAY, "12:30", DEMO_ZONE) + 30 * 86_400_000 + 60_000);
        expect((await refusal((await stand.dinerOf()).openLink(first.token))).code).toBe("LINK_EXPIRED");
      }, 120_000);
    });
  });
});
