/**
 * The demo build's Adminium: Juniper Kitchen's sample in memory, the rules
 * played by the demo's engine, and a clock that stands still until the demo
 * card moves it. Nothing in a hosted or connected build imports this module —
 * `main.tsx` reaches it only behind the build-time `DEMO` flag.
 */
import type { Clock, Sources } from "./sources.ts";
import { DemoAdminium } from "../demo/adminium.ts";
import { DEMO_LATENCY } from "../demo/diner.ts";
import { DEMO_ZONE } from "../sample/juniper.ts";

/** The holidays Holiday calendars offers the demo's kitchen (US, the rest of 2026). */
export const DEMO_HOLIDAYS = [
  { date: "2026-09-07", name: "Labor Day" },
  { date: "2026-10-12", name: "Columbus Day" },
  { date: "2026-11-11", name: "Veterans Day" },
  { date: "2026-11-26", name: "Thanksgiving Day" },
  { date: "2026-12-25", name: "Christmas Day" },
];

let demo: DemoAdminium | null = null;

/** The one demo Adminium of this page. */
export function demoAdminium(): DemoAdminium {
  demo ??= new DemoAdminium({ latency: DEMO_LATENCY });
  return demo;
}

function demoClock(adminium: DemoAdminium): Clock {
  return {
    now: () => adminium.now,
    subscribe: (listener) => adminium.onClock(() => listener()),
  };
}

export function demoSources(): Sources {
  const adminium = demoAdminium();
  return { diner: adminium.diner, kitchen: adminium.kitchen, clock: demoClock(adminium), zone: DEMO_ZONE, currency: "USD" };
}
