/**
 * Inventory's words folded into a day's portions: the page shows the tighter
 * of the kitchen's own count and the shelf's, the one way it always has.
 */
import { describe, expect, it } from "vitest";

import { withStock } from "./diner.ts";

describe("a day's portions with Inventory's words", () => {
  it("leave a dish alone while its ingredients are in and nothing is told of how many", () => {
    expect(withStock([{ id: "1", state: "on", left: 3 }], [{ id: "1", state: "in" }, { id: "2", state: "in" }])).toEqual([{ id: "1", state: "on", left: 3 }]);
  });
  it("sell a dish out when what it is made of is out, whatever its portions say", () => {
    expect(withStock([{ id: "1", state: "on", left: 3 }], [{ id: "1", state: "out" }])).toEqual([{ id: "1", state: "soldout", left: 3 }]);
    // A dish the kitchen set no portions for is known only by its ingredients.
    expect(withStock([], [{ id: "7", state: "out" }])).toEqual([{ id: "7", state: "soldout" }]);
  });
  it("tell the fewer of the two counts when both are told", () => {
    expect(withStock([{ id: "1", state: "on", left: 4 }], [{ id: "1", state: "low", left: 2 }])[0]).toEqual({ id: "1", state: "on", left: 2 });
    expect(withStock([{ id: "1", state: "on", left: 1 }], [{ id: "1", state: "low", left: 2 }])[0]).toEqual({ id: "1", state: "on", left: 1 });
    expect(withStock([], [{ id: "9", state: "low", left: 2 }])).toEqual([{ id: "9", state: "on", left: 2 }]);
  });
  it("never bring back a dish the kitchen itself sold out, and never change what was read", () => {
    const read = [{ id: "1", state: "soldout" as const }];
    expect(withStock(read, [{ id: "1", state: "low", left: 5 }])).toEqual([{ id: "1", state: "soldout" }]);
    expect(read).toEqual([{ id: "1", state: "soldout" }]);
  });
});
