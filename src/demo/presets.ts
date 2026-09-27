/**
 * The States canvases, one address each: `#state=<preset>` opens the demo on
 * the frame the design draws — the clock, the world and the screen set as
 * that frame has them. For looking and for screenshots; the card never uses
 * it. DEMO BUILD ONLY.
 */
import { demoAdminium } from "../data/demo.ts";
import type { Id } from "../data/wire.ts";
import { instantOf, venueDay, addDays } from "../lib/venueTime.ts";
import { afterClosing, fillSlot, moveOn, sellOut } from "./shortcuts.ts";
import { DEMO_SIGN_IN } from "./diner.ts";
import { openSignInLink, useAccount } from "../state/account.ts";
import { lineKey, openSheet, placeOrder, replaceCart, runQuote, setField, toggleOption, useDiner, type CartLine } from "../state/diner.ts";
import { freshPhone, addPhoneLine, setPhone, useKitchen } from "../state/kitchen.ts";
import { setLarge, useLarge } from "../state/large.ts";
import { useReorderAsk } from "../state/reorder.ts";
import { openTrack, useTrack } from "../state/track.ts";
import { goDiner, useUi } from "../state/ui.ts";
import { followPlaced } from "../diner/Checkout.tsx";

const demo = () => demoAdminium();
const zone = () => demo().world.zone;
const today = () => venueDay(demo().now, zone());
const at = (time: string) => instantOf(venueDay(demo().now, zone()), time, zone());
const dish = (name: string) => demo().world.all("menu_items").find((d) => d["name"] === name)!.id;
const option = (dishName: string, name: string): Id => {
  const groups = demo().world.all("modifier_groups").filter((g) => g["item_id"] === dish(dishName)).map((g) => g.id);
  return demo().world.all("modifiers").find((o) => groups.includes(Number(o["group_id"])) && o["name"] === name)!.id;
};
const numbered = (n: string) => demo().world.all("orders").find((o) => o["number"] === n)!;

async function until(test: () => boolean, ms = 8000): Promise<void> {
  const end = Date.now() + ms;
  while (!test()) {
    if (Date.now() > end) return;
    await new Promise((r) => setTimeout(r, 30));
  }
}

const line = (dishId: Id, options: Id[], qty = 1): CartLine => ({ key: lineKey(dishId, options, ""), dishId, qty, options, note: "" });

/** Kwame's cart: a grain bowl (farro, grilled chicken, avocado) and a brown butter cookie — $21.50 before tax. */
function kwameCart(extra: CartLine[] = []): void {
  replaceCart([line(dish("Signature grain bowl"), [option("Signature grain bowl", "Farro"), option("Signature grain bowl", "Grilled chicken"), option("Signature grain bowl", "Avocado")]), line(dish("Brown butter cookie"), []), ...extra]);
}

function kwame(): void {
  setField("name", "Kwame");
  setField("email", "kwame.b@mail.example");
  setField("phone", "(555) 019-2205");
}

async function quoted(): Promise<void> {
  await runQuote();
  await until(() => useDiner.getState().quote?.state !== "busy");
}

/** Kwame places his order and lands on its confirmation. */
async function kwamePlaces(): Promise<void> {
  kwameCart();
  kwame();
  await quoted();
  const placed = await placeOrder("en-US");
  if (placed !== null) await followPlaced(placed);
  await until(() => useTrack.getState().state === "ok");
}

async function signedInAsKwame(): Promise<void> {
  useAccount.setState({ find: { ...useAccount.getState().find, email: "kwame.b@mail.example" } });
  await demo().diner.requestSignIn("kwame.b@mail.example");
  await openSignInLink(DEMO_SIGN_IN.token);
  goDiner("orders");
}

const sample = { heads: 30, headsText: "30", other: "", notes: "Office party — mostly pizza, a few vegan bowls", name: "Maya Chen", phone: "(555) 010-4471", email: "maya@riverside-studio.example" };

