/**
 * Juniper Kitchen's Tuesday: the one source of the app's sample data.
 *
 * `npm run sample` writes `seeds/ordering.sample.json` from this module — the
 * bundle an operator adds from Adminium, and the very rows the website's demo
 * loads — so the demo and a real install show the same kitchen, and every
 * figure the design quotes comes out of these rows (`figures.test.ts`).
 *
 * The kitchen: open every day from 11:00, until 21:00 Sunday to Thursday and
 * 22:00 on Friday and Saturday; a private event 14 days ahead; the 1:00 PM
 * slot paused by Sam. Five categories, 22 dishes, the pizza and the grain
 * bowl with their options. Wild mushroom has 3 portions today, Diavola none.
 *
 * Today (as the design draws it at 11:40): five orders picked up, five on
 * the board, one pre-order for tomorrow; before it, six days of history —
 * #2017 to #2106, 90 orders, one not collected and one cancelled — and three
 * older orders of Kwame's for Order again. Two large-order enquiries.
 *
 * Times are relative to the adding moment, so the board is live whenever the
 * sample is added: an order on the board picks up on the kitchen's next
 * quarter-hours, one already picked up was placed and handed over that long
 * ago. The history sits on the six days before today, at its wall times.
 *
 * Numbers carry an `S` (`S2108`, `LG-S0097`) and no running number, so a
 * kitchen's own first order is never one of them. Addresses end in
 * `.example`, which Adminium never mails.
 */

// ── the kitchen ─────────────────────────────────────────────────────────────

export const SETTINGS = {
  venue_name: "Juniper Kitchen",
  headline: "Bowls and pizza, hot when you get here.",
  intro: "Build your order, pick a time, and walk past the line. Everything comes out of the same wood oven we've had since day one.",
  about: "Bowls and pizza on Junction Ave since 2014.",
  address: "112 Junction Ave, Riverside",
  area: "Riverside · corner of 3rd",
  directions: "We're the low brick building with the green awning. Pickup shelf is just inside the door, on your left — orders are filed by number.",
  phone: "(555) 018-2244",
  tax_rate: 8.25,
  slot_minutes: 15,
  slot_capacity: 6,
  lead_minutes: 20,
  preorder_days: 1,
  prep_minutes: 15,
  max_items: 12,
  online_on: true,
  ready_email_on: true,
  receipt_email_on: true,
  first_order_number: 1001,
};

/** Opening hours, Monday first: [open, opens, closes]. */
export const HOURS: [string, boolean, string, string][] = [
  ["mon", true, "11:00", "21:00"],
  ["tue", true, "11:00", "21:00"],
  ["wed", true, "11:00", "21:00"],
  ["thu", true, "11:00", "21:00"],
  ["fri", true, "11:00", "22:00"],
  ["sat", true, "11:00", "22:00"],
  ["sun", true, "11:00", "21:00"],
];

/** The day the demo stands on: Tuesday 28 July 2026, 11:40 in Riverside. */
export const DEMO_DAY = { y: 2026, m: 7, d: 28 };
export const DEMO_TIME = "11:40";
export const DEMO_ZONE = "America/Los_Angeles";

// ── the menu ────────────────────────────────────────────────────────────────

export const CATEGORIES: [slug: string, name: string, icon: string][] = [
  ["bowls", "Bowls", "salad"],
  ["pizza", "Pizza", "pizza"],
  ["sides", "Sides", "soup"],
  ["drinks", "Drinks", "cup-soda"],
  ["sweets", "Sweets", "cookie"],
];

export interface Dish {
  slug: string;
  name: string;
  category: string;
  price: number;
  description: string;
  /** The tile's hue, in degrees, when the dish has no photo. */
  hue: number;
  tags: string[];
  featured: boolean;
  allergens: string;
}

