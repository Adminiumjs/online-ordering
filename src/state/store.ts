/**
 * The app's single store.
 *
 * One store for both shells, because the Diner and the Kitchen act on the SAME
 * order book: a checkout on the diner side puts a card on the kitchen board,
 * and the kitchen clearing that card is what the diner's tracker shows. Two
 * stores would mean keeping two copies of one service in step.
 *
 * TIME. `now` is minutes since midnight and starts at `PINNED_NOW`. The dock's
 * "+10 min" chip is the ONLY thing that changes it — nothing anywhere reads
 * `Date.now()`. Everything derived from the clock (open/closed, pickup slots,
 * elapsed chips) is recomputed at render time from this one integer.
 *
 * Money is integer cents throughout.
 */

import { create } from "zustand";

import {
  CLOCK_STEP,
  CLOSE_AT,
  FIRST_LIVE_NUMBER,
  FIRST_SLOT,
  OPEN_AT,
  PINNED_NOW,
  SLOT_STEP,
  TAX_RATE,
  itemById,
} from "../data/demo.ts";
import { source, type DayHours, type Venue } from "../data/source.ts";
import type {
  CartLine,
  Category,
  CategoryId,
  Item,
  Order,
  OrderStatus,
  Persona,
  Selection,
  Toast,
  View,
} from "../data/types.ts";
import { t } from "../i18n/ambient.ts";
import { label } from "../lib/format.ts";
import {
  STATUS_CHAIN,
  addLine,
  advanceAll,
  cartTotals,
  emptySelection,
  isComplete,
  isOpen,
  nextOrderNumber,
  nextStatus,
  pickupSlots,
  replaceLine,
  setQty,
  statusIndex,
  toggleOption,
} from "../lib/order.ts";

const THEME_KEY = "online-ordering-theme";

export type Theme = "light" | "dark";

/** Which menu category the grid is filtered to; `all` is the default chip. */
export type CategoryFilter = CategoryId | "all";

/** When each status was reached, per order number. Drives the track timeline. */
export type StatusStamps = Record<number, Partial<Record<OrderStatus, number>>>;

/** The item sheet's working copy — nothing is committed until "Add to order". */
export interface SheetState {
  itemId: string;
  selection: Selection;
  note: string;
  qty: number;
  /** The cart line being edited, or null when this is a fresh build. */
  editKey: string | null;
}

/** The note field's hard cap, mirrored by the sheet's live counter. */
export const NOTE_MAX = 80;

/** Past this many minutes on the board, a kitchen card's elapsed chip goes amber. */
export const LATE_AFTER = 10;

interface State {
  /* --- routing + persona --- */
  view: View;
  persona: Persona;
  /**
   * A section to scroll to once the next view has painted. Hours and Find us
   * are anchors on Home rather than views of their own, and `go()` always
   * scrolls to the top, so the two need a handshake rather than a fight.
   */
  anchor: string | null;

  /* --- chrome --- */
  theme: Theme;
  navOpen: boolean;
  dockOpen: boolean;
  /** True while any overlay owns the bottom corner, so the dock steps aside. */
  overlayOpen: boolean;

  /* --- the pinned clock --- */
  now: number;

  /* --- seed, loaded through the DataSource seam --- */
  categories: Category[];
  items: Item[];
  orders: Order[];
  venue: Venue;
  weekHours: DayHours[];
  history: StatusStamps;

  /* --- the diner's session --- */
  cart: CartLine[];
  cat: CategoryFilter;
  /** False until the menu's first paint has finished its skeleton shimmer. */
  menuLoaded: boolean;
  pickupAt: number | null;
  coName: string;
  coPhone: string;
  /** Order numbers this visitor placed, oldest first. */
  myNums: number[];
  trackNum: number | null;

  /* --- overlays --- */
  sheet: SheetState | null;
  drawerOpen: boolean;
  paySheetOpen: boolean;
  toasts: Toast[];

  /* --- actions --- */
  go: (view: View) => void;
  goSection: (anchor: string) => void;
  clearAnchor: () => void;
  setPersona: (p: Persona) => void;

  initTheme: () => void;
  toggleTheme: () => void;
  setNavOpen: (open: boolean) => void;
  setDockOpen: (open: boolean) => void;
  setCat: (cat: CategoryFilter) => void;
  markMenuLoaded: () => void;

  tick: () => void;

