/**
 * The queue: today's orders in four columns — New, Confirmed, Preparing,
 * Ready — each card with its lines, notes, a chip that says in words how
 * the time stands, and the one button that moves it on.
 *
 * An order paid online reaches the board when its payment is in, as a new
 * order with a "Paid" chip; one still waiting for its diner's payment is not
 * on it. A paid order cancelled whose money has not gone back yet is listed
 * above the columns as "Refund owed", for everyone in the kitchen to see.
 *
 * A ready order whose diner asked for a text says, in one small line, how
 * that text stands: held while the Undo is there, then sent or why not.
 */
import { useEffect, useState } from "react";

import { Icon, type IconName } from "../components/Icon.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import type { Row } from "../data/wire.ts";
import { useNow } from "../data/sources.ts";
import { useI18n, type TFunction } from "../i18n/index.tsx";
import type { Formatter } from "../lib/format.ts";
import { storedOptionsText } from "../lib/menu.ts";
import { BOARD, NEXT, dayOf, kToday, num, owed, owedOrders, refundOwed, useKitchen, type BoardState, NO_CARD } from "../state/kitchen.ts";
import { useUi } from "../state/ui.ts";
import { useKFmt } from "./fmt.ts";
import { advance, undo, useRecentMove } from "./moves.ts";
import { OUTCOME_WORD, textOutcome, type TextOutcome } from "./textState.ts";

const TEXT_LOOK: Record<Exclude<TextOutcome, "waiting">, { icon: IconName; color: string }> = {
  sent: { icon: "send", color: "var(--pos)" },
  "no-number": { icon: "circle-slash", color: "var(--fg-muted)" },
  "opted-out": { icon: "circle-slash", color: "var(--fg-muted)" },
  limit: { icon: "triangle-alert", color: "var(--warn)" },
  unknown: { icon: "triangle-alert", color: "var(--warn)" },
  "not-sent": { icon: "circle-slash", color: "var(--fg-muted)" },
};

/**
 * How a ready order's text stands: while this screen's Undo is there, the
 * text waits and the seconds run down; then it is on its way; then sent, or
 * why not. Small, and never a button: nothing here stops the kitchen.
 */
export function TextLine({ order }: { order: OrderWithLines }) {
  const { t } = useI18n();
  const recent = useRecentMove();
  const offered = useKitchen((s) => s.settings?.["ready_text_on"] === true);
  const o = order.order;
  const outcome = textOutcome(o, order.texts, { offered });
  const holding = outcome === "waiting" && recent.id === o.id && recent.to === "ready" && Date.now() < recent.until;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(timer);
  }, [holding]);
  if (outcome === null) return null;
  const line = { display: "flex", alignItems: "center", gap: 6, marginBlockEnd: 11, fontSize: 12, fontWeight: 700 } as const;
  if (outcome === "waiting") {
    const seconds = Math.max(1, Math.ceil((recent.until - Date.now()) / 1000));
    return (
      <div data-text-state={holding ? "held" : "sending"} style={{ ...line, color: "var(--fg-muted)" }}>
        <Icon name={holding ? "hourglass" : "message-square"} size={13} style={{ color: "var(--accent-ink)" }} />
        {holding ? <span>{t("kitchen.text.wait", { seconds: String(seconds) })}</span> : <span role="status">{t("kitchen.text.sending")}</span>}
      </div>
    );
  }
  const look = TEXT_LOOK[outcome];
  return (
    <div data-text-state={outcome} style={{ ...line, color: look.color }}>
      <Icon name={look.icon} size={13} />
      <span role="status">{t(OUTCOME_WORD[outcome] as "kitchen.text.sent")}</span>
    </div>
  );
}

