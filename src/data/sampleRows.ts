/**
 * The sample kitchen, resolved in the browser.
 *
 * The website's demo runs with no server: it reads the very bundle an operator
 * adds from Adminium (`seeds/ordering.sample.json`) and needs the rows Adminium
 * would have written from it. `resolveSample()` is that loader, done here —
 * and done the SAME way, because a demo that worked out "today" or a total
 * differently from a real install would show a kitchen nobody can get:
 *
 *   - each table's rows get `id`s 1, 2, 3 … in bundle order, as a fresh
 *     table's counter hands them out; a row left out by `@byClock` takes none;
 *   - `@ref` is the id of the earlier row with that `@label`;
 *   - `@ago` is an instant that long before `now`; `@in` one that long after,
 *     rounded up with `@grid` to the next step of that many minutes on the
 *     kitchen's clock, counted from its midnight and never past the next; with
 *     `@slot`, the first pickup slot from then on that is open (its day's
 *     hours, no closure, not paused) and has room beside the rows placed on it
 *     before — today, or a day it opens up to two weeks on;
 *   - `@day`/`@time` is a wall time on the kitchen's clock, `@day` alone a
 *     date there; with `@workdays` the days count Monday to Friday, and day 0
 *     on a weekend is the Monday after;
 *   - `@month`/`@dom` is that day of the month so many months back, the
 *     month's last day when it has fewer, and never later than today (with
 *     `@time`, never later than now) — so a month's history keeps its shape
 *     whatever day it is added;
 *   - `@onlyIfEmpty` is a row for a table that holds one: the demo's tables
 *     start empty, so the row is always added;
 *   - `@byClock` merges its `before`, `around` or `after` set by where the
 *     row's time falls against `now` — more than half an hour before, within
 *     half an hour, or later — and `"@skip": true` leaves the row out;
 *   - `@t` is the reader's language: the exact tag, then the same language,
 *     then US English;
 *   - what the database fills in is filled in: a copy through the row's link
 *     (always, or only when the row names none), a setting the column falls
 *     back to (a column of the app's own settings row, read as the bundle
 *     wrote it), each column's default ("now" is the adding moment), a running
 *     number the row leaves out, and null for the rest;
 *   - then, once every row is in, the totals are settled from the rows that
 *     feed them, as the loader does last: each line's amount (its formula),
 *     each line's options (their sum), each order's subtotal and item count
 *     (the sum of its lines), tax and total (their formulas).
 *
 * Instants come out as ISO strings in UTC (`…Z`), dates as `YYYY-MM-DD` on the
 * kitchen's clock, worked-out money as numbers. Formulas are worked out exactly
 * (fractions, not floats) and rounded once, half away from zero, to the
 * column's scale — a currency's own decimals for money.
 *
 * Nothing is stamped: Adminium's stamps skip a sample load, so a row carries
 * the times and names it spells. A code the server draws at random (a share
 * link's token) is left empty here.
 *
 * Pure, and browser-safe: it imports nothing, and nothing that runs only in
 * Node — it ships in the demo bundle. The server's own resolver is in Adminium
 * (`apps/server/src/apps/sample-data.ts`); sampleRows.test.ts holds this one
 * to the same answers, and src/sample/sample-bundle.test.ts holds the written part below
 * to manifest.json.
 */

/** The parts of an `adminium.sample/1` bundle this resolver reads. */
export interface SampleBundleRows {
  format: string;
  app: string;
  tables: { ref: string; rows: Record<string, unknown>[] }[];
}

export type ResolvedRow = Record<string, unknown>;
export type ResolvedSample = Record<string, ResolvedRow[]>;

export interface ResolveOptions {
  /** The adding moment, in epoch milliseconds. */
  now: number;
  /** The kitchen's IANA zone, e.g. "America/Los_Angeles". */
  zone: string;
  /** The reader's BCP 47 tag, e.g. "de-DE". */
  locale: string;
  /** The connection's currency, for a column that falls back to it. */
  currency?: string;
  /** The add-ons' settings a column falls back to, by `<addOn>.<setting>`. */
  settings?: Readonly<Record<string, unknown>>;
}

/** A column the database fills with the adding moment. */
const NOW = Symbol("now");
/** A column every row must name: it has no default and may not be empty. */
const REQUIRED = Symbol("required");
type Fill = string | number | boolean | null | typeof NOW | typeof REQUIRED;

