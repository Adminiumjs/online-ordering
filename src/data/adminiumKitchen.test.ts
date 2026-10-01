/**
 * The kitchen's door over a fake data API: every call it makes, and every
 * answer read back as the screens read it — whichever engine spelled it.
 */
import { describe, expect, it } from "vitest";

import type { StaffConfig } from "../staffConnection.ts";
import { AdminiumKitchen, momentOf, type EventSourceLike } from "./adminiumKitchen.ts";
import { SessionPortError, type SessionTransport } from "./sessionSource.ts";
import { ApiError } from "./wire.ts";

const CONN = "c1";
const REL = { lines: "rel-lines", options: "rel-options" };

const config = (over: Partial<StaffConfig> = {}): StaffConfig => ({
  connectionId: CONN,
  appName: null,
  tables: { orders: "ordering_orders", order_items: "ordering_order_items", order_item_modifiers: "ordering_order_item_modifiers", slot_pauses: "ordering_slot_pauses", menu_items: "ordering_menu_items" },
  settings: {},
  timezone: "America/Los_Angeles",
  timezoneSource: "operator",
  serverTimezone: "Europe/Berlin",
  currency: "USD",
  now: "2026-07-28T18:40:00.000Z",
  user: { id: "u1", name: "Sam", email: "sam@juniper.example" },
  csrfToken: "t",
  publicKeys: {},
  access: { tables: { orders: ["read", "create", "update"], hours: ["read"] }, roles: [{ slug: "ordering-kitchen", name: "Kitchen" }] },
  addOns: {},
  sharedTables: {},
  ...over,
});

type Call = { method: string; path: string; body?: unknown };