export const DISHES: Dish[] = [
  { slug: "bowl-grain", name: "Signature grain bowl", category: "bowls", price: 12.5, description: "Charred broccoli, herb tahini, quick-pickled onion.", hue: 128, tags: [], featured: true, allergens: "sesame, tree nuts" },
  { slug: "bowl-squash", name: "Harvest squash bowl", category: "bowls", price: 13.0, description: "Roasted squash, farro, sage brown butter.", hue: 36, tags: ["V"], featured: false, allergens: "gluten, dairy" },
  { slug: "bowl-chili", name: "Smoky chili bowl", category: "bowls", price: 11.75, description: "Three beans, chipotle, lime crema.", hue: 18, tags: ["V", "Spicy"], featured: false, allergens: "dairy" },
  { slug: "bowl-chicken", name: "Lemon chicken bowl", category: "bowls", price: 14.25, description: "Grilled chicken, jasmine rice, charred lemon.", hue: 62, tags: [], featured: false, allergens: "" },
  { slug: "bowl-tofu", name: "Sesame tofu bowl", category: "bowls", price: 12.75, description: "Crisp tofu, cabbage slaw, ginger sesame.", hue: 148, tags: ["V"], featured: false, allergens: "soy, sesame" },
  { slug: "pizza-byo", name: "Build your own pizza", category: "pizza", price: 14.0, description: "Start with our 48-hour dough and go from there.", hue: 26, tags: [], featured: true, allergens: "gluten, dairy" },
  { slug: "pizza-marg", name: "Margherita", category: "pizza", price: 13.5, description: "San Marzano, fior di latte, torn basil.", hue: 8, tags: ["V"], featured: false, allergens: "gluten, dairy" },
  { slug: "pizza-pep", name: "Pepperoni & honey", category: "pizza", price: 16.0, description: "Cup pepperoni, chili honey, oregano.", hue: 350, tags: ["Spicy"], featured: false, allergens: "gluten, dairy" },
  { slug: "pizza-funghi", name: "Wild mushroom", category: "pizza", price: 16.5, description: "Taleggio, thyme, roasted garlic cream.", hue: 30, tags: ["V"], featured: true, allergens: "gluten, dairy" },
  { slug: "pizza-verde", name: "Green pizza", category: "pizza", price: 15.25, description: "Basil pesto, broccolini, pistachio.", hue: 108, tags: ["V"], featured: false, allergens: "gluten, dairy, tree nuts" },
  { slug: "pizza-diavola", name: "Diavola", category: "pizza", price: 16.75, description: "Spicy salami, Calabrian chili, honey.", hue: 2, tags: ["Spicy"], featured: false, allergens: "gluten, dairy" },
  { slug: "side-focaccia", name: "Rosemary focaccia", category: "sides", price: 5.0, description: "Warm, salty, torn by hand.", hue: 42, tags: ["V"], featured: false, allergens: "gluten" },
  { slug: "side-brussels", name: "Charred brussels", category: "sides", price: 6.5, description: "Sprouts, mint, toasted almond.", hue: 96, tags: ["V"], featured: false, allergens: "tree nuts" },
  { slug: "side-soup", name: "Tomato & fennel soup", category: "sides", price: 6.0, description: "Slow-cooked, finished with olive oil.", hue: 14, tags: ["V"], featured: false, allergens: "" },
  { slug: "side-gem", name: "Little gem salad", category: "sides", price: 7.25, description: "Crisp lettuce, lemon, pecorino.", hue: 118, tags: ["V"], featured: false, allergens: "dairy" },
  { slug: "drink-lemonade", name: "Lemonade", category: "drinks", price: 4.0, description: "Pressed this morning, barely sweet.", hue: 68, tags: [], featured: false, allergens: "" },
  { slug: "drink-hibiscus", name: "Hibiscus iced tea", category: "drinks", price: 4.25, description: "Tart, floral, no sugar.", hue: 336, tags: [], featured: false, allergens: "" },
  { slug: "drink-water", name: "Sparkling water", category: "drinks", price: 3.25, description: "Cold can, lots of bubbles.", hue: 200, tags: [], featured: false, allergens: "" },
  { slug: "drink-cola", name: "Craft cola", category: "drinks", price: 3.75, description: "Cane sugar, bitter orange.", hue: 24, tags: [], featured: false, allergens: "" },
  { slug: "sweet-cookie", name: "Brown butter cookie", category: "sweets", price: 3.5, description: "Chewy middle, crackly edge.", hue: 32, tags: ["V"], featured: false, allergens: "gluten, dairy, egg" },
  { slug: "sweet-tart", name: "Lemon tart", category: "sweets", price: 5.5, description: "Sharp curd, shortbread base.", hue: 54, tags: ["V"], featured: false, allergens: "gluten, dairy, egg" },
  { slug: "sweet-brownie", name: "Olive oil brownie", category: "sweets", price: 4.5, description: "Dark chocolate, flaky salt.", hue: 20, tags: ["V"], featured: false, allergens: "gluten, egg" },
];

