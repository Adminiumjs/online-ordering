/**
 * What goes over the wire, as Adminium's APIs answer it — the one shape every
 * screen reads, whichever Adminium answers: the real one, or the demo's
 * stand-in (`src/demo/`).
 *
 * Rows are the table's columns by their names (`pickup_at`, `line_total`),
 * as the entry's `select` lets them out. Instants are ISO strings, dates
 * `YYYY-MM-DD` on the kitchen's calendar, money a decimal string or number.
 * A refusal is an {@link ApiError}: its HTTP status, its code, and its
 * params — the code is the contract, never the message.
 */

export type Id = number;

/** A row as an API answers it. */
export type Row = Record<string, unknown> & { id: Id };

// ── the public API ──────────────────────────────────────────────────────────

/** `/public/config`: the kitchen's zone and money, and the refs the key reaches. */
export interface PublicConfig {
  timezone: string;
  currency: string | null;
  /** The server's clock, when it says it. */
  now?: string;
}

/** A pickup time of a day: free, full (or too soon, or past), or paused. */
export interface SlotTime {
  /** `HH:MM` on the kitchen's clock. */
  time: string;
  state: "free" | "full" | "paused";
}

/** A dish's portions on a day: on sale, or sold out; `left` only when few are. */
export interface DishState {
  id: string;
  state: "on" | "soon" | "ended" | "soldout";
  left?: number;
}

/** One child row of a create, and the rows below it. */
export interface TreeRow {
  values: Record<string, unknown>;
  children?: Record<string, { values: Record<string, unknown> }[]>;
}

/** An order with its lines and each line's options, as a create sends it. */
export interface OrderBody {
  values: Record<string, unknown>;
  children: { order_items: TreeRow[] };
  /** The total the diner was shown, as a decimal string: a different one writes nothing. */
  expect?: { total: string };
}

/** A written row of a tree, and its own rows below. */
export interface TreeReplyRow {
  data: Record<string, unknown>;
  children?: Record<string, { data: Record<string, unknown> }[]>;
}

/** A create's reply: the order, its lines and options; `replayed` for a retry of one already made. */
export interface OrderReply {
  data: Row;
  children?: { order_items?: TreeReplyRow[] };
  replayed?: true;
  /** The order's own link, answered once, on the first create (never on a replay). */
  link?: { key: string; token: string };
}

/** A dry run's reply: every figure a save would write, and how the limits it takes from stand. */
export interface QuoteReply {
  data: Record<string, unknown>;
  children?: { order_items?: TreeReplyRow[] };
  capacity: { pool: string; state: "available" | "full"; at?: string }[];
  exact: boolean;
}

/** A session a claim opens (the order's link, a sign-in). */
export interface ClaimReply {
  session: string;
  expiresAt: number;
  firstName?: string;
}

// ── the staff API ───────────────────────────────────────────────────────────

/** What a slot of a day holds, as the kitchen's counts answer it. */
export interface SlotCount {
  /** `HH:MM` on the kitchen's clock. */
  time: string;
  /** The instant, ISO. */
  at: string;
  taken: number;
  size: number;
  /** The paused-slot row, when the slot is paused. */
  pause: { id: Id; by: string | null; /** When it was paused, ISO (absent from an older port). */ at?: string | null } | null;
}

/** A change the live stream announces: which row of which table, and how. */
export interface LiveFrame {
  table: string;
  id: Id;
  op: "insert" | "update" | "delete";
}

// ── refusals ────────────────────────────────────────────────────────────────

/** A refusal, as either API answers it: its status, its code, its params. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
  constructor(status: number, code: string, message: string, params: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "ApiError");

/** The line of a refused order a refusal names: `path` `['order_items', 1, …]`. */
export function refusedLine(error: ApiError): number | null {
  const path = error.params["path"];
  if (Array.isArray(path) && path[0] === "order_items" && typeof path[1] === "number") return path[1];
  const index = error.params["index"];
  return error.params["child"] === "order_items" && typeof index === "number" ? index : null;
}
