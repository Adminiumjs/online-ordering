/**
 * THE DEMO'S ADMINIUM DECIDES WHAT ADMINIUM DECIDES.
 *
 * Each check is a rule of the manifest, asked through the doors the screens
 * use, at the demo's moment — 11:40 on Tuesday 28 July 2026 in Riverside —
 * over the sample. The same checks, run against a real server with the
 * sample, are the contract suite's.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { ApiError, type OrderBody, type Row } from "../data/wire.ts";
import { instantOf } from "../lib/venueTime.ts";
import { DemoAdminium } from "./adminium.ts";
import { DEMO_SIGN_IN } from "./diner.ts";

const ZONE = "America/Los_Angeles";
const TODAY = "2026-07-28";
const TOMORROW = "2026-07-29";
const at = (time: string, day = TODAY) => new Date(instantOf(day, time, ZONE)).toISOString();

let demo: DemoAdminium;
beforeEach(() => {
  demo = new DemoAdminium();
});

const dish = (name: string) => demo.world.all("menu_items").find((d) => d["name"] === name)!;
const option = (dishName: string, name: string) => {
  const groups = demo.world.where("modifier_groups", (g) => g["item_id"] === dish(dishName).id).map((g) => g.id);
  return demo.world.all("modifiers").find((m) => m["name"] === name && groups.includes(Number(m["group_id"])))!;
};
const order = (number: string) => demo.world.all("orders").find((o) => o["number"] === number)!;

/** Kwame's cart: the grain bowl with farro, grilled chicken and avocado, and a cookie. */
function kwame(overrides: Partial<Record<string, unknown>> = {}, lines?: OrderBody["children"]["order_items"]): OrderBody {
  return {
    values: { name: "Kwame", email: "kwame.b@mail.example", phone: "(555) 019-2205", language: "en-US", pickup_at: at("12:00"), ...overrides },
    children: {
      order_items: lines ?? [
        {
          values: { menu_item_id: dish("Signature grain bowl").id, qty: 1 },
          children: {
            order_item_modifiers: [
              { values: { modifier_id: option("Signature grain bowl", "Farro").id } },
              { values: { modifier_id: option("Signature grain bowl", "Grilled chicken").id } },
              { values: { modifier_id: option("Signature grain bowl", "Avocado").id } },
            ],
          },
        },
        { values: { menu_item_id: dish("Brown butter cookie").id, qty: 1 } },
      ],
    },
  };
}
const line = (name: string, qty: number) => ({ values: { menu_item_id: dish(name).id, qty } });

