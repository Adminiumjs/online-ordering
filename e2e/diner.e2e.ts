/**
 * The order page, walked the way a diner walks it — Home, the menu, a dish,
 * the cart, checkout, the confirmation, Track and its cancel question, Large
 * orders, Find my order and Order again — in light, dark, Arabic and on a
 * phone, each screen shot and swept by axe.
 */
import { expect, test, type Page } from "@playwright/test";

import { DEMO_BASE } from "../playwright.config.ts";
import { MESSAGES, type MessageKey } from "../src/i18n/messages/index.ts";
import { check, newContext, VARIANTS, type Variant } from "./browser.ts";

const PROJECT = "diner";

function words(variant: Variant): (key: MessageKey, params?: Record<string, string>) => string {
  const bundle = MESSAGES[variant === "arabic" ? "ar-EG" : "en-US"];
  return (key, params = {}) => {
    const raw = bundle[key] ?? MESSAGES["en-US"][key] ?? key;
    return raw.split("|")[0]!.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
  };
}

/** Picks the first option of every pick-one group the dish sheet asks for. */
async function answerSheet(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  for (const group of await dialog.getByRole("radiogroup").all()) {
    if ((await group.getByRole("radio", { checked: true }).count()) === 0) await group.getByRole("radio").first().click();
  }
}

async function go(page: Page, variant: Variant, label: string): Promise<void> {
  if (variant === "phone") {
    await page.locator("header").getByRole("button").first().click();
    await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
  } else {
    await page.locator("footer").getByRole("link", { name: label, exact: true }).click();
  }
}

for (const variant of VARIANTS) {
  test(`the order page, ${variant}`, async ({ browser }) => {
    const t = words(variant);
    const context = await newContext(browser, variant);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(DEMO_BASE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await check(page, PROJECT, "home", variant);

    await page.getByRole("button", { name: t("home.cta.build") }).click();
    await expect(page.getByRole("heading", { level: 1, name: t("menu.title") })).toBeVisible();
    await check(page, PROJECT, "menu", variant);

    await page.getByRole("button", { name: /^Signature grain bowl/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, PROJECT, "sheet", variant);
    await answerSheet(page);
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${t("sheet.add")}`) }).click();
    await expect(page.getByRole("dialog", { name: t("cart.title") })).toBeVisible();
    await expect(page.getByText(t("totals.checking"))).toHaveCount(0);
    await check(page, PROJECT, "drawer", variant);

    await page.getByRole("button", { name: t("cart.fullPage") }).click();
    await expect(page.getByRole("heading", { level: 1, name: t("cart.title") })).toBeVisible();
    await check(page, PROJECT, "cart", variant);

    await page.getByRole("main").getByRole("button", { name: t("cart.checkout") }).click();
    await page.getByLabel(t("co.name"), { exact: true }).fill("Kwame B.");
    await page.getByLabel(t("co.email"), { exact: true }).fill("kwame.b@mail.example");
    await expect(page.getByText(t("totals.checking"))).toHaveCount(0);
    await check(page, PROJECT, "checkout", variant);
    // The pickup times are one radio group: an arrow key chooses the next free time.
    const times = page.getByRole("radiogroup", { name: t("pick.times") });
    const chosen = times.getByRole("radio", { checked: true });
    const before = await chosen.getAttribute("data-time");
    await chosen.focus();
    await page.keyboard.press(variant === "arabic" ? "ArrowLeft" : "ArrowRight");
    await expect(times.getByRole("radio", { checked: true })).not.toHaveAttribute("data-time", before ?? "");
    await expect(times.getByRole("radio", { checked: true })).toBeFocused();

    await page.getByRole("button", { name: new RegExp(`^${t("co.placeNoTotal")}`) }).click();
    await expect(page.getByRole("button", { name: t("confirm.follow") })).toBeVisible();
    await check(page, PROJECT, "confirmation", variant);

    await page.getByRole("button", { name: t("confirm.follow") }).click();
    await expect(page.getByRole("status").filter({ hasText: t("track.badge.placed") })).toBeVisible();
    await check(page, PROJECT, "track", variant);
    await page.getByRole("button", { name: t("track.cancel") }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, PROJECT, "track-cancel", variant);
    await page.getByRole("button", { name: t("track.cancel.keep") }).click();

    await go(page, variant, t("shell.nav.large"));
    await expect(page.getByRole("heading", { level: 1, name: t("large.title") })).toBeVisible();
    await check(page, PROJECT, "large", variant);
    await page.getByRole("group", { name: t("large.day") }).getByRole("button").first().click();
    await page.getByLabel(t("co.name"), { exact: true }).fill("Priya");
    await page.getByLabel(t("large.phone"), { exact: true }).fill("(555) 010-4471");
    await page.getByLabel(t("co.email"), { exact: true }).fill("priya@mail.example");
    await page.getByRole("button", { name: t("large.send") }).click();
    await expect(page.getByRole("heading", { level: 1, name: t("large.sent.title") })).toBeVisible();
    await check(page, PROJECT, "large-sent", variant);

    await go(page, variant, t("shell.nav.orders"));
    await expect(page.getByRole("heading", { level: 1, name: t("find.titleOrders") })).toBeVisible();
    await check(page, PROJECT, "find", variant);
    await page.getByLabel(t("co.email"), { exact: true }).fill("kwame.b@mail.example");
    await page.getByRole("button", { name: t("find.send") }).click();
    await page.getByRole("button", { name: t("find.useCode") }).click();
    await page.getByLabel(t("find.code.label"), { exact: true }).fill("284716");
    await check(page, PROJECT, "find-sent", variant);
    await page.getByRole("button", { name: t("find.code.go") }).click();
    await expect(page.getByRole("heading", { level: 1, name: t("orders.title") })).toBeVisible();
    await check(page, PROJECT, "orders", variant);
    await page.getByRole("button", { name: t("orders.account") }).click();
    await check(page, PROJECT, "orders-menu", variant);

    expect(errors).toEqual([]);
    await context.close();
  });
}
