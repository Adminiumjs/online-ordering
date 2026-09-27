/**
 * The kitchen: its header (the day, the counts, tomorrow, the clock, sound,
 * the connection, who is signed in), the tabs, today's all-day tally, the
 * tab's screen, and what opens over it. New orders chime, pulse and are said
 * aloud; the screen stays awake while it is open.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Icon, type IconName } from "../components/Icon.tsx";
import { Toaster } from "../components/Toaster.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import { useNow } from "../data/sources.ts";
import { useI18n } from "../i18n/index.tsx";
import { hoursOn } from "../lib/day.ts";
import { addDays } from "../lib/venueTime.ts";
import { checkSession, dayOf, freshPhone, goLive, kToday, loadKitchen, num, refreshAll, signIn, signOut, useKitchen, whenOrderArrives, type KitchenTab } from "../state/kitchen.ts";
import { setTheme, toast, useUi } from "../state/ui.ts";
import { Board, useBoard } from "./Board.tsx";
import { Hours } from "./Hours.tsx";
import { PhoneOrder } from "./Phone.tsx";
import { CancelSheet, HandOffSheet, Ticket, TomorrowSheet } from "./Sheets.tsx";
import { Shelf } from "./Shelf.tsx";
import { Slots } from "./Slots.tsx";
import { TodayMenu } from "./TodayMenu.tsx";
import { useKFmt } from "./fmt.ts";
import { armSound, chime, keepAwake, setSoundOn, useSound } from "./sound.ts";

const TABS: { id: KitchenTab; key: string; icon: IconName }[] = [
  { id: "queue", key: "kitchen.tab.queue", icon: "layout-list" },
  { id: "slots", key: "kitchen.tab.slots", icon: "timer" },
  { id: "shelf", key: "kitchen.tab.shelf", icon: "hand-platter" },
  { id: "menu", key: "kitchen.tab.menu", icon: "list-checks" },
  { id: "hours", key: "kitchen.tab.hours", icon: "clock" },
];

const WAIT_MS = 60_000;

function Mark() {
  return (
    <span aria-hidden="true" style={{ flex: "none", width: 32, height: 32, borderRadius: 10, background: "var(--accent)", color: "var(--accent-fg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name="chef-hat" size={16} />
    </span>
  );
}

function SignedOut() {
  const { t } = useI18n();
  return (
    <main id="main" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(420px,100%)", display: "flex", flexDirection: "column", gap: 14, padding: 28, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Mark />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.034em" }}>{t("kitchen.out.title")}</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)" }}>{t("kitchen.out.body")}</p>
        <button className="jn-btn jk-btn-primary" onClick={() => void signIn()} style={{ alignSelf: "flex-start", height: 46, padding: "0 20px", borderRadius: 12, fontSize: 14 }}>
          <Icon name="log-in" size={16} />
          {t("kitchen.out.signIn")}
        </button>
      </div>
    </main>
  );
}

function PersonMenu() {
  const { t } = useI18n();
  const person = useKitchen((s) => s.person);
  const open = useKitchen((s) => s.personMenu);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => {
      if (box.current !== null && !box.current.contains(e.target as Node)) useKitchen.setState({ personMenu: false });
    };
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") useKitchen.setState({ personMenu: false });
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button className="jn-gi" onClick={() => useKitchen.setState({ personMenu: !open })} aria-haspopup="menu" aria-expanded={open} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 11, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
        <Icon name="user-round" size={14} />
        <bdi>{person?.name ?? ""}</bdi>
        <Icon name="chevron-down" size={13} style={{ color: "var(--fg-subtle)" }} />
      </button>
      {open && (
        <div role="menu" aria-label={person?.name ?? ""} style={{ position: "absolute", insetInlineEnd: 0, insetBlockStart: 40, zIndex: 30, width: 170, padding: 5, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 14px 34px rgba(20,20,35,.2)" }}>
          <button className="jn-gi" role="menuitem" onClick={() => void signOut()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, height: 36, paddingInline: 10, borderRadius: 8, border: "none", background: "transparent", color: "var(--fg)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Icon name="log-out" size={14} />
            {t("orders.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const k = useKitchen();
  const board = useBoard();
  const sound = useSound();
  const theme = useUi((s) => s.theme);
  const today = kToday(now);
  const hours = hoursOn(today, k.hours, k.closures);
  const picked = k.orders.filter((o) => dayOf(o) === today && o.order["status"] === "picked_up").length;
  const tomorrow = k.orders.filter((o) => dayOf(o) === addDays(today, 1) && o.order["status"] !== "cancelled").length;
  const pausedAhead = (k.slots[today] ?? []).filter((s) => s.pause !== null && Date.parse(s.at) >= now).length;
  const ready = board.filter((o) => o.order["status"] === "ready").length;
  const badges: Record<KitchenTab, number> = { queue: board.length, slots: pausedAhead, shelf: ready, menu: 0, hours: 0 };
  const venue = String(k.settings?.["venue_name"] ?? "");
  const tabKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = TABS.findIndex((x) => x.id === k.tab);
    const rtl = document.documentElement.dir === "rtl";
    const by = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : e.key === "Home" ? -at : e.key === "End" ? TABS.length - 1 - at : 0;
    if (by === 0) return;
    e.preventDefault();
    const next = TABS[(at + by + TABS.length) % TABS.length]!;
    useKitchen.setState({ tab: next.id });
    e.currentTarget.querySelector<HTMLElement>(`#jn-ktab-${next.id}`)?.focus();
  };
  const chip = { display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 11, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", whiteSpace: "nowrap" } as const;
  const tally = new Map<string, { name: string; n: number; first: number }>();
  board.forEach((o, i) =>
    o.lines.forEach((l) => {
      const name = String(l["name"]);
      const was = tally.get(name);
      tally.set(name, { name, n: (was?.n ?? 0) + num(l["qty"], 1), first: was?.first ?? i });
    }),
  );
  const allDay = [...tally.values()].sort((a, b) => b.n - a.n || a.first - b.first);
  return (
    <header style={{ flex: "none", borderBlockEnd: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px clamp(14px,2.2vw,24px)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Mark />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "-.03em" }}>{t("kitchen.title", { name: venue })}</h1>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
              {hours.open ? t("kitchen.openToday", { from: fmt.wall(today, hours.opens), to: fmt.wall(today, hours.closes) }) : hours.closure?.reason ? t("kitchen.closedTodayFor", { reason: hours.closure.reason }) : t("kitchen.closedToday")}
            </span>
          </span>
        </span>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={chip}>
            <span className="jk-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-ink)" }}>
              {fmt.number(board.length)}
            </span>
            {t("kitchen.stat.board", {}, board.length)}
          </span>
          <span style={chip}>
            <span className="jk-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--pos)" }}>
              {fmt.number(picked)}
            </span>
            {t("kitchen.stat.picked", {}, picked)}
          </span>
          <button className="jn-gi" disabled={tomorrow === 0} onClick={() => useKitchen.setState({ tomorrow: true })} style={{ ...chip, cursor: tomorrow === 0 ? "default" : "pointer" }}>
            {tomorrow === 0 ? (
              t("kitchen.tomorrowNone")
            ) : (
              <>
                <span className="jk-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--info)" }}>
                  {fmt.number(tomorrow)}
                </span>
                {t("kitchen.stat.tomorrow", {}, tomorrow)}
                <Icon name="chevron-right" size={13} className="jk-flip" />
              </>
            )}
          </button>
          <span className="jk-mono" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 11, borderRadius: 10, background: "var(--fg)", color: "var(--bg)", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>
            <Icon name="clock" size={14} />
            {fmt.time(now)}
          </span>
          <button className="jn-gi jk-iconbtn is-sm" onClick={() => setSoundOn(!sound.on)} title={t("kitchen.sound")} aria-label={t("kitchen.sound")} aria-pressed={sound.on}>
            <Icon name={sound.on ? "volume-2" : "volume-x"} size={15} />
          </button>
          <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 11, borderRadius: 10, background: k.conn === "live" ? "var(--pos-soft)" : "var(--warn-soft)", color: k.conn === "live" ? "var(--pos)" : "var(--warn)", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>
            {k.conn === "live" ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--pos)" }} /> : <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} />}
            {k.conn === "live" ? t("kitchen.live") : t("kitchen.reconnecting")}
          </span>
          <PersonMenu />
          <button className="jn-gi jk-iconbtn is-sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("shell.theme")} title={t("shell.theme")}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", padding: "0 clamp(14px,2.2vw,24px) 10px" }}>
        <button className="jn-btn" onClick={() => useKitchen.setState({ phone: freshPhone() })} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, paddingInline: 12, borderRadius: 9, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 12.5, fontWeight: 800, cursor: "pointer", marginInlineEnd: 8 }}>
          <Icon name="phone-incoming" size={14} />
          {t("kitchen.phoneOrder.title")}
        </button>
        <div role="tablist" aria-label={t("shell.kitchen")} onKeyDown={tabKeys} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const on = k.tab === tab.id;
            const badge = badges[tab.id];
            return (
              <button key={tab.id} id={`jn-ktab-${tab.id}`} className="jn-chip" role="tab" aria-selected={on} aria-controls="jn-kpanel" tabIndex={on ? 0 : -1} onClick={() => useKitchen.setState({ tab: tab.id })} style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, paddingInline: 12, borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: on ? "var(--fg)" : "transparent", color: on ? "var(--bg)" : "var(--fg-muted)" }}>
                <Icon name={tab.icon} size={14} />
                {t(tab.key as "kitchen.tab.queue")}
                {badge > 0 && (
                  <span className="jk-mono" style={{ minWidth: 18, height: 18, paddingInline: 5, borderRadius: 6, background: on ? "var(--bg)" : "var(--surface-3)", color: on ? "var(--fg)" : "var(--fg-muted)", fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {fmt.number(badge)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="jn-row" role="region" aria-label={t("kitchen.allDay")} tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px clamp(14px,2.2vw,24px)", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)", overflowX: "auto" }}>
        <span className="jk-kicker" style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="list" size={13} />
          {t("kitchen.allDay")}
        </span>
        <ul style={{ display: "flex", alignItems: "center", gap: 7, margin: 0, padding: 0, listStyle: "none" }}>
          {allDay.length === 0 && <li style={{ fontSize: 12.5, color: "var(--fg-subtle)" }}>{t("kitchen.allDayNone")}</li>}
          {allDay.map((a) => (
            <li key={a.name} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
              {a.name}
              <span className="jk-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-ink)" }}>
                {t("co.qty", { qty: fmt.number(a.n) })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

/** Chimes, pulses and says a new order; asks for a tap when the browser keeps the sound off; keeps the screen awake. */
function useArrivals(say: (text: string) => void): void {
  const { t } = useI18n();
  const chimed = useRef(new Map<number, number>());
  useEffect(() => {
    whenOrderArrives((order: OrderWithLines) => {
      const played = chime();
      chimed.current.set(order.order.id, Date.now());
      const text = t("kitchen.arrived", { number: String(order.order["number"]), name: String(order.order["name"] ?? "") });
      toast(text, "bell", { ...(played || !useSound.getState().on ? {} : { suffix: t("kitchen.soundOff") }), actionLabel: t("kitchen.open"), undo: () => useKitchen.setState({ ticket: order.order.id }) });
      say(text);
    });
    const release = keepAwake();
    // Still New after a minute: chime again, pulse, say it.
    const remind = () => {
      const now = Date.now();
      const { orders } = useKitchen.getState();
      const today = kToday();
      for (const o of orders) {
        if (o.order["status"] !== "placed" || dayOf(o) !== today) continue;
        const placed = Date.parse(String(o.order["placed_at"] ?? 0));
        if (now - placed < WAIT_MS) continue;
        if (now - (chimed.current.get(o.order.id) ?? 0) < WAIT_MS) continue;
        chimed.current.set(o.order.id, now);
        chime();
        useKitchen.setState({ pulse: [...useKitchen.getState().pulse.filter((id) => id !== o.order.id), o.order.id] });
        say(t("kitchen.stillWaiting", { number: String(o.order["number"]) }));
      }
    };
    const timer = setInterval(remind, 15_000);
    const back = () => {
      if (document.visibilityState !== "visible") return;
      void refreshAll().then(remind);
    };
    document.addEventListener("visibilitychange", back);
    return () => {
      whenOrderArrives(null);
      release();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [t, say]);
}

export default function KitchenApp() {
  const { t } = useI18n();
  const k = useKitchen();
  const sound = useSound();
  const now = useNow();
  const [said, setSaid] = useState("");
  const say = useRef((text: string) => setSaid(text)).current;
  const day = kToday(now);
  useEffect(() => {
    void loadKitchen();
    const stop = goLive();
    const session = setInterval(() => void checkSession(), 60_000);
    return () => {
      stop();
      clearInterval(session);
    };
  }, []);
  // The day turned: read everything for the new one.
  useEffect(() => {
    if (useKitchen.getState().load === "ok") void refreshAll();
  }, [day]);
  useArrivals(say);

  const Panel = { queue: Board, slots: Slots, shelf: Shelf, menu: TodayMenu, hours: Hours }[k.tab];
  return (
    <div
      // Any tap wakes the sound — on the click, never the press: the banner that asks for it
      // leaves as the sound starts, and on a press the board would move under the finger.
      onClickCapture={() => {
        if (sound.on && !sound.running) armSound();
      }}
      style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--fg)", overflow: "hidden" }}>
      <a className="jn-sr jk-skip" href="#jn-kpanel">
        {t("shell.skip")}
      </a>
      {k.signedOut ? (
        <SignedOut />
      ) : (
        <>
          <Header />
          {k.conn === "reconnecting" && (
            <div role="status" style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, padding: "9px clamp(14px,2.2vw,24px)", background: "var(--warn-soft)", color: "var(--warn)", fontSize: 13, fontWeight: 700, borderBlockEnd: "1px solid var(--border)" }}>
              <Icon name="wifi-off" size={15} />
              {t("kitchen.outOfDate")}
            </div>
          )}
          {sound.on && !sound.running && (
            <button onClick={armSound} style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", padding: "9px clamp(14px,2.2vw,24px)", border: "none", borderBlockEnd: "1px solid var(--border)", background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              <Icon name="volume-2" size={15} />
              {t("kitchen.tapSound")}
            </button>
          )}
          <main id="jn-kpanel" role="tabpanel" aria-labelledby={`jn-ktab-${k.tab}`} tabIndex={-1} className="jn-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "clamp(12px,2vw,20px) clamp(14px,2.2vw,24px) clamp(80px,8vw,96px)", opacity: k.conn === "reconnecting" ? 0.55 : 1, transition: "opacity .2s ease" }}>
            {k.load === "busy" && <div aria-busy="true" aria-label={t("shell.loading")} className="jn-skel" style={{ height: 240, borderRadius: 16 }} />}
            {k.load === "err" && (
              <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 22px", borderRadius: 16, border: "1px dashed var(--border-strong)", background: "var(--surface)" }}>
                <Icon name="wifi-off" size={18} style={{ color: "var(--fg-subtle)" }} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{t("kitchen.loadError")}</span>
                <button className="jn-gi jk-btn-sm" onClick={() => void loadKitchen()} style={{ marginInlineStart: "auto" }}>
                  <Icon name="rotate-cw" size={14} />
                  {t("shell.retry")}
                </button>
              </div>
            )}
            {k.load === "ok" && <Panel />}
          </main>
          <Ticket />
          <CancelSheet />
          <HandOffSheet />
          <TomorrowSheet />
          <PhoneOrder />
        </>
      )}
      <span className="jn-sr" role="status" aria-live="polite">
        {said}
      </span>
      <Toaster />
    </div>
  );
}
