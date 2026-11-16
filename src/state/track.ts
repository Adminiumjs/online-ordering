/**
 * Following one order by its own link (`/o#<code>`): the code opens the
 * order, the page reads it again every 30 seconds while it is on screen and
 * the order is still moving, and the diner may cancel it while the kitchen
 * has not taken it yet.
 *
 * The first view after placing is the confirmation; a reload, or the link in
 * the email, is Track. The code stays in the fragment — never a path, never a
 * server log — and this device keeps its last order's link so "Track an
 * order" finds it.
 *
 * Paying online: the page hands the diner to Adminium's pay page in the same
 * tab, and keeps a note for the tab of the order it sent there. The pay page
 * sends them back to the order page's own address (no code rides back, so a
 * forwarded pay link never opens the order); the note says which order to
 * open. Back, the page checks for a few seconds whether the payment made the
 * order new; still waiting after that, it says the payment didn't finish —
 * the order is held a few minutes more, to pay again or to pay at pickup.
 */
import { create } from "zustand";

import type { OrderWithLines } from "../data/ports.ts";
import { isApiError, type Id } from "../data/wire.ts";
import { sources } from "../data/sources.ts";
import { mountKey } from "../lib/mountKey.ts";

export type TrackState = "idle" | "loading" | "ok" | "expired" | "error";

/**
 * Where paying stands for an order waiting for its payment, as this page
 * knows it: just waiting (`idle`), back from the pay page and checking, back
 * and the payment didn't finish, leaving for the pay page, or a step that
 * could not be taken (the pay page would not open, or the order moved).
 */
export type PayState = "idle" | "checking" | "failed" | "going" | "refused";

interface TrackStore {
  state: TrackState;
  token: string | null;
  order: OrderWithLines | null;
  /** When the last read answered. */
  updatedAt: number | null;
  /** A refresh failed; the last answer stays on screen. */
  stale: boolean;
  /** The confirmation shows on the first view of a just-placed order. */
  first: boolean;
  cancelAsk: boolean;
  cancelling: boolean;
  /** Opened by its own link, or from the signed-in diner's orders. */
  source: "link" | "account";
  pay: PayState;
  /** "Pay when you pick up instead" is being asked. */
  switching: boolean;
}

export const useTrack = create<TrackStore>(() => ({
  state: "idle",
  token: null,
  order: null,
  updatedAt: null,
  stale: false,
  first: false,
  cancelAsk: false,
  cancelling: false,
  source: "link",
  pay: "idle",
  switching: false,
}));

/** Per install, as the cart is (`lib/mountKey.ts`). */
const LAST_LINK = mountKey("online-ordering-last-order");
const FINAL = ["picked_up", "cancelled", "not_collected"];

/** The link this device keeps for "Track an order". */
export function lastLink(): string | null {
  try {
    return localStorage.getItem(LAST_LINK);
  } catch {
    return null;
  }
}

function keepLink(token: string): void {
  try {
    localStorage.setItem(LAST_LINK, token);
  } catch {
    // Not kept: "Track an order" goes to Find my order.
  }
}

export function forgetLink(): void {
  try {
    localStorage.removeItem(LAST_LINK);
  } catch {
    // Nothing kept.
  }
}

/** Opens an order by its link's code and reads it. */
export async function openTrack(token: string, first = false): Promise<void> {
  keepLink(token);
  useTrack.setState({ state: "loading", token, first, order: null, stale: false, source: "link", pay: "idle" });
  try {
    await sources().diner.openLink(token);
  } catch (error) {
    const expired = isApiError(error) && (error.code === "LINK_EXPIRED" || error.code === "PUBLIC_REF_NOT_FOUND");
    // A link that opens nothing any more is not this device's to keep.
    if (expired && lastLink() === token) forgetLink();
    useTrack.setState({ state: expired ? "expired" : "error" });
    return;
  }
  await readTrack();
  // Opened, but the first read did not answer: said, with its Retry, never an endless skeleton.
  if (useTrack.getState().state === "loading") useTrack.setState({ state: "error" });
  else checkReturned();
}

