/**
 * A large-order enquiry: how many people, which day, what they are thinking,
 * and who to call. It is sent once however often the button is pressed — a
 * retry carries the same key — and the reference it gets is Adminium's.
 */
import { create } from "zustand";

import type { Row } from "../data/wire.ts";
import { isApiError } from "../data/wire.ts";
import { sources } from "../data/sources.ts";

export interface LargeForm {
  heads: number;
  headsText: string;
  /** A day chip's date, "other" for the date field, or "" for none. */
  date: string;
  other: string;
  notes: string;
  name: string;
  phone: string;
  email: string;
}

interface LargeState {
  form: LargeForm;
  touched: Partial<Record<"name" | "phone" | "email", boolean>>;
  sending: boolean;
  /** The last send failed: refused as too many from here, or anything else. */
  failed: false | "limit" | "notes" | "other";
  sent: Row | null;
  clientKey: string | null;
}

export const freshLarge = (): LargeForm => ({ heads: 12, headsText: "12", date: "", other: "", notes: "", name: "", phone: "", email: "" });

export const useLarge = create<LargeState>(() => ({ form: freshLarge(), touched: {}, sending: false, failed: false, sent: null, clientKey: null }));

const get = useLarge.getState;
const set = useLarge.setState;

export const HEADS_MIN = 6;
export const HEADS_MAX = 120;

export function setLarge(patch: Partial<LargeForm>): void {
  set({ form: { ...get().form, ...patch }, failed: false });
}

export function touchLarge(name: "name" | "phone" | "email"): void {
  set({ touched: { ...get().touched, [name]: true } });
}

export function stepHeads(by: number): void {
  const heads = Math.min(HEADS_MAX, Math.max(HEADS_MIN, get().form.heads + by));
  setLarge({ heads, headsText: String(heads) });
}

export function typeHeads(text: string): void {
  const digits = text.replace(/[^0-9]/g, "").slice(0, 3);
  const value = Number.parseInt(digits, 10);
  setLarge({ headsText: digits, heads: Number.isNaN(value) ? get().form.heads : Math.min(HEADS_MAX, Math.max(HEADS_MIN, value)) });
}

export function settleHeads(): void {
  setLarge({ headsText: String(get().form.heads) });
}

function mintKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendEnquiry(language: string): Promise<boolean> {
  const s = get();
  if (s.sending) return false;
  const clientKey = s.clientKey ?? mintKey();
  set({ sending: true, failed: false, clientKey });
  const f = s.form;
  try {
    const sent = await sources().diner.enquire(
      {
        heads: f.heads,
        wanted_on: f.date === "other" ? f.other : f.date,
        ...(f.notes.trim() === "" ? {} : { notes: f.notes.trim() }),
        name: f.name.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        language,
        client_key: clientKey,
      },
      clientKey,
    );
    set({ sending: false, sent, clientKey: null });
    return true;
  } catch (error) {
    // A lost answer keeps the key: sending again files the same enquiry, once.
    const limit = isApiError(error) && (error.code === "PUBLIC_RATE_LIMITED" || error.code === "PUBLIC_LIMIT_REACHED");
    // No answer, or a proxy's or the server's error: the enquiry may be in, and the key is kept.
    const mayBeIn = !isApiError(error) || error.status === 0 || error.status >= 500 || error.code === "PUBLIC_UPSTREAM_UNAVAILABLE";
    // The door named the note: said as what it is, not as "try again" (the same text would be refused again).
    const notes = isApiError(error) && error.code === "PUBLIC_WRITE_REFUSED" && error.params["column"] === "notes";
    set({ sending: false, failed: limit ? "limit" : notes ? "notes" : "other", ...(mayBeIn ? {} : { clientKey: null }) });
    return false;
  }
}

export function sendAnother(): void {
  set({ form: freshLarge(), touched: {}, sent: null, failed: false, clientKey: null });
}
