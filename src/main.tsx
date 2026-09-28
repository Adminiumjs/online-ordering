/*
 * Entry point: which Adminium the screens talk to (the demo's own in the demo
 * build, the real one everywhere else), the address the page opened on, and
 * then the app.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/fonts.css";
import "./styles/juniper.css";

import { I18nProvider, setHostLocale } from "./i18n/index.tsx";
import { setSources } from "./data/sources.ts";
import { liveSources } from "./data/live.ts";
import { appName } from "./i18n/ambient.ts";
import { DEMO, HOSTED, SURFACE_SIDE } from "./surface.ts";
import { currentView, goView, useUi } from "./state/ui.ts";
import type { BootLink } from "./app/App.tsx";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root — check index.html");

/** This app's name, as the failure screen says it. */
const BRAND = "Juniper Kitchen";

/**
 * The headline for a startup failure, chosen by CAUSE.
 *
 * One sentence used to cover every cause: "<Brand> is not connected". It was
 * wrong for most of them and actively misleading for two — an app that reached
 * Adminium, authenticated, and refused only because two databases are serving
 * is not "not connected", and an operator who reads that goes looking for a
 * broken connection instead of the choice the app is actually waiting on.
 *
 * The DETAIL under it already says precisely what happened; this only has to
 * name the KIND of problem without contradicting it.
 */
function titleFor(code: string | null): string {
  switch (code) {
    case "AMBIGUOUS_CONNECTION":
      return `${BRAND} does not know which database to read`;
    case "CONNECTION_PAUSED":
      return `${BRAND}'s database is paused`;
    case "NO_CONNECTION":
      return `${BRAND} is not connected`;
    case "NO_BACKEND":
      return `${BRAND} has no backend configured`;
    default:
      // Reached the server and could not finish: a refused scope, a schema that
      // does not match, an expired session. "Not connected" would be a guess.
      return `${BRAND} could not load its data`;
  }
}

/**
 * The smallest honest "this is not configured" surface.
 *
 * Deliberately plain DOM and inline styles: it has to work when the data layer,
 * and possibly the locale bundle, did not. Anything richer would be one more
 * thing that can fail while reporting a failure.
 */
function showStartupFailure(mount: HTMLElement, detail: string, code: string | null): void {
  const title = titleFor(code);
  console.error(`[adminium] ${title}: ${detail}`);
  mount.innerHTML = "";
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText =
    "max-width:34rem;margin:12vh auto;padding:1.5rem;font:400 15px/1.6 system-ui,sans-serif;" +
    "border:1px solid #d4d4d8;border-radius:12px;color:#18181b;background:#fff";
  const h = document.createElement("h1");
  h.textContent = title;
  h.style.cssText = "margin:0 0 .5rem;font-size:1.05rem;font-weight:600";
  const p = document.createElement("p");
  p.textContent = detail;
  // `pre-wrap`: the detail is a LIST — one problem per line, and a blank line
  // before any hint. Collapsed to a single run of prose (the CSS default) the
  // nine missing tables and the sentence that explains them read as one
  // sentence, which is how "resume it in Connections" ends up glued to a
  // column name.
  p.style.cssText = "margin:0;color:#52525b;white-space:pre-wrap";
  box.append(h, p);
  mount.append(box);
}

/**
 * The transport's code for a failure, when it carried one.
 *
 * Duck-typed rather than `instanceof`: the reason travels through
 * `snapshotFailure()` as a plain `Error`, and a build that swaps transports
 * should not have to share a class for the screen above to stay accurate.
 */
function codeOf(reason: Error | null): string | null {
  const code = (reason as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

async function boot(): Promise<void> {
  /*
   * A NON-DEMO BUILD NEVER RENDERS DEMO DATA: the demo's Adminium is imported
   * only behind the build-time `DEMO` flag, so a hosted or connected bundle
   * does not contain it at all.
   */
  let preset: string | null = null;
  if (DEMO) {
    const { demoSources } = await import("./data/demo.ts");
    setSources(demoSources());
    const { attachDemoBridge } = await import("./demoBridge.ts");
    attachDemoBridge();
    // `#state=<preset>`: a frame of the design's States canvases, for looking and for screenshots.
    const presets = await import("./demo/presets.ts");
    preset = presets.presetFromHash();
    if (preset !== null) await presets.prepareWorld(preset);
  } else {
    const live = await liveSources();
    if (live instanceof Error) {
      // Not signed in: the page is already on its way to Adminium's sign-in.
      if (codeOf(live) !== "SIGNING_IN") showStartupFailure(container as HTMLElement, live.message, codeOf(live));
      return;
    }
    setSources(live);
  }

  const persona = SURFACE_SIDE === "staff" ? "kitchen" : SURFACE_SIDE === "customer" ? "diner" : null;
  if (persona !== null) useUi.setState({ persona });

  /*
   * The link the page was opened with: an order's own (`/o#<code>`) or an
   * emailed sign-in (`/c#<code>`). Read before anything rewrites the address.
   */
  const code = preset === null ? window.location.hash.slice(1) : "";
  const last = window.location.pathname.replace(/\/+$/, "").split("/").pop();
  const link: BootLink | null = code === "" ? null : last === "o" ? { kind: "track", token: code } : last === "c" ? { kind: "signin", token: code } : null;
  if (link?.kind === "track") goView("track");
  if (link?.kind === "signin") {
    goView("orders");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  }

  /*
   * URL ⇄ SCREEN in every real build, and the host bridge when hosted. The
   * demo build is driven by the website's card and keeps its own address.
   */
  if (!DEMO) {
    const { attachUrlSync } = await import("./urlSync.ts");
    const { SURFACE_NAV, APP_KEY } = await import("./surface-nav.ts");
    let bridge: { navigated: (path: string) => void } | null = null;
    const sync = attachUrlSync({
      nav: SURFACE_NAV,
      side: SURFACE_SIDE,
      go: goView,
      current: currentView,
      onPath: (path) => bridge?.navigated(path),
    });
    if (HOSTED) {
      const { connectToHost } = await import("./embed.ts");
      bridge = await connectToHost(APP_KEY, SURFACE_SIDE as "staff" | "customer", sync.path(), {
        onTheme: (theme) => useUi.setState({ theme }),
        onLocale: setHostLocale,
        onPath: (path) => sync.applyPath(path),
      });
    }
    useUi.subscribe(sync.reflect);
  }

  const named = appName();
  if (named !== null) document.title = named;

  const { default: App } = await import("./app/App.tsx");
  createRoot(container as HTMLElement).render(
    <StrictMode>
      <I18nProvider>
        <App link={link} />
      </I18nProvider>
    </StrictMode>,
  );

  if (DEMO && preset !== null) {
    const { prepareScreen } = await import("./demo/presets.ts");
    await prepareScreen(preset);
  }
}

void boot();
