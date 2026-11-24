/**
 * What the board says of a ready text: held, then sent or why not, from
 * Adminium's fixed sentence on the outbox row; nothing where the diner did not
 * ask, the kitchen has no texts, or the "ready" was taken back.
 */
import { describe, expect, it } from "vitest";

import type { Row } from "../data/wire.ts";
import { latestText, textOutcome } from "./textState.ts";

const order = (more: Partial<Row> = {}): Row => ({ status: "ready", texts_ok: true, ...more, id: 1 });
const text = (id: number, status: string, error: string | null = null, skip_reason: string | null = null): Row => ({ id, kind: "order-ready-text", status, error, skip_reason, order_id: 1 });
const on = { offered: true };

describe("the board's line for a ready text", () => {
  it("says nothing when the diner did not tick the box, the kitchen does not offer texts, or the outbox was not read", () => {
    expect(textOutcome(order({ id: 1, texts_ok: false }), [text(1, "sent")], on)).toBeNull();
    expect(textOutcome(order(), [text(1, "sent")], { offered: false })).toBeNull();
    expect(textOutcome(order(), undefined, on)).toBeNull();
  });

  it("is held from the moment the order is ready, before the outbox row is read, and while it is queued", () => {
    expect(textOutcome(order(), [], on)).toBe("waiting");
    expect(textOutcome(order(), [text(1, "queued")], on)).toBe("waiting");
    // Not yet ready (taken back, nothing queued): nothing to say.
    expect(textOutcome(order({ id: 1, status: "preparing" }), [], on)).toBeNull();
  });

  it("says each way it ended, by Adminium's sentence", () => {
    const said = (status: string, error: string | null) => textOutcome(order(), [text(1, status, error)], on);
    expect(said("sent", null)).toBe("sent");
    expect(said("skipped", "No mobile number on file")).toBe("no-number");
    expect(said("skipped", "Not sent: the mobile number cannot be read")).toBe("no-number");
    expect(said("skipped", "Not sent: this person replied STOP")).toBe("opted-out");
    expect(said("failed", "Not sent: this person opted out at the provider")).toBe("opted-out");
    expect(said("skipped", "Not sent: the daily text limit is reached")).toBe("limit");
    expect(said("sent", "Unknown: check with the provider before resending")).toBe("unknown");
    expect(said("failed", "Unknown: check with the provider before resending")).toBe("unknown");
    expect(said("sent", "An earlier send is still open: check it before resending")).toBe("unknown");
    expect(said("skipped", "Not sent: this person has not agreed to texts")).toBe("not-sent");
    expect(said("failed", "Not delivered: the provider reports it failed")).toBe("not-sent");
  });

  it("says nothing where the kitchen has no texts to speak of: no provider, texts off, sample data", () => {
    for (const error of ["No text provider is connected", "Texts are switched off on this server", "No sender is set for texts", "Sample data (never sent)"]) {
      expect([error, textOutcome(order(), [text(1, "skipped", error)], on)]).toEqual([error, null]);
    }
  });

  it("reads the newest text that still speaks for the order: one an Undo dropped does not", () => {
    const undone = text(1, "skipped", null, "no-longer-needed");
    expect(latestText([undone])).toBeNull();
    expect(textOutcome(order(), [undone], on)).toBe("waiting");
    expect(textOutcome(order(), [undone, text(2, "sent")], on)).toBe("sent");
    expect(textOutcome(order(), [text(2, "skipped", "Not sent: the daily text limit is reached"), text(3, "queued")], on)).toBe("waiting");
  });
});