const COLUMNS: Record<BoardState, { tone: string; button: string; icon: IconName; empty: string }> = {
  placed: { tone: "info", button: "kitchen.btn.confirm", icon: "check", empty: "kitchen.empty.placed" },
  confirmed: { tone: "accent", button: "kitchen.btn.start", icon: "play", empty: "kitchen.empty.confirmed" },
  preparing: { tone: "warn", button: "kitchen.btn.ready", icon: "bell", empty: "kitchen.empty.preparing" },
  ready: { tone: "pos", button: "kitchen.btn.handOff", icon: "hand-platter", empty: "kitchen.empty.ready" },
};

export function useWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return width;
}

/** Today's orders still on the board, by number. */
export function useBoard(): OrderWithLines[] {
  const orders = useKitchen((s) => s.orders);
  const now = useNow();
  const today = kToday(now);
  return orders.filter((o) => dayOf(o) === today && (BOARD as readonly string[]).includes(String(o.order["status"]))).sort((a, b) => num(a.order["number"]) - num(b.order["number"]));
}

const minutes = (ms: number) => Math.floor(ms / 60_000);

/** The chip, in words: when to start, when it is due, how late, how long on the shelf. */
export function chipFor(t: TFunction, fmt: Formatter, o: OrderWithLines, now: number, prepMinutes: number): { text: string; tone: "neutral" | "warn" | "danger" | "pos"; icon: IconName } {
  const status = String(o.order["status"]);
  const pickup = Date.parse(String(o.order["pickup_at"]));
  if (status === "ready") {
    const since = Date.parse(String(o.order["ready_at"] ?? o.order["pickup_at"]));
    return { text: t("kitchen.chip.shelf", { minutes: fmt.number(Math.max(0, minutes(now - since))) }), tone: "pos", icon: "timer" };
  }
  if (now > pickup && minutes(now - pickup) >= 1) return { text: t("kitchen.chip.late", { minutes: fmt.number(minutes(now - pickup)) }), tone: "danger", icon: "triangle-alert" };
  if (status === "preparing") {
    const left = minutes(pickup - now);
    return left <= 0 ? { text: t("kitchen.chip.dueNow"), tone: "warn", icon: "timer" } : { text: t("kitchen.chip.dueIn", { minutes: fmt.number(left) }), tone: "neutral", icon: "timer" };
  }
  const start = pickup - prepMinutes * 60_000;
  if (now >= start) return { text: t("kitchen.chip.startNow"), tone: "warn", icon: "clock" };
  return { text: t("kitchen.chip.start", { time: fmt.time(start) }), tone: "neutral", icon: "clock" };
}