/** A decimal column's places: a number, or the row's currency's own. */
type Scale = number | "currency";

/** A formula as the manifest writes it (`rules.formula`). */
export type Formula =
  | number
  | string
  | { add: Formula[] }
  | { sub: [Formula, Formula] }
  | { mul: Formula[] }
  | { div: [Formula, Formula] }
  | { min: Formula[] }
  | { max: Formula[] }
  | { round: Formula | [Formula, number] }
  | { coalesce: [Formula, Formula] }
  | { if: [Condition, Formula, Formula] };

export type Condition =
  | { eq: [string, string | number | boolean] }
  | { neq: [string, string | number | boolean] }
  | { gt: [Formula, Formula] }
  | { gte: [Formula, Formula] }
  | { lt: [Formula, Formula] }
  | { lte: [Formula, Formula] }
  | { isNull: string }
  | { and: Condition[] }
  | { or: Condition[] };

export interface Rules {
  /** `column.copy`: the value of `from` on the row `via` links to (a `parent` row); `always`, or only when the row names none. */
  copies: { table: string; column: string; via: string; parent: string; from: string; always: boolean }[];
  /** `column.default.from`: a setting the column falls back to when the row and its copy leave it empty. */
  defaults: { table: string; column: string; from: string }[];
  /** `column.formula`, worked out over the row's own columns. */
  formulas: { table: string; column: string; scale: Scale; expr: Formula }[];
  /** `column.rollup`: the sum of `child.sum` over the rows linked by `via`, and the balance it leaves. */
  rollups: {
    table: string;
    column: string;
    child: string;
    via: string;
    sum: string;
    scale: Scale;
    where?: { column: string; eq: unknown };
    balance?: { column: string; of: string };
  }[];
  /** `column.sequence`: the next number when a row leaves it out (per `scope` row when scoped). */
  sequences: { table: string; column: string; scope: string | null }[];
  /** `column.format`: the text of a running number, with its prefix. */
  formats: { table: string; column: string; from: string; prefix: string | null; prefixSetting: string | null; pad: number }[];
  /** `column.code`: drawn at random by the server; left empty here. */
  codes: { table: string; column: string }[];
}

/*
 * Every column after `id`, in the manifest's order, with what the database
 * puts there when a row does not say, and the rules the loader settles rows
 * by (manifest.json `requiredSchema`). The manifest is too big to ship to the
 * browser for this, so `npm run sample` writes them here from it, between
 * the two marker lines.
 */
// ── written by `npm run sample` from manifest.json; do not edit by hand ──
export const COLUMNS: Record<string, Record<string, Fill>> = {
  settings: { venue_name: REQUIRED, headline: null, intro: null, about: null, address: REQUIRED, area: null, directions: null, phone: null, photo_hero: null, photo_street: null, photo_closed: null, photo_store: null, tax_rate: 0, slot_minutes: 15, slot_capacity: 6, lead_minutes: 20, preorder_days: 1, prep_minutes: 15, max_items: 12, online_on: true, ready_email_on: true, receipt_email_on: true, first_order_number: 1001 },
  menu_categories: { slug: null, name: REQUIRED, position: 0, icon: null, tint: null },
  menu_items: { category_id: null, slug: null, name: REQUIRED, short_name: null, description: null, price: 0, image: null, available: true, featured: false, tags: null, position: 0, barcode: null, stock_today: null, stock_on: null, hue: null, allergens: null, online: true },
  modifier_groups: { item_id: REQUIRED, slug: null, name: REQUIRED, kind: "radio", min: 0, max: 1, hint: null, position: 0 },
  modifiers: { group_id: REQUIRED, slug: null, name: REQUIRED, price_delta: 0, available: true, position: 0, allergens: null },
  hours: { weekday: REQUIRED, open: true, opens: "11:00", closes: "21:00" },
  closures: { from_date: REQUIRED, to_date: REQUIRED, reason: null, active: true },
  slot_pauses: { slot_at: REQUIRED, active: true, paused_by: null, paused_at: null },
  customers: { email: null, name: null, forgotten_at: null, created_at: null },
  orders: { number_seq: null, number: null, status: "placed", pickup_at: REQUIRED, name: REQUIRED, phone: null, email: null, channel: "online", note: null, item_count: null, subtotal: null, tax_rate: null, tax: null, total: null, paid_method: null, cancel_code: null, cancel_dish: null, cancel_note: null, placed_at: REQUIRED, confirmed_at: null, confirmed_by: null, preparing_at: null, ready_at: null, ready_by: null, picked_up_at: null, picked_up_by: null, cancelled_at: null, cancelled_by: null, not_collected_at: null, language: null, customer_id: null, link_token: null, link_expires: null, link_stopped: false, client_key: null },
  order_items: { order_id: REQUIRED, position: null, menu_item_id: REQUIRED, qty: 1, note: null, name: null, unit_price: null, options_total: null, unit_total: null, line_total: null },
  order_item_modifiers: { order_item_id: REQUIRED, modifier_id: REQUIRED, name: null, price_delta: null },
  enquiries: { ref_seq: null, ref: null, status: "new", heads: REQUIRED, wanted_on: REQUIRED, notes: null, name: REQUIRED, phone: REQUIRED, email: REQUIRED, language: null, staff_note: null, handled_by: null, created_at: null, client_key: null },
  messages: { kind: REQUIRED, status: "queued", to_address: null, language: null, order_id: null, enquiry_id: null, customer_id: null, due: null, created_at: null, sent_at: null, error: null, skip_reason: null },
};

