/**
 * What opens over the kitchen: an order's ticket (with Print), cancelling it
 * with a reason the diner reads, handing it over with how it was paid, and
 * tomorrow's pre-orders.
 */
import { useId } from "react";

import { Icon, type IconName } from "../components/Icon.tsx";
import { Modal } from "../components/Modal.tsx";
import { Switch } from "../components/Switch.tsx";
import { Bdi } from "../components/Bdi.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import { useNow } from "../data/sources.ts";
import { useI18n, type TFunction } from "../i18n/index.tsx";
import { firstName, maskEmail, telHref, type Formatter } from "../lib/format.ts";
import { storedOptionsText, type MenuModel } from "../lib/menu.ts";
import { addDays, venueDay } from "../lib/venueTime.ts";
import { BOARD, NEXT, cancelOrder, dayOf, handOff, kToday, markSoldOut, num, useKitchen, type BoardState, type CancelDraft } from "../state/kitchen.ts";
import { mailable } from "../lib/plainText.ts";
import { toast, useUi } from "../state/ui.ts";
import { LineList, PhoneTag } from "./Board.tsx";
import { useKFmt } from "./fmt.ts";
import { advance, sayRefused, word } from "./moves.ts";

const TONES: Record<string, string> = { placed: "info", confirmed: "accent", preparing: "warn", ready: "pos", cancelled: "danger", not_collected: "warn" };

function StatusChip({ status }: { status: string }) {
  const { t } = useI18n();
  const tone = TONES[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 999, background: tone === undefined ? "var(--surface-3)" : `var(--${tone}-soft)`, color: tone === undefined ? "var(--fg-muted)" : tone === "accent" ? "var(--accent-ink)" : `var(--${tone})`, fontSize: 11.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>
      {word(t, status)}
    </span>
  );
}

/** "Today, Tuesday, July 28" on the kitchen's calendar. */
function dayLine(t: TFunction, fmt: Formatter, instant: string, today: string): string {
  const d = venueDay(instant, fmt.zone);
  const w = d === today ? t("pick.today") : d === addDays(today, 1) ? t("pick.tomorrow") : null;
  return w === null ? fmt.dayLong(d) : t("track.dayWord", { word: w, date: fmt.dayLong(d) });
}

/** The ticket as paper: an 80 mm page the browser prints, in the page's language. */
function printTicket(t: TFunction, fmt: Formatter, order: OrderWithLines, venue: string, menu: MenuModel | null, today: string): void {
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const o = order.order;
  const lines = order.lines
    .map((l) => {
      const mods = storedOptionsText(menu, l.options);
      return `<tr><td class="q">×${esc(num(l["qty"], 1))}</td><td><b>${esc(l["name"])}</b>${mods ? `<div>${esc(mods)}</div>` : ""}${l["note"] ? `<div class="n">${esc(l["note"])}</div>` : ""}</td></tr>`;
    })
    .join("");
  const dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  const html = `<!doctype html><html lang="${esc(document.documentElement.lang)}" dir="${dir}"><head><meta charset="utf-8"><title>#${esc(o["number"])}</title><style>@page{margin:6mm}body{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;margin:0;padding:8px;width:280px;color:#000}h1{font-size:30px;margin:0}td{vertical-align:top;padding:4px 0}.q{width:36px;font-weight:700}.n{font-weight:700}div{margin-top:2px}hr{border:0;border-top:1px dashed #000;margin:10px 0}</style></head><body><div>${esc(venue)}${o["channel"] === "phone" ? ` · ${esc(t("kitchen.phone"))}` : ""}</div><h1>#${esc(o["number"])}</h1><div><b>${esc(o["name"])}</b></div><div>${esc(t("kitchen.pickup"))} ${esc(fmt.time(String(o["pickup_at"])))} · ${esc(dayLine(t, fmt, String(o["pickup_at"]), today))}</div><div>${esc(t("kitchen.ticket.placed"))} ${esc(fmt.time(String(o["placed_at"] ?? "")))}</div>${o["note"] ? `<hr><div class="n">${esc(o["note"])}</div>` : ""}<hr><table>${lines}</table><hr><div><b>${esc(t("totals.total"))} ${esc(fmt.money(o["total"]))}</b> · ${esc(t("kitchen.ticket.payAtPickup"))}</div></body></html>`;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument ?? frame.contentWindow?.document;
  if (doc === undefined || doc === null) return;
  doc.open();
  doc.write(html);
  doc.close();
  toast(t("kitchen.ticket.printing", { number: String(o["number"]) }));
  setTimeout(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // No printer dialog here: nothing else to do.
    }
    setTimeout(() => frame.remove(), 1500);
  }, 120);
}

