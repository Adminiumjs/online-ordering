/** The door's lists of moments and yes/no columns are the manifest's, table by table. */
import { describe, expect, it } from "vitest";

import { buildManifest } from "../manifest/build.ts";
import { MOMENTS, YES_NO } from "./columnKinds.ts";

const tables = (buildManifest() as { requiredSchema: { tables: { ref: string; columns: { ref: string; type: string }[] }[] } }).requiredSchema.tables;
const ofType = (type: string) =>
  Object.fromEntries(
    tables.map((t) => [t.ref, t.columns.filter((c) => c.type === type).map((c) => c.ref)] as const).filter(([, columns]) => columns.length > 0),
  );

describe("the columns the kitchen's door spells back", () => {
  it("are every moment of the manifest", () => {
    expect(MOMENTS).toEqual(ofType("timestamptz"));
  });
  it("are every yes/no of the manifest", () => {
    expect(YES_NO).toEqual(ofType("bool"));
  });
});
