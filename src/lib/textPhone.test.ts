/** What the checkout tells of a mobile before Adminium reads it: mainland China, and a number too short or long. */
import { describe, expect, it } from "vitest";

import { compactPhone, mainlandChina, textReadable } from "./textPhone.ts";

describe("a mobile at checkout", () => {
  it("is in mainland China only on +86, however it is written; Hong Kong, Macao and Taiwan are texted", () => {
    for (const phone of ["+86 138 0013 8000", "+8613800138000", "0086 138 0013 8000", " (+86) 138-0013-8000 "]) expect([phone, mainlandChina(phone)]).toEqual([phone, true]);
    for (const phone of ["+852 9123 4567", "+853 6612 3456", "+886 912 345 678", "(555) 018-2244", "+1 555 018 2244", "86 1234 5678"]) expect([phone, mainlandChina(phone)]).toEqual([phone, false]);
  });

  it("can be texted with 7 to 15 digits after an optional +, and a calling code that does not start with 0", () => {
    for (const phone of ["(555) 018-2244", "+1 555 018 2244", "+44 7700 900123", "0049 151 2345 6789", "+852 9123 4567", "+20 100 123 4567"]) expect([phone, textReadable(phone)]).toEqual([phone, true]);
    for (const phone of ["12345", "123 456", "+0 555 018 2244", "+1 555 018 2244 9999 99", "555-CALL-NOW", "+1 (555) 018-2244 ext 4"]) expect([phone, textReadable(phone)]).toEqual([phone, false]);
  });

  it("drops its separators and writes a leading 00 as +", () => {
    expect(compactPhone(" 00 44 (7700) 900-123 ")).toBe("+447700900123");
  });
});
