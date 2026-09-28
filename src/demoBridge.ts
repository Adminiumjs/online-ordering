/**
 * The demo build's side of the website's demo card: the card says which
 * screen, person, language, theme and add-ons to show, presses shortcuts and
 * moves the clock; the page says where it is. DEMO BUILD ONLY — `main.tsx`
 * imports it behind the build-time `DEMO` flag, so no hosted or connected
 * bundle carries the protocol.
 */
import { DEMO_MESSAGE_PREFIX, isDemoMessage, type DemoMessage } from "./demo-types.ts";
import { demoAdminium, DEMO_HOLIDAYS } from "./data/demo.ts";
import { cardWord } from "./demo/card.ts";
import { addHoliday, afterClosing, anotherScreenReady, arrive, fillSlot, lunchRush, moveOn, priceChange, sellOut } from "./demo/shortcuts.ts";
import { DEMO_SIGN_IN } from "./demo/diner.ts";
import { setHostLocale } from "./i18n/index.tsx";
import { isLocaleTag } from "./i18n/locales.ts";
import { formatter } from "./lib/format.ts";
import { addDays, venueDay, venueMinutes, hhmm } from "./lib/venueTime.ts";
import { openSignInLink, useAccount } from "./state/account.ts";
import { reloadAll, refreshAvailability, setField, useDiner } from "./state/diner.ts";
import { setLarge, useLarge } from "./state/large.ts";
import { freshPhone, useKitchen, type KitchenTab } from "./state/kitchen.ts";
import { readTrack, useTrack } from "./state/track.ts";
import { goDiner, setTheme, toast, useUi, type DinerView } from "./state/ui.ts";
import { useReorderAsk } from "./state/reorder.ts";

const APP_KEY = "ordering";

const DINER_SCREENS: Record<string, DinerView> = { home: "home", menu: "menu", cart: "cart", checkout: "checkout", track: "track", find: "find", history: "orders", large: "large", "404": "notfound" };
const KITCHEN_TABS: Record<string, KitchenTab> = { queue: "queue", slots: "slots", shelf: "shelf", today: "menu", hours: "hours" };

const locale = (): string => document.documentElement.lang || "en-US";
const demo = () => demoAdminium();
const today = () => venueDay(demo().now, demo().world.zone);

function post(message: DemoMessage): void {
  if (window.parent === window) return;
  window.parent.postMessage(message, "*");
}

/** Which of the card's screens the page is on. */
export function currentScreen(): string {
  const ui = useUi.getState();
  if (ui.persona === "kitchen") {
    const k = useKitchen.getState();
    if (k.phone !== null) return "phone";
    if (k.handoff !== null) return "handoff";
    if (k.ticket !== null) return "ticket";
    return Object.entries(KITCHEN_TABS).find(([, tab]) => tab === k.tab)?.[0] ?? "queue";
  }
  if (ui.dinerView === "track" && useTrack.getState().first) return "checkout";
  return Object.entries(DINER_SCREENS).find(([, view]) => view === ui.dinerView)?.[0] ?? "home";
}

function overlay(): boolean {
  const ui = useUi.getState();
  const d = useDiner.getState();
  const k = useKitchen.getState();
  const a = useAccount.getState();
  if (ui.persona === "kitchen") return k.ticket !== null || k.cancel !== null || k.handoff !== null || k.tomorrow || k.phone !== null || k.askStop || k.askOnlineOff;
  return ui.mobileMenu || d.sheet !== null || d.drawer || d.priceChanged !== null || d.soldOut !== null || useTrack.getState().cancelAsk || useReorderAsk.getState().order !== null || a.confirmSignOutAll || a.deleteAsk;
}

let queued = false;

