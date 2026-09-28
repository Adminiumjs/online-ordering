/**
 * A kitchen stood up for a contract: the BUILT Adminium booted on one engine,
 * this app installed on it as an operator installs it (with the add-ons the
 * check names, ticked in the install), the kitchen's clock and money set, the
 * sample added a moment before 11:40, the public API on and the links in its
 * emails pointed at it — and the app's own two doors onto it, booted as the
 * builds boot them.
 *
 * Tests and scratch servers only; nothing that ships imports it.
 */
import { AdminiumDiner } from "../data/adminiumDiner.ts";
import { AdminiumKitchen } from "../data/adminiumKitchen.ts";
import { createSessionTransport } from "../data/sessionSource.ts";
import type { Row } from "../data/wire.ts";
import { DEMO_CURRENCY, DEMO_START, DEMO_ZONE } from "../demo/world.ts";
import { loadStaffConfig, type StaffConfig } from "../staffConnection.ts";
import { addOnBundle, appBundle, boot, Caller, ok, until, type Engine, type Server } from "./harness.ts";

export const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };

/** One email the server's mail sink caught. */
export interface Mail {
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; contentType: string; size: number }[];
}

export interface Stand {
  server: Server;
  staff: Caller;
  connectionId: string;
  /** The app's tables by their manifest name, as this server keys them. */
  ids: Record<string, string>;
  cfg: StaffConfig;
  kitchen: AdminiumKitchen;
  /** A fresh order page in a fresh tab, booted from the customer config as the customer build boots it. */
  dinerOf(): Promise<AdminiumDiner>;
  /** The kitchen's door booted again: what a tablet reads after a reload (the add-ons' settings, say). */
  kitchenAgain(): Promise<AdminiumKitchen>;
  data(ref: string): string;
  rows(ref: string): Promise<Row[]>;
  order(number: string): Promise<Row>;
  messagesOf(orderId: unknown): Promise<Row[]>;
  /** The server's own moment, as its staff config says it. */
  now(): Promise<number>;
  /** How many emails the sink holds; the next one to an address after that many. */
  mailCount(): Promise<number>;
  mailTo(address: string, after: number, ms?: number): Promise<Mail>;
  /** Every email to an address after that many, once at least `n` are there. */
  mailsTo(address: string, after: number, n: number, ms?: number): Promise<Mail[]>;
}

