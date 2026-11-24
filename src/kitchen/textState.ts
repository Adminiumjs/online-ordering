/**
 * Where an order's ready text stands, as the board says it: small, beside
 * the order, and never in the kitchen's way.
 *
 * The text is queued when the order is marked ready and waits out the Undo
 * (`HOLD_MS`, the outbox's `holdSeconds`); an Undo drops it, so nothing is
 * sent. Then Adminium sends it, or says why it did not, as a code on the
 * outbox row (`text_reason`) beside its English sentence. The board reads the
 * code, never the sentence, and nothing else of the row.
 *
 * Nothing is said for an order whose diner did not tick the box, nor when
 * the kitchen has no texts (no provider, texts off, sample data): there is
 * no text to speak of.
 */
import type { Row } from "../data/wire.ts";

/** The outbox's wait before "ready" reaches the diner, in milliseconds (`manifest/outbox.ts`, `HOLD_SECONDS`). */
export const HOLD_MS = 20_000;

export const TEXT_KIND = "order-ready-text";

export type TextOutcome = "waiting" | "sent" | "no-number" | "opted-out" | "limit" | "unknown" | "not-sent";

/**
 * Adminium's code for how a text ended (`outbox.columns.textReason`, 0.3.76), by what the board says of it. A code
 * not listed is "Text not sent"; null says nothing.
 */
const SAID: Readonly<Record<string, TextOutcome | null>> = {
  queued: "waiting",
  waiting: "waiting",
  sent: "sent",
  unknown: "unknown",
  "earlier-send-open": "unknown",
  "no-number": "no-number",
  "unreadable-phone": "no-number",
  "bad-number": "no-number",
  "invalid-number": "no-number",
  "cannot-receive-text": "no-number",
  "not-mobile": "no-number",
  stopped: "opted-out",
  "opted-out": "opted-out",
  "daily-limit": "limit",
  // No text to speak of: the kitchen has none set up, or this is sample data, or the "ready" was taken back.
  "not-set-up": null,
  sample: null,
  rehearsal: null,
  "no-longer-needed": null,
};

const yes = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

/** A text dropped by an Undo: the "ready" it was for did not stand. */
const dropped = (m: Row) => m["status"] === "skipped" && (m["skip_reason"] === "no-longer-needed" || m["text_reason"] === "no-longer-needed");

/** The order's newest ready text that still speaks for it, or null. */
export function latestText(texts: readonly Row[] | undefined): Row | null {
  const own = (texts ?? []).filter((m) => m["kind"] === TEXT_KIND && !dropped(m));
  own.sort((a, b) => Number(b.id) - Number(a.id));
  return own[0] ?? null;
}

/**
 * What the board says of an order's ready text: `waiting` while it is held
 * or on its way, then how it ended; null when there is nothing to say.
 */
export function textOutcome(order: Row, texts: readonly Row[] | undefined, opts: { offered: boolean }): TextOutcome | null {
  // `texts` unread (a door that cannot read the outbox): nothing is said, rather than a wait that never ends.
  if (!opts.offered || !yes(order["texts_ok"]) || texts === undefined) return null;
  const row = latestText(texts);
  // Marked ready a moment ago: the outbox row is on its way to the board.
  if (row === null) return order["status"] === "ready" ? "waiting" : null;
  const code = typeof row["text_reason"] === "string" && row["text_reason"] !== "" ? row["text_reason"] : null;
  if (code !== null) return code in SAID ? (SAID[code] ?? null) : "not-sent";
  // Not yet judged by Adminium: still held, or on its way.
  return row["status"] === "queued" ? "waiting" : row["status"] === "sent" ? "sent" : "not-sent";
}

/** The words for an outcome that has ended (`waiting` has its own line, with the seconds). */
export const OUTCOME_WORD: Record<Exclude<TextOutcome, "waiting">, string> = {
  sent: "kitchen.text.sent",
  "no-number": "kitchen.text.noNumber",
  "opted-out": "kitchen.text.optedOut",
  limit: "kitchen.text.limit",
  unknown: "kitchen.text.unknown",
  "not-sent": "kitchen.text.notSent",
};
