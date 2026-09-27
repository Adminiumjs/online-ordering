/**
 * The demo build's side of the website's demo card: the card says which
 * screen, persona, language and theme to show, and the page reports back
 * where it is. DEMO BUILD ONLY — `main.tsx` imports it behind the build-time
 * `DEMO` flag, so no hosted or connected bundle carries the protocol.
 */
import { DEMO_MESSAGE_PREFIX, isDemoMessage, type DemoMessage } from "./demo-types.ts";
import { setHostLocale } from "./i18n/index.tsx";
import { isLocaleTag } from "./i18n/locales.ts";
import { currentView, goView, setTheme, useUi, type View } from "./state/ui.ts";
import { useDiner } from "./state/diner.ts";

const APP_KEY = "online-ordering";
const SCREENS: readonly View[] = ["home", "menu", "cart", "checkout", "track", "find", "orders", "large", "notfound", "kitchen"];

let locale = "en-US";

function post(message: DemoMessage): void {
  if (window.parent === window) return;
  window.parent.postMessage(message, "*");
}

/** Where the page is, for the card. */
export function reportState(): void {
  const ui = useUi.getState();
  const diner = useDiner.getState();
  post({
    type: `${DEMO_MESSAGE_PREFIX}state` as "adminium:demo:state",
    dv: 1,
    screen: currentView(),
    persona: ui.persona,
    mode: null,
    online: diner.data?.settings["online_on"] !== false,
    toggles: {},
    locale,
    theme: ui.theme,
    overlay: ui.mobileMenu || diner.sheet !== null || diner.drawer,
  });
}

function apply(message: DemoMessage): void {
  switch (message.type) {
    case "adminium:demo:init":
    case "adminium:demo:set": {
      if (message.theme !== undefined) setTheme(message.theme);
      if (message.locale !== undefined && isLocaleTag(message.locale)) {
        locale = message.locale;
        setHostLocale(message.locale);
      }
      if (message.persona === "kitchen" || message.persona === "diner") goView(message.persona === "kitchen" ? "kitchen" : "home");
      if (message.type === "adminium:demo:init" && message.screen !== undefined && (SCREENS as readonly string[]).includes(message.screen)) goView(message.screen as View);
      break;
    }
    case "adminium:demo:go":
      if ((SCREENS as readonly string[]).includes(message.screen)) goView(message.screen as View);
      break;
    default:
      break;
  }
  reportState();
}

export function attachDemoBridge(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent || !isDemoMessage(event.data)) return;
    apply(event.data);
  });
  useUi.subscribe(reportState);
  post({ type: `${DEMO_MESSAGE_PREFIX}hello` as "adminium:demo:hello", dv: 1, appKey: APP_KEY });
}
