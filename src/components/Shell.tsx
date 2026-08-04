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

import { TAX_RATE } from "../data/demo.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock, clockRange, label } from "../lib/format.ts";
import { allDayCounts, cartTotals, liveOrders } from "../lib/order.ts";
import { kitchenOpen, useStore } from "../state/store.ts";
import { Mono, Pill, SectionLabel } from "./Primitives.tsx";

/* ------------------------------------------------------------------- brand */

function Wordmark({ onClick, label: text }: { onClick?: () => void; label?: string }) {
  const { t } = useI18n();
  const inner = (
    <>
      <span className="jk-wmtile" aria-hidden="true">
        <Utensils size={17} />
      </span>
      <span className="jk-wmname">{t("chrome.brand")}</span>
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
          <p className="jk-foot__copy">{t("chrome.footer.copy")}</p>
          <span className="jk-mchip jk-mono">{t("chrome.footer.chip")}</span>
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

export default function Shell({ children }: { children: ReactNode }) {
  const persona = useStore((s) => s.persona);
  return persona === "kitchen" ? (
    <KitchenShell>{children}</KitchenShell>
  ) : (
    <DinerShell>{children}</DinerShell>
  );
}