export function LineList({ order, size }: { order: OrderWithLines; size: "card" | "ticket" }) {
  const { t } = useI18n();
  const fmt = useKFmt();
  const menu = useKitchen((s) => s.menu);
  const big = size === "ticket";
  return (
    <>
      {order.lines.map((line) => {
        const mods = storedOptionsText(menu, line.options);
        return (
          <div key={line.id} style={{ position: "relative", paddingInlineStart: big ? 38 : 34 }}>
            <span className="jk-mono" style={{ position: "absolute", insetInlineStart: 0, insetBlockStart: 0, minWidth: big ? 30 : 26, height: big ? 24 : 21, paddingInline: big ? 7 : 6, borderRadius: big ? 8 : 7, background: "var(--surface-3)", color: "var(--fg)", fontSize: big ? 12 : 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {t("co.qty", { qty: fmt.number(num(line["qty"], 1)) })}
            </span>
            <span style={{ display: "block", fontSize: big ? 14.5 : 13.5, fontWeight: 700, letterSpacing: "-.015em" }}>{String(line["name"])}</span>
            {mods !== "" && <span style={{ display: "block", marginBlockStart: 3, fontSize: big ? 12.5 : 12, lineHeight: 1.45, color: "var(--fg-muted)", textWrap: "pretty" }}>{mods}</span>}
            {line["note"] ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBlockStart: 6, padding: "4px 9px", borderRadius: 8, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 11.5, fontWeight: 700 }}>
                <Icon name="message-square" size={11} />
                {String(line["note"])}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/** Paid in full before the counter, online: nothing to collect at the hand-over. */
export const paidOnline = (o: Row): boolean => num(o["online_paid"]) > 0 && owed(o) <= 0;

/** "Paid": an order paid online, on its card and its ticket. */
export function PaidTag() {
  const { t } = useI18n();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "var(--pos-soft)", color: "var(--pos)", fontSize: 10.5, fontWeight: 800 }}>
      <Icon name="check-circle-2" size={11} />
      {t("kpay.paid")}
    </span>
  );
}

export function PhoneTag() {
  const { t } = useI18n();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "var(--info-soft)", color: "var(--info)", fontSize: 10.5, fontWeight: 800 }}>
      <Icon name="phone" size={10} />
      {t("kitchen.phone")}
    </span>
  );
}

function Card({ order, column }: { order: OrderWithLines; column: BoardState }) {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const prep = num(useKitchen((s) => s.settings?.["prep_minutes"]), 15);
  const pulse = useKitchen((s) => s.pulse.includes(order.order.id));
  const theme = useUi((s) => s.theme);
  const recent = useRecentMove();
  const o = order.order;
  const chip = chipFor(t, fmt, order, now, prep);
  const isNew = String(o["status"]) === "placed" && now - Date.parse(String(o["placed_at"] ?? 0)) < 60_000;
  const number = t("confirm.number", { number: String(o["number"]) });
  const name = String(o["name"] ?? "");
  const open = () => useKitchen.setState({ ticket: o.id });
  const tone = chip.tone === "neutral" ? ["var(--surface-3)", "var(--fg-muted)"] : [`var(--${chip.tone}-soft)`, `var(--${chip.tone})`];
  const undoable = recent.id === o.id && Date.now() < recent.until && recent.to === column;
  const go = () => {
    if (column === "ready") useKitchen.setState({ handoff: { id: o.id, paid: null, busy: false, card: NO_CARD } });
    else void advance(t, fmt, o.id, column, NEXT[column]);
  };
  return (
    <article
      style={{ padding: "14px 15px", borderRadius: 16, background: "var(--surface)", border: `1px solid ${pulse || isNew ? "var(--accent)" : chip.tone === "danger" ? "var(--danger)" : "var(--border)"}`, animation: pulse ? "jn-arrive 1.9s ease-out 3" : "none" }}
      onAnimationEnd={() => useKitchen.setState({ pulse: useKitchen.getState().pulse.filter((id) => id !== o.id) })}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button className="jn-nav" onClick={open} aria-label={t("kitchen.openTicket", { number, name })} style={{ display: "inline-flex", alignItems: "baseline", gap: 8, border: "none", background: "transparent", padding: 0, color: "var(--fg)", cursor: "pointer", textAlign: "start" }}>
          <span className="jk-mono" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-.01em" }}>
            {number}
          </span>
          <bdi style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-.015em" }}>{name}</bdi>
        </button>
        {isNew && <span style={{ padding: "3px 8px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" }}>{t("kitchen.new")}</span>}
        {o["channel"] === "phone" && <PhoneTag />}
        {paidOnline(o) && <PaidTag />}
        <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999, background: tone[0], color: tone[1], fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
          <Icon name={chip.icon} size={12} />
          <span>{chip.text}</span>
        </span>
      </div>
      <div onClick={open} style={{ display: "flex", flexDirection: "column", gap: 9, paddingBlock: 11, marginBlock: 11, borderBlock: "1px solid var(--border)", cursor: "pointer" }}>
        <LineList order={order} size="card" />
      </div>
      {o["note"] ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBlockEnd: 11, padding: "9px 11px", borderRadius: 10, background: "var(--warn-soft)", color: "var(--warn)" }}>
          <Icon name="message-square" size={13} style={{ marginBlockStart: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}><bdi>{String(o["note"])}</bdi></span>
        </div>
      ) : null}
      {column === "ready" && <TextLine order={order} />}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBlockEnd: 11 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
          <Icon name="timer" size={13} style={{ color: "var(--accent-ink)" }} />
          {t("kitchen.pickup")}{" "}
          <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>
            {fmt.time(String(o["pickup_at"]))}
          </span>
        </span>
        {undoable && (
          <button className="jn-nav" onClick={() => void undo(t, fmt)} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", padding: 0, color: "var(--accent-ink)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            <Icon name="rotate-ccw" size={12} />
            {t("shell.toast.undo")}
          </button>
        )}
        <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
          {fmt.money(paidOnline(o) ? o["total"] : owed(o))}
        </span>
      </div>
      <button className="jn-btn" onClick={go} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 46, borderRadius: 12, border: "none", background: column === "ready" ? "var(--pos)" : "var(--accent)", color: column === "ready" ? (theme === "dark" ? "#0f0f14" : "#ffffff") : "var(--accent-fg)", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
        <Icon name={COLUMNS[column].icon} size={16} />
        {t(COLUMNS[column].button as "kitchen.btn.confirm")}
      </button>
    </article>
  );
}

