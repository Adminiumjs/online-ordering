import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { configBase } from "../staffConnection.ts";
import { mountBase, mountKey, mountSuffix } from "./mountKey.ts";

const BAKED = "/apps/ordering/customer/";
const at = (pathname: string, baked = BAKED) => mountKey("online-ordering-cart", mountBase(baked, pathname));

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

  it("finds the same install as the staff side's configBase, on every kind of path", () => {
    const paths = [
      "/", "/track/abc", "/apps/ordering/customer/", "/apps/ordering/customer/track/abc",
      "/apps/ordering/customer/customer", "/apps/ordering/kiln/customer/", "/apps/ordering/kiln/customer/track/abc",
      "/apps/ordering/staff/customer/", "/apps/ordering/kiln/staff/", "/apps/other/kiln/customer/", "/apps/ordering/kiln",
    ];
    for (const baked of [BAKED, "/apps/ordering/staff/", "/demo/online-ordering/app/", "/"]) {
      for (const path of paths) {
        expect(mountSuffix(mountBase(baked, path)), `${baked} at ${path}`).toBe(mountSuffix(configBase(baked, path)));
      }
    }
  });
});

describe("outside Vite, where import.meta.env is undefined", () => {
  // The cart and last-order stores compute their keys at load; the browser
  // specs import them under Playwright's loader, which defines no env.
  it("loads and gives the bare key", () => {
    const url = new URL("./mountKey.ts", import.meta.url).href;
    const script = `const m = await import(${JSON.stringify(url)}); process.stdout.write(String(import.meta.env) + " " + m.mountKey("online-ordering-cart"));`;
    const out = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script], {
      cwd: fileURLToPath(new URL(".", import.meta.url)),
      encoding: "utf8",
    });
    expect(out).toBe("undefined online-ordering-cart");
  });
});
