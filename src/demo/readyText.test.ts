/**
 * The ready text, as the demo's Adminium plays it: queued when an order whose
 * diner ticked the box is marked ready, held for the Undo, dropped by an Undo
 * (nothing sent), sent once its wait is over, to the diner's own mobile; and
 * the kitchen reads only whether it went.
 */
import { beforeEach, describe, expect, it } from "vitest";

import type { OrderBody, Row } from "../data/wire.ts";
import { instantOf } from "../lib/venueTime.ts";
import { DemoAdminium } from "./adminium.ts";

const ZONE = "America/Los_Angeles";
const at = (time: string) => new Date(instantOf("2026-07-28", time, ZONE)).toISOString();

let demo: DemoAdminium;
beforeEach(() => {
  demo = new DemoAdminium();
});

const order = (number: string) => demo.world.all("orders").find((o) => o["number"] === number)!;
const texts = (id: number): Row[] => demo.world.where("messages", (m) => m["order_id"] === id && m["kind"] === "order-ready-text");

/** A new diner's order, with or without the box ticked. */
async function placed(values: Record<string, unknown>, key: string): Promise<number> {
  const lemonade = demo.world.all("menu_items").find((d) => d["name"] === "Lemonade")!;
  const body: OrderBody = {
    values: { name: "Noor", email: `${key}@mail.example`, language: "en-US", pickup_at: at("12:00"), ...values },
    children: { order_items: [{ values: { menu_item_id: lemonade.id, qty: 1 } }] },
  };
  const reply = await demo.diner.place(body, `${key}-0123456789abcdef0123`);
  for (const [from, to] of [["placed", "confirmed"], ["confirmed", "preparing"]] as const) await demo.kitchen.move(reply.data.id, from, to);
  return reply.data.id;
}

describe("the ready text in the demo", () => {
  it("is queued when the order is marked ready, held for the Undo, and sent to the diner's own mobile once the wait is over", async () => {
    const id = await placed({ phone: "(555) 019-4471", texts_ok: true }, "noor.ready");
    await demo.kitchen.move(id, "preparing", "ready");
    const [held] = texts(id);
    expect([held?.["status"], held?.["to_address"], Date.parse(String(held?.["due"])) - demo.now]).toEqual(["queued", "(555) 019-4471", 20_000]);
    demo.engine.settleText(held!.id);
    expect(texts(id).map((m) => m["status"])).toEqual(["sent"]);
  });

  it("is dropped by an Undo, so nothing is sent; ready again, it is queued and sent afresh", async () => {
    const id = await placed({ phone: "(555) 019-4471", texts_ok: true }, "noor.undo");
    await demo.kitchen.move(id, "preparing", "ready");
    await demo.kitchen.move(id, "ready", "preparing");
    expect(texts(id).map((m) => [m["status"], m["skip_reason"]])).toEqual([["skipped", "no-longer-needed"]]);
    demo.engine.settleText(texts(id)[0]!.id);
    expect(texts(id).map((m) => m["status"])).toEqual(["skipped"]);
    await demo.kitchen.move(id, "preparing", "ready");
    demo.engine.settleText(texts(id)[1]!.id);
    expect(texts(id).map((m) => m["status"])).toEqual(["skipped", "sent"]);
  });

  it("is never queued for a diner who left the box empty, nor while the kitchen offers no texts", async () => {
    const none = await placed({ phone: "(555) 019-4471" }, "noor.none");
    await demo.kitchen.move(none, "preparing", "ready");
    expect(texts(none)).toEqual([]);
    demo.world.update("settings", demo.world.settings().id, { ready_text_on: false });
    const off = await placed({ phone: "(555) 019-4471", texts_ok: true }, "noor.off");
    await demo.kitchen.move(off, "preparing", "ready");
    expect(texts(off)).toEqual([]);
  });

  it("goes to the number on the diner's account, and says so when there is none", async () => {
    // Kwame is on file with his own mobile: a number typed on a later order does not move it.
    const kwame = await placed({ email: "kwame.b@mail.example", phone: "(555) 010-9999", texts_ok: true }, "kwame.later");
    await demo.kitchen.move(kwame, "preparing", "ready");
    expect(texts(kwame).map((m) => m["to_address"])).toEqual(["(555) 019-2205"]);
    // A diner on file from an order with no mobile: nothing to text.
    demo.world.insert("customers", { email: "nophone@mail.example", name: "Nils", phone: null, language: "en-US", opt_in: false, forgotten_at: null, created_at: at("09:00") });
    const nils = await placed({ email: "nophone@mail.example", phone: "(555) 010-1234", texts_ok: true }, "nophone");
    await demo.kitchen.move(nils, "preparing", "ready");
    expect(texts(nils).map((m) => [m["status"], m["error"]])).toEqual([["skipped", "No mobile number on file"]]);
  });

  it("plays the sample's kitchen too, and the board reads whether it went, never to whom", async () => {
    const marcus = order("2114");
    await demo.kitchen.move(marcus.id, "preparing", "ready");
    const read = await demo.kitchen.order(marcus.id);
    expect(read.texts?.map((m) => [m["status"], "to_address" in m, "customer_id" in m])).toEqual([["queued", false, false]]);
    // Priya's went before the demo's moment.
    expect((await demo.kitchen.order(order("2113").id)).texts?.map((m) => m["status"])).toEqual(["sent"]);
  });
});