export function Ticket() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const id = useKitchen((s) => s.ticket);
  const order = useKitchen((s) => s.orders.find((o) => o.order.id === s.ticket));
  const menu = useKitchen((s) => s.menu);
  const venue = String(useKitchen((s) => s.settings?.["venue_name"]) ?? "");
  const titleId = useId();
  if (id === null || order === undefined) return null;
  const o = order.order;
  const status = String(o["status"]);
  const today = kToday(now);
  const close = () => useKitchen.setState({ ticket: null });
  const onBoard = (BOARD as readonly string[]).includes(status);
  const stamps: { key: string; at: unknown; by: unknown }[] = [
    { key: "confirmed", at: o["confirmed_at"], by: o["confirmed_by"] },
    { key: "preparing", at: o["preparing_at"], by: null },
    { key: "ready", at: o["ready_at"], by: o["ready_by"] },
    { key: "picked_up", at: o["picked_up_at"], by: o["picked_up_by"] },
    { key: "cancelled", at: o["cancelled_at"], by: o["cancel_code"] === "self" ? t("kitchen.ticket.byDiner") : o["cancel_code"] === "closed" ? null : o["cancelled_by"] },
    { key: "not_collected", at: o["not_collected_at"], by: null },
  ].filter((s) => s.at !== null && s.at !== undefined && s.at !== "");
  const next = () => {
    if (status === "ready") useKitchen.setState({ handoff: { id: o.id, paid: null, busy: false } });
    else {
      close();
      void advance(t, fmt, o.id, status, NEXT[status as BoardState]);
    }
  };
  const phone = o["phone"] ? String(o["phone"]) : null;
  return (
    <Modal labelledBy={titleId} width={540} z={520} onClose={close}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "18px 20px", borderBlockEnd: "1px solid var(--border)" }}>
        <h2 id={titleId} className="jk-mono" style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>
          {t("confirm.number", { number: String(o["number"]) })}
        </h2>
        <StatusChip status={status} />
        {o["channel"] === "phone" && <PhoneTag />}
        <button className="jn-gi jk-iconbtn is-sm" onClick={close} aria-label={t("shell.close")} style={{ marginInlineStart: "auto" }}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="jn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "18px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "14px 15px", borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)", minWidth: 0 }}>
            <span className="jk-kicker">{t("kitchen.ticket.customer")}</span>
            <bdi style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.02em" }}>{String(o["name"] ?? "")}</bdi>
            {phone !== null ? (
              <a href={telHref(phone)} className="jn-gi" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, height: 30, paddingInline: 10, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 12, fontWeight: 800 }}>
                <Icon name="phone" size={13} />
                {t("kitchen.ticket.call")}
                <span className="jk-mono" style={{ fontWeight: 500, color: "var(--fg-muted)" }}>
                  <Bdi>{phone}</Bdi>
                </span>
              </a>
            ) : (
              <span style={{ fontSize: 12, color: "var(--fg-subtle)" }}>{t("kitchen.ticket.noPhone")}</span>
            )}
            <span className="jk-mono" style={{ fontSize: 11, color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis" }}>
              {o["email"] ? String(o["email"]) : t("kitchen.ticket.noEmail")}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "14px 15px", borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span className="jk-kicker">{t("confirm.pickup")}</span>
            <span className="jk-mono" style={{ fontSize: 16, fontWeight: 600 }}>
              {fmt.time(String(o["pickup_at"]))}
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{dayLine(t, fmt, String(o["pickup_at"]), today)}</span>
            {o["placed_at"] ? (
              <span style={{ fontSize: 12, color: "var(--fg-subtle)" }}>
                {t("kitchen.ticket.placed")}{" "}
                <span className="jk-mono">{fmt.time(String(o["placed_at"]))}</span>
              </span>
            ) : null}
          </div>
        </div>
        {o["note"] ? (
          <div className="jk-notice" style={{ marginBlockStart: 14, background: "var(--warn-soft)", color: "var(--warn)" }}>
            <Icon name="message-square" size={14} style={{ marginBlockStart: 1 }} />
            <span><bdi>{String(o["note"])}</bdi></span>
          </div>
        ) : null}
        {status === "cancelled" && o["cancel_code"] !== "self" && (
          <div className="jk-notice" style={{ marginBlockStart: 14, background: "var(--danger-soft)", color: "var(--danger)" }}>
            <Icon name="circle-slash" size={14} style={{ marginBlockStart: 1 }} />
            <span>{cancelWords(t, order)}</span>
          </div>
        )}
        <span className="jk-kicker" style={{ display: "block", marginBlockStart: 20 }}>
          {t("kitchen.ticket.lines")}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBlockStart: 12 }}>
          <LineList order={order} size="ticket" />
        </div>
        {stamps.length > 0 && (
          <>
            <span className="jk-kicker" style={{ display: "block", marginBlockStart: 20 }}>
              {t("kitchen.ticket.timeline")}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBlockStart: 12 }}>
              {stamps.map((s) => (
                <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
                  {s.key === "cancelled" && o["cancel_code"] === "closed" ? t("kitchen.ticket.cancelledAtClosing") : word(t, s.key)}
                  <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {fmt.time(String(s.at))}
                  </span>
                  {s.by ? <span style={{ color: "var(--fg-subtle)" }}>{String(s.by)}</span> : null}
                </span>
              ))}
            </div>
          </>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBlockStart: 18, paddingBlockStart: 14, borderBlockStart: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{t("totals.total")}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 16, fontWeight: 600 }}>
            {fmt.money(o["total"])}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>· {t("kitchen.ticket.payAtPickup")}</span>
        </div>
      </div>
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 10, padding: "16px 20px 20px", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="jn-gi jk-btn-ghost" onClick={() => printTicket(t, fmt, order, venue, menu, today)} style={{ height: 46, padding: "0 18px", borderRadius: 12, fontSize: 14 }}>
            <Icon name="printer" size={16} />
            {t("kitchen.ticket.print")}
          </button>
          {onBoard && (
            <button className="jn-btn jk-btn-primary" onClick={next} style={{ flex: 1, minWidth: 150, height: 46, padding: 0, borderRadius: 12, fontSize: 14 }}>
              <Icon name="arrow-right" size={16} className="jk-flip" />
              {t(`kitchen.btn.${status === "placed" ? "confirm" : status === "confirmed" ? "start" : status === "preparing" ? "ready" : "handOff"}` as "kitchen.btn.confirm")}
            </button>
          )}
        </div>
        {onBoard && (
          <button className="jn-gi" onClick={() => useKitchen.setState({ cancel: { id: o.id, reason: null, dish: null, dishId: null, note: "", markSold: true, busy: false } })} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, height: 38, paddingInline: 14, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Icon name="circle-slash" size={14} />
            {t("kitchen.ticket.cancel")}
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Why the kitchen cancelled, in the words the diner's email carries. */
function cancelWords(t: TFunction, order: OrderWithLines): string {
  const o = order.order;
  switch (o["cancel_code"]) {
    case "ran_out":
      return o["cancel_dish"] ? t("track.reason.ranOutDish", { dish: String(o["cancel_dish"]) }) : t("track.reason.ranOut");
    case "too_busy":
      return t("track.reason.busy");
    case "customer_asked":
      return t("kitchen.cancel.asked");
    case "closed":
      return t("kitchen.cancel.closed");
    default:
      return o["cancel_note"] ? String(o["cancel_note"]) : t("kitchen.cancel.other");
  }
}

const REASONS: { id: NonNullable<CancelDraft["reason"]>; key: string }[] = [
  { id: "ran_out", key: "kitchen.cancel.ranOut" },
  { id: "too_busy", key: "kitchen.cancel.busy" },
  { id: "customer_asked", key: "kitchen.cancel.customer" },
  { id: "other", key: "kitchen.cancel.otherLabel" },
];

export function CancelSheet() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const c = useKitchen((s) => s.cancel);
  const order = useKitchen((s) => s.orders.find((o) => o.order.id === s.cancel?.id));
  const titleId = useId();
  const dishLabel = useId();
  if (c === null || order === undefined) return null;
  const o = order.order;
  const name = firstName(o["name"]);
  const set = (patch: Partial<CancelDraft>) => useKitchen.setState({ cancel: { ...c, ...patch } });
  const close = () => useKitchen.setState({ cancel: null });
  const ready = c.reason !== null && !(c.reason === "ran_out" && c.dish === null) && !(c.reason === "other" && c.note.trim() === "");
  const dishes = order.lines.map((l) => ({ name: String(l["name"]), id: num(l["menu_item_id"]) })).filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);
  const go = async () => {
    const number = String(o["number"]);
    const result = await cancelOrder();
    if (!result.ok) {
      sayRefused(t, fmt, result.result, number, String(o["name"] ?? ""));
      return;
    }
    // "We've emailed them" only for an address that is mailed: a sample order's (a reserved domain) never is.
    const base = mailable(o["email"]) ? t("kitchen.cancel.doneEmailed", { number, name }) : t("kitchen.cancel.done", { number });
    if (result.soldFailed && c.dishId !== null && c.dish !== null) {
      const dishId = c.dishId;
      const dish = c.dish;
      toast(t("kitchen.cancel.soldFailed", { dish }), "warn", { actionLabel: t("shell.retry"), undo: () => void markSoldOut(dishId).then((ok) => toast(ok ? t("kitchen.menu.soldDone", { name: dish }) : t("kitchen.cancel.soldFailed", { dish }), ok ? "warn" : "warn")) });
    } else toast(result.soldOut === null ? base : `${base} · ${t("kitchen.menu.soldDone", { name: result.soldOut })}`, "warn");
  };
  return (
    <Modal labelledBy={titleId} width={460} z={580} onClose={close}>
      <div style={{ padding: "22px 22px 6px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.03em" }}>
            {t("kitchen.cancel.title", { number: String(o["number"]) })}
          </h2>
          <button className="jn-gi jk-iconbtn is-sm" onClick={close} aria-label={t("shell.close")} style={{ marginInlineStart: "auto" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--fg-muted)" }}>{o["email"] ? t("kitchen.cancel.why", { name }) : t("kitchen.cancel.whyCall", { name })}</p>
        <div role="radiogroup" aria-label={t("kitchen.cancel.reason")} style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBlockStart: 16 }}>
          {REASONS.map((r) => (
            <button key={r.id} className="jn-chip jk-chip" role="radio" aria-checked={c.reason === r.id} onClick={() => set({ reason: r.id })} style={{ height: 36 }}>
              {t(r.key as "kitchen.cancel.ranOut")}
            </button>
          ))}
        </div>
        {c.reason === "ran_out" && (
          <div style={{ marginBlockStart: 14 }}>
            <span id={dishLabel} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
              {t("kitchen.cancel.whatRanOut")}
            </span>
            <div role="radiogroup" aria-labelledby={dishLabel} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {dishes.map((d) => (
                <button key={d.id} className="jn-chip jk-chip" role="radio" aria-checked={c.dishId === d.id} onClick={() => set({ dish: d.name, dishId: d.id })} style={{ height: 34 }}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {c.reason === "ran_out" && c.dish !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlockStart: 14, padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{t("kitchen.cancel.markSold", { dish: c.dish })}</span>
            <Switch on={c.markSold} label={t("kitchen.cancel.markSold", { dish: c.dish })} onToggle={() => set({ markSold: !c.markSold })} />
          </div>
        )}
        {c.reason === "other" && (
          <div style={{ marginBlockStart: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <label htmlFor="jn-kc-other" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                {t("kitchen.cancel.inYourWords")}
              </label>
              <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--fg-subtle)" }}>
                {t("sheet.count", { n: fmt.number(c.note.length), max: fmt.number(160) })}
              </span>
            </div>
            <textarea id="jn-kc-other" className="jn-fld" value={c.note} onChange={(e) => set({ note: e.target.value.slice(0, 160) })} maxLength={160} rows={2} style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 14, lineHeight: 1.5, resize: "none" }} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "16px 22px 20px", marginBlockStart: 14, borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <button className="jn-gi jk-btn-ghost" onClick={close} style={{ height: 46, padding: "0 18px", borderRadius: 12, fontSize: 14 }}>
          {t("kitchen.cancel.keep")}
        </button>
        <button className="jn-btn" onClick={() => void go()} disabled={!ready || c.busy} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 12, border: "none", background: ready ? "var(--danger)" : "var(--surface-3)", color: ready ? "var(--on-danger)" : "var(--fg-subtle)", fontSize: 14, fontWeight: 800, cursor: ready ? "pointer" : "not-allowed" }}>
          <Icon name="circle-slash" size={16} />
          {t("kitchen.cancel.go")}
        </button>
      </div>
    </Modal>
  );
}

const PAYS: { id: "cash" | "card"; key: string; icon: IconName }[] = [
  { id: "cash", key: "kitchen.handoff.cash", icon: "banknote" },
  { id: "card", key: "kitchen.handoff.card", icon: "credit-card" },
];

export function HandOffSheet() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const h = useKitchen((s) => s.handoff);
  const order = useKitchen((s) => s.orders.find((o) => o.order.id === s.handoff?.id));
  const receipts = useKitchen((s) => s.receipts && s.settings?.["receipt_email_on"] !== false);
  const menu = useKitchen((s) => s.menu);
  const dark = useUi((s) => s.theme) === "dark";
  const titleId = useId();
  const paidId = useId();
  if (h === null || order === undefined) return null;
  const o = order.order;
  const close = () => useKitchen.setState({ handoff: null });
  const go = async () => {
    const result = await handOff();
    if (result.ok) {
      toast(t(h.paid === "card" ? "kitchen.handoff.doneCard" : "kitchen.handoff.doneCash", { number: String(o["number"]), name: firstName(o["name"]), total: fmt.money(o["total"]) }));
    } else sayRefused(t, fmt, result.result, String(o["number"]), String(o["name"] ?? ""));
  };
  return (
    <Modal labelledBy={titleId} width={440} z={560} onClose={close}>
      <div style={{ padding: "24px 24px 0", overflowY: "auto" }}>
        <span className="jk-kicker" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="scan-line" size={14} style={{ color: "var(--pos)" }} />
          {t("kitchen.handoff.title")}
        </span>
        <h2 id={titleId} className="jk-mono" style={{ display: "block", margin: "12px 0 0", fontSize: 38, fontWeight: 600, letterSpacing: "-.03em" }}>
          {t("confirm.number", { number: String(o["number"]) })}
        </h2>
        <bdi style={{ display: "block", marginBlockStart: 4, fontSize: 19, fontWeight: 800, letterSpacing: "-.028em" }}>{String(o["name"] ?? "")}</bdi>
        <span style={{ display: "block", marginBlockStart: 4, fontSize: 12.5, color: "var(--fg-muted)" }}>
          {t("kitchen.pickup")}{" "}
          <span className="jk-mono" style={{ fontWeight: 600 }}>
            {fmt.time(String(o["pickup_at"]))}
          </span>
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 16, padding: "14px 15px", borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {order.lines.map((l) => {
            const mods = storedOptionsText(menu, l.options);
            return (
              <span key={l.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 13.5, fontWeight: 700 }}>
                  <span className="jk-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>
                    {t("co.qty", { qty: fmt.number(num(l["qty"], 1)) })}
                  </span>
                  {String(l["name"])}
                </span>
                {mods !== "" && <span style={{ paddingInlineStart: 28, fontSize: 12, color: "var(--fg-muted)" }}>{mods}</span>}
              </span>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBlockStart: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{t("kitchen.collect")}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 30, fontWeight: 600, letterSpacing: "-.02em" }}>
            {fmt.money(o["total"])}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBlockStart: 14 }}>
          <span id={paidId} style={{ fontSize: 13, fontWeight: 800 }}>
            {t("kitchen.handoff.paidBy")}
          </span>
          <div role="radiogroup" aria-labelledby={paidId} aria-required="true" className="jk-seg" style={{ borderRadius: 11 }}>
            {PAYS.map((p) => (
              <button key={p.id} className="jn-chip jk-segbtn" role="radio" aria-checked={h.paid === p.id} aria-pressed={undefined} onClick={() => useKitchen.setState({ handoff: { ...h, paid: p.id } })} style={{ height: 36, paddingInline: 15, fontSize: 13.5, ...(h.paid === p.id ? { background: "var(--accent)", color: "var(--accent-fg)" } : {}) }}>
                <Icon name={p.icon} size={15} />
                {t(p.key as "kitchen.handoff.cash")}
              </button>
            ))}
          </div>
        </div>
        <div className="jk-notice" style={{ marginBlockStart: 14, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 12.5 }}>
          <Icon name="alert-circle" size={14} style={{ marginBlockStart: 1 }} />
          <span>{t("kitchen.handoff.checkName")}</span>
        </div>
        {receipts && o["email"] ? (
          <span style={{ display: "flex", alignItems: "center", gap: 7, marginBlockStart: 10, fontSize: 12, color: "var(--fg-muted)" }}>
            <Icon name="receipt" size={13} />
            <span>
              {t("kitchen.handoff.receiptBefore")}{" "}
              <span className="jk-mono">
                <Bdi>{maskEmail(String(o["email"]))}</Bdi>
              </span>{" "}
              {t("kitchen.handoff.receiptAfter")}
            </span>
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "18px 24px 22px" }}>
        <button className="jn-gi jk-btn-ghost" onClick={close} style={{ height: 48, padding: "0 20px", borderRadius: 12, fontSize: 14 }}>
          {t("kitchen.handoff.notYet")}
        </button>
        <button className="jn-btn" onClick={() => void go()} disabled={h.paid === null || h.busy} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 48, borderRadius: 12, border: "none", background: h.paid !== null ? "var(--pos)" : "var(--surface-3)", color: h.paid !== null ? (dark ? "#0f0f14" : "#ffffff") : "var(--fg-subtle)", fontSize: 14.5, fontWeight: 800, cursor: h.paid !== null ? "pointer" : "not-allowed" }}>
          <Icon name="check" size={17} />
          {t("kitchen.handoff.go", { total: fmt.money(o["total"]) })}
        </button>
      </div>
    </Modal>
  );
}

