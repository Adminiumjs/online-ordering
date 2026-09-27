/**
 * The order page's frame: the sticky header (mark, name, navigation, the
 * open pill, theme, cart), the banner when online orders are off, the mobile
 * navigation, the footer with its language picker, and the toast.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Icon } from "../components/Icon.tsx";
import { Bdi } from "../components/Bdi.tsx";
import { useI18n, LOCALES, LOCALE_TAGS, type LocaleTag } from "../i18n/index.tsx";
import { telHref } from "../lib/format.ts";
import { cartCount, setDrawer, useDiner } from "../state/diner.ts";
import { lastLink } from "../state/track.ts";
import { goDiner, setTheme, useUi } from "../state/ui.ts";
import { useFmt, useVenue } from "../app/venue.ts";
import { useDay, type DayFacts } from "./useDay.ts";
import { Toaster } from "../components/Toaster.tsx";

/** The open pill's words and tone. */
export function useOpenPill(day: DayFacts): { label: string; tone: "pos" | "warn" | "info" | "neutral" } {
  const { t } = useI18n();
  const fmt = useFmt();
  if (day.paused) return { label: t("shell.pill.paused"), tone: "warn" };
  if (day.state === "open" || day.state === "noSlots") return { label: t("shell.pill.open", { time: fmt.wall(day.today, day.hours.closes) }), tone: "pos" };
  if (day.state === "later") return { label: t("shell.pill.later", { time: fmt.wall(day.today, day.hours.opens) }), tone: "info" };
  if (day.state === "closedToday") return { label: t("shell.pill.closedToday"), tone: "neutral" };
  if (day.nextOpen === null || day.nextHours === null) return { label: t("shell.pill.closed"), tone: "neutral" };
  const time = fmt.wall(day.nextOpen, day.nextHours.opens);
  return day.nextOpen === day.tomorrow ? { label: t("shell.pill.backTomorrow", { time }), tone: "neutral" } : { label: t("shell.pill.backOn", { day: fmt.weekday(day.nextOpen), time }), tone: "neutral" };
}

export function OpenPill({ day }: { day: DayFacts }) {
  const pill = useOpenPill(day);
  return (
    <span className={`jk-pill tone-${pill.tone}`}>
      <span className="jk-pill-dot" />
      {pill.label}
    </span>
  );
}