export const RULES: Rules = {
  copies: [
    { table: "order_items", column: "name", via: "menu_item_id", parent: "menu_items", from: "name", always: true },
    { table: "order_items", column: "unit_price", via: "menu_item_id", parent: "menu_items", from: "price", always: true },
    { table: "order_item_modifiers", column: "name", via: "modifier_id", parent: "modifiers", from: "name", always: true },
    { table: "order_item_modifiers", column: "price_delta", via: "modifier_id", parent: "modifiers", from: "price_delta", always: true },
  ],
  defaults: [
    { table: "orders", column: "tax_rate", from: "app:settings.tax_rate" },
  ],
  formulas: [
    { table: "orders", column: "tax", scale: "currency", expr: {"round":{"div":[{"mul":["subtotal",{"coalesce":["tax_rate",0]}]},100]}} },
    { table: "orders", column: "total", scale: "currency", expr: {"add":["subtotal",{"coalesce":["tax",0]}]} },
    { table: "order_items", column: "unit_total", scale: "currency", expr: {"add":["unit_price",{"coalesce":["options_total",0]}]} },
    { table: "order_items", column: "line_total", scale: "currency", expr: {"mul":["qty","unit_total"]} },
  ],
  rollups: [
    { table: "orders", column: "item_count", child: "order_items", via: "order_id", sum: "qty", scale: 2 },
    { table: "orders", column: "subtotal", child: "order_items", via: "order_id", sum: "line_total", scale: "currency" },
    { table: "order_items", column: "options_total", child: "order_item_modifiers", via: "order_item_id", sum: "price_delta", scale: "currency" },
  ],
  sequences: [
    { table: "orders", column: "number_seq", scope: null },
    { table: "enquiries", column: "ref_seq", scope: null },
  ],
  formats: [
    { table: "orders", column: "number", from: "number_seq", prefix: null, prefixSetting: null, pad: 0 },
    { table: "enquiries", column: "ref", from: "ref_seq", prefix: "LG-", prefixSetting: null, pad: 4 },
  ],
  codes: [
    { table: "orders", column: "link_token" },
  ],
};
// ── end of the written part ──

// ── the clock ───────────────────────────────────────────────────────────────

interface Ymd {
  y: number;
  m: number;
  d: number;
}

/** How far `zone` is ahead of UTC at `instant`, in ms. */
function zoneOffsetMs(zone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((local - instant) / 60_000) * 60_000;
}

/** The instant of a wall-clock time in `zone`; across a clock change a second pass settles it. */
function zonedWallTime(date: Ymd, time: string, zone: string): number {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(date.y, date.m - 1, date.d, hh, mm);
  const offset = zoneOffsetMs(zone, guess);
  const again = zoneOffsetMs(zone, guess - offset);
  return again === offset ? guess - offset : guess - again;
}

/** Today's date in `zone`, moved by `days`. */
function zonedDay(now: number, zone: string, days: number): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const shifted = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + days));
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/** `n` working days from today in `zone`; day 0 on a weekend is the Monday after. */
function zonedWorkday(now: number, zone: string, n: number): Ymd {
  const today = zonedDay(now, zone, 0);
  const at = new Date(Date.UTC(today.y, today.m - 1, today.d));
  const weekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;
  while (weekend(at)) at.setUTCDate(at.getUTCDate() + 1);
  for (let left = Math.abs(n); left > 0; ) {
    at.setUTCDate(at.getUTCDate() + Math.sign(n));
    if (!weekend(at)) left -= 1;
  }
  return { y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate() };
}

