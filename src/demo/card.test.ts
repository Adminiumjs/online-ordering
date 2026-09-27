/**
 * `demo.json` as the website checks it: this app's declaration, emitted in the
 * card's eight languages, passes the website's own `demoJsonIssues` — with the
 * add-ons the marketplace knows and icon names lucide draws — and every screen
 * and shortcut it offers is one the bridge answers to.
 */
import { icons } from "lucide-react";
import { describe, expect, it } from "vitest";

import { buildDemoJson } from "../../demo-emit.ts";
import { demoJsonIssues } from "../demo-types.ts";
import { SCREEN_IDS, SHORTCUT_IDS } from "../demoBridge.ts";
import { CARD_MESSAGES, DEMO_CARD } from "./card.ts";

const pascal = (name: string) => name.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Za-z])([0-9])/g, "$1-$2").toLowerCase();
const ICONS = new Set(Object.keys(icons).map(kebab));

const doc = buildDemoJson({ ...DEMO_CARD, messages: CARD_MESSAGES });

describe("demo.json", () => {
  it("passes the website's check", () => {
    expect(demoJsonIssues(doc, { appKey: "ordering", dir: "online-ordering", addOnKeys: new Set(["invoices", "holiday-calendars"]), icons: ICONS })).toEqual([]);
  });

  it("offers 17 screens, 14 shortcuts and 37 label sets", () => {
    const shortcuts = doc.screens.flatMap((s) => s.shortcuts ?? []);
    expect(doc.screens).toHaveLength(17);
    expect(shortcuts).toHaveLength(14);
    expect(shortcuts.map((s) => s.id)).toContain("overorder");
    const sets = doc.screens.length + shortcuts.length + (doc.personas?.length ?? 0) + (doc.clock?.advance.length ?? 0) + 1 + (doc.addOns?.length ?? 0);
    expect(sets).toBe(37);
    expect(doc.base).toBe("/demo/online-ordering/app/");
  });

  it("names icons lucide draws, spelled as the card spells them", () => {
    for (const screen of doc.screens) {
      expect(icons[pascal(screen.icon) as keyof typeof icons], screen.icon).toBeDefined();
      for (const s of screen.shortcuts ?? []) expect(icons[pascal(s.icon) as keyof typeof icons], s.icon).toBeDefined();
    }
  });

  it("has no screen or shortcut the bridge does not answer to", () => {
    expect(doc.screens.map((s) => s.id).filter((id) => !SCREEN_IDS.includes(id))).toEqual([]);
    expect(doc.screens.flatMap((s) => s.shortcuts ?? []).map((s) => s.id).filter((id) => !SHORTCUT_IDS.includes(id))).toEqual([]);
  });
});