  openSheet: (itemId: string) => void;
  editLine: (key: string) => void;
  closeSheet: () => void;
  sheetToggle: (groupId: string, optionId: string) => void;
  setSheetNote: (note: string) => void;
  setSheetQty: (qty: number) => void;
  submitSheet: () => void;

  setDrawerOpen: (open: boolean) => void;
  setLineQty: (key: string, qty: number) => void;
  setPickup: (minutes: number) => void;

  setCoName: (name: string) => void;
  setCoPhone: (phone: string) => void;
  setPaySheetOpen: (open: boolean) => void;
  placeOrder: () => void;
  trackOrder: (num: number) => void;

  advanceOrder: (num: number) => void;

  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  escape: () => void;
  reset: () => void;
}

let toastSeq = 0;

/* ------------------------------------------------------------- derivations */

/** Today's pickup slots at a given clock reading. */
export function slotsAt(now: number): number[] {
  return pickupSlots(now, FIRST_SLOT, CLOSE_AT, SLOT_STEP);
}

/**
 * The slot the order will actually be picked up at.
 *
 * A chosen slot that the clock has since overtaken silently falls back to the
 * soonest one still on offer, so a reader who left the tab open does not get
 * to check out into a time that has already passed.
 */
export function chosenPickup(pickupAt: number | null, now: number): number | null {
  const slots = slotsAt(now);
  if (slots.length === 0) return null;
  return pickupAt !== null && slots.includes(pickupAt) ? pickupAt : slots[0];
}

export function kitchenOpen(now: number): boolean {
  return isOpen(now, OPEN_AT, CLOSE_AT);
}

/**
 * Reconstruct when each completed status was reached.
 *
 * The seed records only two instants per order — when it was placed and when
 * it last moved — so intermediate steps are spread evenly between them. A
 * timeline with holes in it reads as a bug; evenly spaced stamps read as a
 * kitchen working steadily, which is what actually happened.
 */
function seedHistory(orders: Order[]): StatusStamps {
  const out: StatusStamps = {};

  for (const order of orders) {
    const reached = statusIndex(order.status);
    const stamps: Partial<Record<OrderStatus, number>> = { placed: order.placedAt };
    for (let step = 1; step <= reached; step += 1) {
      stamps[STATUS_CHAIN[step]] = Math.round(
        order.placedAt + ((order.statusAt - order.placedAt) * step) / reached,
      );
    }
    out[order.num] = stamps;
  }

  return out;
}

/** A fresh service: the seed, deep-copied out of the DataSource. */
function freshOrders(): Order[] {
  return source.orders();
}