/** Today's portions: Wild mushroom has three, Diavola is sold out. */
export const PORTIONS: Record<string, number> = { "pizza-funghi": 3, "pizza-diavola": 0 };

export interface OptionGroup {
  dish: string;
  slug: string;
  name: string;
  kind: "radio" | "check";
  min: number;
  max: number;
  hint: string | null;
  options: [slug: string, name: string, extra: number, allergens?: string][];
}

export const GROUPS: OptionGroup[] = [
  {
    dish: "pizza-byo",
    slug: "size",
    name: "Size",
    kind: "radio",
    min: 1,
    max: 1,
    hint: "Choose a size.",
    options: [
      ["p", 'Personal 10"', 0],
      ["m", 'Medium 14"', 4],
      ["l", 'Large 18"', 7],
    ],
  },
  {
    dish: "pizza-byo",
    slug: "crust",
    name: "Crust",
    kind: "radio",
    min: 1,
    max: 1,
    hint: "Choose a crust.",
    options: [
      ["thin", "Thin and blistered", 0],
      ["classic", "Classic", 0],
      ["pan", "Pan, thick and crisp", 0],
    ],
  },
  {
    dish: "pizza-byo",
    slug: "tops",
    name: "Toppings",
    kind: "check",
    min: 0,
    max: 5,
    hint: "Up to five.",
    options: [
      ["fdl", "Fior di latte", 1.5, "dairy"],
      ["pep", "Cup pepperoni", 1.5],
      ["sal", "Spicy salami", 1.5],
      ["mush", "Wild mushroom", 1.5],
      ["squ", "Roasted squash", 1.5],
      ["bro", "Broccolini", 1.5],
      ["onion", "Red onion", 1.5],
      ["chili", "Calabrian chili", 1.5],
      ["basil", "Torn basil", 1.5],
      ["pist", "Pistachio", 1.5, "tree nuts"],
    ],
  },
  {
    dish: "bowl-grain",
    slug: "base",
    name: "Base",
    kind: "radio",
    min: 1,
    max: 1,
    hint: "Choose a base.",
    options: [
      ["farro", "Farro", 0, "gluten"],
      ["rice", "Jasmine rice", 0],
      ["gems", "Little gems", 0],
      ["half", "Half grain, half greens", 0, "gluten"],
    ],
  },
  {
    dish: "bowl-grain",
    slug: "protein",
    name: "Protein",
    kind: "radio",
    min: 1,
    max: 1,
    hint: "Choose a protein.",
    options: [
      ["chick", "Braised chickpeas", 3],
      ["tofu", "Crisp tofu", 3, "soy"],
      ["chicken", "Grilled chicken", 3.5],
      ["balls", "Herb meatballs", 3.5, "gluten, egg"],
    ],
  },
  {
    dish: "bowl-grain",
    slug: "extras",
    name: "Extras",
    kind: "check",
    min: 0,
    max: 3,
    hint: "Up to three.",
    options: [
      ["avo", "Avocado", 2],
      ["onion", "Pickled onion", 0.75],
      ["tahini", "Extra herb tahini", 0.75, "sesame"],
      ["seeds", "Toasted seeds", 1, "sesame"],
      ["egg", "Soft egg", 1.5, "egg"],
    ],
  },
];

// ── the orders ──────────────────────────────────────────────────────────────

/** A line: the dish, how many, the options chosen (as `group/option` slugs). */
export type Line = [dish: string, qty: number, options: string[]];

