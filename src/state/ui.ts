/**
 * What is on the screen: which side and view, the theme, the toast, and the
 * one dialog or sheet open over the page. The URL follows the view
 * (`urlSync.ts`), so a reload or a shared link lands where it was.
 */
import { create } from "zustand";

export type Persona = "diner" | "kitchen";

import type { DinerView, KitchenView, View } from "./views.ts";

export type { DinerView, KitchenView, View };

export type ToastKind = "ok" | "warn" | "bell";

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  /** A short note after the message, "(sound off)". */
  suffix?: string;
  /** The kitchen's Undo (or another action, named by `actionLabel`), for ten seconds. */
  undo?: () => void;
  actionLabel?: string;
}

export type Theme = "light" | "dark";

interface UiState {
  persona: Persona;
  dinerView: DinerView;
  kitchenView: KitchenView;
  /** The menu's chosen category, or every one. */
  category: number | "all";
  theme: Theme;
  toast: Toast | null;
  /** The diner's mobile navigation sheet. */
  mobileMenu: boolean;
}

const STORAGE = "online-ordering-theme";

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // No storage: the system's preference decides.
  }
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const useUi = create<UiState>(() => ({
  persona: "diner",
  dinerView: "home",
  kitchenView: "queue",
  category: "all",
  theme: initialTheme(),
  toast: null,
  mobileMenu: false,
}));

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastId = 0;

/** Says something for a moment: 3.2 seconds, or ten with an Undo. */
export function toast(message: string, kind: ToastKind = "ok", extra: { suffix?: string; undo?: () => void; actionLabel?: string } = {}): void {
  toastId += 1;
  useUi.setState({ toast: { id: toastId, message, kind, ...extra } });
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useUi.setState({ toast: null }), extra.undo === undefined ? 3200 : 10_000);
}

/** Holds the toast while the pointer or focus is on it (its Undo must not run out under a finger). */
export function holdToast(held: boolean, undoable: boolean): void {
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = null;
  if (!held) toastTimer = setTimeout(() => useUi.setState({ toast: null }), undoable ? 10_000 : 3200);
}

export function dismissToast(): void {
  if (toastTimer !== null) clearTimeout(toastTimer);
  useUi.setState({ toast: null });
}

export function setTheme(theme: Theme): void {
  useUi.setState({ theme });
  try {
    localStorage.setItem(STORAGE, theme);
  } catch {
    // Not remembered, still applied.
  }
}

/** Goes to a diner view from the top of the page, every overlay closed. */
export function goDiner(view: DinerView, extra: Partial<UiState> = {}): void {
  useUi.setState({ dinerView: view, mobileMenu: false, ...extra });
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

/** Goes to a screen by its address's view: the kitchen's, or one of the diner's. */
export function goView(view: View): void {
  if (view === "kitchen") useUi.setState({ persona: "kitchen" });
  else goDiner(view, { persona: "diner" });
}

/** The screen the address shows. */
export const currentView = (): View => (useUi.getState().persona === "kitchen" ? "kitchen" : useUi.getState().dinerView);

export function goKitchen(view: KitchenView): void {
  useUi.setState({ kitchenView: view });
}