async function refusal(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("the pickup slots a diner sees at 11:40", () => {
  it("offers 12:00 PM first: earlier times are too soon, 1:00 PM is paused, the last is 8:45 PM", async () => {
    const slots = await demo.diner.slots(TODAY);
    expect(slots).toHaveLength(40);
    expect(slots.slice(0, 5).map((s) => [s.time, s.state])).toEqual([
      ["11:00", "full"],
      ["11:15", "full"],
      ["11:30", "full"],
      ["11:45", "full"],
      ["12:00", "free"],
    ]);
    expect(slots.find((s) => s.time === "13:00")!.state).toBe("paused");
    expect(slots.at(-1)).toEqual({ time: "20:45", state: "free" });
    expect(slots.filter((s) => s.state === "free")).toHaveLength(35);
  });

  it("offers tomorrow from opening, and nothing on a closed day", async () => {
    expect((await demo.diner.slots(TOMORROW))[0]).toEqual({ time: "11:00", state: "free" });
    expect(await demo.diner.slots("2026-08-11")).toEqual([]);
  });

  it("says each dish's portions: Wild mushroom 2 left, Diavola sold out, the rest on", async () => {
    const states = await demo.diner.dishes(TODAY);
    const of = (name: string) => states.find((s) => s.id === String(dish(name).id));
    expect(of("Wild mushroom")).toEqual({ id: String(dish("Wild mushroom").id), state: "on", left: 2 });
    expect(of("Diavola")!.state).toBe("soldout");
    expect(of("Margherita")).toEqual({ id: String(dish("Margherita").id), state: "on" });
    // Tomorrow the portions set for today do not hold.
    expect((await demo.diner.dishes(TOMORROW)).find((s) => s.id === String(dish("Diavola").id))!.state).toBe("on");
  });
});

describe("placing an order", () => {
  it("prices Kwame's order at $21.50 + $1.77 = $23.27 and numbers it #2118", async () => {
    const quote = await demo.diner.quote(kwame());
    expect([quote.data["subtotal"], quote.data["tax"], quote.data["total"]]).toEqual([21.5, 1.77, 23.27]);
    expect(quote.data["number"]).toBeUndefined();
    const placed = await demo.diner.place(kwame({}), "k".repeat(22));
    expect(placed.data["number"]).toBe("2118");
    expect(placed.data["total"]).toBe(23.27);
    expect(placed.link?.token).toMatch(/^[0-9A-Z]{16}$/);
    expect(placed.children!.order_items![0]!.data["line_total"]).toBe(18);
    // Kwame is on file already: the order is his.
    expect(order("2118")["customer_id"]).toBe(demo.world.all("customers").find((c) => c["email"] === "kwame.b@mail.example")!.id);
  });

  it("answers a retry with the order already made, without its link, whatever it sends now", async () => {
    await demo.diner.place(kwame(), "retry-key-0123456789ab");
    const again = await demo.diner.place(kwame({ pickup_at: at("12:30") }), "retry-key-0123456789ab");
    expect(again.replayed).toBe(true);
    expect(again.link).toBeUndefined();
    expect(again.data["number"]).toBe("2118");
    expect(demo.world.where("orders", (o) => o["number"] === "2119")).toEqual([]);
  });

  it("writes nothing when the total is not the one the diner was shown", async () => {
    const error = await refusal(demo.diner.place({ ...kwame(), expect: { total: "23.26" } }, "k".repeat(22)));
    expect([error.status, error.code, error.params["total"]]).toEqual([409, "PUBLIC_PRICE_CHANGED", "23.27"]);
  });

  it("refuses the third Wild mushroom today, naming the line", async () => {
    const error = await refusal(demo.diner.place(kwame({}, [line("Margherita", 1), line("Wild mushroom", 3)]), "k".repeat(22)));
    // The line, and its link to what ran out.
    expect([error.code, error.params]).toEqual(["PUBLIC_SOLD_OUT", { child: "order_items", index: 1, path: ["order_items", 1], column: "menu_item_id" }]);
    await expect(demo.diner.place(kwame({}, [line("Wild mushroom", 2)]), "m".repeat(22))).resolves.toBeDefined();
    expect((await demo.diner.dishes(TODAY)).find((s) => s.id === String(dish("Wild mushroom").id))!.state).toBe("soldout");
  });

  it("refuses Diavola today, and sells it for tomorrow", async () => {
    expect((await refusal(demo.diner.place(kwame({}, [line("Diavola", 1)]), "k".repeat(22)))).code).toBe("PUBLIC_SOLD_OUT");
    await expect(demo.diner.place(kwame({ pickup_at: at("12:30", TOMORROW) }, [line("Diavola", 1)]), "n".repeat(22))).resolves.toBeDefined();
  });

  it("refuses an option switched off since it went in the cart, naming the line and the option", async () => {
    await demo.kitchen.setOption(option("Signature grain bowl", "Grilled chicken").id, false);
    const error = await refusal(demo.diner.place(kwame(), "k".repeat(22)));
    expect([error.status, error.params["reason"], error.params["path"]]).toEqual([400, "not-offered", ["order_items", 0, "order_item_modifiers", 1]]);
  });

  it("refuses a dish on the till but not sold online", async () => {
    await demo.kitchen.setDish(dish("Margherita").id, { online: false });
    expect((await demo.diner.menu()).items.some((i) => i["name"] === "Margherita")).toBe(false);
    expect((await refusal(demo.diner.place(kwame({}, [line("Margherita", 1)]), "k".repeat(22)))).params["reason"]).toBe("not-offered");
  });

  it("refuses a pizza with no size, and a sixth topping", async () => {
    const pizza = (toppings: string[]) => [
      {
        values: { menu_item_id: dish("Build your own pizza").id, qty: 1 },
        children: { order_item_modifiers: toppings.map((t) => ({ values: { modifier_id: option("Build your own pizza", t).id } })) },
      },
    ];
    expect((await refusal(demo.diner.quote(kwame({}, pizza(["Pan, thick and crisp"]))))).params["reason"]).toBe("too-few");
    const six = ['Large 18"', "Pan, thick and crisp", "Cup pepperoni", "Spicy salami", "Wild mushroom", "Roasted squash", "Broccolini", "Red onion"];
    expect((await refusal(demo.diner.quote(kwame({}, pizza(six))))).params["reason"]).toBe("too-many");
  });

  it("refuses more than 12 items online", async () => {
    const error = await refusal(demo.diner.quote(kwame({}, [line("Margherita", 13)])));
    expect(error.params).toEqual({ child: "order_items", column: "qty", reason: "too-many" });
  });

  it("refuses a time too soon, a paused one, a full one, and one on a closed day", async () => {
    expect((await refusal(demo.diner.place(kwame({ pickup_at: at("11:45") }), "a".repeat(22)))).params).toEqual({ column: "pickup_at", reason: "out-of-range" });
    expect((await refusal(demo.diner.place(kwame({ pickup_at: at("13:00") }), "b".repeat(22)))).params).toEqual({ column: "pickup_at", reason: "paused" });
    // 12:15 holds two; the kitchen takes four by phone (a stranger's hour allows ten tries on this page, the two above included).
    for (const name of ["A.", "B.", "C.", "D."]) await demo.kitchen.phoneOrder({ values: { name, phone: "(555) 010-0000", pickup_at: at("12:15") }, children: { order_items: [line("Lemonade", 1)] } }, `phone-${name}-0123456789abcdef`);
    const full = await refusal(demo.diner.place(kwame({ pickup_at: at("12:15") }), "c".repeat(22)));
    expect([full.status, full.code, full.params]).toEqual([409, "PUBLIC_SLOT_FULL", { column: "pickup_at" }]);
    expect((await demo.diner.slots(TODAY)).find((s) => s.time === "12:15")!.state).toBe("full");
  });

  it("closes checkout while online orders are off — and the kitchen's phone orders still go in", async () => {
    await demo.kitchen.setOnline(false);
    expect((await refusal(demo.diner.quote(kwame()))).code).toBe("PUBLIC_SWITCHED_OFF");
    expect((await refusal(demo.diner.place(kwame(), "k".repeat(22)))).status).toBe(403);
    const phone = await demo.kitchen.phoneOrder({ values: { name: "Grace T.", phone: "(555) 014-2290", pickup_at: at("13:00") }, children: { order_items: [line("Margherita", 2)] } }, "grace-0123456789abcdef0");
    expect([phone.data["channel"], phone.data["status"], phone.data["email"] ?? null]).toEqual(["phone", "placed", null]);
  });

  it("refuses an eleventh order from one address in a day: the limit on an order nobody signed in for", async () => {
    for (let i = 0; i < 10; i += 1) await demo.diner.place(kwame({ pickup_at: at(["12:30", "12:45", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30", "14:45", "15:00"][i]!) }, [line("Lemonade", 1)]), `cap-${String(i)}-0123456789abcdef`);
    const error = await refusal(demo.diner.place(kwame({ pickup_at: at("15:15") }, [line("Lemonade", 1)]), "cap-last-0123456789abcdef"));
    expect([error.status, error.code]).toEqual([409, "PUBLIC_LIMIT_REACHED"]);
  });

  it("counts a refused try against the limit, and hands back the charge of a value the diner typed wrong", async () => {
    // Nine tries at a paused time: each keeps its charge.
    for (let i = 0; i < 9; i += 1) await refusal(demo.diner.place(kwame({ pickup_at: at("13:00") }), `try-${String(i)}-0123456789abcdef`));
    // A malformed phone is the diner's own value: handed back.
    expect((await refusal(demo.diner.place(kwame({ phone: "call me" }), "bad-phone-0123456789abcdef"))).params).toEqual({ column: "phone", reason: "format" });
    await demo.diner.place(kwame({ pickup_at: at("12:30") }), "tenth-0123456789abcdef");
    expect((await refusal(demo.diner.place(kwame({ pickup_at: at("12:45") }), "eleventh-0123456789abcdef"))).code).toBe("PUBLIC_LIMIT_REACHED");
  });

  it("refuses a time on a day the kitchen is closed", async () => {
    await demo.kitchen.addClosure({ from_date: TOMORROW, to_date: TOMORROW, reason: "Staff day" });
    expect((await refusal(demo.diner.place(kwame({ pickup_at: at("12:30", TOMORROW) }), "k".repeat(22)))).params).toEqual({ column: "pickup_at", reason: "closed" });
    expect(await demo.diner.slots(TOMORROW)).toEqual([]);
  });

  it("keeps what a stranger types plain text", async () => {
    // Named, with no reason: the form says why.
    expect((await refusal(demo.diner.place(kwame({ name: "see https://x.example" }), "k".repeat(22)))).params).toEqual({ column: "name" });
  });
});

describe("the order's own link", () => {
  async function placed(): Promise<{ id: number; token: string }> {
    const reply = await demo.diner.place(kwame(), "k".repeat(22));
    return { id: reply.data.id, token: reply.link!.token };
  }

  it("opens the order, and lets the diner cancel it while the kitchen has not taken it", async () => {
    const { id, token } = await placed();
    await demo.diner.openLink(token);
    expect((await demo.diner.linkedOrder()).order["number"]).toBe("2118");
    const cancelled = await demo.diner.cancelLinked(id);
    expect([cancelled["status"], cancelled["cancel_code"]]).toEqual(["cancelled", "self"]);
    expect(demo.world.get("orders", id)!["cancelled_by"]).toBe("customer");
    expect(demo.world.where("messages", (m) => m["order_id"] === id).map((m) => m["kind"])).toEqual(["order-confirmation", "order-cancelled-by-you"]);
    // Cancelled already: the window rides in the change, and nothing matches.
    const twice = await refusal(demo.diner.cancelLinked(id));
    expect([twice.status, twice.code]).toEqual([404, "PUBLIC_REF_NOT_FOUND"]);
  });

  it("answers a cancel after the kitchen confirmed as no such order", async () => {
    const { id, token } = await placed();
    await demo.diner.openLink(token);
    await demo.kitchen.move(id, "placed", "confirmed");
    const error = await refusal(demo.diner.cancelLinked(id));
    expect([error.status, error.code]).toEqual([404, "PUBLIC_REF_NOT_FOUND"]);
  });

  it("stops working 30 days after pickup", async () => {
    const { token } = await placed();
    demo.advance(31 * 24 * 60);
    expect((await refusal(demo.diner.openLink(token))).code).toBe("LINK_EXPIRED");
  });

  it("never shows who in the kitchen moved it", async () => {
    const { id, token } = await placed();
    await demo.kitchen.move(id, "placed", "confirmed");
    await demo.diner.openLink(token);
    const { order: seen } = await demo.diner.linkedOrder();
    expect(Object.keys(seen)).not.toContain("confirmed_by");
    expect(seen["confirmed_at"]).not.toBeNull();
  });
});

describe("the kitchen's moves", () => {
  it("moves one step at a time, stamped with when and by whom", async () => {
    const id = order("2116").id;
    const moved = await demo.kitchen.move(id, "placed", "confirmed");
    expect([moved["status"], moved["confirmed_by"], moved["confirmed_at"]]).toEqual(["confirmed", "Sam", at("11:40")]);
  });

  it("refuses a second screen's repeat, naming when and by whom: \"already ready — 11:34, Sam\"", async () => {
    const error = await refusal(demo.kitchen.move(order("2113").id, "ready", "ready"));
    expect([error.status, error.code, error.params]).toEqual([409, "STATE_UNCHANGED", { column: "status", state: "ready", at: at("11:34"), by: "Sam" }]);
  });

  it("refuses a stale tablet's Start on an order another screen marked ready", async () => {
    const id = order("2114").id;
    await demo.kitchen.move(id, "preparing", "ready");
    const error = await refusal(demo.kitchen.move(id, "confirmed", "preparing"));
    // The state it is in now, and the one the stale screen named.
    expect([error.code, error.params]).toEqual(["STATE_MOVE_REFUSED", { column: "status", from: "ready", to: "preparing", named: "confirmed" }]);
  });

  it("undoes Ready within the minute: the ready stamps cleared, the cooking kept, the email dropped", async () => {
    const id = order("2114").id;
    await demo.kitchen.move(id, "preparing", "ready");
    const back = await demo.kitchen.move(id, "ready", "preparing");
    expect([back["status"], back["ready_at"], back["ready_by"], back["preparing_at"]]).toEqual(["preparing", null, null, at("11:28")]);
    demo.advance(1);
    expect(demo.world.where("messages", (m) => m["order_id"] === id && m["kind"] === "order-ready").map((m) => m["status"])).toEqual(["skipped"]);
    // Ready again: the email goes this time.
    await demo.kitchen.move(id, "preparing", "ready");
    demo.advance(1);
    expect(demo.world.where("messages", (m) => m["order_id"] === id && m["kind"] === "order-ready").map((m) => m["status"])).toEqual(["skipped", "sent"]);
  });

  it("refuses an undo a minute later", async () => {
    const id = order("2114").id;
    await demo.kitchen.move(id, "preparing", "ready");
    demo.advance(2);
    expect((await refusal(demo.kitchen.move(id, "ready", "preparing"))).code).toBe("STATE_MOVE_REFUSED");
  });

  it("cancels only with a reason, and \"ran out\" emails the diner that reason", async () => {
    const id = order("2116").id;
    expect((await refusal(demo.kitchen.move(id, "placed", "cancelled"))).code).toBe("STATE_MOVE_REFUSED");
    const cancelled = await demo.kitchen.cancel(id, "placed", "ran_out", "Wild mushroom", null);
    expect([cancelled["cancel_code"], cancelled["cancel_dish"], cancelled["cancelled_by"]]).toEqual(["ran_out", "Wild mushroom", "Sam"]);
    expect(demo.world.where("messages", (m) => m["order_id"] === id).map((m) => m["kind"])).toContain("order-cancelled-ran-out");
  });

  it("hands over only with how it was paid, then locks the order and its lines", async () => {
    const id = order("2113").id;
    const handed = await demo.kitchen.handOff(id, "card");
    expect([handed["status"], handed["paid_method"], handed["picked_up_by"]]).toEqual(["picked_up", "card", "Sam"]);
    const locked = await refusal(demo.kitchen.cancel(id, "picked_up", "other", null, "x"));
    expect(locked.code).toBe("STATE_MOVE_REFUSED");
    demo.advance(1);
    expect(demo.world.where("messages", (m) => m["order_id"] === id && m["kind"] === "order-receipt").map((m) => m["status"])).toEqual(["sent"]);
  });

  it("lets a manager take a hand-over back: ready and unpaid again, the held receipt dropped", async () => {
    const id = order("2113").id;
    await demo.kitchen.handOff(id, "cash");
    const back = await demo.kitchen.move(id, "picked_up", "ready");
    expect([back["status"], back["paid_method"], back["picked_up_at"], back["picked_up_by"], back["ready_at"]]).toEqual(["ready", null, null, null, at("11:34")]);
    demo.advance(1);
    expect(demo.world.where("messages", (m) => m["order_id"] === id && m["kind"] === "order-receipt").map((m) => [m["status"], m["skip_reason"]])).toEqual([["skipped", "no-longer-needed"]]);
  });

  it("takes a hand-over back only for a manager", async () => {
    const id = order("2113").id;
    await demo.kitchen.handOff(id, "card");
    demo.kitchen.person.roles.splice(demo.kitchen.person.roles.indexOf("manager"), 1);
    const error = await refusal(demo.kitchen.move(id, "picked_up", "ready"));
    expect([error.code, error.params["roles"]]).toEqual(["STATE_MOVE_REFUSED", ["ordering-manager"]]);
    demo.kitchen.person.roles.push("manager");
  });

  it("queues no receipt at all without Invoices & Receipts", async () => {
    demo.kitchen.addOns.invoices = false;
    const id = order("2113").id;
    await demo.kitchen.handOff(id, "card");
    demo.advance(1);
    expect(demo.world.where("messages", (m) => m["order_id"] === id && m["kind"] === "order-receipt")).toEqual([]);
  });

  it("frees a cancelled order's slot and portions", async () => {
    const before = (await demo.kitchen.slotCounts(TODAY)).find((s) => s.time === "12:15")!.taken;
    await demo.kitchen.cancel(order("2116").id, "placed", "too_busy", null, null);
    expect((await demo.kitchen.slotCounts(TODAY)).find((s) => s.time === "12:15")!.taken).toBe(before - 1);
    expect((await demo.kitchen.dishCounts(TODAY))[String(dish("Wild mushroom").id)]).toBe(0);
  });
});

describe("the clock", () => {
  it("marks a ready order not collected at closing, and cancels an unfinished one half an hour later", async () => {
    demo.advanceTo(instantOf(TODAY, "21:00", ZONE));
    expect(order("2113")["status"]).toBe("not_collected");
    expect(order("2116")["status"]).toBe("placed");
    demo.advanceTo(instantOf(TODAY, "21:30", ZONE));
    expect([order("2116")["status"], order("2116")["cancel_code"], order("2114")["status"]]).toEqual(["cancelled", "closed", "cancelled"]);
    expect(demo.world.where("messages", (m) => m["order_id"] === order("2116").id).map((m) => m["kind"])).toContain("order-cancelled-closed");
    // Tomorrow's pre-order is not today's to sweep.
    expect(order("2107")["status"]).toBe("placed");
  });
});

describe("stopping online orders for today", () => {
  it("pauses every remaining slot of today, and leaves tomorrow open", async () => {
    for (const slot of await demo.kitchen.slotCounts(TODAY)) if (Date.parse(slot.at) >= demo.now && slot.pause === null) await demo.kitchen.pause(slot.at);
    const today = await demo.diner.slots(TODAY);
    expect(today.filter((s) => s.state === "free")).toEqual([]);
    expect((await demo.diner.slots(TOMORROW)).some((s) => s.state === "free")).toBe(true);
    const pauses = demo.world.where("slot_pauses", (p) => p["active"] === true);
    expect(pauses.every((p) => p["paused_by"] === "Sam")).toBe(true);
  });
});

describe("signing in", () => {
  it("counts the wrong codes down, then signs in with the right one and lists Kwame's orders", async () => {
    expect(await demo.diner.requestSignIn("kwame.b@mail.example")).toEqual({ sentTo: "k…@mail.example" });
    const wrong = await refusal(demo.diner.verifyCode("kwame.b@mail.example", "284761"));
    expect([wrong.code, wrong.params]).toEqual(["PUBLIC_CODE_WRONG", { triesLeft: 4 }]);
    const opened = await demo.diner.verifyCode("kwame.b@mail.example", DEMO_SIGN_IN.code);
    expect(opened.firstName).toBe("Kwame");
    const numbers = (await demo.diner.myOrders()).map((o: { order: Row }) => o.order["number"]);
    expect(numbers).toEqual(["2109", "2009", "1951", "1872"]);
  });

  it("spends a code after five wrong tries, and locks the address's codes after ten in a day — its link still opens", async () => {
    await demo.diner.requestSignIn("kwame.b@mail.example");
    for (let i = 0; i < 5; i += 1) await refusal(demo.diner.verifyCode("kwame.b@mail.example", "000000"));
    const spent = await refusal(demo.diner.verifyCode("kwame.b@mail.example", DEMO_SIGN_IN.code));
    expect([spent.status, spent.code]).toEqual([410, "PUBLIC_CODE_EXPIRED"]);
    await demo.diner.requestSignIn("kwame.b@mail.example");
    for (let i = 0; i < 5; i += 1) await refusal(demo.diner.verifyCode("kwame.b@mail.example", "000000"));
    await demo.diner.requestSignIn("kwame.b@mail.example");
    const locked = await refusal(demo.diner.verifyCode("kwame.b@mail.example", DEMO_SIGN_IN.code));
    expect([locked.status, locked.code]).toEqual([403, "PUBLIC_CLAIM_LOCKED"]);
    await expect(demo.diner.verifyLink(DEMO_SIGN_IN.token)).resolves.toBeDefined();
  });

  it("asks a sign-in older than ten minutes to sign in again before deleting details", async () => {
    await demo.diner.requestSignIn("kwame.b@mail.example");
    await demo.diner.verifyLink(DEMO_SIGN_IN.token);
    demo.advance(11);
    expect((await refusal(demo.diner.forget())).code).toBe("PUBLIC_CODE_STEP_UP");
    await demo.diner.verifyLink(DEMO_SIGN_IN.token);
    await demo.diner.forget();
    expect(await demo.diner.signedIn()).toBeNull();
    // The orders keep their own copies.
    expect(order("2109")["name"]).toBe("Kwame B.");
  });

  it("stops the links a diner's orders were emailed with when they delete their details", async () => {
    await demo.diner.place(kwame(), "k".repeat(22));
    const placed = demo.world.all("orders").at(-1)!;
    const token = String(placed["link_token"]);
    expect((await demo.diner.openLink(token)).session).toBe(`link-${String(placed.id)}`);
    await demo.diner.requestSignIn("kwame.b@mail.example");
    await demo.diner.verifyLink(DEMO_SIGN_IN.token);
    await demo.diner.forget();
    expect((await refusal(demo.diner.openLink(token))).status).toBe(404);
  });
});

describe("a large order", () => {
  it("files the enquiry as LG-0099, once however often it is sent", async () => {
    const values = { heads: 30, wanted_on: "2026-08-01", notes: "Office party", name: "Maya Chen", phone: "(555) 010-4471", email: "maya@riverside-studio.example", language: "en-US" };
    const sent = await demo.diner.enquire(values, "e".repeat(22));
    expect(sent["ref"]).toBe("LG-0099");
    expect((await demo.diner.enquire(values, "e".repeat(22)))["ref"]).toBe("LG-0099");
    expect(demo.world.all("enquiries")).toHaveLength(3);
    expect((await refusal(demo.diner.enquire({ ...values, heads: 5 }, "f".repeat(22)))).params).toEqual({ column: "heads", reason: "too-small" });
  });
});