/** Baskets the history cycles through (and some of today's orders). */
export const BASKETS: Line[][] = [
  [["pizza-marg", 1, []], ["drink-lemonade", 1, []]],
  [["bowl-grain", 1, ["base/farro", "protein/chicken", "extras/avo"]], ["sweet-cookie", 1, []]],
  [["pizza-pep", 1, []], ["bowl-grain", 1, ["base/rice", "protein/tofu"]], ["drink-water", 1, []]],
  [["pizza-marg", 2, []], ["side-gem", 1, []]],
  [["bowl-grain", 1, ["base/gems", "protein/chick"]], ["drink-hibiscus", 1, []]],
  [["pizza-byo", 1, ["size/l", "crust/pan", "tops/pep", "tops/chili"]], ["side-brussels", 1, []]],
  [["pizza-funghi", 1, []], ["drink-hibiscus", 1, []]],
  [["bowl-chili", 1, []], ["drink-lemonade", 2, []]],
  [["bowl-squash", 1, []], ["side-focaccia", 1, []]],
  [["bowl-chicken", 1, []], ["side-soup", 1, []]],
  [["bowl-tofu", 1, []], ["drink-cola", 1, []]],
  [["pizza-verde", 1, []], ["sweet-tart", 1, []]],
  [["pizza-diavola", 1, []], ["sweet-brownie", 1, []]],
  [["pizza-marg", 1, []], ["pizza-funghi", 1, []], ["drink-hibiscus", 2, []]],
  [["pizza-byo", 1, ["size/m", "crust/thin", "tops/fdl", "tops/basil"]], ["side-brussels", 1, []]],
  [["pizza-marg", 1, []], ["side-gem", 1, []], ["drink-lemonade", 1, []]],
];

export type Status = "placed" | "confirmed" | "preparing" | "ready" | "picked_up" | "cancelled" | "not_collected";

/** One of today's orders, as the design draws it at 11:40. */
export interface TodayOrder {
  number: number;
  name: string;
  email: string;
  phone: string | null;
  /** Wall times on the demo day: placed, and the stamps it has reached (confirmed, preparing, ready, picked up). */
  placed: string;
  stamps: string[];
  /** Pickup: days from today and the wall time. */
  pickup: [day: number, time: string];
  status: Status;
  note: string | null;
  paid: "cash" | "card" | null;
  lines: Line[];
}

const BY = "Sam";

export const TODAY: TodayOrder[] = [
  { number: 2107, name: "Hana K.", email: "hana.k@mail.example", phone: "(555) 018-7720", placed: "09:15", stamps: [], pickup: [1, "12:30"], status: "placed", note: null, paid: null, lines: [["bowl-grain", 1, ["base/farro", "protein/chicken", "extras/avo"]], ["drink-lemonade", 1, []]] },
  { number: 2108, name: "Rosa M.", email: "rosa.m@mail.example", phone: "(555) 018-4471", placed: "10:36", stamps: ["10:38", "10:45", "10:57", "11:01"], pickup: [0, "11:00"], status: "picked_up", note: null, paid: "cash", lines: BASKETS[0]! },
  { number: 2109, name: "Kwame B.", email: "kwame.b@mail.example", phone: "(555) 019-2205", placed: "10:48", stamps: ["10:50", "11:00", "11:12", "11:16"], pickup: [0, "11:15"], status: "picked_up", note: null, paid: "card", lines: BASKETS[1]! },
  { number: 2110, name: "Sofia R.", email: "sofia.r@mail.example", phone: "(555) 017-8830", placed: "10:52", stamps: ["10:54", "11:02", "11:13", "11:18"], pickup: [0, "11:15"], status: "picked_up", note: null, paid: "cash", lines: BASKETS[2]! },
  { number: 2111, name: "Aiden T.", email: "aiden.t@mail.example", phone: null, placed: "11:02", stamps: ["11:04", "11:16", "11:27", "11:32"], pickup: [0, "11:30"], status: "picked_up", note: null, paid: "card", lines: BASKETS[3]! },
  { number: 2112, name: "Noor H.", email: "noor.h@mail.example", phone: "(555) 019-4408", placed: "11:06", stamps: ["11:08", "11:18", "11:28", "11:35"], pickup: [0, "11:30"], status: "picked_up", note: null, paid: "cash", lines: BASKETS[4]! },
  { number: 2113, name: "Priya N.", email: "priya.n@mail.example", phone: "(555) 018-3392", placed: "11:12", stamps: ["11:14", "11:22", "11:34"], pickup: [0, "11:45"], status: "ready", note: null, paid: null, lines: [["pizza-marg", 2, []], ["drink-lemonade", 1, []]] },
  { number: 2114, name: "Marcus O.", email: "marcus.o@mail.example", phone: "(555) 017-5140", placed: "11:15", stamps: ["11:17", "11:28"], pickup: [0, "11:45"], status: "preparing", note: "Extra crispy, please.", paid: null, lines: BASKETS[5]! },
  { number: 2115, name: "Dana L.", email: "dana.l@mail.example", phone: "(555) 019-7761", placed: "11:18", stamps: ["11:20"], pickup: [0, "12:00"], status: "confirmed", note: null, paid: null, lines: [["bowl-grain", 1, ["base/farro", "protein/chicken", "extras/avo", "extras/egg"]], ["sweet-cookie", 2, []]] },
  { number: 2116, name: "Theo A.", email: "theo.a@mail.example", phone: null, placed: "11:24", stamps: [], pickup: [0, "12:15"], status: "placed", note: "One box, please — we're sharing.", paid: null, lines: BASKETS[13]! },
  { number: 2117, name: "Ines V.", email: "ines.v@mail.example", phone: "(555) 019-0934", placed: "11:26", stamps: [], pickup: [0, "12:15"], status: "placed", note: null, paid: null, lines: BASKETS[7]! },
];

