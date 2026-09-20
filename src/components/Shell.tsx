/**
 * TWO shells, switched by the demo dock's Diner | Kitchen segment.
 *
 * The Diner gets a warm marketing-site header and a real footer, because that
 * is what an order-ahead site is: a shop window with a till behind it. The
 * Kitchen gets a compact full-screen header with the board's own counts and
 * the clock, because a cook reads the queue, not the menu.
 *
 * That difference is the product story, so it lives in the chrome rather than
 * being simulated inside each screen.
 */

import { isEmbedded } from "../embed.ts";
import { DEMO } from "../surface.ts";
import type { ReactNode } from "react";
import {
  ChefHat,
  Clock,
  MapPin,
  Menu as MenuIcon,
  Moon,
  ShoppingBag,
  Sun,
  Timer,
  Utensils,
  X,
} from "lucide-react";

import { TAX_RATE } from "../state/store.ts";
import { appName } from "../i18n/ambient.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock, clockRange, label } from "../lib/format.ts";
import { allDayCounts, cartTotals, liveOrders } from "../lib/order.ts";
import { kitchenOpen, useStore } from "../state/store.ts";
import { Mono, Pill, SectionLabel } from "./Primitives.tsx";

/* ------------------------------------------------------------------- brand */

/**
 * What this app is CALLED on screen.
 *
 * The operator's name from Adminium when they set one, else the name this
 * build ships with. One helper rather than a `??` at each render site: a
 * sidebar, a wordmark and a dialog label that disagree about the name of the
 * app is a worse bug than any of them being wrong alone.
 *
 * Not localized, deliberately — an operator types one business name and it is
 * not Adminium's to translate. `chrome.brand` still is, for the apps that keep
 * the shipped one.
 */
function useBrand(): string {
  const { t } = useI18n();
  return appName() ?? t("chrome.brand");
}

function Wordmark({ onClick, label: text }: { onClick?: () => void; label?: string }) {
  const brand = useBrand();
  const inner = (
    <>
      <span className="jk-wmtile" aria-hidden="true">
        <Utensils size={17} />
      </span>
      <span className="jk-wmname">{brand}</span>
    </>
  );
  if (onClick === undefined) return <span className="jk-wordmark">{inner}</span>;
  return (
    <button type="button" className="jk-wordmark jk-btn" onClick={onClick} aria-label={text}>
      {inner}
    </button>
  );
}

/* --------------------------------------------------------------- diner nav */

interface NavEntry {
  key: "menu" | "hours" | "findus" | "track";
  labelKey: "chrome.nav.menu" | "chrome.nav.hours" | "chrome.nav.findUs" | "chrome.nav.track";
  icon: typeof Utensils;
}

const NAV: NavEntry[] = [
  { key: "menu", labelKey: "chrome.nav.menu", icon: Utensils },
  { key: "hours", labelKey: "chrome.nav.hours", icon: Clock },
  { key: "findus", labelKey: "chrome.nav.findUs", icon: MapPin },
  { key: "track", labelKey: "chrome.nav.track", icon: Timer },
];

function useNavEntries(): NavEntry[] {
  const myNums = useStore((s) => s.myNums);
  /* Track only exists once there is something to track. */
  return NAV.filter((entry) => entry.key !== "track" || myNums.length > 0);
}

function navigate(
  entry: NavEntry,
  go: (v: "menu" | "track") => void,
  goSection: (a: string) => void,
): void {
  if (entry.key === "menu") return go("menu");
  if (entry.key === "track") return go("track");
  goSection(entry.key);
}

