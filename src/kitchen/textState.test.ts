/**
 * What the board says of a ready text: held, then sent or why not, from
 * Adminium's code on the outbox row (`text_reason`), never its English
 * sentence; nothing where the diner did not ask, the kitchen has no texts, or
 * the "ready" was taken back.
 */
import { describe, expect, it } from "vitest";

import type { Row } from "../data/wire.ts";
import { latestText, textOutcome } from "./textState.ts";

const order = (more: Partial<Row> = {}): Row => ({ status: "ready", texts_ok: true, ...more, id: 1 });
const text = (id: number, status: string, code: string | null = null, skip_reason: string | null = null): Row => ({ id, kind: "order-ready-text", status, error: "an English sentence the board never reads", text_reason: code, skip_reason, order_id: 1 });
const on = { offered: true };

describe("the board's line for a ready text", () => {
  it("says nothing when the diner did not tick the box, texts are not offered, or the outbox was not read", () => {
    expect(textOutcome(order({ texts_ok: false }), [text(1, "sent", "sent")], on)).toBeNull();
    expect(textOutcome(order(), [text(1, "sent", "sent")], { offered: false })).toBeNull();
    expect(textOutcome(order(), undefined, on)).toBeNull();
  });

  it("is held from the moment the order is ready, before the outbox row is read, while queued, and while on its way", () => {
    expect(textOutcome(order(), [], on)).toBe("waiting");
    expect(textOutcome(order(), [text(1, "queued")], on)).toBe("waiting");
    expect(textOutcome(order(), [text(1, "sent", "queued")], on)).toBe("waiting");
    expect(textOutcome(order(), [text(1, "sent", "waiting")], on)).toBe("waiting");
    // Not yet ready (taken back, nothing queued): nothing to say.
    expect(textOutcome(order({ status: "preparing" }), [], on)).toBeNull();
  });

  it("says each way it ended, by Adminium's code", () => {
    const said = (status: string, code: string) => textOutcome(order(), [text(1, status, code)], on);
    expect(said("sent", "sent")).toBe("sent");
    for (const code of ["no-number", "unreadable-phone", "bad-number", "invalid-number", "cannot-receive-text", "not-mobile"]) expect([code, said("skipped", code)]).toEqual([code, "no-number"]);
    expect(said("skipped", "stopped")).toBe("opted-out");
    expect(said("failed", "opted-out")).toBe("opted-out");
    expect(said("skipped", "daily-limit")).toBe("limit");
    expect(said("sent", "unknown")).toBe("unknown");
    expect(said("sent", "earlier-send-open")).toBe("unknown");
    expect(said("skipped", "no-consent")).toBe("not-sent");
    expect(said("failed", "provider-failed")).toBe("not-sent");
  });

  it("says nothing where there is no text to speak of: texts not set up, sample data, a rehearsal", () => {
    for (const code of ["not-set-up", "sample", "rehearsal"]) expect([code, textOutcome(order(), [text(1, "skipped", code)], on)]).toEqual([code, null]);
  });

  it("reads the newest text that still speaks for the order: one an Undo dropped does not", () => {
    const undone = text(1, "skipped", "no-longer-needed", "no-longer-needed");
    expect(latestText([undone])).toBeNull();
    expect(textOutcome(order(), [undone], on)).toBe("waiting");
    expect(textOutcome(order(), [undone, text(2, "sent", "sent")], on)).toBe("sent");
    expect(textOutcome(order(), [text(2, "skipped", "daily-limit"), text(3, "queued")], on)).toBe("waiting");
  });
});
