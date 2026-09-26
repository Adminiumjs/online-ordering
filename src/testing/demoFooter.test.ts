/**
 * THE DEMO FOOTER IS DEMO-ONLY, AND ABSENT FROM EVERY SURFACE BUILD.
 *
 * This app's own half of the surface gate. `surfaceBuild.test.ts` is synced
 * byte-identical across the fleet and proves the demo's tools and dataset stay
 * out of a surface; this footer is this app's alone, so its proof lives here.
 *
 * The footer read "A demo … shipped with Adminium" beside an
 * `adminium.dev/demo/<key>` chip, and it shipped inside the hosted staff and
 * customer bundles — telling an operator's own staff and customers that the
 * thing they were working in was a sample. The dock was gated on `DEMO`; the
 * footer was simply missed, and nothing noticed for two waves.
 *
 * MARKED BY CLASS, NOT BY STRING. The English copy stays in the bundle no
 * matter what: it is one entry in a message table, which is data, and Rollup
 * cannot tree-shake a single key out of an object. What must be absent is the
 * markup that would RENDER it, and class names are the only part of that
 * markup to survive minification.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "..", "..");
const SHELL = join(REPO, "src", "components", "Shell.tsx");

/**
 * Listed by hand rather than scraped, because in this app the obvious patterns
 * catch innocent classes too, and a marker that matches non-demo UI would make
 * this gate fail forever. `footerMarkers()` keeps the list from going stale.
 */
const FOOTER_MARKERS = ["jk-foot__copy"];

function footerMarkers(): string[] {
  const src = readFileSync(SHELL, "utf8");
  const missing = FOOTER_MARKERS.filter((cls) => !src.includes(cls));
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(", ")} no longer appears in ${SHELL} — this gate cannot see the ` +
        `footer, so it cannot prove the footer is absent. Fix the list, do not delete the test.`,
    );
  }
  return FOOTER_MARKERS;
}

/** Every `.js` byte of a build, concatenated. */
function build(outDir: string, side: string): string {
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir", "--logLevel", "error"], {
    cwd: REPO,
    // The same pinned environment as the synced gate: production, because
    // vitest's NODE_ENV=test would build React's development bundle, and every
    // flag explicit, so a developer's shell cannot change what is measured.
    env: {
      ...process.env,
      NODE_ENV: "production",
      VITE_ADMINIUM_SURFACE_SIDE: side,
      VITE_ADMINIUM_API_BASE_URL: "",
      VITE_ADMINIUM_PUBLISHABLE_KEY: "",
    },
    stdio: "pipe",
  });
  const assets = join(outDir, "assets");
  if (!existsSync(assets)) throw new Error(`no assets/ in ${outDir} — the build did not produce a bundle`);
  const js = readdirSync(assets).filter((f) => f.endsWith(".js"));
  if (js.length === 0) throw new Error(`no .js in ${assets}`);
  return js.map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
}

/** Which markers a bundle carries — small, so a failure prints the finding and not the bundle. */
function present(bundle: string, markers: string[]): string[] {
  return markers.filter((m) => bundle.includes(m));
}

let demo = "";
let staff = "";
let customer = "";
let outs: string[] = [];

beforeAll(() => {
  footerMarkers();
  outs = ["demo", "staff", "customer"].map(() => mkdtempSync(join(tmpdir(), "footer-gate-")));
  demo = build(outs[0]!, "");
  staff = build(outs[1]!, "staff");
  customer = build(outs[2]!, "customer");
}, 180_000);

afterAll(() => {
  for (const d of outs) rmSync(d, { recursive: true, force: true });
});

describe("the demo footer is demo-only, and absent from every surface build", () => {
  it("the demo build contains the footer", () => {
    // The control: absence proves nothing when the marker itself has gone stale.
    expect(present(demo, footerMarkers())).not.toEqual([]);
  });

  it("no surface build can render the footer", () => {
    expect({
      staff: present(staff, footerMarkers()),
      customer: present(customer, footerMarkers()),
    }).toEqual({ staff: [], customer: [] });
  });
});