/** Where the page is, for the card — once per burst of changes. */
export function reportState(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    const ui = useUi.getState();
    const d = demo();
    const fmt = formatter(locale(), d.world.zone, d.world.currency);
    const day = venueDay(d.now, d.world.zone);
    post({
      type: `${DEMO_MESSAGE_PREFIX}state` as "adminium:demo:state",
      dv: 1,
      screen: currentScreen(),
      persona: ui.persona,
      mode: null,
      online: true,
      toggles: { invoices: d.kitchen.addOns.invoices, "holiday-calendars": d.kitchen.addOns.holidays, "orders-off": d.world.settings()["online_on"] === false },
      locale: locale(),
      theme: ui.theme,
      clockLabel: `${fmt.dayShort(day)} · ${fmt.time(d.now)}`,
      overlay: overlay(),
    });
  });
}

/** Goes to one of the card's screens. */
export function goScreen(screen: string): void {
  const diner = DINER_SCREENS[screen];
  if (diner !== undefined) {
    useKitchen.setState({ ticket: null, handoff: null, phone: null, cancel: null, tomorrow: false });
    goDiner(diner, { persona: "diner" });
    if (diner === "track" && useTrack.getState().state === "ok") useTrack.setState({ first: false });
    return;
  }
  useUi.setState({ persona: "kitchen", mobileMenu: false });
  const tab = KITCHEN_TABS[screen];
  if (tab !== undefined) {
    useKitchen.setState({ tab, ticket: null, handoff: null, phone: null, cancel: null, tomorrow: false });
    return;
  }
  const byNumber = (n: string) => useKitchen.getState().orders.find((o) => o.order["number"] === n)?.order.id ?? null;
  if (screen === "ticket") useKitchen.setState({ ticket: byNumber("2114") ?? useKitchen.getState().orders[0]?.order.id ?? null });
  if (screen === "handoff") {
    const ready = useKitchen.getState().orders.find((o) => o.order["status"] === "ready");
    if (ready !== undefined) useKitchen.setState({ handoff: { id: ready.order.id, paid: null, busy: false } });
  }
  if (screen === "phone") useKitchen.setState({ phone: freshPhone() });
}

/** What the diner's side reads again after the card changed the world. */
async function dinerCatchUp(): Promise<void> {
  await reloadAll();
  await refreshAvailability(demo().now);
  if (useTrack.getState().state === "ok") await readTrack();
}