export const useStore = create<State>((set, get) => ({
  view: "home",
  persona: "diner",
  anchor: null,

  theme: "light",
  navOpen: false,
  dockOpen: true,
  overlayOpen: false,

  now: PINNED_NOW,

  categories: source.categories(),
  items: source.items(),
  orders: freshOrders(),
  venue: source.venue(),
  weekHours: source.weekHours(),
  history: seedHistory(freshOrders()),

  cart: [],
  cat: "all",
  menuLoaded: false,
  pickupAt: null,
  coName: "",
  coPhone: "",
  myNums: [],
  trackNum: null,

  sheet: null,
  drawerOpen: false,
  paySheetOpen: false,
  toasts: [],

  /**
   * Every view change scrolls back to the top — house layout rule 3, and the
   * reason arriving at checkout lands on its header rather than halfway down
   * the menu the reader was just scrolling.
   */
  go: (view) => {
    set({ view, navOpen: false, drawerOpen: false, anchor: null, overlayOpen: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  /** Hours and Find us are sections of Home, not views. */
  goSection: (anchor) => {
    set({ view: "home", navOpen: false, drawerOpen: false, overlayOpen: false, anchor });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  clearAnchor: () => set({ anchor: null }),

  /*
   * Switching persona lands on that persona's own screen. A cook dropped onto
   * the marketing home page would have to navigate to their own work, and a
   * diner dropped onto the queue would be reading somebody else's shift.
   */
  setPersona: (persona) => {
    set({
      persona,
      view: persona === "kitchen" ? "kitchen" : "home",
      navOpen: false,
      drawerOpen: false,
      sheet: null,
      paySheetOpen: false,
      overlayOpen: false,
      anchor: null,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  initTheme: () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      // Storage disabled — fall back to the OS preference.
    }
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme: Theme =
      stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  toggleTheme: () => {
    const theme: Theme = get().theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not remembering the choice is not a reason to refuse it.
    }
    set({ theme });
  },

  /*
   * The mobile nav does NOT shift the dock. House layout rule 1 is about the
   * dock covering a primary action, and the nav sheet enters from the inline
   * START — the corner the dock would move TO. Shifting for it would put the
   * dock on top of the very menu it was trying to get out of the way of.
   */
  setNavOpen: (navOpen) => set({ navOpen }),
  setDockOpen: (dockOpen) => set({ dockOpen }),
  setCat: (cat) => set({ cat, view: "menu", navOpen: false, overlayOpen: false }),
  markMenuLoaded: () => set({ menuLoaded: true }),

  /**
   * The demo clock. One tap moves it `CLOCK_STEP` minutes and steps every
   * in-flight order one status forward; orders stop at `ready`, because only a
   * person handing over a bag knows an order was collected.
   */
  tick: () => {
    const { now, orders, history } = get();
    const next = now + CLOCK_STEP;
    const advanced = advanceAll(orders, next);

    const stamps: StatusStamps = { ...history };
    let moved = 0;
    advanced.forEach((order, i) => {
      if (order.status === orders[i].status) return;
      moved += 1;
      stamps[order.num] = { ...stamps[order.num], [order.status]: next };
    });

    set({ now: next, orders: advanced, history: stamps });
    get().toast(t("chrome.toast.ticked", { count: moved }, moved), "info");
  },

  openSheet: (itemId) => {
    const item = itemById(itemId);
    if (item === undefined || item.soldOut === true) return;
    set({
      sheet: { itemId, selection: emptySelection(), note: "", qty: 1, editKey: null },
      navOpen: false,
      overlayOpen: true,
    });
  },

  /**
   * Editing reopens the sheet PRE-FILLED from the line, keeping its key so the
   * result replaces that line rather than adding a second one beside it.
   */
  editLine: (key) => {
    const line = get().cart.find((l) => l.key === key);
    if (line === undefined) return;
    set({
      sheet: {
        itemId: line.item,
        selection: Object.fromEntries(
          Object.entries(line.selection).map(([group, ids]) => [group, [...ids]]),
        ),
        note: line.note,
        qty: line.qty,
        editKey: key,
      },
      overlayOpen: true,
    });
  },

  closeSheet: () => set({ sheet: null, overlayOpen: get().drawerOpen }),

  sheetToggle: (groupId, optionId) => {
    const { sheet } = get();
    if (sheet === null) return;
    const item = itemById(sheet.itemId);
    if (item === undefined) return;
    const group = item.mods.find((g) => g.id === groupId);
    if (group === undefined) return;
    set({
      sheet: { ...sheet, selection: toggleOption(group, sheet.selection, optionId) },
    });
  },

  setSheetNote: (note) => {
    const { sheet } = get();
    if (sheet === null) return;
    set({ sheet: { ...sheet, note: note.slice(0, NOTE_MAX) } });
  },

  setSheetQty: (qty) => {
    const { sheet } = get();
    if (sheet === null) return;
    set({ sheet: { ...sheet, qty: Math.max(1, Math.min(20, qty)) } });
  },

  /**
   * Commit the sheet. The engine decides whether this merges into an existing
   * line: same item, same options and the same note merge; any difference at
   * all makes a separate line, which is what stops "no onions" being folded
   * into somebody else's pizza.
   */
  submitSheet: () => {
    const { sheet, cart } = get();
    if (sheet === null) return;
    const item = itemById(sheet.itemId);
    if (item === undefined || !isComplete(item, sheet.selection)) return;

    const next =
      sheet.editKey === null
        ? addLine(cart, sheet.itemId, sheet.selection, sheet.note, sheet.qty)
        : replaceLine(cart, sheet.editKey, sheet.itemId, sheet.selection, sheet.note, sheet.qty);

    set({ cart: next, sheet: null, overlayOpen: get().drawerOpen });
    get().toast(
      t(sheet.editKey === null ? "chrome.toast.added" : "chrome.toast.updated", {
        item: label(item.name),
      }),
      "pos",
    );
  },

  setDrawerOpen: (drawerOpen) =>
    set({ drawerOpen, overlayOpen: drawerOpen || get().sheet !== null }),

  setLineQty: (key, qty) => {
    const line = get().cart.find((l) => l.key === key);
    set({ cart: setQty(get().cart, key, qty) });
    if (qty <= 0 && line !== undefined) {
      const item = itemById(line.item);
      get().toast(
        t("chrome.toast.removed", { item: item === undefined ? "" : label(item.name) }),
        "info",
      );
    }
  },

  setPickup: (pickupAt) => set({ pickupAt }),

  setCoName: (coName) => set({ coName }),
  setCoPhone: (coPhone) => set({ coPhone }),
  setPaySheetOpen: (paySheetOpen) =>
    set({ paySheetOpen, overlayOpen: paySheetOpen || get().drawerOpen }),

  /**
   * Checkout. The number is minted from the highest already issued, so the
   * first live order is #2118 — the seeded morning ends at #2117 and the demo
   * never pretends otherwise.
   */
  placeOrder: () => {
    const { cart, orders, now, coName, history, items, myNums, pickupAt } = get();
    if (cart.length === 0) return;

    const num = nextOrderNumber(orders, FIRST_LIVE_NUMBER);
    const pickup = chosenPickup(pickupAt, now) ?? now + SLOT_STEP;

    /*
     * The kitchen card shows one customer note at the top of the ticket, and
     * the seed's own orders mirror their first line note there. Follow the
     * same convention rather than inventing a second place to type a note.
     */
    const note = cart.find((l) => l.note.length > 0)?.note ?? "";

    const order: Order = {
      num,
      customer: coName.trim(),
      status: "placed",
      placedAt: now,
      statusAt: now,
      pickupAt: pickup,
      lines: cart.map((l) => ({
        ...l,
        selection: Object.fromEntries(
          Object.entries(l.selection).map(([group, ids]) => [group, [...ids]]),
        ),
      })),
      note,
    };

    const totals = cartTotals(cart, items, TAX_RATE);

    set({
      orders: [...orders, order],
      history: { ...history, [num]: { placed: now } },
      cart: [],
      myNums: [...myNums, num],
      trackNum: num,
      pickupAt: pickup,
      view: "confirm",
      paySheetOpen: false,
      drawerOpen: false,
      overlayOpen: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });

    get().toast(t("chrome.toast.placed", { num, count: totals.count }, totals.count), "pos");
  },

  trackOrder: (num) => {
    set({ trackNum: num, view: "track", navOpen: false, drawerOpen: false, overlayOpen: false });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  /**
   * The Kitchen's big button. Unlike the clock, this moves ONE order, and it
   * is the only path to `picked_up` — the dock's chip deliberately stops at
   * `ready` so the last step stays a human act.
   */
  advanceOrder: (num) => {
    const { orders, now, history } = get();
    const order = orders.find((o) => o.num === num);
    if (order === undefined) return;

    const next = nextStatus(order.status);
    if (next === order.status) return;

    set({
      orders: orders.map((o) =>
        o.num === num ? { ...o, status: next, statusAt: now } : o,
      ),
      history: { ...history, [num]: { ...history[num], [next]: now } },
    });

    get().toast(
      t("chrome.toast.moved", { num, status: label(`kitchen.status.${next}`) }),
      next === "picked_up" ? "pos" : "info",
    );
  },

  toast: (text, tone = "info") => {
    toastSeq += 1;
    const id = toastSeq;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    window.setTimeout(() => get().dismissToast(id), 3600);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),

  /**
   * The document-level Escape handler. Overlays close innermost-first, so one
   * press does one thing rather than dismissing the whole stack: the card
   * sheet sits over the drawer, and the drawer sits over the page.
   */
  escape: () => {
    const s = get();
    if (s.paySheetOpen) return set({ paySheetOpen: false, overlayOpen: s.drawerOpen });
    if (s.sheet !== null) return set({ sheet: null, overlayOpen: s.drawerOpen });
    if (s.drawerOpen) return set({ drawerOpen: false, overlayOpen: false });
    if (s.navOpen) return set({ navOpen: false });
  },

  reset: () => {
    const orders = freshOrders();
    set({
      now: PINNED_NOW,
      orders,
      history: seedHistory(orders),
      cart: [],
      cat: "all",
      pickupAt: null,
      coName: "",
      coPhone: "",
      myNums: [],
      trackNum: null,
      sheet: null,
      drawerOpen: false,
      paySheetOpen: false,
      navOpen: false,
      overlayOpen: false,
      anchor: null,
      view: get().persona === "kitchen" ? "kitchen" : "home",
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    get().toast(t("chrome.toast.reset"), "info");
  },
}));

export { CLOSE_AT, OPEN_AT, SLOT_STEP, TAX_RATE };