/** Kwame's older orders, for Order again: number, days before today, pickup, lines. */
export const KWAME_PAST: [number, number, string, Line[]][] = [
  [2009, -7, "12:00", BASKETS[15]!],
  [1951, -11, "12:15", BASKETS[1]!],
  [1872, -18, "12:30", [["pizza-byo", 1, ["size/m", "crust/thin", "tops/fdl", "tops/basil"]], ["pizza-diavola", 1, []]]],
];

/** The six days before today: days from today, and how many orders (Saturday's includes one cancelled). */
export const HISTORY_DAYS: [day: number, orders: number][] = [
  [-6, 12],
  [-5, 15],
  [-4, 19],
  [-3, 21],
  [-2, 14],
  [-1, 9],
];

/** How pickups spread over a day, by hour (the lunch and the dinner peak). */
const WEIGHT: Record<number, number> = { 11: 1, 12: 3, 13: 2, 14: 1, 15: 0.5, 16: 0.5, 17: 1, 18: 2.5, 19: 2, 20: 1 };

/** The pickup minute a history order at quantile `q` of its day falls on (quarter-hours, 11:00–20:45). */
function pickupMinute(q: number): number {
  const slots: number[] = [];
  for (let h = 11; h <= 20; h += 1) for (const m of [0, 15, 30, 45]) slots.push(h * 60 + m);
  const total = slots.reduce((sum, slot) => sum + WEIGHT[Math.floor(slot / 60)]!, 0);
  let running = 0;
  for (const slot of slots) {
    running += WEIGHT[Math.floor(slot / 60)]!;
    if (q <= running / total + 1e-12) return slot;
  }
  return slots.at(-1)!;
}

/** Diners of the history, in turn. */
const REGULARS: [name: string, email: string, phone: string | null][] = [
  ["Maya C.", "maya.c@mail.example", "(555) 010-4471"],
  ["Luis P.", "luis.p@mail.example", "(555) 012-3308"],
  ["Grace W.", "grace.w@mail.example", null],
  ["Omar S.", "omar.s@mail.example", "(555) 014-2290"],
  ["Elena V.", "elena.v@mail.example", "(555) 011-7713"],
  ["Ben D.", "ben.d@mail.example", "(555) 013-6621"],
  ["Hiro T.", "hiro.t@mail.example", null],
  ["Chloe R.", "chloe.r@mail.example", "(555) 016-0045"],
  ["Sam K.", "sam.k@mail.example", "(555) 015-9982"],
  ["Ada N.", "ada.n@mail.example", "(555) 012-7740"],
  ["Ravi M.", "ravi.m@mail.example", "(555) 017-3316"],
  ["Lena F.", "lena.f@mail.example", null],
  ["Jonah B.", "jonah.b@mail.example", "(555) 018-9951"],
  ["Mira L.", "mira.l@mail.example", "(555) 011-2276"],
];

