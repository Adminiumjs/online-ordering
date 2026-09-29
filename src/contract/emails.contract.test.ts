/**
 * THE KITCHEN'S EMAILS, RECEIPTS AND HOLIDAYS, ON EVERY ENGINE.
 *
 * The app installed on a BUILT Adminium with both add-ons it suggests ticked
 * — Invoices & Receipts and Holiday Calendars, packed from an add-ons
 * checkout — its sample added at 11:40, and every email read from the
 * server's own mail sink as the diner gets it: the online confirmation with
 * its lines, options, tax and the link to follow the order, in the language
 * the order was placed in; the phone confirmation without a link; the ready
 * email after its twenty seconds; a cancel that says why, one per reason;
 * the receipt at pickup with the document attached and the options printed
 * under each dish; the enquiry's reference. Then Holiday Calendars' days,
 * read by the kitchen as its screens read them, one made a closure: the
 * order page offers no time that day.
 *
 * Sample orders never produce email (Adminium's rule): every email here is
 * about an order this file makes. It runs with `CONTRACT=1` (see
 * `install.contract.test.ts`); its servers take the port block after
 * `identity.contract.test.ts`'s.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AdminiumDiner } from "../data/adminiumDiner.ts";
import type { OrderBody, Row } from "../data/wire.ts";
import { DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { addDays, instantOf, venueDay } from "../lib/venueTime.ts";
import { EMAIL_EN, type EmailWords } from "../manifest/emails.ts";
import { EMAIL_TRANSLATIONS } from "../manifest/emails-i18n.ts";
import { ENGINES, missing, missingAddOn, ok, PORTS_PER_ENGINE, until, type Engine } from "./harness.ts";
import { ADMIN, standUp, type Stand } from "./stand.ts";

const why = missing() ?? missingAddOn("invoices") ?? missingAddOn("holiday-calendars");
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
/** After `identity.contract.test.ts`'s servers. */
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4870) + 9 * PORTS_PER_ENGINE;

const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const at = (time: string, day = TODAY) => new Date(instantOf(day, time, DEMO_ZONE)).toISOString();

const WORDS: Record<string, EmailWords> = { "en-US": EMAIL_EN, ...(EMAIL_TRANSLATIONS as Record<string, EmailWords>) };
/** An email's words as they reach a reader: every run of spaces (a no-break one too) as one. */
const flat = (text: string) => text.replace(/[\s  ]+/g, " ").trim();
/** A template sentence with the values it names filled in. */
const fill = (sentence: string, values: Record<string, string>) => sentence.replace(/\{\{([A-Za-z_.]+)\}\}/g, (whole, name: string) => values[name] ?? whole);
const money = (amount: unknown, tag: string) => new Intl.NumberFormat(tag, { style: "currency", currency: "USD" }).format(Number(amount));