/** The kitchen's mark: an accent tile with its initial. */
export function Mark({ size = 32, name }: { size?: number; name: string }) {
  return (
    <span aria-hidden="true" style={{ flex: "none", width: size, height: size, borderRadius: size * 0.31, background: "var(--accent)", color: "var(--accent-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.47, fontWeight: 800, letterSpacing: "-.02em" }}>
      {(name.trim()[0] ?? "·").toUpperCase()}
    </span>
  );
}

/** Scrolls to a section of Home, from any view. */
export function toSection(id: "jn-hours" | "jn-findus"): void {
  const go = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (useUi.getState().dinerView !== "home") {
    goDiner("home");
    setTimeout(go, 90);
  } else {
    useUi.setState({ mobileMenu: false });
    setTimeout(go, 20);
  }
}

/** "Track an order": this device's last order, or Find my order. */
export function trackAnOrder(): void {
  const link = lastLink();
  if (link !== null) {
    window.location.hash = link;
    goDiner("track");
  } else goDiner("find");
}

function Header({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const view = useUi((s) => s.dinerView);
  const theme = useUi((s) => s.theme);
  const count = useDiner((s) => cartCount(s.cart));
  const [wide, setWide] = useState(() => typeof window === "undefined" || window.innerWidth >= 1000);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 1000);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const links: { id: string; label: string; current: boolean; go: () => void }[] = [
    { id: "menu", label: t("shell.nav.menu"), current: view === "menu", go: () => goDiner("menu") },
    { id: "hours", label: t("shell.nav.hours"), current: false, go: () => toSection("jn-hours") },
    { id: "findus", label: t("shell.nav.findUs"), current: false, go: () => toSection("jn-findus") },
    { id: "orders", label: t("shell.nav.orders"), current: view === "orders", go: () => goDiner("orders") },
    { id: "track", label: t("shell.nav.track"), current: view === "track" || view === "find", go: trackAnOrder },
  ];
  return (
    <header style={{ position: "sticky", insetBlockStart: 0, zIndex: 200, background: "var(--surface-header)", backdropFilter: "blur(14px)", borderBlockEnd: "1px solid var(--border)" }}>
      <div className="jk-shell">
        <div style={{ display: "flex", alignItems: "center", gap: wide ? 14 : 10, height: 70 }}>
          {!wide && (
            <button className="jn-gi jk-iconbtn" onClick={() => useUi.setState({ mobileMenu: true })} aria-label={t("shell.nav.open")} style={{ borderColor: "var(--border-strong)", color: "var(--fg)" }}>
              <Icon name="menu" size={18} />
            </button>
          )}
          <button onClick={() => goDiner("home")} aria-label={t("shell.home", { name: venue.name })} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "var(--fg)" }}>
            <Mark name={venue.name} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontSize: 17.5, fontWeight: 800, letterSpacing: "-.035em", whiteSpace: "nowrap" }}>{venue.name}</span>
          </button>
          {wide && (
            <nav aria-label={t("shell.nav.label")} style={{ display: "flex", alignItems: "center", gap: 4, marginInlineStart: 12 }}>
              {links.map((l) => (
                <button key={l.id} className="jn-nav" onClick={l.go} aria-current={l.current ? "page" : undefined} style={{ display: "inline-flex", alignItems: "center", border: "none", padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: l.current ? "var(--accent-ink)" : "var(--fg-muted)", background: l.current ? "var(--accent-soft)" : "transparent" }}>
                  {l.label}
                </button>
              ))}
            </nav>
          )}
          <div style={{ flex: "none", marginInlineStart: "auto", display: "flex", alignItems: "center", gap: wide ? 9 : 7 }}>
            {wide && <OpenPill day={day} />}
            <button className="jn-gi jk-iconbtn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("shell.theme")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
            </button>
            <button className="jn-btn" onClick={() => setDrawer(true)} aria-label={t("shell.cart.aria", {}, count)} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8, height: 38, paddingInline: 15, borderRadius: 11, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
              <Icon name="shopping-bag" size={16} />
              {t("shell.cart")}
              {count > 0 && (
                <span className="jk-mono" style={{ minWidth: 20, height: 20, paddingInline: 5, borderRadius: 999, background: "var(--accent-fg)", color: "var(--accent-ink)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function OffBanner({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const view = useUi((s) => s.dinerView);
  if (!day.paused || (view !== "home" && view !== "menu")) return null;
  const key = !day.online ? (venue.phone === null ? "shell.off.onlineNoPhone" : "shell.off.online") : venue.phone === null ? "shell.off.todayNoPhone" : "shell.off.today";
  const [before, after] = t(key, { phone: "\u0000" }).split("\u0000");
  return (
    <div role="status" style={{ background: "var(--warn-soft)", borderBlockEnd: "1px solid var(--border)" }}>
      <div className="jk-shell">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingBlock: 12, fontSize: 13.5, fontWeight: 700, lineHeight: 1.5, color: "var(--warn)" }}>
          <Icon name="power-off" size={16} />
          <span>
            {before}
            {venue.phone !== null && after !== undefined && (
              <a href={telHref(venue.phone)} className="jk-mono" style={{ fontWeight: 700, color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
                <Bdi>{venue.phone}</Bdi>
              </a>
            )}
            {after}
          </span>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const open = useUi((s) => s.mobileMenu);
  const view = useUi((s) => s.dinerView);
  const count = useDiner((s) => cartCount(s.cart));
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") useUi.setState({ mobileMenu: false });
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      back?.focus();
    };
  }, [open]);
  if (!open) return null;
  const close = () => useUi.setState({ mobileMenu: false });
  const links: { id: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; go: () => void }[] = [
    { id: "home", label: t("shell.nav.home"), icon: "house", go: () => goDiner("home") },
    { id: "menu", label: t("shell.nav.menu"), icon: "utensils", go: () => goDiner("menu") },
    { id: "orders", label: t("shell.nav.orders"), icon: "rotate-ccw", go: () => goDiner("orders") },
    { id: "hours", label: t("shell.nav.hours"), icon: "clock", go: () => toSection("jn-hours") },
    { id: "findus", label: t("shell.nav.findUs"), icon: "map-pin", go: () => toSection("jn-findus") },
    { id: "large", label: t("shell.nav.large"), icon: "users", go: () => goDiner("large") },
    { id: "track", label: t("shell.nav.track"), icon: "radar", go: trackAnOrder },
  ];
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 450, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "jn-scrim .18s ease" }}>
      <nav
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t("shell.nav.dialog")}
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, width: "min(320px,88%)", display: "flex", flexDirection: "column", padding: 18, background: "var(--surface)", borderInlineEnd: "1px solid var(--border)", animation: `${document.documentElement.dir === "rtl" ? "jn-drawer" : "jn-drawer-rtl"} .24s cubic-bezier(.2,.8,.2,1)` }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 22 }}>
          <Mark name={venue.name} />
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.035em" }}>{venue.name}</span>
          <button className="jn-gi jk-iconbtn is-sm" onClick={close} aria-label={t("shell.nav.close")} style={{ marginInlineStart: "auto" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <OpenPill day={day} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBlockStart: 20 }}>
          {links.map((l) => {
            const on = view === l.id;
            return (
              <button key={l.id} className="jn-gi" onClick={l.go} aria-current={on ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 11, height: 46, paddingInline: 13, borderRadius: 12, border: `1px solid ${on ? "var(--border)" : "transparent"}`, background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent-ink)" : "var(--fg)", fontSize: 14.5, fontWeight: 700, cursor: "pointer", textAlign: "start" }}>
                <Icon name={l.icon} size={16} />
                {l.label}
              </button>
            );
          })}
        </div>
        <button className="jn-btn" onClick={() => { close(); setDrawer(true); }} style={{ marginBlockStart: "auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 48, borderRadius: 13, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
          <Icon name="shopping-bag" size={17} />
          {count > 0 ? t("shell.cart.mobile", { count }) : t("shell.cart.mobileEmpty")}
        </button>
      </nav>
    </div>
  );
}

