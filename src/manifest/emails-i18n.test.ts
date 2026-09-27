/**
 * Every email in every language has English's blocks and English's
 * variables, sentence by sentence — a translation may not drop a `{{…}}`
 * the outbox fills, or invent one it does not.
 */
import { describe, expect, it } from "vitest";

import { EMAIL_EN, emailWords } from "./emails.ts";
import { LOCALES } from "./labels.ts";

function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${String(i)}]`));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([k, v]) => leaves(v, path === "" ? k : `${path}.${k}`));
  return [];
}
const vars = (text: string) => [...text.matchAll(/\{\{([\w.]+)\}\}/g)].map((m) => m[1]!).sort();

describe.each(LOCALES.filter((t) => t !== "en-US"))("%s", (tag) => {
  const words = emailWords()[tag];
  const en = new Map(leaves(EMAIL_EN));
  const local = new Map(leaves(words));

  it("has every sentence English has, and no other", () => {
    expect([...local.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it("uses English's variables in each sentence", () => {
    const wrong = [...en].filter(([path, text]) => JSON.stringify(vars(text)) !== JSON.stringify(vars(local.get(path) ?? ""))).map(([path]) => path);
    expect(wrong).toEqual([]);
  });

  it("is not English", () => {
    const same = [...en].filter(([path, text]) => local.get(path) === text && /\p{L}/u.test(text.replace(/\{\{[\w.]+\}\}/g, ""))).map(([path]) => path);
    expect(same.filter((p) => !["total", "subtotal"].includes(p))).toEqual([]);
  });
});
