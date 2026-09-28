/**
 * `npm run demo-rules`: write `src/demo/rules.ts` — the rules the demo's
 * Adminium plays, taken from `manifest.json` (the limits, the states, the
 * public entries, the roles' limits, the email producers). The demo carries
 * them as data, not as a copy someone keeps up by hand;
 * `src/demo/rules.test.ts` fails when the file and the manifest disagree.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Json = Record<string, unknown>;

export function demoRulesText(manifest: Json): string {
  const tables = (manifest["requiredSchema"] as { tables: Json[] }).tables;
  const of = (key: string) => Object.fromEntries(tables.filter((t) => t[key] !== undefined).map((t) => [t["ref"], t[key]]));
  const roles = (manifest["roles"] as Json[]).map((r) => ({ key: r["key"], limits: r["limits"] ?? null }));
  const outbox = manifest["outbox"] as Json;
  /** Per table, each column's stamp rule, by column. */
  const stamps = Object.fromEntries(
    tables
      .map((t) => [t["ref"], Object.fromEntries((t["columns"] as Json[]).filter((c) => (c["rules"] as Json | undefined)?.["stamp"] !== undefined).map((c) => [c["ref"], (c["rules"] as Json)["stamp"]]))])
      .filter(([, columns]) => Object.keys(columns as Json).length > 0),
  );
  /** Per table, its enum columns' values. */
  const enums = Object.fromEntries(
    tables.map((t) => [t["ref"], Object.fromEntries((t["columns"] as Json[]).filter((c) => c["type"] === "enum").map((c) => [c["ref"], c["enum"]]))]),
  );
  /** Per table, each column's own rule of a kind (`validation`, `format`), by column. */
  const columnRule = (kind: string) =>
    Object.fromEntries(
      tables
        .map((t) => [t["ref"], Object.fromEntries((t["columns"] as Json[]).filter((c) => (c["rules"] as Json | undefined)?.[kind] !== undefined).map((c) => [c["ref"], (c["rules"] as Json)[kind]]))])
        .filter(([, columns]) => Object.keys(columns as Json).length > 0),
    );
  const body = {
    stamps,
    enums,
    validation: columnRule("validation"),
    formats: columnRule("format"),
    features: ((manifest["addOns"] as Json | undefined)?.["features"] as Json[] | undefined)?.map((f) => ({ id: f["id"], requires: f["requires"] })) ?? [],
    capacity: of("capacity"),
    states: of("states"),
    publicAccess: manifest["publicAccess"],
    roles,
    producers: outbox["producers"],
    kinds: outbox["kinds"],
  };
  return [
    "/**",
    " * The rules the demo's Adminium plays, as `manifest.json` declares them.",
    " * Written by `npm run demo-rules`; do not edit by hand.",
    " */",
    "// prettier-ignore",
    `export const MANIFEST_RULES = ${JSON.stringify(body, null, 2)} as const;`,
    "",
  ].join("\n");
}

const root = join(import.meta.dirname, "..");
if (process.env["VITEST"] === undefined) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as Json;
  writeFileSync(join(root, "src", "demo", "rules.ts"), demoRulesText(manifest));
  console.info("[demo-rules] wrote src/demo/rules.ts");
}
