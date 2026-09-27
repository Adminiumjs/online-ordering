/**
 * The two doors the screens go through — one per side of the app, each the
 * calls that side makes and nothing else.
 *
 *   DinerPort    the order page: the public API through the kitchen's
 *                browser key (the menu, the slots, placing an order, the
 *                order's own link, signing in, a large-order enquiry);
 *   KitchenPort  the kitchen's screens: the data API as a signed-in person
 *                (the board, moves and cancels, hand-offs, slots and pauses,
 *                today's menu, phone orders, the hours).
 *
 * Every answer is a wire shape (`wire.ts`) and every refusal an `ApiError`
 * carrying Adminium's code, so a screen has one path whoever answers: the
 * real server, or the demo's stand-in, which plays the same rules.
 */
import type { ClaimReply, DishState, Id, LiveFrame, OrderBody, OrderReply, PublicConfig, QuoteReply, Row, SlotCount, SlotTime } from "./wire.ts";

/** The menu as the order page reads it: only what is on, and sold online. */
export interface Menu {
  categories: Row[];
  items: Row[];
  groups: Row[];
  options: Row[];
}

/** An order with its lines, and each line with its options. */
export interface OrderWithLines {
  order: Row;
  lines: (Row & { options: Row[] })[];
}

export interface DinerPort {
  config(): Promise<PublicConfig>;
  settings(): Promise<Row>;
  menu(): Promise<Menu>;
  hours(): Promise<Row[]>;
  closures(): Promise<Row[]>;

  /** Each pickup time of a day (`YYYY-MM-DD`). */
  slots(date: string): Promise<SlotTime[]>;
  /** Each dish's portions on a day; `qty` asks whether that many are left. */
  dishes(date: string, qty?: number): Promise<DishState[]>;

  /** The order priced by Adminium, written nowhere. */
  quote(body: OrderBody): Promise<QuoteReply>;
  /** The order placed. `clientKey` makes a retry land on the same order. */
  place(body: OrderBody, clientKey: string): Promise<OrderReply>;

  /** Opens the order behind its own link (the code in the link's fragment). */
  openLink(token: string): Promise<ClaimReply>;
  /** The order the link opened. */
  linkedOrder(): Promise<OrderWithLines>;
  /** Cancels the order the link opened, while the kitchen has not taken it. */
  cancelLinked(id: Id): Promise<Row>;

  /** Emails a sign-in link (and a code) to an address; the same answer whoever it is. */
  requestSignIn(email: string, lang?: string): Promise<{ sentTo: string }>;
  /** Signs in with the emailed link. */
  verifyLink(token: string): Promise<ClaimReply>;
  /** Signs in with the emailed code, typed on another device. */
  verifyCode(email: string, code: string): Promise<ClaimReply>;
  /** Whether this browser holds a sign-in session, and whose. */
  signedIn(): Promise<{ email: string; name: string | null; at: string } | null>;
  /** The signed-in diner's orders, newest first. */
  myOrders(): Promise<OrderWithLines[]>;
  /** Cancels one of the signed-in diner's orders, while the kitchen has not taken it. */
  cancelMine(id: Id): Promise<Row>;
  signOut(): Promise<void>;
  signOutEverywhere(): Promise<void>;
  /** Empties the diner's details; a sign-in older than ten minutes is asked to sign in again first. */
  forget(): Promise<void>;

  /** A large-order enquiry, sent. */
  enquire(values: Record<string, unknown>, clientKey: string): Promise<Row>;
}

/** Who is signed in to the kitchen, and what they may do. */
export interface KitchenPerson {
  name: string;
  roles: string[];
}

export interface KitchenPort {
  me(): Promise<KitchenPerson>;
  config(): Promise<{ timezone: string | null; currency: string | null }>;
  settings(): Promise<Row>;
  hours(): Promise<Row[]>;
  closures(): Promise<Row[]>;
  menu(): Promise<Menu & { all: true }>;

  /** The orders picked up between two days (`YYYY-MM-DD`, both included), with lines and options. */
  orders(from: string, to: string): Promise<OrderWithLines[]>;
  order(id: Id): Promise<OrderWithLines>;

  /** A move of an order's state; `from` is the state the screen showed. */
  move(id: Id, from: string, to: string): Promise<Row>;
  cancel(id: Id, from: string, code: string, dish: string | null, note: string | null): Promise<Row>;
  handOff(id: Id, paid: "cash" | "card"): Promise<Row>;

  /** Each slot of a day and what it holds. */
  slotCounts(date: string): Promise<SlotCount[]>;
  /** How many of each dish the orders of a day hold. */
  dishCounts(date: string): Promise<Record<string, number>>;
  pause(at: string): Promise<Row>;
  reopen(pauseId: Id): Promise<Row>;

  setDish(id: Id, values: { available?: boolean; stock_today?: number | null; stock_on?: string | null; online?: boolean }): Promise<Row>;
  setOption(id: Id, available: boolean): Promise<Row>;

  /** An order taken by phone, with its lines and options. */
  phoneOrder(body: OrderBody): Promise<OrderReply>;

  /** A manager's: the hours, the closures, taking online orders. */
  setHours(id: Id, values: { open?: boolean; opens?: string; closes?: string }): Promise<Row>;
  addClosure(values: { from_date: string; to_date: string; reason: string | null }): Promise<Row>;
  setClosure(id: Id, active: boolean): Promise<Row>;
  setOnline(on: boolean): Promise<Row>;

  /** The public holidays Holiday calendars offers, when it is installed. */
  holidays(): Promise<{ date: string; name: string }[] | null>;

  /** Every change the live stream announces; returns the unsubscribe. */
  subscribe(listener: (frame: LiveFrame) => void, onState?: (state: "live" | "reconnecting") => void): () => void;
}
