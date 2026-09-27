/**
 * "Order it again": a past order back into the cart, rebuilt from the ids it
 * kept — each line's dish and options — never by names. A dish that is sold
 * out or off the menu, or an option switched off, stays out and is named;
 * the cart is then priced by Adminium like any other.
 */
import { create } from "zustand";

import type { OrderWithLines } from "../data/ports.ts";
import { portionsOf } from "../lib/menu.ts";
import { sources } from "../data/sources.ts";
import { activeDay, lineKey, replaceCart, useDiner, type CartLine } from "./diner.ts";

export interface Rebuilt {
  lines: CartLine[];
  /** The dishes left out: sold out or off the menu. */
  gone: string[];
}

export function rebuild(order: OrderWithLines): Rebuilt {
  const s = useDiner.getState();
  const menu = s.data?.menu;
  const day = activeDay(sources().clock.now());
  const lines: CartLine[] = [];
  const gone: string[] = [];
  for (const line of order.lines) {
    const dishId = Number(line["menu_item_id"]);
    const dish = menu?.dish(dishId);
    const name = String(line["name"] ?? dish?.name ?? "");
    if (dish === undefined || !dish.online || !dish.available || portionsOf(s.dishes[day] ?? null, dishId).soldOut) {
      gone.push(name);
      continue;
    }
    const options = line.options.map((o) => Number(o["modifier_id"]));
    if (options.some((id) => menu?.option(id)?.available !== true)) {
      gone.push(name);
      continue;
    }
    const note = String(line["note"] ?? "");
    const key = lineKey(dishId, options, note);
    const same = lines.find((l) => l.key === key);
    const qty = Number(line["qty"] ?? 1);
    if (same !== undefined) same.qty = Math.min(20, same.qty + qty);
    else lines.push({ key, dishId, qty, options, note });
  }
  return { lines, gone };
}

/** An order waiting on "Replace what's in your order?". */
export const useReorderAsk = create<{ order: OrderWithLines | null }>(() => ({ order: null }));

/** Puts a rebuilt order in the cart: in place of what is there, or added to it. */
export function applyRebuilt(rebuilt: Rebuilt, mode: "replace" | "add"): void {
  if (mode === "replace") {
    replaceCart(rebuilt.lines);
    return;
  }
  const cart = useDiner.getState().cart.map((l) => ({ ...l }));
  for (const line of rebuilt.lines) {
    const same = cart.find((l) => l.key === line.key);
    if (same !== undefined) same.qty = Math.min(20, same.qty + line.qty);
    else cart.push(line);
  }
  replaceCart(cart);
}
