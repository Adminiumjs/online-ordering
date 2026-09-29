/**
 * The order page's door over a fake public API: the refs it names, the
 * sessions it keeps for the tab (one per key), and the answers it reads back.
 */
import { describe, expect, it } from "vitest";

import { AdminiumDiner } from "./adminiumDiner.ts";
import { ApiError } from "./wire.ts";

const BASE = "https://kitchen.example";
const served = { baseUrl: BASE, publishableKey: "adm_pub_customer", tables: { orders: "ordering_orders" }, publicKeys: { link: "adm_pub_link" } };

/** Session storage as a tab has it. */
function tab(): Storage {
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

type Seen = { method: string; path: string; key: string | null; session: string | null; body: unknown };

/** A public API answering by method and path; every request kept. */
function fakeApi(route: (seen: Seen) => { status?: number; body: unknown } | undefined) {
  const seen: Seen[] = [];
  const fetch: typeof globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const s: Seen = {
      method: (init?.method ?? "GET").toUpperCase(),
      path: url.pathname.replace("/api/v1/public", ""),
      key: headers.get("authorization"),
      session: headers.get("x-adminium-public-session"),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : null,
    };
    seen.push(s);
    const reply = route(s) ?? (s.path === "/challenge" ? { body: { data: { id: "ch", salt: "s", difficulty: 1, expiresAt: Date.now() + 60_000 } } } : { status: 404, body: { error: { code: "PUBLIC_REF_NOT_FOUND", message: "no" } } });
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { fetch, seen };
}

const PLACED = {
  data: { id: 118, number: "2118", total: "23.27", pickup_at: "2026-07-28T19:00:00.000Z" },
  children: { order_items: [] },
  link: { key: "link", token: "LINKCODE12345678", session: "link-session", expiresAt: Date.now() + 30 * 60_000 },
};

describe("placing an order", () => {
  it("sends the price shown and the retry key with the save, never with the quote", async () => {
    const api = fakeApi((s) => (s.path.endsWith("/dry-run") ? { body: { data: { total: "23.27" }, children: {}, capacity: [], exact: true } } : s.method === "POST" && s.path === "/records/ordering_orders_verified_2" ? { status: 201, body: PLACED } : undefined));
    const diner = new AdminiumDiner(served, { fetch: api.fetch, storage: tab() });
    const body = { values: { pickup_at: "2026-07-28T19:00:00.000Z" }, children: { order_items: [{ values: { menu_item_id: 3, qty: 1 } }] }, expect: { total: "23.27" } };
    await diner.quote(body);
    await diner.place(body, "k".repeat(32));
    const [quote, save] = api.seen.filter((s) => s.path.startsWith("/records/"));
    expect(quote!.body).toEqual({ values: body.values, children: body.children });
    expect(save!.body).toMatchObject({ values: { ...body.values, client_key: "k".repeat(32) }, expect: { total: "23.27" } });
    expect(save!.key).toBe("Bearer adm_pub_customer");
  });

  it("follows the order it placed through the link key's session, and keeps it for the tab", async () => {
    const storage = tab();
    const api = fakeApi((s) => {
      if (s.method === "POST") return { status: 201, body: PLACED };
      if (s.path === "/records/ordering_orders_claimed") return { body: { data: [{ id: 118, number: "2118", status: "placed" }] } };
      if (s.path.startsWith("/records/ordering_order_item")) return { body: { data: [] } };
      return undefined;
    });
    const diner = new AdminiumDiner(served, { fetch: api.fetch, storage });
    const reply = await diner.place({ values: {}, children: { order_items: [] } }, "k".repeat(32));
    expect(reply.link).toEqual({ key: "link", token: "LINKCODE12345678" });
    // A reload: a new door on the same tab.
    const again = new AdminiumDiner(served, { fetch: api.fetch, storage });
    expect((await again.linkedOrder()).order["number"]).toBe("2118");
    const read = api.seen.find((s) => s.path === "/records/ordering_orders_claimed")!;
    expect([read.key, read.session]).toEqual(["Bearer adm_pub_link", "link-session"]);
  });

  it("answers an order's page with no session as nobody's", async () => {
    const diner = new AdminiumDiner(served, { fetch: fakeApi(() => undefined).fetch, storage: tab() });
    await expect(diner.linkedOrder()).rejects.toMatchObject({ status: 404, code: "PUBLIC_REF_NOT_FOUND" });
  });
});

describe("the order's own link", () => {
  it("opens it, and says when it is unknown or closed", async () => {
    const api = fakeApi((s) => (s.path === "/claim/token" ? ((s.body as { token: string }).token === "OPEN" ? { body: { data: { session: "s", expiresAt: Date.now() + 60_000, level: "verified" } } } : (s.body as { token: string }).token === "SHUT" ? { status: 410, body: { error: { code: "LINK_EXPIRED", message: "gone" } } } : undefined) : undefined));
    const diner = new AdminiumDiner(served, { fetch: api.fetch, storage: tab() });
    expect((await diner.openLink("OPEN")).session).toBe("s");
    await expect(diner.openLink("SHUT")).rejects.toMatchObject({ status: 410, code: "LINK_EXPIRED" });
    await expect(diner.openLink("NONE")).rejects.toMatchObject({ status: 404 });
  });
});

describe("signing in", () => {
  const signIn = (answers: (s: Seen) => { status?: number; body: unknown } | undefined) =>
    fakeApi((s) => {
      if (s.path === "/claim/link") return { status: 202, body: { data: { sentTo: "k•••@m•••.example" } } };
      if (s.path === "/claim/link/peek") return { body: { data: { firstName: "Kwame" } } };
      if (s.path === "/claim/link/verify") return { body: { data: { session: "person", expiresAt: Date.now() + 30 * 60_000, level: "verified" } } };
      return answers(s);
    });

  it("reads who is signed in from their own row, and keeps no address of theirs in the browser", async () => {
    const api = signIn((s) => (s.path === "/records/ordering_customers_claimed" ? { body: { data: [{ name: "Kwame B.", email: "kwame.b@mail.example" }] } } : undefined));
    const storage = tab();
    const diner = new AdminiumDiner(served, { fetch: api.fetch, storage });
    await diner.requestSignIn("kwame.b@mail.example");
    await diner.verifyCode("kwame.b@mail.example", "284716");
    expect(await diner.signedIn()).toMatchObject({ email: "kwame.b@mail.example", name: "Kwame B." });
    for (let i = 0; i < storage.length; i += 1) expect(storage.getItem(storage.key(i)!)).not.toContain("kwame.b@");
  });

  it("says a wrong code with the tries left", async () => {
    const api = fakeApi((s) => (s.path === "/claim/link/verify" ? { status: 403, body: { error: { code: "PUBLIC_CODE_WRONG", message: "no", params: { triesLeft: 3 } } } } : undefined));
    const error = await new AdminiumDiner(served, { fetch: api.fetch, storage: tab() }).verifyCode("kwame.b@mail.example", "000000").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect([(error as ApiError).code, (error as ApiError).params["triesLeft"]]).toEqual(["PUBLIC_CODE_WRONG", 3]);
  });

  it("forgets the tab's sessions when the diner's details are deleted", async () => {
    const storage = tab();
    const api = signIn((s) => (s.method === "DELETE" && s.path === "/account" ? { body: { data: {} } } : s.method === "POST" && s.path === "/records/ordering_orders_verified_2" ? { status: 201, body: PLACED } : undefined));
    const diner = new AdminiumDiner(served, { fetch: api.fetch, storage });
    await diner.place({ values: {}, children: { order_items: [] } }, "k".repeat(32));
    await diner.verifyLink("TOKEN");
    expect(storage.length).toBeGreaterThanOrEqual(2);
    await diner.forget();
    expect([storage.getItem("ordering.session.customer"), storage.getItem("ordering.session.link")]).toEqual([null, null]);
  });
});