describe.skipIf(why !== null)(`the kitchen's emails on a built Adminium${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let stand: Stand;
      let diner: AdminiumDiner;
      const address = (who: string) => `${who}.${engine}@juniper-diners.dev`;

      beforeAll(async () => {
        stand = await standUp(engine as Engine, PORT_BASE + index * PORTS_PER_ENGINE, `oo_emails_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { addOns: ["invoices", "holiday-calendars"] });
        await stand.server.setClock(DEMO_START - 30_000);
        diner = await stand.dinerOf();
      }, 300_000);

      afterAll(async () => {
        await stand?.server.stop();
      });

      /** A bowl with three options and two cookies, by this Adminium's ids. */
      const cart = async (values: Record<string, unknown>): Promise<OrderBody> => {
        const menu = await diner.menu();
        const bowl = menu.items.find((d) => d["name"] === "Signature grain bowl")!;
        const cookie = menu.items.find((d) => d["name"] === "Brown butter cookie")!;
        const groups = menu.groups.filter((g) => g["item_id"] === bowl.id).map((g) => g.id);
        const option = (name: string) => menu.options.find((o) => o["name"] === name && groups.includes(o["group_id"] as number))!.id;
        return {
          values: { pickup_at: at("12:30"), ...values },
          children: {
            order_items: [
              { values: { menu_item_id: bowl.id, qty: 1 }, children: { order_item_modifiers: ["Farro", "Grilled chicken", "Avocado"].map((n) => ({ values: { modifier_id: option(n) } })) } },
              { values: { menu_item_id: cookie.id, qty: 2 } },
            ],
          },
        };
      };
      const placeOnline = async (who: string, language: string, values: Record<string, unknown> = {}) => {
        const body = await cart({ name: who, email: address(who.toLowerCase()), language, ...values });
        const quote = await diner.quote(body);
        return diner.place({ ...body, expect: { total: String(quote.data["total"]) } }, `${who}-${engine}-0123456789abcdefgh`.toLowerCase());
      };

      let ada: Row;
      it("confirms an order placed in German, in German: its lines and options, the tax the German way, the link to follow it", async () => {
        const before = await stand.mailCount();
        ada = (await placeOnline("Ada", "de-DE")).data;
        const mail = await stand.mailTo(address("ada"), before);
        const de = WORDS["de-DE"]!;
        expect(mail.subject).toBe(fill(de["order-confirmation"].subject, { "order.number": String(ada["number"]) }));
        const text = flat(mail.text);
        // "Farro, Grilled chicken, Avocado" under the bowl; each figure in the diner's money; "8,25 %".
        expect(text).toContain("Farro, Grilled chicken, Avocado");
        expect(text).toContain(flat(money(ada["total"], "de-DE")));
        expect(text).toContain(flat(`${de.tax} ${new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 2 }).format(0.0825)}`));
        expect(text).toContain(de.payAtPickup);
        expect(text).toMatch(/\/o#[A-Za-z0-9]{8,}/);
      }, 240_000);

      it("confirms a phone order to the email the caller gave, without a link", async () => {
        const menu = await stand.kitchen.menu();
        const before = await stand.mailCount();
        const made = await stand.kitchen.phoneOrder(
          { values: { name: "Cy", phone: "(555) 013-4455", email: address("cy"), pickup_at: at("13:30") }, children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 2 } }] } },
          `cy-${engine}-0123456789abcdefghij`,
        );
        const mail = await stand.mailTo(address("cy"), before);
        expect(mail.subject).toBe(fill(EMAIL_EN["order-confirmation-phone"].subject, { "order.number": String(made.data["number"]) }));
        expect(flat(mail.text)).toContain("Lemonade × 2");
        expect(mail.text).not.toMatch(/\/o#/);
      }, 240_000);

      it("says an order is on the shelf twenty seconds after it is, and hands it over with the receipt attached", async () => {
        const id = ada.id as number;
        for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"], ["preparing", "ready"]] as const) await stand.kitchen.move(id, from, to);
        const before = await stand.mailCount();
        const ready = await stand.mailTo(address("ada"), before);
        expect(ready.subject).toBe(fill(WORDS["de-DE"]!["order-ready"].subject, { "order.number": String(ada["number"]) }));
        const handed = await stand.kitchen.handOff(id, "card");
        expect(handed["status"]).toBe("picked_up");
        const receipt = await stand.mailTo(address("ada"), before + 1);
        expect(receipt.attachments.map((a) => a.contentType)).toContain("application/pdf");
        // "Bezahlt mit: Karte" — the way the diner paid, in their words.
        expect(flat(receipt.text)).toContain(fill(WORDS["de-DE"]!["order-receipt"].paras[1]!, { "order.paid_method.label": "Karte" }));
      }, 300_000);

      it("takes back a hand-over after its receipt went, and sends the corrected one when it is handed over again", async () => {
        const id = ada.id as number;
        const back = await stand.kitchen.move(id, "picked_up", "ready");
        expect([back["status"], back["paid_method"]]).toEqual(["ready", null]);
        const before = await stand.mailCount();
        await stand.kitchen.handOff(id, "cash");
        // "Bezahlt mit: Bar" — one receipt a hand-over; the ready email is not sent twice.
        const corrected = await stand.mailTo(address("ada"), before);
        const venue = String((await stand.rows("settings"))[0]!["venue_name"]);
        expect(corrected.subject).toBe(fill(WORDS["de-DE"]!["order-receipt"].subject, { appName: venue }));
        expect(flat(corrected.text)).toContain(fill(WORDS["de-DE"]!["order-receipt"].paras[1]!, { "order.paid_method.label": "Bar" }));
        const mail = await stand.messagesOf(id);
        const receipts = mail.filter((m) => m["kind"] === "order-receipt");
        expect(receipts.map((m) => m["status"])).toEqual(["sent", "sent"]);
        expect(new Set(receipts.map((m) => m["repeat_key"])).size).toBe(2);
        expect(mail.filter((m) => m["kind"] === "order-ready")).toHaveLength(1);
      }, 300_000);

      it("queues no receipt while the kitchen's receipt switch is off, with Invoices & Receipts attached", async () => {
        const settings = (await stand.rows("settings"))[0]!;
        const path = `${stand.data("settings")}/${String(settings.id)}`;
        ok(await stand.staff.patch(path, { values: { receipt_email_on: false } }));
        try {
          const menu = await stand.kitchen.menu();
          const made = await stand.kitchen.phoneOrder(
            { values: { name: "Dee", phone: "(555) 014-5566", email: address("dee"), pickup_at: at("13:45") }, children: { order_items: [{ values: { menu_item_id: menu.items.find((d) => d["name"] === "Lemonade")!.id, qty: 1 } }] } },
            `dee-${engine}-0123456789abcdefghij`,
          );
          const id = made.data.id as number;
          for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"], ["preparing", "ready"]] as const) await stand.kitchen.move(id, from, to);
          await stand.kitchen.handOff(id, "card");
          // Judged when it would be queued: none is, and none comes later.
          await until(async () => ((await stand.messagesOf(id)).some((m) => m["kind"] === "order-ready") ? true : undefined), "the ready email queued");
          expect((await stand.messagesOf(id)).filter((m) => m["kind"] === "order-receipt")).toEqual([]);
        } finally {
          ok(await stand.staff.patch(path, { values: { receipt_email_on: true } }));
        }
      }, 240_000);

      it("prints a receipt with each dish's options under it", async () => {
        const drawn = ok(await stand.staff.post<{ printUrl: string }>("/api/v1/apps/ordering/documents/render", { ref: "orders", kind: "receipt", pk: { id: ada.id } }), 201);
        const page = flat(String((await stand.staff.get(drawn.printUrl)).body));
        for (const words of [String(ada["number"]), "Signature grain bowl", "Farro · Grilled chicken · Avocado", "Brown butter cookie"]) expect(page, words).toContain(words);
      }, 120_000);

      it("tells a diner why the kitchen cancelled, one email a reason, in their language", async () => {
        const reasons = [
          { code: "ran_out", who: "Bo", language: "fr-FR", dish: "Wild mushroom", note: null },
          { code: "too_busy", who: "Di", language: "en-US", dish: null, note: null },
          { code: "customer_asked", who: "Ed", language: "cs-CZ", dish: null, note: null },
          { code: "other", who: "Fe", language: "da-DK", dish: null, note: "The oven is being repaired." },
        ];
        for (const [i, r] of reasons.entries()) {
          const made = (await placeOnline(r.who, r.language, { pickup_at: at(["14:30", "14:45", "15:00", "15:15"][i]!) })).data;
          const confirmed = await stand.mailTo(address(r.who.toLowerCase()), 0);
          expect(confirmed.subject).toContain(String(made["number"]));
          const before = await stand.mailCount();
          await stand.kitchen.cancel(made.id, "placed", r.code, r.dish, r.note);
          const mail = await stand.mailTo(address(r.who.toLowerCase()), before);
          const kind = `order-cancelled-${r.code.replace("_", "-")}` as keyof EmailWords;
          const words = WORDS[r.language]![kind] as { subject: string; paras: string[] };
          expect(mail.subject, r.code).toBe(fill(words.subject, { "order.number": String(made["number"]) }));
          expect(flat(mail.text), r.code).toContain(flat(fill(words.paras[0]!, { "order.cancel_dish": r.dish ?? "", "order.cancel_note": r.note ?? "", "order.number": String(made["number"]) })));
        }
      }, 600_000);

      it("gives a large-order enquiry its reference, the people and the day, in the diner's language", async () => {
        const before = await stand.mailCount();
        const made = await diner.enquire(
          { heads: 24, wanted_on: addDays(TODAY, 3), name: "Gil", phone: "(555) 016-7788", email: address("gil"), language: "en-US", notes: "Office lunch" },
          `gil-${engine}-0123456789abcdefghij`,
        );
        const mail = await stand.mailTo(address("gil"), before);
        expect(mail.subject).toBe(fill(EMAIL_EN["enquiry-received"].subject, { "enquiry.ref": String(made["ref"]) }));
        expect(flat(mail.text)).toContain("24 people");
      }, 240_000);

      it("reads Holiday Calendars' days as the kitchen does, and one made a closure closes the order page that day", async () => {
        ok(await stand.staff.put("/api/v1/add-ons/holiday-calendars/settings", { values: { days: [{ date: "2026-12-25", name: "Christmas Day", from: { country: "US", year: 2026 } }] } }));
        const kitchen = await stand.kitchenAgain();
        expect(await kitchen.holidays()).toEqual([{ date: "2026-12-25", name: "Christmas Day" }]);
        const closure = await kitchen.addClosure({ from_date: "2026-12-25", to_date: "2026-12-25", reason: "Christmas Day" });
        // The day before, the order page offers Christmas Eve and nothing on Christmas Day.
        await stand.server.setClock(instantOf("2026-12-24", "10:00", DEMO_ZONE));
        // Five months on, the operator's session has long ended: signed in again, the kitchen booted again.
        await stand.staff.signIn(ADMIN.email, ADMIN.password);
        const tablet = await stand.kitchenAgain();
        const page = await stand.dinerOf();
        expect((await page.closures()).map((c) => String(c["from_date"]).slice(0, 10))).toContain("2026-12-25");
        expect((await page.slots("2026-12-24")).some((s) => s.state === "free")).toBe(true);
        // A closed day has no times at all.
        expect(await page.slots("2026-12-25")).toEqual([]);
        // Switched off, the day opens again.
        await tablet.setClosure(closure.id, false);
        await until(async () => ((await page.slots("2026-12-25")).some((s) => s.state === "free") ? true : undefined), "Christmas Day to open again", 60_000);
      }, 180_000);
    });
  });
});

