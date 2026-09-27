/**
 * The demo inside the website's card: a parent page frames the demo build and
 * speaks the demo protocol to it — init, a screen, a shortcut, the clock —
 * and the demo answers with `hello` and its `state`.
 */
import { expect, test } from "@playwright/test";

import { DEMO_BASE } from "../playwright.config.ts";

interface State {
  type: string;
  screen?: string;
  persona?: string | null;
  clockLabel?: string;
  locale?: string;
  toggles?: Record<string, boolean>;
}

test("the card drives the demo, and the demo says where it is", async ({ page, baseURL }) => {
  await page.setContent(`<!doctype html><html><body style="margin:0"><iframe id="demo" src="${baseURL!}${DEMO_BASE}" style="width:1280px;height:900px;border:0"></iframe>
<script>
window.got = [];
window.addEventListener("message", (e) => { if (e.data && typeof e.data.type === "string" && e.data.type.startsWith("adminium:demo:")) window.got.push(e.data); });
window.send = (m) => document.getElementById("demo").contentWindow.postMessage(Object.assign({ dv: 1 }, m), "*");
</script></body></html>`);
  const last = async (): Promise<State> => (await page.evaluate(() => (window as unknown as { got: State[] }).got.filter((m) => m.type === "adminium:demo:state").at(-1))) ?? { type: "" };
  await expect.poll(async () => (await page.evaluate(() => (window as unknown as { got: State[] }).got.map((m) => m.type))).includes("adminium:demo:hello"), { timeout: 30_000 }).toBe(true);

  await page.evaluate(() => (window as unknown as { send: (m: object) => void }).send({ type: "adminium:demo:init", locale: "de-DE", theme: "dark", screen: "menu" }));
  await expect.poll(async () => (await last()).screen).toBe("menu");
  expect((await last()).locale).toBe("de-DE");

  await page.evaluate(() => (window as unknown as { send: (m: object) => void }).send({ type: "adminium:demo:go", screen: "queue" }));
  await expect.poll(async () => (await last()).persona).toBe("kitchen");
  expect((await last()).screen).toBe("queue");

  await page.evaluate(() => (window as unknown as { send: (m: object) => void }).send({ type: "adminium:demo:do", shortcut: "lunch-rush" }));
  await expect.poll(async () => (await last()).screen).toBe("slots");

  const before = (await last()).clockLabel;
  await page.evaluate(() => (window as unknown as { send: (m: object) => void }).send({ type: "adminium:demo:clock", advance: "10m" }));
  await expect.poll(async () => (await last()).clockLabel).not.toBe(before);

  await page.evaluate(() => (window as unknown as { send: (m: object) => void }).send({ type: "adminium:demo:do", shortcut: "orders-off" }));
  await expect.poll(async () => (await last()).toggles?.["orders-off"]).toBe(true);
});