function DinerNav({ onPick }: { onPick?: () => void }) {
  const { t } = useI18n();
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);
  const goSection = useStore((s) => s.goSection);
  const entries = useNavEntries();

  return (
    <nav className="jk-mainnav" aria-label={t("chrome.nav.label")}>
      {entries.map((entry) => (
        <button
          key={entry.key}
          type="button"
          className="jk-navlink jk-btn"
          aria-current={view === entry.key ? "page" : undefined}
          onClick={() => {
            navigate(entry, go, goSection);
            onPick?.();
          }}
        >
          {entry.key === "track" && <span className="jk-navlink__live" aria-hidden="true" />}
          {t(entry.labelKey)}
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------ diner header */

function DinerHeader() {
  const { t } = useI18n();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setNavOpen = useStore((s) => s.setNavOpen);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);
  const go = useStore((s) => s.go);
  const cart = useStore((s) => s.cart);
  const items = useStore((s) => s.items);
  const now = useStore((s) => s.now);

  const count = cartTotals(cart, items, TAX_RATE).count;
  const open = kitchenOpen(now);

  return (
    <header className="jk-shead">
      <div className="jk-site jk-shead__row">
        <button
          type="button"
          className="jk-iconbtn jk-btn jk-narrow-only"
          onClick={() => setNavOpen(true)}
          aria-label={t("chrome.menu.open")}
        >
          <MenuIcon size={17} aria-hidden="true" />
        </button>

        <Wordmark onClick={() => go("home")} label={t("chrome.brand.home")} />

        <div className="jk-wide-only">
          <DinerNav />
        </div>

        <span className="jk-shead__spacer" />

        <span className="jk-wide-only">
          <Pill tone={open ? "pos" : "muted"}>{t(open ? "chrome.open" : "chrome.closed")}</Pill>
        </span>

        <button
          type="button"
          className="jk-iconbtn jk-btn"
          onClick={toggleTheme}
          aria-label={t(theme === "dark" ? "chrome.dock.theme.light" : "chrome.dock.theme.dark")}
        >
          {theme === "dark" ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="jk-iconbtn jk-cartbtn jk-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label={t("chrome.cart.open", { count }, count)}
        >
          <ShoppingBag size={16} aria-hidden="true" />
          {/* Same reason as the tile's filename chip: the mono run goes inside. */}
          {count > 0 && (
            <span className="jk-cartbadge">
              <span className="jk-mono">{count}</span>
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- mobile nav */

function MobileNav() {
  const { t } = useI18n();
  const navOpen = useStore((s) => s.navOpen);
  const setNavOpen = useStore((s) => s.setNavOpen);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);
  const go = useStore((s) => s.go);
  const goSection = useStore((s) => s.goSection);
  const venue = useStore((s) => s.venue);
  const cart = useStore((s) => s.cart);
  const items = useStore((s) => s.items);
  const weekHours = useStore((s) => s.weekHours);
  const entries = useNavEntries();

  if (!navOpen) return null;

  const count = cartTotals(cart, items, TAX_RATE).count;
  const today = weekHours.find((d) => d.today === true) ?? weekHours[0];

  return (
    <>
      <button
        type="button"
        className="jk-scrim"
        aria-label={t("chrome.menu.close")}
        onClick={() => setNavOpen(false)}
      />
      <nav className="jk-sheet jk-mnav" aria-modal="true" role="dialog" aria-label={t("chrome.nav.label")}>
        <div className="jk-mnav__head">
          <Wordmark />
          <button
            type="button"
            className="jk-iconbtn jk-btn"
            style={{ marginInlineStart: "auto" }}
            onClick={() => setNavOpen(false)}
            aria-label={t("chrome.menu.close")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.key}
              type="button"
              className="jk-mnav__item jk-btn"
              onClick={() => {
                navigate(entry, go, goSection);
                setNavOpen(false);
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {t(entry.labelKey)}
            </button>
          );
        })}

        <button
          type="button"
          className="jk-mnav__item jk-btn"
          onClick={() => {
            setNavOpen(false);
            setDrawerOpen(true);
          }}
        >
          <ShoppingBag size={17} aria-hidden="true" />
          {t("chrome.nav.cart")}
          {count > 0 && (
            <span className="jk-cartbadge jk-cartbadge--inline">
              <span className="jk-mono">{count}</span>
            </span>
          )}
        </button>

        <div className="jk-mnav__foot">
          <span>
            {venue.line1} · {venue.line2}
          </span>
          <Mono>{clockRange(today.open, today.close)}</Mono>
        </div>
      </nav>
    </>
  );
}

/* ------------------------------------------------------------ diner footer */

function DinerFooter() {
  const { t } = useI18n();
  const go = useStore((s) => s.go);
  const goSection = useStore((s) => s.goSection);
  const venue = useStore((s) => s.venue);
  const weekHours = useStore((s) => s.weekHours);
  const today = weekHours.find((d) => d.today === true) ?? weekHours[0];

  return (
    <footer className="jk-foot">
      <div className="jk-site jk-footgrid">
        <div className="jk-foot__brand">
          <Wordmark />
          <p className="jk-foot__blurb">{t("chrome.footer.blurb")}</p>
          {/* Demo-only. The blurb above and the links beside it are the
              restaurant's real footer and stay in every build. */}
          {DEMO && (
            <>
              <p className="jk-foot__copy">{t("chrome.footer.copy")}</p>
              <span className="jk-mchip jk-mono">{t("chrome.footer.chip")}</span>
            </>
          )}
        </div>

        <div className="jk-foot__col">
          <SectionLabel>{t("chrome.footer.kitchen")}</SectionLabel>
          <button type="button" className="jk-footlink jk-btn" onClick={() => go("menu")}>
            {t("chrome.footer.theMenu")}
          </button>
          <button type="button" className="jk-footlink jk-btn" onClick={() => goSection("hours")}>
            {t("chrome.nav.hours")}
          </button>
          <button type="button" className="jk-footlink jk-btn" onClick={() => goSection("findus")}>
            {t("chrome.nav.findUs")}
          </button>
          {/* A deliberately cut page: it exists in the footer and 404s honestly. */}
          <button
            type="button"
            className="jk-footlink jk-btn"
            onClick={() => go("notfound")}
            title={t("chrome.footer.giftCards.title")}
          >
            {t("chrome.footer.giftCards")}
          </button>
        </div>

        <div className="jk-foot__col">
          <SectionLabel>{t("chrome.footer.today")}</SectionLabel>
          <span className="jk-foot__fact jk-mono">{clockRange(today.open, today.close)}</span>
          <span className="jk-foot__fact">{venue.line1}</span>
          <span className="jk-foot__fact">{venue.line2}</span>
          <span className="jk-foot__note">{t("chrome.footer.pickupOnly")}</span>
        </div>
      </div>
    </footer>
  );
}

function DinerShell({ children }: { children: ReactNode }) {
  return (
    <div className="jk-app">
      <DinerHeader />
      <main className="jk-main" id="main">
        {children}
      </main>
      <DinerFooter />
      <MobileNav />
    </div>
  );
}

/* ---------------------------------------------------------- kitchen header */

/*
 * THE ZONE CHIP IS GONE, and the warning it carried now lives in Adminium.
 *
 * It rendered "Dates shown in UTC" — or a city nobody confirmed — permanently,
 * in the header of every screen, for everyone. But an unset timezone is the
 * OPERATOR's to fix, on the connection, in Adminium; staff and customers
 * reading this app can do nothing about it and were shown it on every page
 * anyway. Studio's Connections card now names the zone dates actually render
 * in whenever a connection has none, which is both where the fix is and the
 * only audience that can apply it.
 *
 * `timezoneNotice()` stays in `i18n/ambient.ts`: the claim is still worth
 * carrying and still logged at boot. Nothing renders it.
 */

/**
 * The Kitchen's sticky header, including the all-day aggregate strip.
 *
 * The strip belongs up here rather than inside the screen because it is the
 * first thing a kitchen reads and the last thing it should have to scroll to:
 * how many of each thing are on the board, most first.
 */
function KitchenHeader() {
  const { t } = useI18n();
  const orders = useStore((s) => s.orders);
  const items = useStore((s) => s.items);
  const now = useStore((s) => s.now);
  const weekHours = useStore((s) => s.weekHours);
  const today = weekHours.find((d) => d.today === true) ?? weekHours[0];

  const live = liveOrders(orders).length;
  const done = orders.length - live;
  const aggregate = allDayCounts(orders, items);

  return (
    <header className="jk-khead">
      <div className="jk-khead__row">
        <span className="jk-wmtile" aria-hidden="true">
          <ChefHat size={17} />
        </span>
        <span className="jk-khead__title">
          <span className="jk-khead__name">{t("kitchen.title")}</span>
          <span className="jk-khead__sub">
            {t("kitchen.serviceSince", { time: clock(today.open) })}
          </span>
        </span>
        <span className="jk-shead__spacer" />
        <Pill tone="accent">{t("kitchen.onBoard", { count: live }, live)}</Pill>
        <span className="jk-wide-only">
          <Pill tone="pos">{t("kitchen.pickedUp", { count: done }, done)}</Pill>
        </span>
        <Mono className="jk-khead__clock">{clock(now)}</Mono>
      </div>

      <div className="jk-khead__agg">
        <SectionLabel>{t("kitchen.allDay")}</SectionLabel>
        <div className="jk-aggrow jk-scroll">
          {aggregate.length === 0 && (
            <span className="jk-khead__quiet">{t("kitchen.allDay.empty")}</span>
          )}
          {aggregate.map(({ item, count }) => (
            <span key={item.id} className="jk-mchip">
              {label(item.short)} <Mono>×{count}</Mono>
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

function KitchenShell({ children }: { children: ReactNode }) {
  return (
    <div className="jk-kwrap">
      <KitchenHeader />
      <main className="jk-kmain" id="main">
        {children}
      </main>
    </div>
  );
}

/**
 * NO CHROME AT ALL — the internal placement (29-app-surfaces.md D6).
 *
 * Blended into the Adminium dashboard, this app's screens render inside the
 * dashboard's own shell: Adminium's sidebar carries this app's sections and its
 * topbar carries the account menu, the theme control and the language control.
 * Rendering our own alongside would be two sidebars, two theme toggles and two
 * brands in one window.
 *
 * `#main` is kept, because the skip link targets it and a skip link pointing at
 * nothing is worse than no skip link.
 */
function EmbeddedShell({ children }: { children: ReactNode }) {
  return (
    <div className="jk-embedded">
      <main className="jk-kmain" id="main">
        {children}
      </main>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const persona = useStore((s) => s.persona);
  /*
   * A runtime check, not a build flag, and that is the point: ONE hosted-staff
   * bundle serves both placements. Opened directly at its own URL it renders
   * the full kitchen chrome; framed by the dashboard it renders none.
   * Switching placement is a setting in Studio, not a rebuild.
   */
  if (isEmbedded()) return <EmbeddedShell>{children}</EmbeddedShell>;
  return persona === "kitchen" ? (
    <KitchenShell>{children}</KitchenShell>
  ) : (
    <DinerShell>{children}</DinerShell>
  );
}
