/**
 * A tap that moves an order on, as the kitchen says it: the move, a toast
 * with Undo for ten seconds (the card offers the same Undo), and — when another
 * screen got there first, or the diner cancelled — what happened instead.
 */
import { create } from "zustand";

import type { Id } from "../data/wire.ts";
import type { TFunction } from "../i18n/index.tsx";
import type { Formatter } from "../lib/format.ts";
import { firstName } from "../lib/format.ts";
import { moveOrder, useKitchen, type MoveResult } from "../state/kitchen.ts";
import { toast } from "../state/ui.ts";

export const UNDO_MS = 10_000;

/** The move this screen may still undo, and until when (the device's clock: the Undo is this screen's own). */
export const useRecentMove = create<{ id: Id | null; from: string; to: string; until: number }>(() => ({ id: null, from: "", to: "", until: 0 }));

export const STATE_WORD: Record<string, string> = {
  placed: "kitchen.state.placed",
  confirmed: "kitchen.state.confirmed",
  preparing: "kitchen.state.preparing",
  ready: "kitchen.state.ready",
  picked_up: "kitchen.state.picked_up",
  cancelled: "kitchen.state.cancelled",
  not_collected: "kitchen.state.not_collected",
};

export function word(t: TFunction, state: string): string {
  return t((STATE_WORD[state] ?? "kitchen.state.placed") as "kitchen.state.placed");
}

/** Says why a move did not happen. */
export function sayRefused(t: TFunction, fmt: Formatter, result: MoveResult, number: string, name: string): void {
  if (result.ok) return;
  if (result.kind === "unchanged") {
    const at = result.at === null ? "" : fmt.time(result.at);
    toast(result.by === null || result.by === "" ? t("kitchen.move.alreadyAt", { number, state: word(t, result.state).toLocaleLowerCase(), time: at }) : t("kitchen.move.already", { number, state: word(t, result.state).toLocaleLowerCase(), time: at, by: result.by }), "warn");
  } else if (result.kind === "moved") {
    toast(t("kitchen.move.movedElsewhere", { number, state: word(t, result.state).toLocaleLowerCase() }), "warn");
  } else if (result.kind === "late") {
    toast(t("kitchen.move.undoLate", { number }), "warn");
  } else if (result.kind === "cancelled") {
    toast(t("kitchen.move.cancelledBy", { name: firstName(name), time: result.at === null ? "" : fmt.time(result.at) }), "warn");
  } else {
    toast(t("kitchen.move.failed", { number }), "warn");
  }
}

/** Moves an order one step on and offers Undo. */
export async function advance(t: TFunction, fmt: Formatter, id: Id, from: string, to: string): Promise<void> {
  const order = useKitchen.getState().orders.find((o) => o.order.id === id);
  const number = String(order?.order["number"] ?? "");
  const name = String(order?.order["name"] ?? "");
  const result = await moveOrder(id, from, to);
  if (!result.ok) {
    sayRefused(t, fmt, result, number, name);
    return;
  }
  const until = Date.now() + UNDO_MS;
  useRecentMove.setState({ id, from, to, until });
  // The card's Undo goes when its ten seconds do.
  setTimeout(() => {
    if (useRecentMove.getState().until === until) useRecentMove.setState({ id: null, until: 0 });
  }, UNDO_MS);
  toast(t("kitchen.move.done", { number, state: word(t, to) }), "ok", { undo: () => void undo(t, fmt) });
}

/** Moves the last order back, within its ten seconds. */
export async function undo(t: TFunction, fmt: Formatter): Promise<void> {
  const recent = useRecentMove.getState();
  if (recent.id === null || Date.now() > recent.until) {
    toast(t("kitchen.move.undoGone"), "warn");
    return;
  }
  useRecentMove.setState({ id: null, until: 0 });
  const order = useKitchen.getState().orders.find((o) => o.order.id === recent.id);
  const number = String(order?.order["number"] ?? "");
  const result = await moveOrder(recent.id, recent.to, recent.from);
  if (result.ok) toast(t("kitchen.move.undone", { number, state: word(t, recent.from) }));
  else sayRefused(t, fmt, result, number, String(order?.order["name"] ?? ""));
}
