/**
 * The columns a staff read spells its own way on some engines, by table: the
 * moments (SQLite hands them back as the server's wall time, with no zone)
 * and the yes/no columns (SQLite and MySQL hand back 0 or 1). The kitchen's
 * door reads them back as every screen expects — an instant in ISO, a
 * boolean. Held to the manifest's column types by `columnKinds.test.ts`.
 */
export const MOMENTS: Readonly<Record<string, readonly string[]>> = {
  slot_pauses: ["slot_at", "paused_at"],
  customers: ["forgotten_at", "created_at"],
  orders: ["pickup_at", "placed_at", "confirmed_at", "preparing_at", "ready_at", "picked_up_at", "cancelled_at", "not_collected_at", "link_expires"],
  enquiries: ["created_at"],
  messages: ["due", "created_at", "sent_at"],
};

export const YES_NO: Readonly<Record<string, readonly string[]>> = {
  settings: ["online_on", "ready_email_on", "receipt_email_on"],
  menu_items: ["available", "featured", "online"],
  modifiers: ["available"],
  hours: ["open"],
  closures: ["active"],
  slot_pauses: ["active"],
  orders: ["link_stopped"],
};

/** A yes/no as a boolean: SQLite and MySQL (and an Adminium before 0.3.9 on any door) hand back 0 or 1. */
export const yesNo = (value: unknown): unknown =>
  value === null || value === undefined || typeof value === "boolean" ? value : value === 1 || value === "1" || value === "true";

/** Every yes/no column's name, whichever table it is on: no other column of the app shares one. */
export const YES_NO_NAMES: ReadonlySet<string> = new Set(Object.values(YES_NO).flat());

/** A row with its yes/no columns as booleans, for a door that reads rows by ref rather than by table. */
export function withYesNo<T extends Record<string, unknown>>(row: T): T {
  let out: Record<string, unknown> | null = null;
  for (const name of YES_NO_NAMES) {
    if (!(name in row)) continue;
    const read = yesNo(row[name]);
    if (read === row[name]) continue;
    out ??= { ...row };
    out[name] = read;
  }
  return (out ?? row) as T;
}