/** A tab's storage, for the order page's door. */
export function tab(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

export async function standUp(engine: Engine, port: number, database: string, options: { addOns?: string[]; built?: boolean } = {}): Promise<Stand> {
  const server = await boot(engine, port, DEMO_START - 60_000, { database });
  const staff = new Caller(server.base, { origin: server.base });
  await staff.signIn(ADMIN.email, ADMIN.password);
  const connectionId = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections")).connections.find((c) => c.name === "northwind")!.id;

  // A suggested add-on goes in with the app only when the install lists it (the box the operator ticks).
  const listed: { key: string; version: string }[] = [];
  for (const key of options.addOns ?? []) {
    const addOn = addOnBundle(key);
    const staged = await staff.post(`/api/v1/add-ons/upload?expectedSha512=${encodeURIComponent(addOn.integrity)}`, addOn.buffer);
    if (![200, 201].includes(staged.status)) throw new Error(`add-on upload ${key}: ${JSON.stringify(staged.body).slice(0, 400)}`);
    listed.push({ key: addOn.key, version: addOn.version });
  }
  const app = appBundle({ built: options.built === true });
  const staged = await staff.post(`/api/v1/apps/upload?expectedSha512=${encodeURIComponent(app.integrity)}`, app.buffer);
  if (![200, 201].includes(staged.status)) throw new Error(`upload: ${JSON.stringify(staged.body).slice(0, 400)}`);
  const body = { key: app.key, version: app.version, connectionId };
  const plan = ok(await staff.post<{ plan: { checksum: string } }>("/api/v1/apps/plan", body)).plan;
  const installed = ok(
    await staff.post<{ schema: { created: string[] }; rules: { skipped: unknown[] } }>("/api/v1/apps/install", { ...body, planChecksum: plan.checksum, ...(listed.length === 0 ? {} : { addOns: listed }) }),
  );
  if (installed.rules.skipped.length > 0) throw new Error(`the install skipped rules: ${JSON.stringify(installed.rules.skipped).slice(0, 1500)}`);
  ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: DEMO_CURRENCY }));
  const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connectionId}/schema`));
  const ids: Record<string, string> = {};
  for (const name of installed.schema.created) ids[name.replace(/^ordering_/, "")] = schema.model.tables.find((t) => t.name === name)!.id;

  // The sample is written for 11:40 on the dot: the clock stands there while it goes in, then runs on.
  await server.setClock(DEMO_START, true);
  ok(await staff.post("/api/v1/apps/ordering/sample-data"));
  await until(async () => (ok(await staff.get<{ loaded: boolean }>("/api/v1/apps/ordering/sample-data")).loaded ? true : undefined), "the sample to be added");
  await server.setClock(DEMO_START);
  ok(await staff.put("/api/v1/public-api", { enabled: true }));
  // Where the links in its emails point.
  ok(await staff.put("/api/v1/settings/email", { publicOrigin: server.base }));

  const kitchenAgain = async (): Promise<AdminiumKitchen> => {
    const cfg = (await loadStaffConfig({ hostedStaff: true, base: "/apps/ordering/staff/", fetchImpl: staff.fetchAs() }))!;
    const transport = createSessionTransport({
      tableOfRef: cfg.tables,
      connectionId: cfg.connectionId ?? undefined,
      staff: { csrfToken: cfg.csrfToken, timezone: cfg.timezone, timezoneSource: cfg.timezoneSource, serverTimezone: cfg.serverTimezone, currency: cfg.currency },
      fetchImpl: staff.fetchAs(),
    });
    const door = new AdminiumKitchen(transport, cfg);
    // As the kitchen's screens start: its configuration first (the session's write token comes with it).
    await door.config();
    return door;
  };
  const cfg = (await loadStaffConfig({ hostedStaff: true, base: "/apps/ordering/staff/", fetchImpl: staff.fetchAs() }))!;
  if (cfg.user === null) throw new Error("the staff surface config names no one signed in");
  const kitchen = await kitchenAgain();

  const served = ok(await new Caller(server.base).get<{ publishableKey: string; publicKeys?: Record<string, string>; tables?: Record<string, string> }>("/apps/ordering/customer/surface-config.json"));
  const originFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("origin", server.base);
    return fetch(input, { ...init, headers });
  };
  const dinerOf = async () =>
    new AdminiumDiner(
      { baseUrl: server.base, publishableKey: served.publishableKey, ...(served.tables === undefined ? {} : { tables: served.tables }), ...(served.publicKeys === undefined ? {} : { publicKeys: served.publicKeys }) },
      { fetch: originFetch, storage: tab() },
    );

  const data = (ref: string) => `/api/v1/data/${connectionId}/${encodeURIComponent(ids[ref]!)}`;
  const rows = async (ref: string): Promise<Row[]> => {
    const out: Row[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = ok(await staff.get<{ data: Row[] }>(`${data(ref)}?limit=200&offset=${String(offset)}`)).data;
      out.push(...page);
      if (page.length < 200) return out;
    }
  };
  const inbox = async () => (await (await fetch(`${server.sink}/messages`)).json()) as Mail[];
  // The sink stamps each email with the server's (moved) clock: new mail is picked by its place in the list.
  const mailsTo = (address: string, after: number, n: number, ms = 150_000) =>
    until(async () => {
      const found = (await inbox()).slice(after).filter((m) => m.to.includes(address));
      return found.length >= n ? found : undefined;
    }, `${String(n)} email(s) to ${address}`, ms);

  return {
    server,
    staff,
    connectionId,
    ids,
    cfg,
    kitchen,
    dinerOf,
    kitchenAgain,
    data,
    rows,
    order: async (number) => (await rows("orders")).find((o) => o["number"] === number)!,
    messagesOf: async (orderId) => (await rows("messages")).filter((m) => String(m["order_id"]) === String(orderId)),
    now: async () => Date.parse(String((await staff.get<{ now: string }>("/apps/ordering/staff/surface-config.json")).body.now)),
    mailCount: async () => (await inbox()).length,
    mailTo: async (address, after, ms) => (await mailsTo(address, after, 1, ms))[0]!,
    mailsTo,
  };
}
