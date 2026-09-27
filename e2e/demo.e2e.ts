/**
 * The website's demo opens, as the website serves it.
 */
import { expect, test } from "@playwright/test";

import { DEMO_BASE } from "../playwright.config.ts";
import { newContext, settle } from "./browser.ts";

test("the demo opens on the order page", async ({ browser }) => {
  const context = await newContext(browser, "light");
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(DEMO_BASE);
  await settle(page);
  await expect(page.locator("body")).not.toBeEmpty();
  expect(errors).toEqual([]);
  await context.close();
});
