/**
 * The browser specs (`e2e/*.e2e.ts`) load under Playwright's own loader, not
 * Vite, so `import.meta.env` is undefined there. A spec that imports app code
 * which reads it at load (`surface.ts`, a store's storage key) dies before a
 * test is listed, and only the contract workflow's browser step would say so.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

describe("the browser specs", () => {
  it("load outside Vite, every file listed", () => {
    const cli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
    const run = spawnSync(process.execPath, [cli, "test", "--list", "--reporter=list"], { cwd: ROOT, encoding: "utf8" });
    const out = `${run.stdout}${run.stderr}`;
    expect(out).not.toMatch(/Error/);
    expect(run.status, out).toBe(0);
    const specs = readdirSync(`${ROOT}e2e`).filter((name) => name.endsWith(".e2e.ts")).length;
    expect(out).toMatch(new RegExp(`Total: [1-9]\\d* tests? in ${String(specs)} files?`));
  }, 60_000);
});