interface Preset {
  /** The clock, on the kitchen's day. */
  time?: string;
  /** What happens to the world before the page reads it. */
  world?: () => void | Promise<void>;
  /** Kitchen presets open the kitchen. */
  kitchen?: boolean;
  /** The screen, once the page has read. */
  ui?: () => void | Promise<void>;
}

const PRESETS: Record<string, Preset> = {
  // States 1 — Home
  "opens-later": { time: "10:30" },
  "closed-tonight": { time: "21:30" },
  "closed-today": { world: () => void demo().world.insert("closures", { from_date: today(), to_date: today(), reason: "Private event", active: true }) },
  "online-off": { world: () => void demo().world.update("settings", demo().world.settings().id, { online_on: false }) },
  "no-slots": { time: "20:40" },
  "stopped-today": { world: () => { for (let m = 12 * 60; m <= 20 * 60 + 45; m += 15) demo().world.insert("slot_pauses", { slot_at: new Date(at(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)).toISOString(), active: true, paused_by: "Sam", paused_at: new Date(demo().now).toISOString() }); } },
  loading: { ui: () => useDiner.setState({ load: "busy" }) },
  "load-error": { ui: () => useDiner.setState({ load: "err" }) },
  // States 2 — Menu and Large orders
  menu: { ui: () => goDiner("menu") },
  "menu-loading": { ui: () => { goDiner("menu"); useDiner.setState({ load: "busy" }); } },
  "menu-error": { ui: () => { goDiner("menu"); useDiner.setState({ load: "err" }); } },
  "sheet-bowl": { ui: () => { goDiner("menu"); openSheet(dish("Signature grain bowl")); } },
  "sheet-pizza": {
    ui: () => {
      goDiner("menu");
      openSheet(dish("Build your own pizza"));
      const groups = demo().world.all("modifier_groups").filter((g) => g["item_id"] === dish("Build your own pizza"));
      for (const g of groups) {
        const options = demo().world.all("modifiers").filter((o) => o["group_id"] === g.id);
        const take = g["kind"] === "check" ? Number(g["max"] ?? 1) : 1;
        for (const o of options.slice(0, take)) toggleOption(g.id, o.id);
      }
    },
  },
  "preorder-menu": { time: "21:30", ui: () => goDiner("menu") },
  "menu-empty": {
    world: () => { for (const d of demo().world.all("menu_items").filter((x) => demo().world.get("menu_categories", Number(x["category_id"]))?.["name"] === "Sweets")) demo().world.update("menu_items", d.id, { online: false }); },
    ui: () => {
      const sweets = useDiner.getState().data?.menu.categories.find((c) => c.name === "Sweets");
      goDiner("menu", sweets === undefined ? {} : { category: sweets.id });
    },
  },
  large: { ui: () => goDiner("large") },
  "large-filled": { ui: () => { setLarge({ ...sample, date: addDays(today(), 4) }); goDiner("large"); } },
  "large-error": { ui: () => { setLarge({ ...sample, date: addDays(today(), 4) }); useLarge.setState({ failed: "other" }); goDiner("large"); } },
  "large-sent": { ui: async () => { setLarge({ ...sample, date: addDays(today(), 4) }); goDiner("large"); const { sendEnquiry } = await import("../state/large.ts"); await sendEnquiry("en-US"); } },
  // States 3 — Cart and Checkout
  cart: { ui: async () => { kwameCart(); await quoted(); goDiner("cart"); } },
  drawer: { ui: async () => { kwameCart(); await quoted(); useDiner.setState({ drawer: true }); } },
  checking: { ui: async () => { kwameCart(); kwame(); goDiner("checkout"); await quoted(); useDiner.setState({ quote: { key: "checking", state: "busy", reply: null } }); } },
  checkout: { ui: async () => { kwameCart(); kwame(); await quoted(); goDiner("checkout"); } },
  placing: { ui: async () => { kwameCart(); kwame(); await quoted(); goDiner("checkout"); useDiner.setState({ placing: true }); } },
  price: { ui: async () => { kwameCart(); kwame(); await quoted(); goDiner("checkout"); useDiner.setState({ priceChanged: { lines: [{ name: "Signature grain bowl", from: 18, to: 18.5 }], total: 23.82 } }); } },
  "slot-filled": {
    world: () => fillSlot(demo(), "12:15"),
    ui: async () => { kwameCart(); kwame(); await quoted(); goDiner("checkout"); useDiner.setState({ slotNotice: { time: "12:15", day: today(), reason: "full" }, pick: null }); },
  },
  "sold-out": {
    world: () => sellOut(demo()),
    ui: async () => {
      kwameCart([line(dish("Wild mushroom"), [])]);
      kwame();
      await quoted();
      goDiner("checkout");
      useDiner.setState({ soldOut: { dishId: dish("Wild mushroom"), short: false, left: null, day: today() } });
    },
  },
  stopped: { ui: async () => { kwameCart(); kwame(); await quoted(); goDiner("checkout"); useDiner.setState({ placeError: "stopped" }); } },
  "too-many": { ui: async () => { replaceCart([line(dish("Margherita"), [], 13)]); kwame(); await quoted(); goDiner("checkout"); useDiner.setState({ placeError: "toomany" }); } },
  offline: { ui: async () => { kwameCart(); kwame(); await quoted(); goDiner("checkout"); useDiner.setState({ placeError: "offline" }); } },
  // States 4 — Track and Find
  confirm: { ui: kwamePlaces },
  track: { ui: async () => { await kwamePlaces(); useTrack.setState({ first: false }); } },
  "track-kitchen": {
    ui: async () => {
      await kwamePlaces();
      const id = useTrack.getState().order!.order.id;
      moveOn(demo(), id);
      demo().advanceTo(at("11:45"));
      moveOn(demo(), id);
      demo().advanceTo(at("11:52"));
      await openTrack(useTrack.getState().token!);
    },
  },
  "track-cancel": { ui: async () => { await kwamePlaces(); useTrack.setState({ first: false, cancelAsk: true }); } },
  "track-cancelled": {
    ui: async () => {
      await kwamePlaces();
      demo().advanceTo(at("11:52"));
      await demo().kitchen.cancel(useTrack.getState().order!.order.id, "placed", "ran_out", "Signature grain bowl", null);
      await openTrack(useTrack.getState().token!);
    },
  },
  "track-noshow": {
    ui: async () => {
      await kwamePlaces();
      const id = useTrack.getState().order!.order.id;
      for (let i = 0; i < 3; i += 1) moveOn(demo(), id);
      demo().advanceTo(at("21:05"));
      await openTrack(useTrack.getState().token!);
    },
  },
  "track-expired": { ui: () => { useTrack.setState({ state: "expired", first: false }); goDiner("track"); } },
  find: { ui: () => goDiner("find") },
  "find-sent": { ui: () => { useAccount.setState({ find: { ...useAccount.getState().find, email: "kwame.b@mail.example", step: "sent", sentAt: Date.now(), sends: 1, codeOpen: true } }); goDiner("find"); } },
  // States 5 — Order again
  "history-out": { ui: () => goDiner("orders") },
  history: { ui: signedInAsKwame },
  "history-replace": {
    ui: async () => {
      await signedInAsKwame();
      replaceCart([line(dish("Margherita"), [])]);
      const past = useAccount.getState().orders?.find((o) => o.order["status"] === "picked_up");
      if (past !== undefined) useReorderAsk.setState({ order: past });
    },
  },
  "history-delete": {
    ui: async () => {
      await signedInAsKwame();
      const person = useAccount.getState().person;
      if (person !== null) useAccount.setState({ person: { ...person, at: new Date(demo().now - 20 * 60_000).toISOString() } });
      useAccount.setState({ deleteAsk: true });
    },
  },
  "history-empty": { ui: () => { useAccount.setState({ person: { email: "new.diner@mail.example", name: null, at: new Date(demo().now).toISOString() }, orders: [] }); goDiner("orders"); } },
  // States 6 — the kitchen board
  "k-board": { kitchen: true },
  "k-1150": { time: "11:50", kitchen: true },
  "k-reconnecting": { kitchen: true, ui: () => demo().kitchen.setLive("reconnecting") },
  "k-ticket": { kitchen: true, ui: () => useKitchen.setState({ ticket: numbered("2114").id }) },
  "k-cancel": { kitchen: true, ui: () => useKitchen.setState({ ticket: numbered("2116").id, cancel: { id: numbered("2116").id, reason: "ran_out", dish: "Wild mushroom", dishId: dish("Wild mushroom"), note: "", markSold: true, busy: false } }) },
  "k-handoff": { kitchen: true, ui: () => useKitchen.setState({ handoff: { id: numbered("2113").id, paid: "card", busy: false } }) },
  "k-tomorrow": { kitchen: true, ui: () => useKitchen.setState({ tomorrow: true }) },
  "k-arrival": { kitchen: true, ui: async () => { const { arrive } = await import("./shortcuts.ts"); arrive(demo()); } },
  // States 7 — kitchen setup
  "k-slots": { kitchen: true, ui: () => useKitchen.setState({ tab: "slots" }) },
  "k-shelf": { kitchen: true, ui: () => useKitchen.setState({ tab: "shelf" }) },
  "k-menu": {
    kitchen: true,
    world: () => void demo().world.update("modifiers", option("Signature grain bowl", "Grilled chicken"), { available: false }),
    ui: () => useKitchen.setState({ tab: "menu", menuOpen: { [String(dish("Signature grain bowl"))]: true } }),
  },
  "k-hours": { kitchen: true, ui: () => useKitchen.setState({ tab: "hours" }) },
  "k-holiday": { kitchen: true, world: () => void demo().world.insert("closures", { from_date: "2026-09-07", to_date: "2026-09-07", reason: "Labor Day", active: true }), ui: () => useKitchen.setState({ tab: "hours" }) },
  "k-closure-warn": { kitchen: true, ui: () => { const tomorrow = addDays(today(), 1); useKitchen.setState({ tab: "hours", closureDraft: { from: tomorrow, to: tomorrow, reason: "Staff day" } }); } },
  "k-phone": {
    kitchen: true,
    ui: () => {
      useKitchen.setState({ phone: freshPhone() });
      addPhoneLine(dish("Signature grain bowl"), [option("Signature grain bowl", "Farro"), option("Signature grain bowl", "Grilled chicken")], 1);
      addPhoneLine(dish("Margherita"), [], 1);
      addPhoneLine(dish("Lemonade"), [], 1);
      setPhone({ time: "12:30", name: "Dana R.", phone: "(555) 017-4410" });
    },
  },
  "k-phone-options": { kitchen: true, ui: () => { useKitchen.setState({ phone: freshPhone() }); setPhone({ sheet: { dishId: dish("Signature grain bowl"), options: [option("Signature grain bowl", "Farro")], qty: 1 } }); } },
  "k-after-closing": { kitchen: true, world: () => afterClosing(demo()) },
};

export const PRESET_NAMES = Object.keys(PRESETS);

/** The preset the address names, if it is one. */
export function presetFromHash(): string | null {
  const match = /^#state=([\w-]+)$/.exec(window.location.hash);
  return match !== null && match[1]! in PRESETS ? match[1]! : null;
}

/** The world as the preset's frame has it, before the page reads anything. */
export async function prepareWorld(name: string): Promise<void> {
  const preset = PRESETS[name]!;
  if (preset.time !== undefined) {
    const when = at(preset.time);
    if (when < demo().now) demo().world.now = when;
    else demo().advanceTo(when);
  }
  await preset.world?.();
  if (preset.kitchen === true) useUi.setState({ persona: "kitchen" });
}

/** The screen as the preset's frame has it, once the page has read. */
export async function prepareScreen(name: string): Promise<void> {
  const preset = PRESETS[name]!;
  if (preset.kitchen === true) await until(() => useKitchen.getState().load === "ok");
  else await until(() => useDiner.getState().load === "ok");
  await preset.ui?.();
  document.documentElement.dataset["preset"] = name;
}
