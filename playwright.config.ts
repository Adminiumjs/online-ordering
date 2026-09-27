/**
 * The browser pass (`npm run e2e`).
 *
 *   demo   the website's demo build, served as the website serves it
 *          (`/demo/online-ordering/app/`), on the lane's preview port: every
 *          screen and state the demo reaches, each in light, dark, Arabic and
 *          on a phone, swept by axe.
 *
 * The files are named `*.e2e.ts` so the unit suite (vitest) never collects them.
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env["E2E_DEMO_PORT"] ?? 8261);
export const DEMO_BASE = "/demo/online-ordering/app/";

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: "e2e-results/report.json" }]],
  outputDir: "e2e-results/artifacts",
  use: { browserName: "chromium", headless: true, trace: "retain-on-failure", actionTimeout: 20_000, navigationTimeout: 60_000, baseURL: `http://127.0.0.1:${String(PORT)}` },
  webServer: {
    command: `npm run build:demo && npx vite preview --base=${DEMO_BASE} --port ${String(PORT)} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}${DEMO_BASE}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: "demo" }],
});
