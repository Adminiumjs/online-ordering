/**
 * Signing in with an emailed link (or its code on another device), and what
 * a signed-in diner sees: their own orders, newest first, each one to order
 * again; signing out here or on every device; deleting their details.
 *
 * "Send the link" answers the same whoever the address belongs to, so the
 * page never learns whether it has orders. The page counts its own sends
 * (three, then a wait) — the server's limit is not something it can see.
 */
import { create } from "zustand";

import type { OrderWithLines } from "../data/ports.ts";
import { isApiError } from "../data/wire.ts";
import { sources } from "../data/sources.ts";

export interface FindState {
  step: "email" | "sent" | "signing";
  email: string;
  touched: boolean;
  codeOpen: boolean;
  code: string;
  /** When the last link went, for the resend cool-down. */
  sentAt: number;
  sends: number;
  error: { kind: "wrong"; triesLeft: number } | { kind: "locked"; minutes: number } | { kind: "expired" } | null;
  /** An emailed link that no longer works. */
  linkExpired: boolean;
  busy: boolean;
}

interface AccountState {
  find: FindState;
  person: { email: string; name: string | null; at: string } | null;
  orders: OrderWithLines[] | null;
  /** A line for the find page after leaving: signed out everywhere, details deleted. */
  notice: "signedOutEverywhere" | "deleted" | "lapsed" | null;
  menuOpen: boolean;
  confirmSignOutAll: boolean;
  deleteAsk: boolean;
  /** The step-up link went: open it to finish deleting. */
  deletePending: boolean;
  busy: boolean;
}

const freshFind = (): FindState => ({ step: "email", email: "", touched: false, codeOpen: false, code: "", sentAt: 0, sends: 0, error: null, linkExpired: false, busy: false });

export const useAccount = create<AccountState>(() => ({
  find: freshFind(),
  person: null,
  orders: null,
  notice: null,
  menuOpen: false,
  confirmSignOutAll: false,
  deleteAsk: false,
  deletePending: false,
  busy: false,
}));

const get = useAccount.getState;
const set = useAccount.setState;
const port = () => sources().diner;
const setFind = (patch: Partial<FindState>) => set({ find: { ...get().find, ...patch } });

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SEND_LIMIT = 3;
export const RESEND_SECONDS = 60;

export function setFindEmail(email: string): void {
  setFind({ email });
}
export function touchFindEmail(): void {
  setFind({ touched: true });
}
export function setCode(code: string): void {
  setFind({ code: code.replace(/[^0-9]/g, "").slice(0, 6), error: get().find.error?.kind === "locked" ? get().find.error : null });
}
export function openCode(): void {
  setFind({ codeOpen: true });
}
export function restartFind(): void {
  setFind({ step: "email", code: "", codeOpen: false, error: null });
}

/** Asks for a sign-in link; the answer is the same whether the address has orders or not. */
export async function sendLink(language: string): Promise<boolean> {
  const f = get().find;
  if (!EMAIL.test(f.email.trim())) {
    setFind({ touched: true });
    return false;
  }
  if (f.sends >= SEND_LIMIT) return false;
  setFind({ busy: true });
  try {
    await port().requestSignIn(f.email.trim(), language);
    setFind({ step: "sent", sentAt: sources().clock.now(), sends: f.sends + 1, code: "", codeOpen: false, error: null, linkExpired: false, busy: false });
    set({ notice: null });
    return true;
  } catch {
    setFind({ busy: false });
    return false;
  }
}

/** Signs in with the code from the email. */
export async function signInWithCode(): Promise<boolean> {
  const f = get().find;
  if (f.code.length !== 6) return false;
  setFind({ busy: true, error: null });
  try {
    await port().verifyCode(f.email.trim(), f.code);
    await signedIn();
    set({ find: freshFind() });
    return true;
  } catch (error) {
    if (isApiError(error) && error.code === "PUBLIC_CODE_WRONG") setFind({ error: { kind: "wrong", triesLeft: Number(error.params["triesLeft"] ?? 0) } });
    else if (isApiError(error) && (error.code === "PUBLIC_CODE_LOCKED" || error.code === "PUBLIC_CLAIM_LOCKED"))
      setFind({ error: { kind: "locked", minutes: Math.max(1, Math.ceil(Number(error.params["retryAfter"] ?? 900) / 60)) } });
    else setFind({ error: { kind: "expired" } });
    setFind({ busy: false });
    return false;
  }
}

/** Signs in with the emailed link (its code in the page's address). */
export async function openSignInLink(token: string): Promise<boolean> {
  set({ find: { ...freshFind(), step: "signing" } });
  try {
    await port().verifyLink(token);
    await signedIn();
    set({ find: freshFind() });
    return true;
  } catch {
    set({ find: { ...freshFind(), linkExpired: true } });
    return false;
  }
}

/** Reads who is signed in on this browser, and their orders. */
export async function signedIn(): Promise<void> {
  const person = await port().signedIn();
  set({ person });
  if (person !== null) await readOrders();
}

export async function readOrders(): Promise<void> {
  try {
    set({ orders: await port().myOrders() });
  } catch (error) {
    if (isApiError(error) && error.status === 401) set({ person: null, orders: null, notice: "lapsed" });
  }
}

export function toggleAccountMenu(open?: boolean): void {
  set({ menuOpen: open ?? !get().menuOpen });
}

export async function signOut(): Promise<void> {
  await port().signOut();
  set({ person: null, orders: null, menuOpen: false, notice: null });
}

export function askSignOutAll(open: boolean): void {
  set({ confirmSignOutAll: open, menuOpen: false });
}

export async function signOutEverywhere(): Promise<void> {
  set({ busy: true });
  try {
    await port().signOutEverywhere();
  } finally {
    set({ busy: false, person: null, orders: null, confirmSignOutAll: false, notice: "signedOutEverywhere" });
  }
}

export function askDelete(open: boolean): void {
  set({ deleteAsk: open, menuOpen: false });
}

/**
 * Deletes the diner's details. A sign-in older than ten minutes is asked to
 * sign in again first: a fresh link goes to their email, and opening it
 * finishes the delete.
 */
export async function deleteDetails(language: string): Promise<"deleted" | "stepUp" | "failed"> {
  set({ busy: true });
  try {
    await port().forget();
    set({ busy: false, deleteAsk: false, person: null, orders: null, notice: "deleted", deletePending: false });
    return "deleted";
  } catch (error) {
    set({ busy: false, deleteAsk: false });
    if (isApiError(error) && error.code === "PUBLIC_CODE_STEP_UP") {
      const email = get().person?.email;
      if (email !== undefined) await port().requestSignIn(email, language);
      set({ deletePending: true });
      return "stepUp";
    }
    return "failed";
  }
}

/** After a fresh sign-in from the step-up link: the delete is asked again, now with a fresh sign-in. */
export function resumeDelete(): void {
  if (get().deletePending) set({ deletePending: false, deleteAsk: true });
}