export interface HistoryOrder {
  number: number;
  day: number;
  /** Pickup, in minutes after midnight. */
  pickup: number;
  status: Status;
  lines: Line[];
  diner: number;
  paid: "cash" | "card" | null;
}

/** #2017–#2106 over the six days before today; one not collected on Friday, one cancelled on Saturday. */
export function history(): HistoryOrder[] {
  const out: HistoryOrder[] = [];
  const count = HISTORY_DAYS.reduce((sum, [, n]) => sum + n, 0);
  let number = 2106 - count + 1;
  let basket = 3;
  for (const [day, n] of HISTORY_DAYS) {
    for (let i = 0; i < n; i += 1) {
      const k = out.length;
      out.push({ number, day, pickup: pickupMinute((i + 0.5) / n), status: "picked_up", lines: BASKETS[basket % BASKETS.length]!, diner: k % REGULARS.length, paid: k % 2 === 0 ? "card" : "cash" });
      number += 1;
      basket += 1;
    }
  }
  const onDay = (day: number) => out.filter((o) => o.day === day);
  const notCollected = onDay(-4).at(-3)!;
  notCollected.status = "not_collected";
  notCollected.paid = null;
  const cancelled = onDay(-3).at(-2)!;
  cancelled.status = "cancelled";
  cancelled.paid = null;
  return out;
}

/** The two large-order enquiries on file. */
export const ENQUIRIES = [
  { ref: "LG-S0097", heads: 40, day: 11, notes: "Riverside Rowing Club, end of season.", name: "Tom Achterberg", phone: "(555) 013-4480", email: "tom.a@rowing.example", status: "called" as const },
  { ref: "LG-S0098", heads: 24, day: 3, notes: "Office lunch — mostly pizza, a couple of vegan bowls, one without gluten if you can.", name: "Priti Shah", phone: "(555) 016-2217", email: "priti.s@office.example", status: "new" as const },
];

// ── the bundle ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const NOW = minutes(DEMO_TIME);

/** A moment of the demo day as the sample spells it: so long before the adding moment. */
function ago(at: string): Record<string, string> {
  const diff = NOW - minutes(at);
  if (diff <= 0) throw new Error(`${at} is not before ${DEMO_TIME}`);
  return { "@ago": `PT${String(diff)}M` };
}

/**
 * A pickup on the board: the kitchen's first open slot at least so far ahead —
 * on the next day it opens when today has none left, so the board is never
 * empty whenever the sample is added.
 */
function ahead(at: string): Record<string, unknown> {
  const diff = minutes(at) - NOW;
  // On the quarter-hour grid: 11:45 is 5 minutes on at 11:40, 12:00 20, 12:15 35.
  return { "@in": `PT${String(diff)}M`, "@slot": "orders" };
}

const wall = (day: number, time: string) => ({ "@day": day, "@time": time });

const STAMPED: [Status, string, string | null][] = [
  ["confirmed", "confirmed_at", "confirmed_by"],
  ["preparing", "preparing_at", null],
  ["ready", "ready_at", "ready_by"],
  ["picked_up", "picked_up_at", "picked_up_by"],
];

/** The rows of one order's lines and their options. */
function lineRows(order: string, lines: Line[]): { items: Row[]; options: Row[] } {
  const items: Row[] = [];
  const options: Row[] = [];
  lines.forEach(([dish, qty, chosen], i) => {
    const label = `${order}:l${String(i + 1)}`;
    items.push({ "@label": label, order_id: { "@ref": order }, position: i + 1, menu_item_id: { "@ref": `dish:${dish}` }, qty });
    for (const option of chosen) {
      options.push({ order_item_id: { "@ref": label }, modifier_id: { "@ref": `option:${dish}.${option.replace("/", ".")}` } });
    }
  });
  return { items, options };
}

export interface SampleBundle {
  format: "adminium.sample/1";
  app: string;
  assets: Record<string, never>;
  tables: { ref: string; onlyIfEmpty?: true; rows: Row[] }[];
}

