/**
 * What the demo card's shortcuts do to the kitchen — each through the
 * demo's Adminium, as the people it stands for would have done it: another
 * diner orders, another tablet marks an order ready, the kitchen marks a dish
 * sold out, a manager changes a price, the clock runs on past closing.
 *
 * (The shortcuts that only fill in a form — Kwame's details, a sample
 * enquiry — are the page's own.)
 *
 * DEMO BUILD ONLY — nothing in a real build imports it.
 */
import type { Id, OrderBody, Row } from "../data/wire.ts";
import { instantOf, venueDay } from "../lib/venueTime.ts";
import type { DemoAdminium } from "./adminium.ts";
import type { Writer } from "./engine.ts";

const SAM: Writer = { origin: "staff", name: "Sam", roles: ["kitchen", "manager"] };
const GUEST: Writer = { origin: "public", name: null, roles: [] };

const dishId = (demo: DemoAdminium, name: string): Id => demo.world.all("menu_items").find((d) => d["name"] === name)!.id;
const today = (demo: DemoAdminium) => venueDay(demo.now, demo.world.zone);
const iso = (ms: number) => new Date(ms).toISOString();

/** An order another diner places now, for the first free time (or the one given). */
export function otherDiner(demo: DemoAdminium, name: string, email: string, dishes: string[], at?: string): Row | null {
  const slot = at ?? demo.engine.slotAnswer(today(demo)).find((s) => s.state === "free")?.time;
  if (slot === undefined) return null;
  const body: OrderBody = {
    values: { name, email, phone: null, language: "en-US", pickup_at: iso(instantOf(today(demo), slot, demo.world.zone)) },
    children: { order_items: dishes.map((d) => ({ values: { menu_item_id: dishId(demo, d), qty: 1 } })) },
  };
  const tree = demo.engine.orderTree(body.values, body.children.order_items.map((l) => ({ values: l.values, options: [] })), GUEST, {
    dry: false,
    readableDish: (d) => d["available"] === true && d["online"] === true,
    readableOption: (o) => o["available"] === true,
  });
  return demo.engine.writeOrder(tree, GUEST).order;
}

/** "A new order arrives": Lena W. orders a Pepperoni & honey and a Craft cola. */
export function arrive(demo: DemoAdminium): Row | null {
  return otherDiner(demo, "Lena W.", "lena.w@mail.example", ["Pepperoni & honey", "Craft cola"]);
}

/**
 * "Another screen marks it ready": the first order cooking (or else the first
 * confirmed) is marked ready on another tablet, at the demo's time now.
 */
export function anotherScreenReady(demo: DemoAdminium): Row | null {
  const orders = demo.world.where("orders", (o) => venueDay(String(o["pickup_at"]), demo.world.zone) === today(demo));
  const target = orders.find((o) => o["status"] === "preparing") ?? orders.find((o) => o["status"] === "confirmed");
  if (target === undefined) return null;
  if (target["status"] === "confirmed") demo.engine.updateOrder(target.id, { status: "preparing" }, SAM);
  return demo.engine.updateOrder(target.id, { status: "ready" }, SAM);
}

/** "A lunch rush": 12:30 fills to the last place. */
export function lunchRush(demo: DemoAdminium): number {
  const names: [string, string[]][] = [
    ["Jonah P.", ["Margherita", "Lemonade"]],
    ["Mei L.", ["Smoky chili bowl"]],
    ["Omar S.", ["Pepperoni & honey", "Rosemary focaccia"]],
    ["Clara D.", ["Sesame tofu bowl", "Hibiscus iced tea"]],
    ["Felix R.", ["Green pizza"]],
    ["Asha K.", ["Harvest squash bowl", "Lemon tart"]],
  ];
  const at = instantOf(today(demo), "12:30", demo.world.zone);
  let made = 0;
  for (const [name, dishes] of names) {
    if (demo.engine.taken(at) >= Number(demo.world.settings()["slot_capacity"])) break;
    if (otherDiner(demo, name, `${name.split(" ")[0]!.toLowerCase()}@mail.example`, dishes, "12:30") !== null) made += 1;
  }
  return made;
}

