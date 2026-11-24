/**
 * Where an order's ready text stands, as the board says it: small, beside
 * the order, and never in the kitchen's way.
 *
 * The text is queued when the order is marked ready and waits out the Undo
 * (`HOLD_MS`, the outbox's `holdSeconds`); an Undo drops it, so nothing is
 * sent. Then Adminium sends it, or says why it did not, in a fixed sentence
 * on the outbox row (`error`) that holds no number. The board reads that
 * sentence and nothing else of the row.
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
 * Adminium's fixed sentences on an outbox row (`apps/server/src/outbox/text-words.ts`, 0.3.76), by what the
 * board says of them. A sentence not listed is "Text not sent".
 */
const SAID: readonly (readonly [prefix: string, outcome: TextOutcome | null])[] = [
  ["No mobile number on file", "no-number"],
  ["Not sent: the mobile number cannot be read", "no-number"],
  ["Not sent: the provider says the number is invalid", "no-number"],
  ["Not sent: this number cannot receive a text", "no-number"],
  ["Not sent: this number is not a mobile", "no-number"],
  ["Not sent: this person replied STOP", "opted-out"],
  ["Not sent: this person opted out at the provider", "opted-out"],
  ["Not sent: the daily text limit is reached", "limit"],
  ["Unknown: check with the provider before resending", "unknown"],
  ["An earlier send is still open: check it before resending", "unknown"],
  // Still on its way: claimed, and held for its hours (never for this kind, which may go at any hour).
  ["Waiting for the sending hours", "waiting"],
  // No text to speak of: the kitchen has none set up, or this is sample data, or the "ready" was taken back.
  ["No text provider is connected", null],
  ["No sender is set for texts", null],
  ["Texts are switched off on this server", null],
  ["Sample data (never sent)", null],
  ["A rehearsal sends no real text", null],
  ["No longer needed", null],
];

const yes = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

/** A text dropped by an Undo: the "ready" it was for did not stand. */
const dropped = (m: Row) => m["status"] === "skipped" && (m["skip_reason"] === "no-longer-needed" || m["error"] === "No longer needed");

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
  const status = String(row["status"] ?? "");
  const error = typeof row["error"] === "string" ? row["error"] : "";
  if (status === "queued") return "waiting";
  if (error !== "") {
    const said = SAID.find(([prefix]) => error.startsWith(prefix));
    if (said !== undefined) return said[1];
  }
  if (status === "sent") return error === "" ? "sent" : "unknown";
  return "not-sent";
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