/** The sample bundle, as `seeds/ordering.sample.json` holds it. */
export function sampleBundle(): SampleBundle {
  const customers: Row[] = [];
  const customerOf = new Map<string, string>();
  const customer = (name: string, email: string): string => {
    const known = customerOf.get(email);
    if (known !== undefined) return known;
    const label = `customer:${email.split("@")[0]!}`;
    customers.push({ "@label": label, email, name, created_at: { "@day": -40, "@time": "12:00" } });
    customerOf.set(email, label);
    return label;
  };

  const orders: Row[] = [];
  const items: Row[] = [];
  const options: Row[] = [];
  const messages: Row[] = [];
  const addLines = (label: string, lines: Line[]) => {
    const rows = lineRows(label, lines);
    items.push(...rows.items);
    options.push(...rows.options);
  };

  // Kwame's older orders, then the six days of history, oldest first.
  for (const [number, day, pickup, lines] of KWAME_PAST) {
    const label = `order:${String(number)}`;
    const at = minutes(pickup);
    orders.push({
      "@label": label,
      number_seq: null,
      number: `S${String(number)}`,
      customer_id: { "@ref": customer("Kwame B.", "kwame.b@mail.example") },
      name: "Kwame B.",
      email: "kwame.b@mail.example",
      phone: "(555) 019-2205",
      language: "en-US",
      pickup_at: wall(day, pickup),
      channel: "online",
      status: "picked_up",
      paid_method: "card",
      ...doneStamps(day, at),
    });
    addLines(label, lines);
  }
  for (const order of history()) {
    const [name, email, phone] = REGULARS[order.diner]!;
    const label = `order:${String(order.number)}`;
    const base: Row = {
      "@label": label,
      number_seq: null,
      number: `S${String(order.number)}`,
      customer_id: { "@ref": customer(name, email) },
      name,
      email,
      phone,
      language: "en-US",
      pickup_at: wall(order.day, hhmm(order.pickup)),
      channel: "online",
      status: order.status,
      paid_method: order.paid,
    };
    if (order.status === "picked_up") Object.assign(base, doneStamps(order.day, order.pickup));
    else if (order.status === "not_collected") {
      Object.assign(base, stampsUpTo(order.day, order.pickup, "ready"), { not_collected_at: wall(order.day, closingOf(order.day)) });
    } else {
      Object.assign(base, stampsUpTo(order.day, order.pickup, "placed"), {
        cancel_code: "ran_out",
        cancel_dish: "Braised chickpeas",
        cancelled_at: wall(order.day, hhmm(order.pickup - 20)),
        cancelled_by: BY,
      });
    }
    orders.push(base);
    addLines(label, order.lines);
  }

  // Today, as the design draws it at 11:40.
  for (const order of TODAY) {
    const label = `order:${String(order.number)}`;
    const onBoard = order.pickup[0] === 0 && order.status !== "picked_up";
    const row: Row = {
      "@label": label,
      number_seq: null,
      number: `S${String(order.number)}`,
      customer_id: { "@ref": customer(order.name, order.email) },
      name: order.name,
      email: order.email,
      phone: order.phone,
      language: "en-US",
      pickup_at: order.pickup[0] === 0 ? (onBoard ? ahead(order.pickup[1]) : ago(order.pickup[1])) : wall(order.pickup[0], order.pickup[1]),
      note: order.note,
      channel: "online",
      status: order.status,
      paid_method: order.paid,
      placed_at: ago(order.placed),
    };
    order.stamps.forEach((at, i) => {
      const [, column, by] = STAMPED[i]!;
      row[column] = ago(at);
      if (by !== null) row[by] = BY;
    });
    orders.push(row);
    addLines(label, order.lines);
    messages.push({ kind: "order-confirmation", status: "sent", to_address: order.email, language: "en-US", order_id: { "@ref": label }, customer_id: { "@ref": customer(order.name, order.email) }, created_at: ago(order.placed), sent_at: ago(order.placed) });
    if (order.stamps.length >= 3) {
      messages.push({ kind: "order-ready", status: "sent", to_address: order.email, language: "en-US", order_id: { "@ref": label }, customer_id: { "@ref": customer(order.name, order.email) }, created_at: ago(order.stamps[2]!), sent_at: ago(order.stamps[2]!) });
    }
  }

  return {
    format: "adminium.sample/1",
    app: "ordering",
    assets: {},
    tables: [
      { ref: "settings", rows: [{ "@label": "settings", "@onlyIfEmpty": true, ...SETTINGS }] },
      // A kitchen that set its own hours keeps them: the week's seven go in only when there are none (Adminium 0.3.8).
      { ref: "hours", onlyIfEmpty: true, rows: HOURS.map(([weekday, open, opens, closes]) => ({ weekday, open, opens, closes })) },
      { ref: "closures", rows: [{ from_date: { "@day": 14 }, to_date: { "@day": 14 }, reason: "Private event", active: true }] },
      { ref: "slot_pauses", rows: [{ slot_at: wall(0, "13:00"), active: true, paused_by: BY, paused_at: ago("11:05") }] },
      { ref: "menu_categories", rows: CATEGORIES.map(([slug, name, icon], i) => ({ "@label": `category:${slug}`, slug, name, icon, position: i + 1 })) },
      {
        ref: "menu_items",
        rows: DISHES.map((dish, i) => ({
          "@label": `dish:${dish.slug}`,
          category_id: { "@ref": `category:${dish.category}` },
          slug: dish.slug,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          available: true,
          featured: dish.featured,
          tags: dish.tags.length === 0 ? null : dish.tags.join(", "),
          position: i + 1,
          hue: String(dish.hue),
          allergens: dish.allergens === "" ? null : dish.allergens,
          online: true,
          ...(PORTIONS[dish.slug] === undefined ? {} : { stock_today: PORTIONS[dish.slug], stock_on: { "@day": 0 } }),
        })),
      },
      {
        ref: "modifier_groups",
        rows: GROUPS.map((group, i) => ({
          "@label": `group:${group.dish}.${group.slug}`,
          item_id: { "@ref": `dish:${group.dish}` },
          slug: group.slug,
          name: group.name,
          kind: group.kind,
          min: group.min,
          max: group.max,
          hint: group.hint,
          position: i + 1,
        })),
      },
      {
        ref: "modifiers",
        rows: GROUPS.flatMap((group) =>
          group.options.map(([slug, name, extra, allergens], i) => ({
            "@label": `option:${group.dish}.${group.slug}.${slug}`,
            group_id: { "@ref": `group:${group.dish}.${group.slug}` },
            slug,
            name,
            price_delta: extra,
            available: true,
            position: i + 1,
            allergens: allergens ?? null,
          })),
        ),
      },
      { ref: "customers", rows: customers },
      { ref: "orders", rows: orders },
      { ref: "order_items", rows: items },
      { ref: "order_item_modifiers", rows: options },
      {
        ref: "enquiries",
        rows: ENQUIRIES.map((e) => ({
          ref_seq: null,
          ref: e.ref,
          heads: e.heads,
          wanted_on: { "@day": e.day },
          notes: e.notes,
          name: e.name,
          phone: e.phone,
          email: e.email,
          language: "en-US",
          status: e.status,
          handled_by: e.status === "called" ? BY : null,
          created_at: { "@day": e.status === "called" ? -5 : -1, "@time": "15:20" },
        })),
      },
      { ref: "messages", rows: messages },
    ],
  };

  /** A finished order's stamps: placed half an hour before pickup, handed over a minute after. */
  function doneStamps(day: number, pickup: number): Row {
    return { ...stampsUpTo(day, pickup, "ready"), picked_up_at: wall(day, hhmm(pickup + 1)), picked_up_by: BY };
  }
  /** The stamps up to a state, on a history day. */
  function stampsUpTo(day: number, pickup: number, last: "placed" | "ready"): Row {
    const row: Row = { placed_at: wall(day, hhmm(pickup - 30)) };
    if (last === "ready") {
      Object.assign(row, {
        confirmed_at: wall(day, hhmm(pickup - 28)),
        confirmed_by: BY,
        preparing_at: wall(day, hhmm(pickup - 18)),
        ready_at: wall(day, hhmm(pickup - 4)),
        ready_by: BY,
      });
    }
    return row;
  }
  /** The closing time of a history day (days before the demo's Tuesday). */
  function closingOf(day: number): string {
    const weekday = (new Date(Date.UTC(DEMO_DAY.y, DEMO_DAY.m - 1, DEMO_DAY.d + day)).getUTCDay() + 6) % 7;
    return HOURS[weekday]![3];
  }
}