// ── paying online ───────────────────────────────────────────────────────────

/** Per install, for the tab: the order this tab last sent to the pay page. */
const SENT_KEY = mountKey("online-ordering-paying");
/** How long, back from the pay page, the page waits for the payment to make the order new before it says it didn't finish. */
export const CHECK_MS = 15_000;
const CHECK_EVERY_MS = 2_000;

interface Sent {
  token: string | null;
  id: Id;
  at: number;
}

function tab(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function readSent(): Sent | null {
  try {
    const raw = tab()?.getItem(SENT_KEY) ?? null;
    if (raw === null) return null;
    const sent = JSON.parse(raw) as Partial<Sent>;
    return typeof sent.id === "number" && typeof sent.at === "number" ? { token: typeof sent.token === "string" ? sent.token : null, id: sent.id, at: sent.at } : null;
  } catch {
    return null;
  }
}

function keepSent(sent: Sent | null): void {
  try {
    if (sent === null) tab()?.removeItem(SENT_KEY);
    else tab()?.setItem(SENT_KEY, JSON.stringify(sent));
  } catch {
    // Not kept: back from the pay page, the diner finds the order with "Track an order".
  }
}

/** Back on the order page's own address with no code: the order this tab sent to the pay page, opened again. False when there is none. */
export async function resumeFromPay(): Promise<boolean> {
  const sent = readSent();
  const token = sent?.token ?? null;
  // A note older than the longest hold is no use any more: the order was paid, or let go, long since.
  if (sent === null || token === null || sources().clock.now() - sent.at > 60 * 60_000) return false;
  await openTrack(token);
  return true;
}

/** Opened again after the pay page: check for a few seconds whether the payment made the order new. */
function checkReturned(): void {
  const { order } = useTrack.getState();
  const sent = readSent();
  if (order === null || sent === null || sent.id !== order.order.id) return;
  if (order.order["status"] !== "paying") {
    keepSent(null);
    return;
  }
  useTrack.setState({ pay: "checking" });
  const started = Date.now();
  const tick = async (): Promise<void> => {
    await readTrack();
    const now = useTrack.getState().order;
    if (now === null || now.order.id !== sent.id) return;
    if (now.order["status"] !== "paying") {
      keepSent(null);
      useTrack.setState({ pay: "idle" });
      return;
    }
    if (Date.now() - started >= CHECK_MS) {
      useTrack.setState({ pay: "failed" });
      return;
    }
    setTimeout(() => void tick(), CHECK_EVERY_MS);
  };
  setTimeout(() => void tick(), CHECK_EVERY_MS);
}

/**
 * To the pay page, for an order waiting for its payment: the tab keeps which
 * order it sent, and the page goes. The demo's pay page is a moment's
 * hand-off that pays the order at once, then shows it.
 */
export async function goPay(url: string, order: { id: Id; token: string | null }, wait = 600): Promise<void> {
  keepSent({ token: order.token, id: order.id, at: sources().clock.now() });
  if (order.token !== null) keepLink(order.token);
  useTrack.setState({ pay: "going" });
  const diner = sources().diner;
  await new Promise((resolve) => setTimeout(resolve, diner.demoPay === undefined ? wait : Math.max(wait, 1300)));
  if (diner.demoPay !== undefined) {
    diner.demoPay(order.id);
    keepSent(null);
    if (order.token !== null) await openTrack(order.token);
    else useTrack.setState({ pay: "idle" });
    return;
  }
  window.location.assign(url);
}

/** "Pay now" on an order waiting for its payment: the link already open, never a second payment. */
export async function payTracked(): Promise<void> {
  const { order, token, source } = useTrack.getState();
  if (order === null) return;
  useTrack.setState({ pay: "going" });
  try {
    const url = await sources().diner.payLink(source, order.order.id);
    await goPay(url, { id: order.order.id, token }, 300);
  } catch {
    // Paid meanwhile, let go, or payments switched off: the order as it is now says which.
    await readTrack();
    useTrack.setState({ pay: useTrack.getState().order?.order["status"] === "paying" ? "refused" : "idle" });
  }
}

/** "Pay when you pick up instead": the order made new, unpaid, as any order paid at pickup. */
export async function payAtPickupTracked(): Promise<boolean> {
  const { order, source } = useTrack.getState();
  if (order === null) return false;
  useTrack.setState({ switching: true });
  try {
    await sources().diner.payAtPickup(source, order.order.id);
    keepSent(null);
    await readTrack();
    useTrack.setState({ pay: "idle" });
    return true;
  } catch {
    await readTrack();
    return useTrack.getState().order?.order["status"] === "placed";
  } finally {
    useTrack.setState({ switching: false });
  }
}

/** Shows an order placed on this page whose reply carried no link (a replay): its figures, no reading. */
export function showWithoutLink(): void {
  useTrack.setState({ state: "ok", token: null, first: true, order: null, source: "link" });
}

/** Follows one of the signed-in diner's own orders, read through their sign-in. */
export function showAccountOrder(order: OrderWithLines): void {
  useTrack.setState({ state: "ok", token: null, first: false, order, updatedAt: sources().clock.now(), stale: false, source: "account" });
}

/** Reads the order again; a session that lapsed is opened again with the code it was opened with. */
export async function readTrack(): Promise<void> {
  const { token, source, order: shown } = useTrack.getState();
  if (source === "account") {
    try {
      const order = (await sources().diner.myOrders()).find((o) => o.order.id === shown?.order.id) ?? null;
      useTrack.setState(order === null ? { stale: true } : { state: "ok", order, updatedAt: sources().clock.now(), stale: false });
    } catch {
      useTrack.setState({ stale: true });
    }
    return;
  }
  try {
    const order = await sources().diner.linkedOrder();
    useTrack.setState({ state: "ok", order, updatedAt: sources().clock.now(), stale: false });
    // A finished order is not kept for "Track an order": the next person on this device sees nothing of it.
    if (!moving(order) && token !== null && lastLink() === token) forgetLink();
  } catch (error) {
    // The link's session lapsed (a fixed half hour): the order reads as nobody's, and the kept code opens it again.
    if (isApiError(error) && (error.status === 401 || error.code === "PUBLIC_REF_NOT_FOUND") && token !== null) {
      try {
        await sources().diner.openLink(token);
        const order = await sources().diner.linkedOrder();
        useTrack.setState({ state: "ok", order, updatedAt: sources().clock.now(), stale: false });
        return;
      } catch (again) {
        if (isApiError(again) && again.code === "LINK_EXPIRED") {
          useTrack.setState({ state: "expired" });
          return;
        }
      }
    }
    useTrack.setState({ stale: true });
  }
}

/** Whether the order still moves (and the page keeps reading it). */
export const moving = (order: OrderWithLines | null): boolean => order !== null && !FINAL.includes(String(order.order["status"]));

/**
 * Cancels the order while the kitchen has not taken it. The kitchen may have
 * just taken it: then nothing matches, the page reads it again, and says so.
 */
export async function cancelTracked(): Promise<"cancelled" | "started" | "failed"> {
  const { order } = useTrack.getState();
  if (order === null) return "failed";
  useTrack.setState({ cancelling: true });
  try {
    if (useTrack.getState().source === "account") await sources().diner.cancelMine(order.order.id);
    else {
      try {
        await sources().diner.cancelLinked(order.order.id);
      } catch (error) {
        // The link's own session lapsed (half an hour): opened again with its code, the cancel is asked once more.
        const token = useTrack.getState().token;
        if (!isApiError(error) || error.status !== 404 || token === null) throw error;
        await sources().diner.openLink(token);
        await sources().diner.cancelLinked(order.order.id);
      }
    }
    await readTrack();
    return "cancelled";
  } catch (error) {
    await readTrack();
    // Taken by the kitchen, or cancelled already: the window rides in the change, and nothing matched.
    if (isApiError(error) && error.status === 404) {
      return String(useTrack.getState().order?.order["status"]) === "cancelled" ? "cancelled" : "started";
    }
    return "failed";
  } finally {
    useTrack.setState({ cancelling: false, cancelAsk: false });
  }
}