export function LanguagePicker({ up = true }: { up?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    box.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button className="jn-gi" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={t("shell.language")} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, paddingInline: 10, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        <Icon name="languages" size={14} />
        <span lang={locale}>{LOCALES[locale].native}</span>
        <Icon name={up ? "chevron-up" : "chevron-down"} size={12} />
      </button>
      {open && (
        <div role="menu" aria-label={t("shell.language")} style={{ position: "absolute", insetInlineStart: 0, ...(up ? { insetBlockEnd: 40 } : { insetBlockStart: 40 }), zIndex: 20, width: 190, padding: 5, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 14px 34px rgba(20,20,35,.2)", display: "flex", flexDirection: "column", gap: 2 }}>
          {LOCALE_TAGS.map((tag: LocaleTag) => {
            const on = tag === locale;
            return (
              <button key={tag} className="jn-gi" role="menuitemradio" aria-checked={on} lang={tag} onClick={() => { setLocale(tag); setOpen(false); }} style={{ width: "100%", height: 30, padding: "0 9px", borderRadius: 8, border: "none", display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: on ? 800 : 600, background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent-ink)" : "var(--fg)", cursor: "pointer", textAlign: "start" }}>
                <span>{LOCALES[tag].native}</span>
                {on && <Icon name="check" size={13} style={{ marginInlineStart: "auto" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Footer({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const fmt = useFmt();
  const link = (label: string, href: string, go: () => void) => ({ label, href, go });
  const columns = [
    { title: t("shell.footer.order"), links: [link(t("shell.footer.menu"), "menu", () => goDiner("menu")), link(t("shell.footer.cart"), "cart", () => goDiner("cart")), link(t("shell.nav.orders"), "orders", () => goDiner("orders")), link(t("shell.nav.track"), "find", trackAnOrder)] },
    { title: venue.name, links: [link(t("shell.nav.hours"), "#hours", () => toSection("jn-hours")), link(t("shell.nav.findUs"), "#find-us", () => toSection("jn-findus")), link(t("shell.nav.large"), "large", () => goDiner("large"))] },
  ];
  return (
    <footer style={{ borderBlockStart: "1px solid var(--border)", background: "var(--surface)" }}>
      <div className="jk-shell">
        <div style={{ display: "flex", gap: "clamp(18px,4vw,50px)", flexWrap: "wrap", paddingBlock: "clamp(26px,4vw,44px)" }}>
          <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mark name={venue.name} />
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.035em" }}>{venue.name}</span>
            </span>
            {venue.about !== null && <p style={{ margin: 0, maxWidth: "34ch", fontSize: 13, lineHeight: 1.6, color: "var(--fg-muted)" }}>{venue.about}</p>}
          </div>
          <div style={{ display: "flex", gap: "clamp(24px,5vw,60px)", flexWrap: "wrap" }}>
            {columns.map((c) => (
              <nav key={c.title} aria-label={c.title} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 110 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>{c.title}</span>
                {c.links.map((l) => (
                  <a key={l.label} className="jn-nav" href={l.href} onClick={(e) => { e.preventDefault(); l.go(); }} style={{ alignSelf: "flex-start", color: "var(--fg-muted)", fontSize: 13, fontWeight: 600 }}>
                    {l.label}
                  </a>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBlock: "16px 76px", borderBlockStart: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("shell.footer.copyright", { year: fmt.year(day.now), name: venue.name })}</span>
          <LanguagePicker />
          <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--fg-subtle)" }}>
            <Icon name="shopping-bag" size={13} />
            {t("shell.footer.pickupOnly")}
          </span>
        </div>
      </div>
    </footer>
  );
}

export function DinerShell({ children }: { children: ReactNode }) {
  const day = useDay();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--fg)" }}>
      <Header day={day} />
      <OffBanner day={day} />
      <main id="main" style={{ flex: 1 }}>{children}</main>
      <Footer day={day} />
      <MobileMenu day={day} />
      <Toaster />
    </div>
  );
}
