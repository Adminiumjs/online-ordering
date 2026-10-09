/**
 * A code or a gift card typed at checkout and never applied is asked about
 * before the order is placed: applied, the diner is shown the new total and
 * presses again; refused, the field says why. Never an order at full price
 * past a typed code. Over the demo's Adminium.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { setSources } from "../data/sources.ts";
import { DemoAdminium } from "../demo/adminium.ts";
import { addSheetToCart, freshQuote, loadDiner, openSheet, placeOrder, runQuote, setField, setOfferDraft, useDiner } from "./diner.ts";

let demo: DemoAdminium;
const orders = () => demo.world.all("orders").length;

beforeEach(async () => {
  demo = new DemoAdminium();
  setSources({ diner: demo.diner, kitchen: demo.kitchen, clock: { now: () => demo.now, subscribe: () => () => undefined }, zone: "America/Los_Angeles", currency: "USD" });
  useDiner.setState(useDiner.getInitialState());
  await loadDiner();
  // Enough for LUNCH5's minimum: four pizzas.
  const pizza = demo.world.all("menu_items").find((d) => d["name"] === "Margherita")!;
  for (let i = 0; i < 4; i += 1) {
    openSheet(pizza.id);
    addSheetToCart();
  }
  setField("name", "Kwame");
  setField("email", "kwame.b@mail.example");
  await runQuote();
});

describe("a code typed and not applied", () => {
  it("is applied before anything is placed, and the diner is shown the new total first", async () => {
    const before = orders();
    const full = Number(freshQuote()!.data["total"]);
    setOfferDraft("code", "lunch5");
    expect(await placeOrder("en-US")).toBeNull();
    expect(orders()).toBe(before);
    const s = useDiner.getState();
    expect([s.code, s.codeDraft, s.priceMoved]).toEqual(["LUNCH5", "", true]);
    expect(Number(freshQuote()!.data["total"])).toBeLessThan(full);
    // Pressed again, with the total they now see: the order goes, with the code.
    const placed = await placeOrder("en-US");
    expect(placed).not.toBeNull();
    expect(orders()).toBe(before + 1);
    expect(demo.world.where("order_codes", (c) => c["order_id"] === placed!.id).map((c) => c["typed"])).toEqual(["LUNCH5"]);
  });

  it("stops the order when the code is refused, and says why under its field", async () => {
    const before = orders();
    setOfferDraft("code", "NOSUCHCODE");
    expect(await placeOrder("en-US")).toBeNull();
    expect(orders()).toBe(before);
    expect(useDiner.getState().codeError).toEqual({ kind: "invalid" });
    expect(useDiner.getState().code).toBeNull();
  });

  it("does the same for a gift card typed and not applied", async () => {
    const before = orders();
    setOfferDraft("card", "GC-7K2M-W3HN-Q4XP");
    expect(await placeOrder("en-US")).toBeNull();
    expect(orders()).toBe(before);
    expect([useDiner.getState().card, useDiner.getState().cardDraft]).toEqual(["GC-7K2M-W3HN-Q4XP", ""]);
    expect(freshQuote()!.payment).not.toBeNull();
  });
});
