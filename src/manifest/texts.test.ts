/**
 * The ready text and the checkout's box for it, as the manifest declares
 * them: one service text a diner is waiting for, held through the kitchen's
 * Undo and dropped by it; a box of its own beside the newsletter's tick,
 * unticked, never needed to order, kept with the lines the checkout shows;
 * and words that carry no link, no code and no "reply YES", short enough to
 * stay one or two segments with Adminium's opt-out line added.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { diner } from "../i18n/strings/diner.ts";
import { HOLD_MS } from "../kitchen/textState.ts";
import { checkTextTemplate } from "../testing/manifest/text-messages.ts";
import { buildManifest } from "./build.ts";
import { LOCALES } from "./labels.ts";
import { HOLD_SECONDS, TEXT_KINDS } from "./outbox.ts";
import { TEXT_BOX_KEYS } from "./people.ts";
import { READY_TEXT } from "./texts.ts";

type Json = Record<string, unknown>;
type Entry = Json & { table: string; key?: string; methods: string[]; writable?: string[]; requires?: string[]; textConsent?: Json; consent?: Json };

const manifest = buildManifest() as Json & {
  publicAccess: Entry[];
  outbox: Json & { kinds: Record<string, string>; channels: Record<string, string>; classes: Record<string, string>; waiting: string[]; producers: Json[]; recipient: Json & { fallback: Json } };
  textTemplates: { key: string; locales: Record<string, { body: string }> }[];
  emailTemplates: { key: string }[];
  requiredSchema: { tables: (Json & { ref: string; columns: (Json & { ref: string; type: string; nullable?: boolean; default?: unknown; rules?: Json })[] })[] };
  roles: (Json & { key: string; permissions: string[]; limits?: Record<string, { writable?: string[]; creatable?: string[]; readable?: string[] }> })[];
};
const column = (t: string, ref: string) => manifest.requiredSchema.tables.find((x) => x.ref === t)!.columns.find((c) => c.ref === ref);

describe("the ready text", () => {
  it("is one kind sent as a text, a service text the diner is waiting for, with a template of its own", () => {
    expect([...TEXT_KINDS]).toEqual(["order-ready-text"]);
    expect(manifest.outbox.channels).toEqual({ "order-ready-text": "sms" });
    expect(manifest.outbox.classes["order-ready-text"]).toBe("service");
    expect(manifest.outbox.waiting).toEqual(["order-ready-text"]);
    expect(manifest.outbox.kinds["order-ready-text"]).toBe("ordering-order-ready-text");
    expect(manifest.textTemplates.map((t) => t.key)).toEqual(["ordering-order-ready-text"]);
    expect(manifest.emailTemplates.map((t) => t.key)).not.toContain("ordering-order-ready-text");
  });

  it("goes to the diner's own mobile, or the one typed on an order nobody is signed in for", () => {
    expect(manifest.outbox.recipient["phone"]).toBe("phone");
    expect(manifest.outbox.recipient.fallback["phone"]).toBe("phone");
  });

  it("is queued only for an order whose diner ticked the box, waits out the Undo, and is dropped by an Undo", () => {
    const producers = manifest.outbox.producers.filter((p) => p["kind"] === "order-ready-text");
    expect(producers).toHaveLength(1);
    const p = producers[0]!;
    expect(p["onChange"]).toEqual({ table: "orders", column: "status", to: "ready", where: { column: "texts_ok", eq: true } });
    // Behind the kitchen's own switch for texts (off until it has texts set up), never the ready email's.
    expect(p["gate"]).toEqual({ setting: { table: "settings", column: "ready_text_on" } });
    // The same wait as the ready email, which the board counts down.
    const email = manifest.outbox.producers.find((x) => x["kind"] === "order-ready")!;
    expect([p["holdSeconds"], p["dropWhen"]]).toEqual([email["holdSeconds"], email["dropWhen"]]);
    expect(p["holdSeconds"]).toBe(HOLD_SECONDS);
    expect(HOLD_MS).toBe(HOLD_SECONDS * 1000);
    // Taken back to any earlier step, or past ready: dropped.
    const drop = (p["dropWhen"] as { column: string; in: string[] }[])[0]!;
    expect(drop.column).toBe("status");
    expect([...drop.in].sort()).toEqual(["cancelled", "confirmed", "not_collected", "picked_up", "placed", "preparing"]);
  });

  it("says the kitchen's name first and the order's number, in every language, with nothing that opens a door", () => {
    const template = manifest.textTemplates[0]!;
    expect(Object.keys(template.locales).sort()).toEqual([...LOCALES].sort());
    for (const tag of LOCALES) {
      const body = template.locales[tag]!.body;
      expect([tag, body]).toEqual([tag, READY_TEXT[tag]]);
      expect([tag, body.startsWith("{{appName}}")]).toEqual([tag, true]);
      expect([tag, [...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]).sort()]).toEqual([tag, ["appName", "order.number"]]);
      expect([tag, checkTextTemplate(body)]).toEqual([tag, { ok: true }]);
      // The opt-out is Adminium's to add: a template never says STOP itself, nor carries a link.
      expect([tag, /stop|http|www\./i.test(body)]).toEqual([tag, false]);
    }
  });

  it("stays one segment in the Latin-letter languages and two in the rest, opt-out line and all", () => {
    for (const tag of LOCALES) {
      const fill = (name: string) => READY_TEXT[tag].replace("{{appName}}", name).replace("{{order.number}}", "2118");
      const short = estimate(`${fill("Juniper Kitchen")} ${REPLY_STOP[tag]}`);
      const long = estimate(`${fill("Juniper Kitchen on Junction Avenue West")} ${REPLY_STOP[tag]}`);
      const latin = ["en-US", "de-DE", "fr-FR", "da-DK"].includes(tag);
      expect([tag, short.encoding, short.segments <= (latin ? 1 : 2)]).toEqual([tag, latin ? "gsm-7" : "ucs-2", true]);
      expect([tag, long.segments <= (latin ? 1 : 2)]).toEqual([tag, true]);
    }
  });
});

describe("the checkout's box for texts", () => {
  const places = manifest.publicAccess.filter((e) => e.table === "orders" && e.methods.includes("POST"));
  const box = places[0]!.textConsent as { column: string; phone: string; class: string; wording: { version: number; text: Record<string, string> } };

  it("is on both ways of placing an order, for the mobile typed, as a yes to service texts", () => {
    expect(places).toHaveLength(2);
    for (const e of places) {
      expect(e.textConsent).toEqual(box);
      expect((e.writable ?? []).includes("texts_ok")).toBe(true);
      // Never needed to order.
      expect((e.requires ?? []).includes("texts_ok")).toBe(false);
    }
    expect([box.column, box.phone, box.class]).toEqual(["texts_ok", "phone", "service"]);
    // No other door takes it.
    expect(manifest.publicAccess.filter((e) => e.textConsent !== undefined)).toEqual(places);
  });

  it("is never the newsletter's tick: its own column, starting unticked, set by nothing but the diner", () => {
    expect(box.column).not.toBe((places[0]!.consent as { column: string }).column);
    const c = column("orders", "texts_ok")!;
    expect([c.type, c.default, c.rules]).toEqual(["bool", false, undefined]);
    for (const r of manifest.roles) {
      const orders = r.limits?.["orders"];
      expect([r.key, (orders?.writable ?? []).includes("texts_ok"), (orders?.creatable ?? []).includes("texts_ok")]).toEqual([r.key, false, false]);
    }
  });

  it("is declared with the three lines the checkout shows, in every language, as version 1", () => {
    expect(box.wording.version).toBe(1);
    expect(Object.keys(box.wording.text).sort()).toEqual([...LOCALES].sort());
    for (const tag of LOCALES) {
      const words = diner[tag] as Partial<Record<string, string>>;
      const shown = TEXT_BOX_KEYS.map((key) => words[key]);
      expect(shown.every((s) => typeof s === "string" && s !== "" && !s.includes("\n") && !s.includes("{"))).toBe(true);
      expect([tag, box.wording.text[tag]]).toEqual([tag, shown.join("\n")]);
    }
    const screen = readFileSync(join(__dirname, "..", "diner", "TextBox.tsx"), "utf8");
    for (const key of TEXT_BOX_KEYS) expect(screen).toContain(`t("${key}")`);
  });

  it("says, in the languages the design names, exactly the design's words", () => {
    const said = (tag: string, key: string) => (diner[tag as "de-DE"] as Record<string, string>)[key];
    expect(diner["en-US"]["co.texts"]).toBe("Text me when my order is ready");
    expect(diner["en-US"]["co.texts.note"]).toBe("One text when it's ready to collect.");
    expect(diner["en-US"]["co.texts.optional"]).toBe("Optional. You can stop at any time; each text tells you how.");
    expect(said("ar-EG", "co.texts.optional")).toBe("اختياري. يمكنك الإيقاف في أي وقت، وكل رسالة توضح لك الطريقة.");
    expect(said("zh-CN", "co.texts.optional")).toBe("可选。您可随时退订，每条短信都会说明退订方式。");
    expect(said("zh-TW", "co.texts.optional")).toBe("可選。您可隨時退訂，每則簡訊都會說明退訂方式。");
    expect(said("de-DE", "co.texts.optional")).toBe("Freiwillig. Sie können jederzeit abbestellen; jede SMS sagt Ihnen, wie.");
    expect([said("de-DE", "co.texts"), said("ar-EG", "co.texts"), said("zh-CN", "co.texts"), said("zh-TW", "co.texts")]).toEqual([
      "SMS, wenn meine Bestellung fertig ist",
      "أرسلوا لي رسالة عندما يكون طلبي جاهزًا",
      "订单备好后短信通知我",
      "餐點備妥後以簡訊通知我",
    ]);
  });
});

describe("the kitchen's read of the outbox", () => {
  it("is whether an order's ready text went: never who it went to, nor the diner it is linked to", () => {
    const kitchen = manifest.roles.find((r) => r.key === "kitchen")!;
    expect(kitchen.permissions).toContain("table:@messages:read");
    expect(kitchen.permissions).not.toContain("table:@messages:read_pii");
    const readable = kitchen.limits?.["messages"]?.readable ?? [];
    expect(readable).not.toContain("to_address");
    expect(readable).not.toContain("customer_id");
  });

  it("leaves conversations to the manager: replies on, read and answered on Adminium's Texts page", () => {
    expect(manifest["textReplies"]).toBe("on");
    const grants = (key: string) => manifest.roles.find((r) => r.key === key)!.permissions.filter((p) => p.startsWith("texts:"));
    expect(grants("manager")).toEqual(["texts:@:read", "texts:@:reply"]);
    expect(grants("kitchen")).toEqual([]);
  });
});

/** Adminium's "Reply STOP" line in each language (`email:texts.optOut.reply`, 0.3.76). */
const REPLY_STOP: Record<string, string> = {
  "en-US": "Reply STOP to opt out.",
  "de-DE": "Antworten Sie STOP zum Abmelden.",
  "fr-FR": "Répondez STOP pour ne plus recevoir de SMS.",
  "da-DK": "Svar STOP for at framelde.",
  "cs-CZ": "Odpovězte STOP pro odhlášení.",
  "ar-EG": "للإيقاف أرسل STOP.",
  "zh-CN": "回复STOP退订。",
  "zh-TW": "回覆STOP退訂。",
};

/** GSM-7's characters (Adminium's `sms/send/length.ts`), and the ones that take two places. */
const GSM_BASIC = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà');
const GSM_ESCAPED = new Set("^{}\\[~]|€\f");

/** The segments a text costs, as Adminium's counter estimates them for most destinations: 160/153 or 70/67. */
function estimate(text: string): { encoding: "gsm-7" | "ucs-2"; segments: number } {
  const chars = [...text];
  if (chars.every((c) => GSM_BASIC.has(c) || GSM_ESCAPED.has(c))) {
    const units = chars.reduce((n, c) => n + (GSM_ESCAPED.has(c) ? 2 : 1), 0);
    return { encoding: "gsm-7", segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  }
  const units = text.length;
  return { encoding: "ucs-2", segments: units <= 70 ? 1 : Math.ceil(units / 67) };
}
