/**
 * Every frame of the design's States canvases, opened by its preset
 * (`#state=<name>`), shot and swept by axe — the sweep to hold beside the
 * canvases.
 */
import { expect, test } from "@playwright/test";

import { DEMO_BASE } from "../playwright.config.ts";
import { PRESET_NAMES } from "../src/demo/presets.ts";
import { check, newContext } from "./browser.ts";

test("every States preset", async ({ browser }) => {
  const context = await newContext(browser, "light");
  const errors: string[] = [];
  for (const name of PRESET_NAMES) {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
    await page.goto(`${DEMO_BASE}#state=${name}`);
    await expect(page.locator(`html[data-preset="${name}"]`)).toHaveCount(1, { timeout: 20_000 });
    await check(page, "presets", name, "light");
    await page.close();
  }
  expect(errors).toEqual([]);
  await context.close();
});
