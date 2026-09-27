/**
 * What every screen of the browser pass does: the variant it is seen in, a
 * wait for the page to be still, a full-page screenshot, and an axe sweep
 * that fails on a serious or critical violation — and on a sweep that
 * analysed nothing, which would otherwise pass by silence.
 *
 * The browser sits in New York while the kitchen is in Riverside: every time
 * on a page must still be the kitchen's.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export type Variant = "light" | "dark" | "arabic" | "phone" | "tablet";
export const VARIANTS: readonly Variant[] = ["light", "dark", "arabic", "phone"];

/** Where the screenshots go: `<SHOTS>/<project>/<screen>-<variant>.png`. */
export const SHOTS = process.env["E2E_SHOTS"] ?? join(process.cwd(), "e2e-results", "shots");

export const DESKTOP = { width: 1280, height: 900 };
export const TABLET = { width: 1024, height: 768 };
export const PHONE = { width: 390, height: 844 };

/** How a variant is set on a fresh browser context: its language, its colour scheme, its width. */
export function contextOptions(variant: Variant) {
  return {
    locale: variant === "arabic" ? "ar-EG" : "en-US",
    colorScheme: variant === "dark" ? ("dark" as const) : ("light" as const),
    viewport: variant === "phone" ? PHONE : variant === "tablet" ? TABLET : DESKTOP,
    ...(variant === "phone" ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    timezoneId: "America/New_York",
  };
}

export async function newContext(browser: Browser, variant: Variant): Promise<BrowserContext> {
  return browser.newContext(contextOptions(variant));
}

/**
 * Wait until the page is still: fonts loaded, no request in flight for a
 * moment, and every entrance animation finished — infinite ones (a spinner, a
 * pulse) never finish and are left running.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finite = document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
  await page.waitForTimeout(150);
}

export interface Sweep {
  passes: number;
  violations: { id: string; impact: string | null | undefined; help: string; nodes: string[] }[];
}

/** Run axe (WCAG 2.0/2.1 A and AA) over the page. */
export async function sweep(page: Page): Promise<Sweep> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return {
    passes: result.passes.length,
    violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 40).map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n").slice(1).join(" ").trim() ?? ""}`) })),
  };
}

/**
 * The check every screen gets, in every variant: settle, shoot the full page,
 * sweep it, and fail on a serious or critical violation, on a sweep with no
 * passes, and on a page wider than the window. The failures are soft — the
 * walk goes on and the test fails at its end with every finding — while the
 * page's direction, held to the variant, is hard.
 */
export async function check(page: Page, project: string, screen: string, variant: Variant): Promise<Sweep> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  if (variant === "arabic") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  else await expect(page.locator("html")).not.toHaveAttribute("dir", "rtl");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `${screen} (${variant}) is ${String(overflow)} px wider than the window`).toBeLessThanOrEqual(0);
  const dir = join(SHOTS, project);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${screen}-${variant}.png`), fullPage: true });
  const result = await sweep(page);
  expect.soft(result.passes, `axe analysed nothing on ${screen} (${variant})`).toBeGreaterThan(0);
  const blocking = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect.soft(blocking, `${screen} (${variant}): ${JSON.stringify(blocking, null, 1)}`).toEqual([]);
  return result;
}
