/**
 * The tick at checkout, "Email me news and offers": off until the diner
 * ticks it, sent with the order as it stands when the order goes, and off
 * again for the next order. Over the demo's Adminium, which keeps the yes
 * for the diner the address finds or makes, as Adminium does (without its
 * consent log).
 */
import { beforeEach, describe, expect, it } from "vitest";

import { setSources } from "../data/sources.ts";
import type { OrderBody } from "../data/wire.ts";
import { DemoAdminium } from "../demo/adminium.ts";
import { addSheetToCart, choose, loadDiner, openSheet, placeOrder, runQuote, setField, setOptIn, useDiner } from "./diner.ts";

let demo: DemoAdminium;
/** The time the page chose on its first visit: chosen again for a next order (a placed order leaves none chosen). */
let firstPick: { day: string; time: string };
const customerOf = (email: string) => demo.world.all("customers").find((c) => c["email"] === email);

/** One dish in the cart and the diner's details typed, the figures asked for. */
async function cartFor(email: string): Promise<void> {
  const lemonade = demo.world.all("menu_items").find((d) => d["name"] === "Lemonade")!;
  openSheet(lemonade.id);
  addSheetToCart();
  if (useDiner.getState().pick === null) choose(firstPick.day, firstPick.time);
  setField("name", "Noor");
  setField("email", email);
  await runQuote();
}

/** Places the order, and answers what the page sent. */
async function placeAndRead(language = "en-US"): Promise<Record<string, unknown>> {
  let sent: OrderBody | null = null;
  demo.diner.beforePlace = (body) => (sent = body);
  expect(await placeOrder(language)).not.toBeNull();
  return (sent as OrderBody | null)!.values;
}

beforeEach(async () => {
  demo = new DemoAdminium();
  setSources({ diner: demo.diner, kitchen: demo.kitchen, clock: { now: () => demo.now, subscribe: () => () => undefined }, zone: "America/Los_Angeles", currency: "USD" });
  useDiner.setState(useDiner.getInitialState());
  await loadDiner();
  firstPick = useDiner.getState().pick!;
});

describe("the tick for the kitchen's news", () => {
  it("starts unticked, and an order placed so sends a no that gives the diner nothing", async () => {
    expect(useDiner.getState().form.optIn).toBe(false);
    await cartFor("noor.plain@mail.example");
    const values = await placeAndRead();
    expect(values["opt_in"]).toBe(false);
    expect([customerOf("noor.plain@mail.example")?.["opt_in"], customerOf("noor.plain@mail.example")?.["language"]]).toEqual([false, "en-US"]);
  });

  it("sends a yes only when ticked, kept for the diner in the order's language, and is off again for the next order", async () => {
    await cartFor("noor.yes@mail.example");
    setOptIn(true);
    expect(useDiner.getState().form.optIn).toBe(true);
    const values = await placeAndRead("fr-FR");
    expect([values["opt_in"], values["language"]]).toEqual([true, "fr-FR"]);
    const order = demo.world.all("orders").find((o) => o["email"] === "noor.yes@mail.example")!;
    expect(order["opt_in"]).toBe(true);
    expect([customerOf("noor.yes@mail.example")?.["opt_in"], customerOf("noor.yes@mail.example")?.["language"]]).toEqual([true, "fr-FR"]);
    // The next order asks again: the box is off, and leaving it so takes back nothing.
    expect(useDiner.getState().form.optIn).toBe(false);
    await cartFor("noor.yes@mail.example");
    expect((await placeAndRead())["opt_in"]).toBe(false);
    expect(customerOf("noor.yes@mail.example")?.["opt_in"]).toBe(true);
  });

  it("ticked and then taken off again before the order goes, sends a no", async () => {
    await cartFor("noor.undo@mail.example");
    setOptIn(true);
    setOptIn(false);
    expect((await placeAndRead())["opt_in"]).toBe(false);
    expect(customerOf("noor.undo@mail.example")?.["opt_in"]).toBe(false);
  });
});