const SHORTCUTS: Record<string, () => void | Promise<void>> = {
  "after-closing": async () => {
    afterClosing(demo());
    goScreen("home");
    await dinerCatchUp();
  },
  "orders-off": async () => {
    const on = demo().world.settings()["online_on"] !== false;
    await demo().kitchen.setOnline(!on);
    await dinerCatchUp();
  },
  "sell-out": async () => {
    sellOut(demo());
    await dinerCatchUp();
    toast(cardWord(locale(), "do.sell-out"), "warn");
  },
  "fill-kwame": () => {
    setField("name", "Kwame");
    setField("email", "kwame.b@mail.example");
    setField("phone", "(555) 019-2205");
    useDiner.setState({ touched: {} });
  },
  "slot-fills": () => {
    const d = demo();
    d.diner.beforePlace = (body) => {
      const at = String(body.values["pickup_at"] ?? "");
      if (at !== "") fillSlot(d, hhmm(venueMinutes(at, d.world.zone)));
    };
    const pick = useDiner.getState().pick;
    const fmt = formatter(locale(), d.world.zone, d.world.currency);
    toast(cardWord(locale(), "toast.slot-fills", { time: pick === null ? "" : fmt.wall(pick.day, pick.time) }), "bell");
  },
  "price-changes": () => {
    const d = demo();
    d.diner.beforePlace = (body) => {
      const first = body.children.order_items[0];
      if (first !== undefined) priceChange(d, Number(first.values["menu_item_id"]));
    };
    toast(cardWord(locale(), "toast.price-changes"), "bell");
  },
  "kitchen-moves": async () => {
    const order = useTrack.getState().order ?? null;
    const id = order?.order.id ?? useDiner.getState().placed?.id;
    if (id === undefined) {
      toast(cardWord(locale(), "toast.no-order"), "warn");
      return;
    }
    moveOn(demo(), id);
    await readTrack();
  },
  "open-link": async () => {
    goDiner("orders", { persona: "diner" });
    if (useAccount.getState().find.email === "") useAccount.setState({ find: { ...useAccount.getState().find, email: "kwame.b@mail.example" } });
    await demo().diner.requestSignIn(useAccount.getState().find.email);
    await openSignInLink(DEMO_SIGN_IN.token);
  },
  "sample-enquiry": () => {
    const saturday = addDays(today(), 4);
    setLarge({ heads: 30, headsText: "30", date: saturday, other: "", notes: "Office party, mostly pizza and a few vegan bowls", name: "Maya Chen", phone: "(555) 010-4471", email: "maya@riverside-studio.example" });
    useLarge.setState({ touched: {}, sent: null, failed: false });
  },
  "new-order": () => {
    arrive(demo());
    useKitchen.setState({ tab: "queue" });
  },
  "other-screen": () => {
    if (anotherScreenReady(demo()) === null) toast(cardWord(locale(), "toast.nothing-cooking"), "warn");
  },
  "lunch-rush": () => {
    lunchRush(demo());
    useKitchen.setState({ tab: "slots", slotDay: "today" });
  },
  holiday: () => {
    addHoliday(demo(), DEMO_HOLIDAYS);
    useKitchen.setState({ tab: "hours" });
  },
  overorder: () => {
    const tomorrow = addDays(today(), 1);
    useKitchen.setState({ tab: "hours", closureDraft: { from: tomorrow, to: tomorrow, reason: "Staff day" } });
  },
};

/** The card's ids this bridge answers to. */
export const SCREEN_IDS = [...Object.keys(DINER_SCREENS), ...Object.keys(KITCHEN_TABS), "ticket", "handoff", "phone"];
export const SHORTCUT_IDS = Object.keys(SHORTCUTS);

async function apply(message: DemoMessage): Promise<void> {
  switch (message.type) {
    case "adminium:demo:init":
    case "adminium:demo:set": {
      if (message.theme !== undefined) setTheme(message.theme);
      if (message.locale !== undefined && isLocaleTag(message.locale)) setHostLocale(message.locale);
      if (message.persona === "kitchen") goScreen("queue");
      if (message.persona === "diner") goScreen("home");
      if (message.type === "adminium:demo:init" && message.screen !== undefined) goScreen(message.screen);
      if (message.type === "adminium:demo:set" && message.addOn !== undefined) {
        const k = demo().kitchen;
        if (message.addOn.key === "invoices") k.addOns.invoices = message.addOn.on;
        if (message.addOn.key === "holiday-calendars") k.addOns.holidays = message.addOn.on;
        useKitchen.setState({ receipts: k.addOns.invoices, holidays: await k.holidays() });
      }
      break;
    }
    case "adminium:demo:go":
      goScreen(message.screen);
      break;
    case "adminium:demo:do":
      await SHORTCUTS[message.shortcut]?.();
      break;
    case "adminium:demo:clock":
      if (message.advance === "10m") {
        demo().advance(10);
        await dinerCatchUp();
      }
      break;
    case "adminium:demo:reset":
      window.location.reload();
      return;
    default:
      break;
  }
  reportState();
}

export function attachDemoBridge(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent || !isDemoMessage(event.data)) return;
    void apply(event.data);
  });
  for (const store of [useUi, useDiner, useKitchen, useTrack, useAccount, useReorderAsk]) (store as { subscribe: (f: () => void) => unknown }).subscribe(reportState);
  demo().onClock(reportState);
  new MutationObserver(reportState).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  post({ type: `${DEMO_MESSAGE_PREFIX}hello` as "adminium:demo:hello", dv: 1, appKey: APP_KEY });
}
