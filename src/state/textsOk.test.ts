/**
 * The box at checkout, "Text me when my order is ready": shown once a mobile
 * is typed, off until the diner ticks it, never needed to order, apart from
 * the newsletter's tick, off again for a number no text can go to, and off for
 * the next order. Over the demo's Adminium, which fills a new diner's mobile
 * from their first order as Adminium does.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { setSources } from "../data/sources.ts";
import type { OrderBody } from "../data/wire.ts";
import { DemoAdminium } from "../demo/adminium.ts";
import { addSheetToCart, choose, loadDiner, openSheet, placeOrder, runQuote, setField, setOptIn, setTextsOk, useDiner } from "./diner.ts";

let demo: DemoAdminium;
let firstPick: { day: string; time: string };

async function cartFor(email: string, phone = "(555) 019-4471"): Promise<void> {
  const lemonade = demo.world.all("menu_items").find((d) => d["name"] === "Lemonade")!;
  openSheet(lemonade.id);
  addSheetToCart();
  if (useDiner.getState().pick === null) choose(firstPick.day, firstPick.time);
  setField("name", "Noor");
  setField("email", email);
  setField("phone", phone);
  await runQuote();
}

async function placeAndRead(): Promise<Record<string, unknown>> {
  let sent: OrderBody | null = null;
  demo.diner.beforePlace = (body) => (sent = body);
  expect(await placeOrder("en-US")).not.toBeNull();
  return (sent as OrderBody | null)!.values;
}

const form = () => useDiner.getState().form;

beforeEach(async () => {
  demo = new DemoAdminium();
  setSources({ diner: demo.diner, kitchen: demo.kitchen, clock: { now: () => demo.now, subscribe: () => () => undefined }, zone: "America/Los_Angeles", currency: "USD" });
  useDiner.setState(useDiner.getInitialState());
  await loadDiner();
  firstPick = useDiner.getState().pick!;
});

describe("the box for the ready text", () => {
  it("starts unticked, cannot be ticked with no number, and an order placed without it goes as any other", async () => {
    expect(form().textsOk).toBe(false);
    setTextsOk(true);
    expect(form().textsOk).toBe(false);
    await cartFor("noor.none@mail.example");
    const values = await placeAndRead();
    expect(values["texts_ok"]).toBe(false);
    expect(demo.world.all("orders").find((o) => o["email"] === "noor.none@mail.example")?.["texts_ok"]).toBe(false);
  });

  it("sends a yes for the number typed when ticked, and is off again for the next order", async () => {
    await cartFor("noor.yes@mail.example");
    setTextsOk(true);
    expect(form().textsOk).toBe(true);
    const values = await placeAndRead();
    expect([values["texts_ok"], values["phone"]]).toEqual([true, "(555) 019-4471"]);
    expect(demo.world.all("orders").find((o) => o["email"] === "noor.yes@mail.example")?.["texts_ok"]).toBe(true);
    // A diner met for the first time is kept with the mobile of this order: where the text goes.
    expect(demo.world.all("customers").find((c) => c["email"] === "noor.yes@mail.example")?.["phone"]).toBe("(555) 019-4471");
    expect(form().textsOk).toBe(false);
  });

  it("goes off with its number: emptied, or a number in mainland China, where it cannot be ticked", async () => {
    await cartFor("noor.change@mail.example");
    setTextsOk(true);
    setField("phone", "");
    expect(form().textsOk).toBe(false);
    setField("phone", "+86 138 0013 8000");
    setTextsOk(true);
    expect(form().textsOk).toBe(false);
    // The number still goes with the order, for a call.
    const values = await placeAndRead();
    expect([values["texts_ok"], values["phone"]]).toEqual([false, "+86 138 0013 8000"]);
  });

  it("is never ticked by the newsletter's tick, nor ticks it", async () => {
    await cartFor("noor.news@mail.example");
    setOptIn(true);
    expect(form().textsOk).toBe(false);
    setOptIn(false);
    setTextsOk(true);
    expect(form().optIn).toBe(false);
    const values = await placeAndRead();
    expect([values["opt_in"], values["texts_ok"]]).toEqual([false, true]);
  });

  it("is not offered while Adminium has no texts set up", async () => {
    demo.diner.textsOn = false;
    useDiner.setState(useDiner.getInitialState());
    await loadDiner();
    await new Promise((r) => setTimeout(r, 0));
    await cartFor("noor.notset@mail.example");
    setTextsOk(true);
    expect(form().textsOk).toBe(false);
    expect((await placeAndRead())["texts_ok"]).toBe(false);
  });

  it("is not offered while the kitchen has switched its ready text off", async () => {
    demo.world.update("settings", demo.world.settings().id, { ready_text_on: false });
    useDiner.setState(useDiner.getInitialState());
    await loadDiner();
    await cartFor("noor.off@mail.example");
    setTextsOk(true);
    expect(form().textsOk).toBe(false);
    expect((await placeAndRead())["texts_ok"]).toBe(false);
  });
});
