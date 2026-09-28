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
 */
import { create } from "zustand";

import type { OrderWithLines } from "../data/ports.ts";
import { isApiError } from "../data/wire.ts";
import { sources } from "../data/sources.ts";

export type TrackState = "idle" | "loading" | "ok" | "expired" | "error";

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
}));

const LAST_LINK = "online-ordering-last-order";
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
  useTrack.setState({ state: "loading", token, first, order: null, stale: false, source: "link" });
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