/** A data API that answers from a table of routes, and keeps what it was asked. */
function fakeTransport(answers: (call: Call) => unknown): SessionTransport & { calls: Call[] } {
  const calls: Call[] = [];
  const reply = async (call: Call) => {
    calls.push(call);
    const answer = answers(call);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return {
    calls,
    port: {} as SessionTransport["port"],
    get: <T,>(path: string) => reply({ method: "GET", path }) as Promise<T>,
    mutate: <T,>(path: string, method: string, body?: unknown) => reply({ method, path, body }) as Promise<T>,
    connection: async () => CONN,
    tableId: async (name: string) => `public.${name}`,
    relation: async (child: string) => (child.endsWith("order_items") ? REL.lines : REL.options),
    refresh: async () => undefined,
  };
}

const where = (path: string) => JSON.parse(decodeURIComponent(new URL(path, "http://x").searchParams.get("where") ?? "null")) as unknown;

describe("a moment SQLite hands back without a zone", () => {
  it("is the server's wall time, read as the instant it is", () => {
    expect(momentOf("2026-07-28 20:40:00", "Europe/Berlin")).toBe("2026-07-28T18:40:00.000Z");
    expect(momentOf("2026-07-28 20:12:05.708", "Europe/Berlin")).toBe("2026-07-28T18:12:05.708Z");
    expect(momentOf("2026-01-15 09:00:00", "Europe/Berlin")).toBe("2026-01-15T08:00:00.000Z");
  });
  it("leaves an instant that says its zone as it came", () => {
    expect(momentOf("2026-07-28T18:40:00.000Z", "Europe/Berlin")).toBe("2026-07-28T18:40:00.000Z");
    expect(momentOf(null, "Europe/Berlin")).toBeNull();
  });
});

describe("the kitchen's reads", () => {
  it("reads an order's moments and yes/no as the screens expect, whatever the engine spelled", async () => {
    const t = fakeTransport((call) => {
      if (call.path.includes("ordering_orders?")) return { data: [{ id: 7, status: "ready", pickup_at: "2026-07-28 20:45:00", ready_at: "2026-07-28 20:34:05.708", link_stopped: 0 }] };
      if (call.path.includes("ordering_order_items?")) return { data: [{ id: 70, order_id: 7, position: 2 }, { id: 71, order_id: 7, position: 1 }] };
      return { data: [{ id: 700, order_item_id: 71, name: "Farro" }] };
    });
    const [order] = await new AdminiumKitchen(t, config()).orders("2026-07-28", "2026-07-28");
    expect(order!.order).toMatchObject({ pickup_at: "2026-07-28T18:45:00.000Z", ready_at: "2026-07-28T18:34:05.708Z", link_stopped: false });
    expect(order!.lines.map((l) => [l.id, l.options.length])).toEqual([[71, 1], [70, 0]]);
    // The day is the kitchen's, from its midnight to the next.
    expect(where(t.calls[0]!.path)).toEqual({ and: [{ column: "pickup_at", op: "gte", value: "2026-07-28T07:00:00.000Z" }, { column: "pickup_at", op: "lt", value: "2026-07-29T07:00:00.000Z" }] });
  });

  it("counts a day's slots from the limit, joins its pauses, and leaves out a closed day's grid", async () => {
    const t = fakeTransport((call) => {
      if (call.path.includes("capacity-counts")) return { data: { kind: "slot", rows: [{ time: "12:00", size: 6, taken: 2 }, { time: "13:00", size: 6, taken: 0, paused: true }] } };
      return { data: [{ id: 3, slot_at: "2026-07-28 22:00:00", active: 1, paused_by: "Sam" }] };
    });
    const counts = await new AdminiumKitchen(t, config()).slotCounts("2026-07-28");
    expect(counts).toEqual([
      { time: "12:00", at: "2026-07-28T19:00:00.000Z", taken: 2, size: 6, pause: null },
      { time: "13:00", at: "2026-07-28T20:00:00.000Z", taken: 0, size: 6, pause: { id: 3, by: "Sam", at: null } },
    ]);
    const closed = fakeTransport((call) => (call.path.includes("capacity-counts") ? { data: { rows: [{ time: "12:00", size: 6, taken: 0, closed: true }] } } : { data: [] }));
    expect(await new AdminiumKitchen(closed, config()).slotCounts("2026-12-25")).toEqual([]);
  });

  it("names the person's roles without the app's prefix, and anyone who may change the hours a manager", async () => {
    expect((await new AdminiumKitchen(fakeTransport(() => null), config()).me()).roles).toEqual(["kitchen"]);
    const owner = config({ access: { tables: { hours: ["read", "update"] }, roles: [] } });
    expect((await new AdminiumKitchen(fakeTransport(() => null), owner).me()).roles).toEqual(["manager"]);
    const gone = new AdminiumKitchen(fakeTransport(() => null), config(), { reload: async () => null });
    await expect(gone.me()).rejects.toMatchObject({ status: 401 });
  });

  it("hears the add-ons: receipts with Invoices & Receipts, the holidays Holiday Calendars hands over", async () => {
    const none = new AdminiumKitchen(fakeTransport(() => null), config());
    expect([await none.receipts(), await none.holidays()]).toEqual([false, null]);
    const both = new AdminiumKitchen(
      fakeTransport(() => null),
      config({ addOns: { invoices: { version: "1.0.6", settings: {} }, "holiday-calendars": { version: "1.0.6", settings: { days: [{ date: "2026-12-25", name: "Christmas Day", from: "US" }] } } } }),
    );
    expect([await both.receipts(), await both.holidays()]).toEqual([true, [{ date: "2026-12-25", name: "Christmas Day" }]]);
  });

  it("hears that the menu is the till's too, only when Adminium says so", async () => {
    expect(await new AdminiumKitchen(fakeTransport(() => null), config()).menuShared()).toBe(false);
    expect(await new AdminiumKitchen(fakeTransport(() => null), config({ sharedTables: { menu_items: ["pos"], menu_categories: ["pos"] } })).menuShared()).toBe(true);
    expect(await new AdminiumKitchen(fakeTransport(() => null), config({ sharedTables: { customers: ["clinic"] } })).menuShared()).toBe(false);
  });
});

describe("the kitchen's writes", () => {
  it("moves with the state it saw, and takes a hand-over back unpaid", async () => {
    const t = fakeTransport(() => ({ data: { id: 7, status: "ready" } }));
    const k = new AdminiumKitchen(t, config());
    await k.move(7, "preparing", "ready");
    await k.move(7, "picked_up", "ready");
    expect(t.calls.map((c) => c.body)).toEqual([
      { values: { status: "ready" }, from: "preparing" },
      // The move itself empties how it was paid.
      { values: { status: "ready" }, from: "picked_up" },
    ]);
  });

  it("switches an old pause back on rather than making a second one", async () => {
    const at = "2026-07-28T20:00:00.000Z";
    const t = fakeTransport((call) => (call.method === "GET" ? { data: [{ id: 3, slot_at: at, active: false }] } : { data: { id: 3, active: true } }));
    await new AdminiumKitchen(t, config()).pause(at);
    expect(t.calls.map((c) => [c.method, c.body ?? where(c.path)])).toEqual([
      ["GET", { column: "slot_at", op: "eq", value: at }],
      ["PATCH", { values: { active: true } }],
    ]);
  });

  it("takes a phone order as one tree, with its retry key and the total the screen showed", async () => {
    const t = fakeTransport(() => ({ data: { id: 9, number: "2118" }, replayed: true }));
    const reply = await new AdminiumKitchen(t, config()).phoneOrder(
      {
        values: { name: "Grace T.", pickup_at: "2026-07-28T20:00:00.000Z" },
        children: { order_items: [{ values: { menu_item_id: 3, qty: 2 }, children: { order_item_modifiers: [{ values: { modifier_id: 9 } }] } }] },
        expect: { total: "24.50" },
      },
      "k".repeat(32),
    );
    expect(t.calls[0]!.body).toEqual({
      values: { name: "Grace T.", pickup_at: "2026-07-28T20:00:00.000Z", channel: "phone" },
      children: { [REL.lines]: [{ values: { menu_item_id: 3, qty: 2 }, children: { [REL.options]: [{ values: { modifier_id: 9 } }] } }] },
      clientKey: "k".repeat(32),
      expect: { total: "24.50", column: "total" },
    });
    expect(reply).toEqual({ data: { id: 9, number: "2118" }, replayed: true });
  });

  it("prices a phone order before a name is typed, and names its lists back", async () => {
    const t = fakeTransport(() => ({ data: { total: "24.50", pickup_at: "2026-07-28 22:00:00" }, children: { [REL.lines]: [{ data: { id: 1, line_total: "24.50" }, children: { [REL.options]: [{ data: { name: "Farro" } }] } }] } }));
    const quote = await new AdminiumKitchen(t, config()).phoneQuote({ values: { pickup_at: "2026-07-28T20:00:00.000Z" }, children: { order_items: [{ values: { menu_item_id: 3, qty: 1 } }] } });
    expect((t.calls[0]!.body as { values: Record<string, unknown> }).values).toMatchObject({ name: "—", channel: "phone" });
    expect(quote).toEqual({
      data: { total: "24.50", pickup_at: "2026-07-28T20:00:00.000Z" },
      children: { order_items: [{ data: { id: 1, line_total: "24.50" }, children: { order_item_modifiers: [{ data: { name: "Farro" } }] } }] },
      capacity: [],
      exact: true,
    });
  });

  it("names a refused line and option by their list and place, as the screens read them", async () => {
    const refused = new SessionPortError("Some values were refused.", 422, "VALIDATION_FAILED", { fields: { modifier_id: { code: "not-offered" } }, reason: "not-offered", relation: REL.options, row: 0, under: { relation: REL.lines, row: 1 } });
    const t = fakeTransport(() => refused);
    const error = await new AdminiumKitchen(t, config()).phoneQuote({ values: {}, children: { order_items: [] } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect([(error as ApiError).status, (error as ApiError).code]).toEqual([422, "VALIDATION_FAILED"]);
    expect((error as ApiError).params).toMatchObject({ child: "order_item_modifiers", index: 0, path: ["order_items", 1, "order_item_modifiers", 0] });
  });
});

describe("the live stream", () => {
  it("asks only for the tables the person reads, and says which table changed", async () => {
    const heard: unknown[] = [];
    const listeners = new Map<string, (event: { data: string }) => void>();
    let url = "";
    const stream = (u: string): EventSourceLike => {
      url = u;
      return { onopen: null, onerror: null, addEventListener: (type, l) => listeners.set(type, l), close: () => undefined };
    };
    const k = new AdminiumKitchen(fakeTransport(() => null), config(), { stream });
    const stop = k.subscribe((frame) => heard.push(frame));
    await new Promise((r) => setTimeout(r, 0));
    // Orders and hours: the two this person reads.
    expect(decodeURIComponent(url)).toBe("/api/v1/events?channels=widget-data:c1:public.ordering_orders,widget-data:c1:public.ordering_hours");
    listeners.get("record.update")!({ data: JSON.stringify({ channel: "widget-data:c1:public.ordering_orders", data: { pk: { id: 12 } } }) });
    expect(heard).toEqual([{ table: "orders", id: 12, op: "update" }]);
    stop();
  });
});