/**
 * Day `dom` of the month `months` from this one in `zone`: the month's last
 * day when it has fewer, and today when that day has not come yet.
 */
export function zonedMonthDay(now: number, zone: string, months: number, dom: number): Ymd & { today: boolean } {
  const today = zonedDay(now, zone, 0);
  const first = new Date(Date.UTC(today.y, today.m - 1 + months, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = { y, m, d: Math.min(dom, last) };
  const later = day.y * 10_000 + day.m * 100 + day.d >= today.y * 10_000 + today.m * 100 + today.d;
  return later ? { ...today, today: true } : { ...day, today: false };
}

/**
 * The first time at or after `instant` on a `grid`-minute step of the
 * kitchen's own clock, counted from its midnight: 12:07 on a 15-minute grid
 * is 12:15, and 12:15 stays 12:15. Never past the next midnight.
 */
export function onVenueGrid(instant: number, grid: number, zone: string): number {
  const local = instant + zoneOffsetMs(zone, instant);
  const midnight = Math.floor(local / 86_400_000) * 86_400_000;
  const step = grid * 60_000;
  const rounded = new Date(midnight + Math.min(Math.ceil((local - midnight) / step) * step, 86_400_000));
  const time = `${pad2(rounded.getUTCHours())}:${pad2(rounded.getUTCMinutes())}`;
  return zonedWallTime({ y: rounded.getUTCFullYear(), m: rounded.getUTCMonth() + 1, d: rounded.getUTCDate() }, time, zone);
}

/** `P[nW][nD][T[nH][nM][nS]]` in ms. */
function durationMs(duration: string): number {
  const match = /^P(?!$)(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.exec(duration);
  if (match === null) throw new Error(`"${duration}" is not an ISO-8601 duration`);
  const n = (part: string | undefined) => (part === undefined ? 0 : Number.parseFloat(part));
  return ((((n(match[1]) * 7 + n(match[2])) * 24 + n(match[4])) * 60 + n(match[5])) * 60 + n(match[6])) * 1000;
}

/** Half an hour either side of the adding moment is "around" it. */
const AROUND_MS = 30 * 60_000;

const pad2 = (n: number) => String(n).padStart(2, "0");
const spellDay = (day: Ymd) => `${String(day.y).padStart(4, "0")}-${pad2(day.m)}-${pad2(day.d)}`;

/** The text for the reader's language: theirs, their language, US English, any. */
export function pickText(texts: Readonly<Record<string, string>>, locale: string): string {
  const tag = locale.replace("_", "-");
  if (texts[tag] !== undefined) return texts[tag]!;
  const language = tag.split("-")[0];
  const near = Object.entries(texts).find(([key]) => key.split("-")[0] === language);
  if (near !== undefined) return near[1];
  return texts["en-US"] ?? Object.values(texts)[0] ?? "";
}

// ── exact arithmetic ────────────────────────────────────────────────────────

/** A fraction of two big integers; `d` is always positive. */
interface Ratio {
  n: bigint;
  d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x === 0n ? 1n : x;
}

function ratio(n: bigint, d: bigint): Ratio {
  if (d < 0n) return ratio(-n, -d);
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/** A stored value as an exact fraction, from its decimal text (never a float product); null when empty. */
function toRatio(value: unknown): Ratio | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return { n: value ? 1n : 0n, d: 1n };
  const text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : typeof value === "string" ? value.trim() : "";
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (match === null) return null;
  const [, sign = "", whole = "", fraction = "", exponent = "0"] = match;
  if (whole === "" && fraction === "") return null;
  let n = BigInt(`${whole}${fraction}` || "0");
  let d = 10n ** BigInt(fraction.length);
  const e = Number.parseInt(exponent, 10);
  if (e > 0) n *= 10n ** BigInt(e);
  else if (e < 0) d *= 10n ** BigInt(-e);
  return ratio(sign === "-" ? -n : n, d);
}

const add = (a: Ratio, b: Ratio) => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Ratio, b: Ratio) => ratio(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Ratio, b: Ratio) => ratio(a.n * b.n, a.d * b.d);
const cmp = (a: Ratio, b: Ratio) => Math.sign(Number(a.n * b.d - b.n * a.d));

/** Round half away from zero to `scale` places. */
function roundTo(value: Ratio, scale: number): Ratio {
  const factor = 10n ** BigInt(scale);
  const scaled = value.n * factor;
  const negative = scaled < 0n;
  const magnitude = negative ? -scaled : scaled;
  let q = magnitude / value.d;
  if ((magnitude % value.d) * 2n >= value.d) q += 1n;
  return ratio(negative ? -q : q, factor);
}

/** A fraction as a number, rounded to `scale` places first. */
function toNumber(value: Ratio, scale: number): number {
  const rounded = roundTo(value, scale);
  const factor = 10n ** BigInt(scale);
  const units = (rounded.n * factor) / rounded.d;
  return Number(units) / Number(factor);
}

/** The decimals a currency is written with: JPY 0, most 2, KWD 3. Unknown → 2. */
export function currencyScale(code: unknown): number {
  if (typeof code !== "string" || !/^[A-Za-z]{3}$/.test(code)) return 2;
  const upper = code.toUpperCase();
  if (["BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF"].includes(upper)) return 0;
  if (["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"].includes(upper)) return 3;
  return 2;
}

function sameValue(stored: unknown, literal: string | number | boolean): boolean {
  if (stored === null || stored === undefined) return false;
  if (typeof literal === "boolean") return stored === literal || stored === (literal ? 1 : 0) || stored === (literal ? "1" : "0") || stored === String(literal);
  if (typeof literal === "number") {
    const a = toRatio(stored);
    const b = toRatio(literal);
    return a !== null && b !== null && cmp(a, b) === 0;
  }
  return String(stored) === literal;
}

function holds(condition: Condition, row: Readonly<Record<string, unknown>>, scale: number): boolean {
  const [op, args] = Object.entries(condition)[0] as [string, unknown];
  switch (op) {
    case "eq": {
      const [column, value] = args as [string, string | number | boolean];
      return sameValue(row[column], value);
    }
    case "neq": {
      const [column, value] = args as [string, string | number | boolean];
      return row[column] !== null && row[column] !== undefined && !sameValue(row[column], value);
    }
    case "isNull": {
      const stored = row[args as string];
      return stored === null || stored === undefined || stored === "";
    }
    case "and":
      return (args as Condition[]).every((c) => holds(c, row, scale));
    case "or":
      return (args as Condition[]).some((c) => holds(c, row, scale));
    default: {
      const [left, right] = (args as [Formula, Formula]).map((side) => evaluate(side, row, scale));
      if (left === null || left === undefined || right === null || right === undefined) return false;
      const order = cmp(left, right);
      return op === "gt" ? order > 0 : op === "gte" ? order >= 0 : op === "lt" ? order < 0 : order <= 0;
    }
  }
}

/** A formula over the row, exactly; null when an input it needs is empty or a divisor is zero. */
function evaluate(expr: Formula, row: Readonly<Record<string, unknown>>, scale: number): Ratio | null {
  if (typeof expr === "number") return toRatio(expr);
  if (typeof expr === "string") return toRatio(row[expr]);
  const [op, args] = Object.entries(expr)[0] as [string, unknown];
  const all = (list: Formula[]): Ratio[] | null => {
    const out: Ratio[] = [];
    for (const item of list) {
      const v = evaluate(item, row, scale);
      if (v === null) return null;
      out.push(v);
    }
    return out;
  };
  switch (op) {
    case "add":
    case "mul":
    case "min":
    case "max": {
      const values = all(args as Formula[]);
      if (values === null) return null;
      return values.reduce((a, b) =>
        op === "add" ? add(a, b) : op === "mul" ? mul(a, b) : op === "min" ? (cmp(a, b) <= 0 ? a : b) : cmp(a, b) >= 0 ? a : b,
      );
    }
    case "sub": {
      const values = all(args as Formula[]);
      return values === null ? null : sub(values[0]!, values[1]!);
    }
    case "div": {
      const values = all(args as Formula[]);
      if (values === null || values[1]!.n === 0n) return null;
      return ratio(values[0]!.n * values[1]!.d, values[0]!.d * values[1]!.n);
    }
    case "round": {
      const [inner, places] = Array.isArray(args) ? (args as [Formula, number]) : [args as Formula, scale];
      const v = evaluate(inner, row, scale);
      return v === null ? null : roundTo(v, places);
    }
    case "coalesce": {
      const [first, second] = args as [Formula, Formula];
      return evaluate(first, row, scale) ?? evaluate(second, row, scale);
    }
    case "if": {
      const [condition, then, otherwise] = args as [Condition, Formula, Formula];
      return evaluate(holds(condition, row, scale) ? then : otherwise, row, scale);
    }
    default:
      return null;
  }
}

/** A formula's value for the row at `scale` places, as a number; null when it has none. */
export function workOut(expr: Formula, row: Readonly<Record<string, unknown>>, scale: number): number | null {
  const value = evaluate(expr, row, scale);
  return value === null ? null : toNumber(value, scale);
}

/** A column's places for this row: its own, or its currency's (the row's, else the connection's). */
function placesOf(scale: Scale, row: Readonly<Record<string, unknown>>, currency: string | undefined): number {
  return scale === "currency" ? currencyScale(row["currency"] ?? currency) : scale;
}

// ── one value, one row ──────────────────────────────────────────────────────

/** An instant, kept as a Date until the row is spelled out, so `@byClock` can compare it. */
type Resolved = unknown;

interface Context extends ResolveOptions {
  labels: Map<string, number>;
  /** The tables resolved so far: the slot limit reads its settings, hours, closures and pauses there. */
  out: ResolvedSample;
  /** How many rows `@slot` has placed on each pickup time, by instant. */
  placed: Map<number, number>;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * The first pickup slot at or after `earliest` that is open and has room, as
 * the loader places a `@slot` time: the grid of `slot_minutes` from each day's
 * opening, the last one starting before its close; never a closed day nor a
 * paused slot; at most `slot_capacity` rows on one time. The plain time when
 * no slot is open in the two weeks from the day before.
 */
function placeOnSlot(earliest: number, ctx: Context): Date {
  const settings = ctx.out["settings"]?.[0] ?? {};
  const step = Number(settings["slot_minutes"] ?? 30);
  const size = Number(settings["slot_capacity"] ?? Number.POSITIVE_INFINITY);
  const hours = new Map((ctx.out["hours"] ?? []).map((row) => [String(row["weekday"]), row]));
  const closures = (ctx.out["closures"] ?? []).filter((row) => row["active"] === true);
  const paused = new Set((ctx.out["slot_pauses"] ?? []).filter((row) => row["active"] === true).map((row) => Date.parse(String(row["slot_at"]))));
  const first = zonedDay(earliest, ctx.zone, -1);
  for (let i = 0; i < 16; i += 1) {
    const date = new Date(Date.UTC(first.y, first.m - 1, first.d + i));
    const day = { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
    const spelled = spellDay(day);
    const open = hours.get(WEEKDAYS[date.getUTCDay()]!);
    if (open === undefined || open["open"] !== true) continue;
    if (closures.some((row) => String(row["from_date"]) <= spelled && (row["to_date"] === null || spelled <= String(row["to_date"])))) continue;
    const [opens, closes] = [String(open["opens"]), String(open["closes"])].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))) as [number, number];
    for (let minute = opens; step > 0 && minute < closes; minute += step) {
      const at = zonedWallTime(day, `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`, ctx.zone);
      if (at < earliest || paused.has(at) || (ctx.placed.get(at) ?? 0) + 1 > size) continue;
      ctx.placed.set(at, (ctx.placed.get(at) ?? 0) + 1);
      return new Date(at);
    }
  }
  return new Date(earliest);
}

function resolveValue(value: unknown, ctx: Context): Resolved {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (typeof record["@ref"] === "string") {
    const id = ctx.labels.get(record["@ref"]);
    if (id === undefined) throw new Error(`The sample row "${record["@ref"]}" was not written.`);
    return id;
  }
  if (typeof record["@ago"] === "string") return new Date(ctx.now - durationMs(record["@ago"]));
  if (typeof record["@in"] === "string") {
    const at = ctx.now + durationMs(record["@in"]);
    if (typeof record["@slot"] === "string") return placeOnSlot(at, ctx);
    return typeof record["@grid"] === "number" ? new Date(onVenueGrid(at, record["@grid"], ctx.zone)) : new Date(at);
  }
  if (typeof record["@day"] === "number") {
    const day = record["@workdays"] === true ? zonedWorkday(ctx.now, ctx.zone, record["@day"]) : zonedDay(ctx.now, ctx.zone, record["@day"]);
    if (typeof record["@time"] === "string") return new Date(zonedWallTime(day, record["@time"], ctx.zone));
    return spellDay(day);
  }
  if (typeof record["@month"] === "number" && typeof record["@dom"] === "number") {
    const day = zonedMonthDay(ctx.now, ctx.zone, record["@month"], record["@dom"]);
    if (typeof record["@time"] !== "string") return spellDay(day);
    const at = zonedWallTime(day, record["@time"], ctx.zone);
    // A time on today that has not come yet is now: a month's history never runs into the future.
    return new Date(day.today && at > ctx.now ? ctx.now : at);
  }
  if (typeof record["@t"] === "object" && record["@t"] !== null) return pickText(record["@t"] as Record<string, string>, ctx.locale);
  if (typeof record["@asset"] === "string") throw new Error(`The sample asset "${record["@asset"]}" cannot be shown without a server.`);
  return value;
}

/** One row with its directives resolved, or null when its `@byClock` set leaves it out. */
function resolveRow(row: Readonly<Record<string, unknown>>, ctx: Context): Record<string, Resolved> | null {
  let values: Readonly<Record<string, unknown>> = row;
  const clock = row["@byClock"] as { at: unknown; before?: Record<string, unknown>; around?: Record<string, unknown>; after?: Record<string, unknown> } | undefined;
  if (clock !== undefined) {
    const when = resolveValue(typeof clock.at === "string" ? row[clock.at] : clock.at, ctx);
    const instant = when instanceof Date ? when.getTime() : Number.NaN;
    const branch = Number.isNaN(instant)
      ? undefined
      : instant < ctx.now - AROUND_MS
        ? clock.before
        : instant <= ctx.now + AROUND_MS
          ? clock.around
          : clock.after;
    if (branch?.["@skip"] === true) return null;
    const { ["@skip"]: _skip, ...columns } = branch ?? {};
    values = { ...row, ...columns };
  }
  const out: Record<string, Resolved> = {};
  for (const [column, value] of Object.entries(values)) {
    if (column === "@label" || column === "@byClock" || column === "@onlyIfEmpty") continue;
    out[column] = resolveValue(value, ctx);
  }
  return out;
}

const spell = (value: Resolved): unknown => (value instanceof Date ? value.toISOString() : value);

/**
 * A setting a column falls back to: the connection's currency, a column of
 * the app's own settings row (`app:<table>.<column>`, as resolved so far), or
 * an add-on's setting.
 */
function settingValue(name: string, options: ResolveOptions, out?: ResolvedSample): unknown {
  if (name === "connection.currency") return options.currency;
  const own = /^app:([a-z_]+)\.([a-z_]+)$/.exec(name);
  if (own !== null) return out?.[own[1]!]?.[0]?.[own[2]!] ?? undefined;
  return options.settings?.[name];
}

// ── the whole bundle ────────────────────────────────────────────────────────

/** Every table of the bundle, as Adminium would have written it at `now`. */
export function resolveSample(bundle: SampleBundleRows, options: ResolveOptions): ResolvedSample {
  const out: ResolvedSample = {};
  const ctx: Context = { ...options, labels: new Map(), out, placed: new Map() };
  const rowById = (table: string, id: unknown) => out[table]?.find((candidate) => candidate["id"] === id);
  for (const table of bundle.tables) {
    const shape = COLUMNS[table.ref];
    if (shape === undefined) throw new Error(`"${table.ref}" is not a table of this app.`);
    const rows = (out[table.ref] ??= []);
    for (const row of table.rows) {
      const values = resolveRow(row, ctx);
      if (values === null) continue;
      for (const column of Object.keys(values)) {
        if (!(column in shape)) throw new Error(`"${table.ref}" has no column "${column}".`);
      }
      // A copy through the row's link, from a row written earlier: always, or when the row names none.
      for (const copy of RULES.copies) {
        if (copy.table !== table.ref || (!copy.always && values[copy.column] !== undefined)) continue;
        const link = values[copy.via];
        if (link === null || link === undefined) continue;
        const source = rowById(copy.parent, link);
        if (source !== undefined) values[copy.column] = source[copy.from];
      }
      // A setting the column falls back to when it is still empty.
      for (const fallback of RULES.defaults) {
        if (fallback.table !== table.ref || (values[fallback.column] !== undefined && values[fallback.column] !== null)) continue;
        const setting = settingValue(fallback.from, options, out);
        if (setting !== undefined) values[fallback.column] = setting;
      }
      // A running number the row leaves out: the largest so far (in its scope) + 1.
      for (const sequence of RULES.sequences) {
        if (sequence.table !== table.ref || values[sequence.column] !== undefined) continue;
        const peers = rows.filter((peer) => sequence.scope === null || peer[sequence.scope] === values[sequence.scope]);
        values[sequence.column] = Math.max(0, ...peers.map((peer) => Number(peer[sequence.column] ?? 0))) + 1;
      }
      for (const format of RULES.formats) {
        if (format.table !== table.ref || values[format.column] !== undefined) continue;
        const number = values[format.from];
        const prefix = format.prefix ?? (format.prefixSetting === null ? undefined : settingValue(format.prefixSetting, options));
        if (typeof number === "number" && typeof prefix === "string") values[format.column] = `${prefix}${String(number).padStart(format.pad, "0")}`;
      }
      const id = rows.length + 1;
      const record: ResolvedRow = { id };
      for (const [column, fill] of Object.entries(shape)) {
        const value = values[column];
        if (value !== undefined) record[column] = spell(value);
        else if (fill === REQUIRED) throw new Error(`A sample row for "${table.ref}" has no "${column}".`);
        else record[column] = fill === NOW ? new Date(options.now).toISOString() : fill;
      }
      rows.push(record);
      const label = row["@label"];
      if (typeof label === "string") ctx.labels.set(label, id);
    }
  }
  settle(out, options);
  return out;
}

/**
 * Every total, from every row that feeds it — last, as the loader does. A
 * document's tax reads its subtotal, a stage line's rate reads its proposal's
 * total, so the rules run again until nothing moves (a handful of passes).
 */
function settle(out: ResolvedSample, options: ResolveOptions): void {
  const order = [...Object.keys(COLUMNS)];
  for (let pass = 0; pass < 12; pass += 1) {
    let moved = false;
    const put = (row: ResolvedRow, column: string, value: unknown) => {
      if (row[column] === value) return;
      row[column] = value;
      moved = true;
    };
    for (const table of order) {
      const rows = out[table] ?? [];
      for (const row of rows) {
        for (const copy of RULES.copies) {
          if (copy.table !== table || !copy.always || row[copy.via] === null || row[copy.via] === undefined) continue;
          const source = out[copy.parent]?.find((candidate) => candidate["id"] === row[copy.via]);
          if (source !== undefined) put(row, copy.column, source[copy.from]);
        }
        for (const formula of formulaOrder(table)) {
          put(row, formula.column, workOut(formula.expr, row, placesOf(formula.scale, row, options.currency)));
        }
      }
      for (const rollup of RULES.rollups) {
        if (rollup.table !== table) continue;
        for (const row of rows) {
          let total: Ratio = { n: 0n, d: 1n };
          for (const child of out[rollup.child] ?? []) {
            if (child[rollup.via] !== row["id"]) continue;
            if (rollup.where !== undefined && !sameValue(child[rollup.where.column], rollup.where.eq as string | number | boolean)) continue;
            const amount = toRatio(child[rollup.sum]);
            if (amount !== null) total = add(total, amount);
          }
          const places = placesOf(rollup.scale, row, options.currency);
          put(row, rollup.column, toNumber(total, places));
          if (rollup.balance !== undefined) {
            const of = toRatio(row[rollup.balance.of]);
            put(row, rollup.balance.column, of === null ? null : toNumber(sub(of, total), places));
          }
        }
      }
    }
    if (!moved) return;
  }
  throw new Error("The sample's totals did not settle.");
}

/** A table's formulas in the order they can be worked out: each after every formula column it reads. */
function formulaOrder(table: string): Rules["formulas"] {
  const own = RULES.formulas.filter((formula) => formula.table === table);
  const byColumn = new Map(own.map((formula) => [formula.column, formula]));
  const done: Rules["formulas"] = [];
  const reads = (node: unknown, found: Set<string>): Set<string> => {
    if (typeof node === "string") found.add(node);
    else if (Array.isArray(node)) node.forEach((child) => reads(child, found));
    else if (typeof node === "object" && node !== null) Object.values(node).forEach((child) => reads(child, found));
    return found;
  };
  const visit = (formula: Rules["formulas"][number]) => {
    if (done.includes(formula)) return;
    for (const name of reads(formula.expr, new Set())) {
      const before = byColumn.get(name);
      if (before !== undefined && before !== formula) visit(before);
    }
    done.push(formula);
  };
  own.forEach(visit);
  return done;
}
