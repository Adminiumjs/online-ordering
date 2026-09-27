/**
 * The demo's Adminium, its presets and the card's words are in the demo build
 * and in no other: a hosted surface (either side) and a connected build carry
 * none of them. The control is the demo build, which must carry every marker.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "..", "..");

/** Literals only the demo's modules hold: the demo's holidays, its sign-in code, a card label, a preset name. */
const MARKERS = ["Thanksgiving Day", "demo-sign-in-link", "Wild mushroom sells out", "k-closure-warn"];

function build(env: Record<string, string>, base: string): string {
  const out = mkdtempSync(join(tmpdir(), "demo-absent-"));
  execFileSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir", "--logLevel", "error", `--base=${base}`], {
    cwd: REPO,
    env: { ...process.env, NODE_ENV: "production", VITE_ADMINIUM_SURFACE_SIDE: "", VITE_ADMINIUM_API_BASE_URL: "", VITE_ADMINIUM_PUBLISHABLE_KEY: "", ...env },
    stdio: "pipe",
  });
  const assets = join(out, "assets");
  const text = readdirSync(assets)
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(join(assets, f), "utf8"))
    .join("\n");
  rmSync(out, { recursive: true, force: true });
  return text;
}

const present = (bundle: string) => MARKERS.filter((m) => bundle.includes(m));

let bundles: Record<string, string> = {};

beforeAll(() => {
  bundles = {
    demo: build({}, "/demo/online-ordering/app/"),
    staff: build({ VITE_ADMINIUM_SURFACE_SIDE: "staff" }, "/apps/ordering/staff/"),
    customer: build({ VITE_ADMINIUM_SURFACE_SIDE: "customer" }, "/apps/ordering/customer/"),
    connected: build({ VITE_ADMINIUM_API_BASE_URL: "https://admin.example.com", VITE_ADMINIUM_PUBLISHABLE_KEY: "adm_pub_example" }, "/"),
  };
}, 240_000);

afterAll(() => {
  bundles = {};
});

describe("the demo is in the demo build only", () => {
  it("the demo build carries every marker", () => {
    expect(present(bundles["demo"]!)).toEqual(MARKERS);
  });

  it("no hosted or connected build carries any", () => {
    expect({ staff: present(bundles["staff"]!), customer: present(bundles["customer"]!), connected: present(bundles["connected"]!) }).toEqual({ staff: [], customer: [], connected: [] });
  });
});
