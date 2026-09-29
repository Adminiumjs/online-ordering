/**
 * Every language says every string, and says it with the same pieces:
 * the same placeholders as English, plural forms in the language's own CLDR
 * order, and no string left in English unless it is the same word there too
 * (a cognate or a sample address, named below — a new one fails until named).
 */
import { describe, expect, it } from "vitest";

import { LOCALE_TAGS, type LocaleTag } from "./locales.ts";
import { MESSAGES } from "./messages/index.ts";

/** How many `|` forms a language's plural strings carry (one form is always allowed). */
const FORMS: Record<LocaleTag, number> = { "en-US": 2, "de-DE": 2, "fr-FR": 2, "da-DK": 2, "cs-CZ": 3, "zh-CN": 1, "zh-TW": 1, "ar-EG": 6 };

/** Strings that are the same word in English and in the language. */
const SAME_AS_ENGLISH: Partial<Record<LocaleTag, string[]>> = {
  "de-DE": ["shell.nav.dialog", "sheet.optional", "co.optional", "co.name", "kitchen.live", "kitchen.chip.start"],
  "fr-FR": ["shell.nav.dialog", "totals.total", "co.phone", "kitchen.slots.pause", "kitchen.ticket.lines", "kitchen.phoneOrder.note"],
  "cs-CZ": ["shell.nav.menu"],
  "da-DK": ["shell.nav.dialog", "totals.subtotal", "large.sent.ref", "kitchen.live", "kitchen.btn.start", "kitchen.chip.start", "kitchen.slots.pause", "kitchen.phoneOrder.note"],
  "zh-CN": ["co.email.placeholder"],
  "zh-TW": ["co.email.placeholder"],
  "ar-EG": ["co.email.placeholder"],
};

const EN = MESSAGES["en-US"];
const params = (text: string) => new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!));

describe.each(LOCALE_TAGS.filter((t) => t !== "en-US"))("%s", (tag) => {
  const bundle = MESSAGES[tag];

  it("carries every English key", () => {
    expect(Object.keys(EN).filter((k) => bundle[k] === undefined || bundle[k] === "")).toEqual([]);
  });

  it("uses English's placeholders and no others", () => {
    const wrong: string[] = [];
    for (const [key, en] of Object.entries(EN)) {
      const text = bundle[key] ?? "";
      const want = params(en);
      const got = params(text);
      // A plural form may say its number in words ("عنصر واحد"), so {count} may be missing.
      for (const p of want) if (p !== "count" && !got.has(p)) wrong.push(`${key}: no {${p}}`);
      for (const p of got) if (!want.has(p)) wrong.push(`${key}: {${p}} is not English's`);
    }
    expect(wrong).toEqual([]);
  });

  it("writes plural forms in the language's CLDR order", () => {
    const wrong = Object.keys(EN)
      .filter((key) => EN[key]!.includes("|"))
      .filter((key) => {
        const n = (bundle[key] ?? "").split("|").length;
        return n !== 1 && n !== FORMS[tag];
      });
    expect(wrong).toEqual([]);
  });

  it("leaves nothing in English but the named same words", () => {
    const same = Object.keys(EN).filter((k) => bundle[k] === EN[k] && /\p{L}/u.test(EN[k]!.replace(/\{\w+\}/g, "")));
    expect(same.sort()).toEqual([...(SAME_AS_ENGLISH[tag] ?? [])].sort());
  });
});

/** Labels that sit side by side and must never read the same. */
const SIDE_BY_SIDE = [
  ["kitchen.tab.queue", "kitchen.tab.slots", "kitchen.tab.shelf", "kitchen.tab.menu", "kitchen.tab.hours"],
  ["shell.nav.home", "shell.nav.menu", "shell.nav.hours", "shell.nav.findUs", "shell.nav.orders", "shell.nav.track", "shell.nav.large"],
] as const;

describe.each(LOCALE_TAGS)("%s: side-by-side labels", (tag) => {
  it("are all different", () => {
    for (const group of SIDE_BY_SIDE) {
      const words = group.map((key) => MESSAGES[tag][key]);
      expect(new Set(words).size, group.join(", ")).toBe(group.length);
    }
  });
});
