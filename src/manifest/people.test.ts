/**
 * The kitchen's diners, as the manifest tells Adminium of them: who a diner
 * is and where they are copied, which emails the do-not-email list may stop
 * (none), which tables the law keeps, and the checkout's tick — declared with
 * the very sentences the order page shows, and the only way the newsletter
 * is said yes to from the diner's side.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { diner } from "../i18n/strings/diner.ts";
import { mailClassOf } from "../testing/manifest/mail-class.ts";
import { buildManifest } from "./build.ts";
import { LOCALES } from "./labels.ts";
import { KINDS } from "./outbox.ts";
import { TICK_KEYS } from "./people.ts";

type Json = Record<string, unknown>;
type Entry = Json & { table: string; key?: string; methods: string[]; writable?: string[]; consent?: Json; identity?: Json; claim?: Json; claimedBy?: Json };
type Limits = Record<string, { writable?: string[]; creatable?: string[] }>;

const manifest = buildManifest() as Json & {
  people: Json[];
  publicAccess: Entry[];
  outbox: Json & { recipient: Json; classes: Record<string, string> };
  requiredSchema: { tables: (Json & { ref: string; keep?: Json; columns: (Json & { ref: string; type: string; rules?: Json })[] })[] };
  roles: (Json & { key: string; permissions: string[]; limits?: Limits })[];
  compatibility: Json;
};
const table = (ref: string) => manifest.requiredSchema.tables.find((t) => t.ref === ref)!;
const column = (t: string, ref: string) => table(t).columns.find((c) => c.ref === ref);
const checkout = () => manifest.publicAccess.find((e) => e.table === "orders" && e.methods.includes("POST"))!;

describe("the kitchen's diners", () => {
  it("are the diner accounts: their address, name, first name, language and the newsletter's consent, and every copy of them", () => {
    expect(manifest.people).toEqual([
      {
        table: "customers",
        kind: "people",
        email: "email",
        name: "name",
        firstName: "firstWordOfName",
        language: "language",
        consent: { column: "opt_in", purpose: "newsletter" },
        copies: [
          { table: "orders", column: "name", holds: "name", via: "customer_id" },
          { table: "orders", column: "email", holds: "email", via: "customer_id" },
          { table: "orders", column: "phone", holds: "phone", via: "customer_id" },
          { table: "enquiries", column: "name", holds: "name" },
          { table: "enquiries", column: "email", holds: "email" },
          { table: "enquiries", column: "phone", holds: "phone" },
        ],
      },
    ]);
    expect(manifest.compatibility["minAdminiumVersion"]).toBe("0.3.38");
  });

  it("have one address: the outbox's, the one they sign in with, and the one the checkout finds them by", () => {
    const person = manifest.people[0]!;
    expect(manifest.outbox.recipient["table"]).toBe(person["table"]);
    expect(manifest.outbox.recipient["email"]).toBe(person["email"]);
    const signIn = manifest.publicAccess.filter((e) => e.table === "customers" && e.claim !== undefined);
    expect(signIn.map((e) => e.claim!["email"])).toEqual([person["email"]]);
    expect([checkout().identity!["table"], checkout().identity!["email"]]).toEqual([person["table"], "email"]);
  });

  it("keep a language with the same eight choices as an order's, filled by the order that makes them", () => {
    expect(column("customers", "language")).toEqual(column("orders", "language"));
    expect(checkout().identity!["fill"]).toEqual({ name: "name", language: "language" });
  });

  it("say yes to the news in a yes/no that starts at no, on the diner and on each order", () => {
    for (const ref of ["customers", "orders"]) expect([ref, column(ref, "opt_in")?.["type"], column(ref, "opt_in")?.["default"]]).toEqual([ref, "bool", false]);
  });

  it("are copied onto text columns, and each copy names the diner's own table where it links to it", () => {
    for (const copy of manifest.people[0]!["copies"] as { table: string; column: string; via?: string }[]) {
      expect([copy.table, copy.column, column(copy.table, copy.column)?.["type"]]).toEqual([copy.table, copy.column, "text"]);
      if (copy.via !== undefined) expect([copy.table, copy.via, column(copy.table, copy.via)?.["references"]]).toEqual([copy.table, copy.via, "customers"]);
    }
  });
});

describe("the tables the law keeps", () => {
  it("are a sale and its money — orders, their lines, gift card payments and money given back — kept for tax, and no other", () => {
    const kept = manifest.requiredSchema.tables.filter((t) => t.keep !== undefined).map((t) => [t.ref, t.keep]);
    expect(kept).toEqual([
      ["orders", { law: "tax" }],
      ["order_items", { law: "tax" }],
      ["payments", { law: "tax" }],
      ["payment_refunds", { law: "tax" }],
    ]);
  });
});

describe("the kitchen's emails", () => {
  it("are every one service mail: the do-not-email list stops none", () => {
    expect(Object.keys(manifest.outbox.classes).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) expect([kind, mailClassOf(manifest as never, { outboxKind: kind })]).toEqual([kind, "service"]);
  });
});

describe("the checkout's tick", () => {
  const wording = (checkout().consent as { wording: { version: number; text: Record<string, string> } }).wording;

  it("is declared with the sentences the checkout shows, in every language, as version 1", () => {
    expect(wording.version).toBe(1);
    expect(Object.keys(wording.text).sort()).toEqual([...LOCALES].sort());
    for (const tag of LOCALES) {
      const words = diner[tag] as Partial<Record<string, string>>;
      const shown = TICK_KEYS.map((key) => words[key]);
      expect(shown.every((s) => typeof s === "string" && s !== "" && !s.includes("\n"))).toBe(true);
      expect([tag, wording.text[tag]]).toEqual([tag, shown.join("\n")]);
      // The kitchen's name stands in each language where the box shows it, and in the first sentence only.
      expect([tag, shown[0]!.includes("{venue}"), shown[1]!.includes("{")]).toEqual([tag, true, false]);
    }
    // And the checkout says exactly these, by these keys, with the kitchen's name in its place.
    const screen = readFileSync(join(__dirname, "..", "diner", "Checkout.tsx"), "utf8");
    expect(screen).toContain('t("co.optIn", { venue: venue.name })');
    expect(screen).toContain('t("co.optIn.note")');
  });

  it("is carried by the checkout alone, kept for the diner the address finds or the diner signed in", () => {
    const ticks = manifest.publicAccess.filter((e) => (e.writable ?? []).includes("opt_in"));
    expect(ticks.map((e) => [e.table, e.key ?? "customer", e.methods.join()])).toEqual([["orders", "customer", "POST"]]);
    const e = ticks[0]!;
    expect(e.consent).toEqual({ column: "opt_in", purpose: "newsletter", wording });
    expect([e.identity!["table"], e.identity!["link"], e.claimedBy!["table"], e.claimedBy!["column"]]).toEqual(["customers", "customer_id", "customers", "customer_id"]);
    // No other door of the order page takes a tick.
    expect(manifest.publicAccess.filter((x) => x.consent !== undefined)).toEqual([e]);
  });

  it("is the only yes the diner's side can give: their own account cannot set the newsletter by hand", () => {
    const account = manifest.publicAccess.find((e) => e.table === "customers" && e.claim !== undefined)!;
    expect(account.writable).toEqual(["name"]);
    expect(manifest.publicAccess.filter((e) => e.table === "customers" && (e.writable ?? []).includes("opt_in"))).toEqual([]);
    // Deleting their details still empties it: Adminium records the withdrawal first.
    expect((account["forget"] as { columns: string[] }).columns).toContain("opt_in");
  });

  it("is the diner's own: no role writes it on an order, in the kitchen or as the manager", () => {
    for (const r of manifest.roles) {
      const orders = r.limits?.["orders"];
      if (orders === undefined) continue;
      expect([r.key, (orders.writable ?? []).includes("opt_in"), (orders.creatable ?? []).includes("opt_in")]).toEqual([r.key, false, false]);
    }
    // Every role that may make or change an order has a column limit on both, so the line above holds for each.
    for (const r of manifest.roles.filter((x) => x.permissions.some((p) => p === "table:@orders:create" || p === "table:@orders:update"))) {
      expect([r.key, r.limits?.["orders"]?.writable !== undefined, r.limits?.["orders"]?.creatable !== undefined]).toEqual([r.key, true, true]);
    }
  });
});