/** "Wild mushroom sells out": the kitchen marks it sold out for today. */
export function sellOut(demo: DemoAdminium, name = "Wild mushroom"): void {
  demo.world.update("menu_items", dishId(demo, name), { stock_today: 0, stock_on: today(demo) });
}

/** "The price changes": a manager puts 50¢ on a dish. */
export function priceChange(demo: DemoAdminium, id: Id): void {
  const dish = demo.world.get("menu_items", id)!;
  demo.world.update("menu_items", id, { price: Math.round((Number(dish["price"]) + 0.5) * 100) / 100 });
}

/** "The slot fills first": other diners take every place left at that time. */
export function fillSlot(demo: DemoAdminium, time: string): void {
  const at = instantOf(today(demo), time, demo.world.zone);
  const size = Number(demo.world.settings()["slot_capacity"]);
  for (let i = 0; demo.engine.taken(at) < size && i < size; i += 1) {
    otherDiner(demo, `Guest ${String(i + 1)}`, `guest${String(i + 1)}@mail.example`, ["Lemonade"], time);
  }
}

/** "The kitchen moves it on": the diner's order, one step further, by Sam. */
export function moveOn(demo: DemoAdminium, id: Id): Row | null {
  const order = demo.world.get("orders", id);
  const next: Record<string, string> = { placed: "confirmed", confirmed: "preparing", preparing: "ready", ready: "picked_up" };
  const to = order === undefined ? undefined : next[String(order["status"])];
  if (to === undefined) return null;
  return demo.engine.updateOrder(id, { status: to, ...(to === "picked_up" ? { paid_method: "card" } : {}) }, SAM);
}

/** "A public holiday": the first holiday not closed yet becomes a closure. */
export function addHoliday(demo: DemoAdminium, holidays: { date: string; name: string }[]): Row | null {
  const next = holidays.find((h) => !demo.world.all("closures").some((c) => c["from_date"] === h.date));
  return next === undefined ? null : demo.world.insert("closures", { from_date: next.date, to_date: next.date, reason: next.name, active: true });
}

/**
 * "After closing": the sample's own orders are finished as the kitchen
 * finished them that afternoon — so the kitchen and the Overview agree on
 * the day's takings — then the clock runs to 9:30 PM, and closing sweeps only
 * the orders made in the demo.
 */
export function afterClosing(demo: DemoAdminium): void {
  const day = today(demo);
  const t = (time: string) => iso(instantOf(day, time, demo.world.zone));
  const finish: Record<string, { stamps: Record<string, string>; paid: "cash" | "card" }> = {
    "2113": { stamps: { picked_up_at: t("11:46") }, paid: "card" },
    "2114": { stamps: { ready_at: t("11:43"), picked_up_at: t("11:46") }, paid: "cash" },
    "2115": { stamps: { preparing_at: t("11:45"), ready_at: t("11:58"), picked_up_at: t("12:02") }, paid: "card" },
    "2116": { stamps: { confirmed_at: t("11:41"), preparing_at: t("12:00"), ready_at: t("12:13"), picked_up_at: t("12:17") }, paid: "cash" },
    "2117": { stamps: { confirmed_at: t("11:42"), preparing_at: t("12:00"), ready_at: t("12:13"), picked_up_at: t("12:19") }, paid: "card" },
  };
  for (const [number, done] of Object.entries(finish)) {
    const order = demo.world.all("orders").find((o) => o["number"] === number);
    if (order === undefined || !["placed", "confirmed", "preparing", "ready"].includes(String(order["status"]))) continue;
    const by = Object.fromEntries(Object.keys(done.stamps).filter((c) => ["confirmed_at", "ready_at", "picked_up_at"].includes(c)).map((c) => [c.replace("_at", "_by"), "Sam"]));
    demo.world.update("orders", order.id, { ...done.stamps, ...by, status: "picked_up", paid_method: done.paid });
  }
  demo.advanceTo(instantOf(day, "21:30", demo.world.zone));
}
