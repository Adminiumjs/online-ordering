/**
 * The review ledger names every language beside English and every surface
 * that carries its words; a surface marked read names who read it.
 */
import { describe, expect, it } from "vitest";

import STATUS from "./review-status.json" with { type: "json" };
import { LOCALE_TAGS } from "./locales.ts";

describe("review-status.json", () => {
  it("covers every language and every surface", () => {
    const surfaces = Object.keys(STATUS.surfaces).sort();
    expect(Object.keys(STATUS.languages).sort()).toEqual(LOCALE_TAGS.filter((t) => t !== "en-US").sort());
    for (const entry of Object.values(STATUS.languages)) expect(Object.keys(entry).sort()).toEqual(surfaces);
  });

  it("names the reader of every surface marked read", () => {
    const unnamed = Object.entries(STATUS.languages).flatMap(([tag, entry]) =>
      Object.entries(entry as Record<string, { reviewed: boolean; by: string | null }>)
        .filter(([, s]) => s.reviewed && (s.by === null || s.by.trim() === ""))
        .map(([surface]) => `${tag}.${surface}`),
    );
    expect(unnamed).toEqual([]);
  });
});
