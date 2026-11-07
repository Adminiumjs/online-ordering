import { describe, expect, it } from "vitest";

import { configBase } from "../staffConnection.ts";
import { mountKey, mountSuffix } from "./mountKey.ts";

const BAKED = "/apps/ordering/customer/";
const at = (pathname: string, baked = BAKED) => mountKey("online-ordering-cart", configBase(baked, pathname));

describe("a storage key per install of the order page", () => {
  it("keeps the old key on the bare mount, so the carts people hold survive the update", () => {
    expect(at("/apps/ordering/customer/")).toBe("online-ordering-cart");
    expect(at("/apps/ordering/customer/track/abc")).toBe("online-ordering-cart");
  });

  it("gives a later install's mount its own key, deep links included", () => {
    expect(at("/apps/ordering/kiln/customer/")).toBe("online-ordering-cart:kiln");
    expect(at("/apps/ordering/kiln/customer/track/abc")).toBe("online-ordering-cart:kiln");
    expect(at("/apps/ordering/harbour/customer/")).not.toBe(at("/apps/ordering/kiln/customer/"));
  });

  it("keeps the bare key on a mapped domain, which is its own origin", () => {
    expect(configBase(BAKED, "/track/abc")).toBe("/");
    expect(at("/track/abc")).toBe("online-ordering-cart");
  });

  it("keeps the bare key for the demo and a standalone build", () => {
    expect(at("/demo/online-ordering/app/", "/demo/online-ordering/app/")).toBe("online-ordering-cart");
    expect(at("/", "/")).toBe("online-ordering-cart");
    expect(mountSuffix("/")).toBe("");
  });
});