export function TomorrowSheet() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const open = useKitchen((s) => s.tomorrow);
  const orders = useKitchen((s) => s.orders);
  const menu = useKitchen((s) => s.menu);
  const titleId = useId();
  if (!open) return null;
  const tomorrow = addDays(kToday(now), 1);
  const list = orders.filter((o) => dayOf(o) === tomorrow && o.order["status"] !== "cancelled").sort((a, b) => Date.parse(String(a.order["pickup_at"])) - Date.parse(String(b.order["pickup_at"])));
  const close = () => useKitchen.setState({ tomorrow: false });
  return (
    <Modal labelledBy={titleId} width={520} z={540} onClose={close}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "18px 20px", borderBlockEnd: "1px solid var(--border)" }}>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span className="jk-kicker">{t("kitchen.tomorrow.eyebrow")}</span>
          <h2 id={titleId} style={{ margin: "3px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-.028em" }}>
            {t("kitchen.tomorrow.title", { date: fmt.dayLong(tomorrow) })}
          </h2>
        </span>
        <button className="jn-gi jk-iconbtn is-sm" onClick={close} aria-label={t("shell.close")} style={{ marginInlineStart: "auto" }}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="jn-scroll" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {list.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg-muted)" }}>{t("kitchen.tomorrow.none")}</p>}
        {list.map((order) => {
          const o = order.order;
          const status = String(o["status"]);
          const lines = order.lines
            .map((l) => {
              const mods = storedOptionsText(menu, l.options);
              const qty = num(l["qty"], 1);
              return `${String(l["name"])}${qty > 1 ? ` ${t("co.qty", { qty: fmt.number(qty) })}` : ""}${mods ? ` (${mods})` : ""}`;
            })
            .join(", ");
          return (
            <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                <button className="jn-nav jk-mono" onClick={() => useKitchen.setState({ ticket: o.id, tomorrow: false })} aria-label={t("kitchen.openTicketShort", { number: String(o["number"]) })} style={{ border: "none", background: "transparent", padding: 0, color: "var(--fg)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                  {t("confirm.number", { number: String(o["number"]) })}
                </button>
                <bdi style={{ fontSize: 14, fontWeight: 800 }}>{String(o["name"] ?? "")}</bdi>
                <span className="jk-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>
                  {fmt.time(String(o["pickup_at"]))}
                </span>
                <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 14, fontWeight: 600 }}>
                  {fmt.money(o["total"])}
                </span>
              </div>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-muted)" }}>{lines}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusChip status={status} />
                {status === "placed" && (
                  <button
                    className="jn-btn jk-btn-sm is-primary"
                    onClick={() => void advance(t, fmt, o.id, "placed", "confirmed")}
                    style={{ marginInlineStart: "auto" }}
                  >
                    <Icon name="check" size={14} />
                    {t("kitchen.btn.confirm")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--fg-subtle)" }}>{t("kitchen.tomorrow.foot")}</p>
      </div>
    </Modal>
  );
}
