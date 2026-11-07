/**
 * A SECOND INSTALL OF THE KITCHEN: the same bundle, served at another
 * database's mount, must say it is that install on every call.
 *
 * Adminium installs one app once per database. Each install's staff side is
 * served at its own mount (`/apps/ordering/<slug>/staff/`) with its own
 * `surface-config.json`, naming its `installId`. The kitchen reads that
 * document from the mount it was opened at and sends the id back as
 * `X-Adminium-Install`, so the server answers Inventory's stock words and
 * takes a gift card's payment for THIS restaurant (with two installs and no
 * header, the words route answers 409).
 */
import { describe, expect, it, vi } from "vitest";

import { AdminiumKitchen } from "./data/adminiumKitchen.ts";
import { createSessionTransport, INSTALL_HEADER } from "./data/sessionSource.ts";
import { configBase, loadStaffConfig } from "./staffConnection.ts";

const BAKED = "/apps/ordering/staff/";

/** Two installs' documents, each at its own mount. */
const addOns = { inventory: { version: "1.0.19", settings: {} }, offers: { version: "1.0.19", settings: {} } };
const DOCS: Record<string, unknown> = {
  "/apps/ordering/staff/surface-config.json": { connectionId: "conn-1", installId: "install-1", csrfToken: "tok-1", timezone: "Europe/London", addOns },
  "/apps/ordering/kiln/staff/surface-config.json": { connectionId: "conn-2", installId: "install-2", csrfToken: "tok-2", timezone: "Europe/Lisbon", addOns },
};

interface Sent {
  url: string;
  headers: Record<string, string>;
}

function server() {
  const sent: Sent[] = [];
  const fetchImpl = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const path = url.split("?")[0] ?? url;
    const payload =
      DOCS[path] ??
      (path.startsWith("/api/v1/words/")
        ? { data: [{ id: "4", state: "low", exact: "2" }] }
        : path.endsWith("payments/dry-run")
          ? { data: {}, payment: { amount: "5.00", due: "0.00" } }
          : { data: [] });
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

async function kitchenAt(pathname: string) {
  const { sent, fetchImpl } = server();
  const staff = await loadStaffConfig({ hostedStaff: true, base: configBase(BAKED, pathname), fetchImpl });
  if (staff === null) throw new Error("no staff config");
  // Built the way `data/live.ts` builds the kitchen's transport.
  const transport = createSessionTransport({
    tableOfRef: staff.tables,
    connectionId: staff.connectionId ?? undefined,
    installId: staff.installId,
    ...(staff.csrfToken === null ? {} : { staff: { csrfToken: staff.csrfToken, timezone: staff.timezone } }),
    fetchImpl,
  });
  const kitchen = new AdminiumKitchen(transport, staff);
  await kitchen.config();
  return { staff, kitchen, sent };
}

describe("a second install of the kitchen", () => {
  it("reads its own install from its own mount", async () => {
    const first = await kitchenAt("/apps/ordering/staff/orders");
    const second = await kitchenAt("/apps/ordering/kiln/staff/orders");
    expect([first.staff.installId, first.staff.connectionId]).toEqual(["install-1", "conn-1"]);
    expect([second.staff.installId, second.staff.connectionId]).toEqual(["install-2", "conn-2"]);
  });

  it("says which install it is on Inventory's stock words and a gift card's payment", async () => {
    const { kitchen, sent } = await kitchenAt("/apps/ordering/kiln/staff/orders");
    const before = sent.length;
    expect(await kitchen.stockWords([4])).toEqual([{ id: "4", state: "low", exact: 2 }]);
    await kitchen.cardCheck(9, "GIFT-1");
    const calls = sent.slice(before);
    expect(calls.map((c) => c.url.split("?")[0])).toEqual(["/api/v1/words/inventory/stock", "/api/v1/data/conn-2/ordering_payments/dry-run"]);
    for (const call of calls) expect(call.headers[INSTALL_HEADER]).toBe("install-2");
  });

  it("sends no install header when an older Adminium names no install", async () => {
    const { sent, fetchImpl } = server();
    const transport = createSessionTransport({ tableOfRef: {}, connectionId: "conn-1", installId: null, staff: { csrfToken: "tok-1" }, fetchImpl });
    await transport.get("/api/v1/words/inventory/stock?table=x&ids=1");
    expect(sent.every((c) => !(INSTALL_HEADER in c.headers))).toBe(true);
  });
});
