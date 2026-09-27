/**
 * The kitchen, walked the way the cook walks it — the board, a ticket,
 * cancelling, handing over, tomorrow, the slots and stopping, the shelf,
 * today's menu, the hours and a phone order — in light, dark, Arabic and on
 * the tablet it lives on, each screen shot and swept by axe.
 */
import { expect, test, type Page } from "@playwright/test";

import { DEMO_BASE } from "../playwright.config.ts";
import { MESSAGES, type MessageKey } from "../src/i18n/messages/index.ts";
import { check, newContext, type Variant } from "./browser.ts";

const PROJECT = "kitchen";
const VARIANTS: readonly Variant[] = ["light", "dark", "arabic", "tablet"];

function words(variant: Variant): (key: MessageKey, params?: Record<string, string>) => string {
  const bundle = MESSAGES[variant === "arabic" ? "ar-EG" : "en-US"];
  return (key, params = {}) => {
    const raw = bundle[key] ?? MESSAGES["en-US"][key] ?? key;
    return raw.split("|")[0]!.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
  };
}

async function asKitchen(page: Page): Promise<void> {
  await page.evaluate(() => window.postMessage({ type: "adminium:demo:set", dv: 1, persona: "kitchen" }, "*"));
}

for (const variant of VARIANTS) {
  test(`the kitchen, ${variant}`, async ({ browser }) => {
    const t = words(variant);
    const context = await newContext(browser, variant);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(DEMO_BASE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await asKitchen(page);
    const tab = (key: MessageKey) => page.getByRole("tab", { name: new RegExp(`^${t(key)}(\\s|\\d|$)`) });
    await expect(tab("kitchen.tab.queue")).toBeVisible();
    await check(page, PROJECT, "queue", variant);

    // A move and its Undo.
    const newColumn = page.getByRole("region", { name: t("kitchen.col.placed") });
    if ((await newColumn.getByRole("button", { name: t("kitchen.btn.confirm") }).count()) > 0) {
      await newColumn.getByRole("button", { name: t("kitchen.btn.confirm") }).first().click();
      await expect(page.getByRole("button", { name: t("shell.toast.undo") }).last()).toBeVisible();
      await check(page, PROJECT, "queue-undo", variant);
    }

    // A ticket, and cancelling it.
    await page.getByRole("region", { name: t("kitchen.col.preparing") }).getByRole("button", { name: new RegExp(`^${t("kitchen.openTicket").split("{")[0]!}`) }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, PROJECT, "ticket", variant);
    await page.getByRole("button", { name: t("kitchen.ticket.cancel") }).click();
    await page.getByRole("radio", { name: t("kitchen.cancel.ranOut") }).click();
    await page.getByRole("radiogroup").nth(1).getByRole("radio").first().click();
    await check(page, PROJECT, "cancel", variant);
    await page.getByRole("button", { name: t("kitchen.cancel.keep") }).click();
    await page.keyboard.press("Escape");

    // Handing over the bag on the shelf.
    await page.getByRole("region", { name: t("kitchen.col.ready") }).getByRole("button", { name: t("kitchen.btn.handOff") }).first().click();
    await page.getByRole("radio", { name: t("kitchen.handoff.card") }).click();
    await check(page, PROJECT, "handoff", variant);
    await page.getByRole("button", { name: t("kitchen.handoff.notYet") }).click();

    // Tomorrow's pre-orders.
    await page.getByRole("button", { name: new RegExp(t("kitchen.stat.tomorrow")) }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, PROJECT, "tomorrow", variant);
    await page.keyboard.press("Escape");

    await tab("kitchen.tab.slots").click();
    await expect(page.getByRole("heading", { level: 2, name: t("kitchen.slots.title") })).toBeVisible();
    await check(page, PROJECT, "slots", variant);
    await page.getByRole("button", { name: t("kitchen.slots.stop") }).click();
    await check(page, PROJECT, "slots-stop", variant);
    await page.getByRole("button", { name: t("kitchen.stop.keep") }).click();
    await page.getByRole("group", { name: t("kitchen.slots.day") }).getByRole("button", { name: t("pick.tomorrow") }).click();
    await check(page, PROJECT, "slots-tomorrow", variant);

    await tab("kitchen.tab.shelf").click();
    await check(page, PROJECT, "shelf", variant);

    await tab("kitchen.tab.menu").click();
    await page.getByRole("button", { name: t("kitchen.menu.showOptions", { name: "Signature grain bowl" }) }).click();
    await check(page, PROJECT, "menu", variant);

    await tab("kitchen.tab.hours").click();
    await check(page, PROJECT, "hours", variant);

    await page.getByRole("button", { name: t("kitchen.phoneOrder.title") }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /^Margherita/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Signature grain bowl/ }).click();
    await check(page, PROJECT, "phone-options", variant);
    for (const group of await page.getByRole("dialog").getByRole("radiogroup").all()) await group.getByRole("radio").first().click();
    await page.getByRole("button", { name: t("kitchen.phoneOrder.add") }).click();
    await page.getByLabel(t("co.name"), { exact: true }).fill("Dana R.");
    await page.getByLabel(t("large.phone"), { exact: true }).fill("(555) 017-4410");
    await page.getByRole("dialog").getByRole("group", { name: t("pick.group.afternoon") }).getByRole("button").first().click();
    await expect(page.getByText(t("totals.checking"))).toHaveCount(0);
    await check(page, PROJECT, "phone", variant);
    await page.getByRole("button", { name: new RegExp(`^${t("kitchen.phoneOrder.placeNoTotal")}`) }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    expect(errors).toEqual([]);
    await context.close();
  });
}