/** Paid orders cancelled whose money has not gone back yet: one row each, for everyone in the kitchen; the ticket has Refund. */
function RefundOwed() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const orders = useKitchen((s) => s.orders);
  const on = useKitchen((s) => s.payments.on);
  const owed = owedOrders(orders, kToday(now));
  if (!on || owed.length === 0) return null;
  return (
    <section aria-label={t("kpay.owed")} style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockEnd: "clamp(12px,1.6vw,18px)", padding: "12px 14px", borderRadius: 14, background: "var(--warn-soft)", border: "1px solid var(--warn-soft)" }}>
      {owed.map((order) => {
        const o = order.order;
        return (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "var(--warn)", fontSize: 13, fontWeight: 700 }}>
            <Icon name="alert-circle" size={15} />
            <span style={{ fontWeight: 800 }}>{t("kpay.owed")}</span>
            <span className="jk-mono">{t("confirm.number", { number: String(o["number"]) })}</span>
            <bdi>{String(o["name"] ?? "")}</bdi>
            <span className="jk-mono">{fmt.money(refundOwed(order))}</span>
            {o["cancelled_at"] ? <span>{t("kpay.cancelledAt", { time: fmt.time(String(o["cancelled_at"])) })}</span> : null}
            <button className="jn-gi" onClick={() => useKitchen.setState({ ticket: o.id })} style={{ marginInlineStart: "auto", height: 34, paddingInline: 12, borderRadius: 9, border: "1px solid currentColor", background: "transparent", color: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
              {t("kpay.openOrder")}
            </button>
          </div>
        );
      })}
    </section>
  );
}

export function Board() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const board = useBoard();
  const width = useWidth();
  return (
    <>
    <RefundOwed />
    <div style={{ display: "grid", gridTemplateColumns: width < 760 ? "1fr" : width < 1120 ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: "clamp(12px,1.6vw,18px)", alignItems: "start" }}>
      {BOARD.map((column) => {
        const list = board.filter((o) => o.order["status"] === column).sort((a, b) => Date.parse(String(a.order["pickup_at"])) - Date.parse(String(b.order["pickup_at"])) || num(a.order["number"]) - num(b.order["number"]));
        const label = t(`kitchen.col.${column}`);
        return (
          <section key={column} aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 11, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 999, flex: "none", background: `var(--${COLUMNS[column].tone})` }} />
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{label}</h2>
              <span className="jk-mono" style={{ marginInlineStart: "auto", minWidth: 24, height: 22, paddingInline: 7, borderRadius: 7, background: "var(--surface-3)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {fmt.number(list.length)}
              </span>
            </div>
            {list.length === 0 && <div style={{ padding: "26px 14px", border: "1px dashed var(--border-strong)", borderRadius: 14, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t(COLUMNS[column].empty as "kitchen.empty.placed")}</div>}
            {list.map((o) => (
              <Card key={o.order.id} order={o} column={column} />
            ))}
          </section>
        );
      })}
    </div>
    </>
  );
}
