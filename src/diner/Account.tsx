/**
 * Find my order — an emailed link (or its code, on another device) — and,
 * signed in, Order again: the diner's own orders, newest first, each one a
 * tap from the cart again; signing out here or everywhere; deleting their
 * details.
 */
import { useEffect, useId, useRef, useState } from "react";

import { ConfirmDialog } from "../components/Confirm.tsx";
import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { Rich } from "../i18n/rich.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import { asciiDigits } from "../lib/format.ts";
import { portionsOf, storedOptionsText } from "../lib/menu.ts";
import { daysBetween, venueDay } from "../lib/venueTime.ts";
import { sources, useNow } from "../data/sources.ts";
import {
  EMAIL,
  RESEND_SECONDS,
  SEND_LIMIT,
  askDelete,
  askSignOutAll,
  deleteDetails,
  openCode,
  restartFind,
  sendLink,
  setCode,
  setFindEmail,
  signInWithCode,
  signOut,
  signOutEverywhere,
  toggleAccountMenu,
  touchFindEmail,
  useAccount,
} from "../state/account.ts";
import { activeDay, useDiner } from "../state/diner.ts";
import { showAccountOrder } from "../state/track.ts";
import { goDiner, toast, useUi } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";
import { useReorder } from "./Reorder.tsx";
import { useDay } from "./useDay.ts";

/** How long an emailed sign-in link works. */
const LINK_MINUTES = 20;
const PAGE = 20;

export function FindPage() {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const view = useUi((s) => s.dinerView);
  const find = useAccount((s) => s.find);
  const notice = useAccount((s) => s.notice);
  const now = useNow();
  const emailId = useId();
  const codeId = useId();
  const emailErr = find.touched && !EMAIL.test(find.email.trim());
  const left = Math.max(0, RESEND_SECONDS - Math.floor((now - find.sentAt) / 1000));
  const capped = find.sends >= SEND_LIMIT;
  const locked = find.error?.kind === "locked";
  const codeErr = find.error !== null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (find.step !== "sent" || left === 0) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [find.step, left]);

  const send = async () => {
    const ok = await sendLink(locale);
    if (!ok && EMAIL.test(find.email.trim()) && !capped) toast(t("find.sendFailed"), "warn");
  };
  const resend = async () => {
    if (left > 0 || capped) return;
    if (await sendLink(locale)) toast(t("find.sentAgain"));
  };
  const go = async () => {
    if (await signInWithCode()) {
      goDiner("orders");
      const person = useAccount.getState().person;
      if (person !== null) toast(t("find.signedIn", { email: person.email }));
    }
  };
  const codeMsg = find.error === null ? null : find.error.kind === "wrong" ? t("find.code.wrong", { count: fmt.number(find.error.triesLeft) }, find.error.triesLeft) : find.error.kind === "locked" ? t("find.code.locked") : t("find.code.expired");
  const noticeText = notice === "signedOutEverywhere" ? t("find.notice.everywhere") : notice === "deleted" ? t("find.notice.deleted") : notice === "lapsed" ? t("find.notice.lapsed") : null;

  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 540, marginInline: "auto", paddingBlock: "clamp(30px,5vw,64px) clamp(34px,5vw,64px)", display: "flex", flexDirection: "column", gap: 14 }}>
        {noticeText !== null && (
          <div role="status" className="jk-notice" style={{ background: "var(--info-soft)", color: "var(--info)", fontSize: 13.5, borderRadius: 13 }}>
            <Icon name="info" size={15} style={{ marginBlockStart: 2 }} />
            <span>{noticeText}</span>
          </div>
        )}
        {find.linkExpired && find.step === "email" && (
          <div role="alert" className="jk-notice" style={{ background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13.5, borderRadius: 13 }}>
            <Icon name="link-2-off" size={15} style={{ marginBlockStart: 2 }} />
            <span>{t("find.linkExpired")}</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "clamp(22px,3vw,30px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ width: 50, height: 50, borderRadius: 15, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="mail-search" size={22} />
          </span>
          {find.step === "signing" && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true" style={{ flex: "none", width: 18, height: 18, borderRadius: 999, border: "2px solid var(--accent)", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} />
              <h1 style={{ margin: 0, fontSize: "clamp(22px,3vw,28px)", fontWeight: 800, letterSpacing: "-.035em" }}>{t("find.signing")}</h1>
            </div>
          )}
          {find.step === "email" && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: "clamp(24px,3.4vw,32px)", fontWeight: 800, letterSpacing: "-.035em" }}>{view === "orders" ? t("find.titleOrders") : t("find.title")}</h1>
                <p style={{ margin: "9px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("find.intro")}</p>
              </div>
              <div>
                <label htmlFor={emailId} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                  {t("co.email")}
                </label>
                <input id={emailId} className={`jn-fld jk-input${emailErr ? " is-bad" : ""}`} type="email" autoComplete="email" dir="ltr" maxLength={254} value={find.email} onChange={(e) => setFindEmail(e.target.value)} onBlur={touchFindEmail} placeholder={t("co.email.placeholder")} aria-invalid={emailErr} aria-describedby={`${emailId}-msg`} />
                {emailErr ? (
                  <span id={`${emailId}-msg`} role="alert" className="jk-error" style={{ marginBlockStart: 7, fontSize: 12, fontWeight: 600 }}>
                    <Icon name="alert-circle" size={13} />
                    {t("find.email.error")}
                  </span>
                ) : (
                  <span id={`${emailId}-msg`} className="jk-hint" style={{ display: "block", marginBlockStart: 7 }}>
                    {t("find.email.hint")}
                  </span>
                )}
              </div>
              <button type="submit" className="jn-btn jk-btn-primary" disabled={find.busy} style={{ alignSelf: "flex-start", padding: "14px 23px", fontSize: 14.5 }}>
                {find.busy ? <span className="jk-spin" aria-hidden="true"><Icon name="refresh-cw" size={16} /></span> : <Icon name="send" size={16} />}
                {t("find.send")}
              </button>
            </form>
          )}
          {find.step === "sent" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: "clamp(24px,3.4vw,32px)", fontWeight: 800, letterSpacing: "-.035em" }}>{t("find.checkEmail")}</h1>
                <p style={{ margin: "9px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("find.sentBody", { minutes: fmt.number(LINK_MINUTES) })}</p>
                <span className="jk-mono" style={{ display: "inline-flex", marginBlockStart: 12, padding: "6px 11px", borderRadius: 9, background: "var(--surface-3)", fontSize: 12.5, fontWeight: 600 }}>
                  {find.email}
                </span>
              </div>
              {find.codeOpen && (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void go();
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <label htmlFor={codeId} style={{ display: "block", fontSize: 12.5, fontWeight: 700, margin: 0 }}>
                    {t("find.code.label")}
                  </label>
                  <span id={`${codeId}-hint`} style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-subtle)" }}>
                    {t("find.code.hint")}
                  </span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input
                      id={codeId}
                      dir="ltr"
                      className="jn-fld"
                      value={find.code}
                      onChange={(e) => setCode(asciiDigits(e.target.value))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      aria-describedby={`${codeId}-hint ${codeId}-msg`}
                      aria-invalid={codeErr}
                      disabled={locked}
                      style={{ width: 170, padding: "12px 14px", borderRadius: 12, border: `1px solid ${codeErr ? "var(--danger)" : "var(--border-strong)"}`, background: "var(--surface)", color: "var(--fg)", fontFamily: "var(--mono)", fontSize: 18, fontWeight: 600, letterSpacing: ".3em", opacity: locked ? 0.55 : 1 }}
                    />
                    <button type="submit" className="jn-btn jk-btn-primary" disabled={find.code.length !== 6 || locked || find.busy} style={{ height: 48, padding: "0 18px", borderRadius: 12, fontSize: 14 }}>
                      <Icon name="arrow-right" size={15} className="jk-flip" />
                      {t("find.code.go")}
                    </button>
                  </div>
                  {codeMsg !== null && (
                    <span id={`${codeId}-msg`} role="alert" className="jk-error" style={{ fontSize: 12, fontWeight: 600 }}>
                      <Icon name="alert-circle" size={13} />
                      {codeMsg}
                    </span>
                  )}
                </form>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {!find.codeOpen && (
                  <button className="jn-nav jk-link" onClick={openCode} style={{ fontSize: 13 }}>
                    <Icon name="key-round" size={14} />
                    {t("find.useCode")}
                  </button>
                )}
                {capped ? (
                  <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--fg-muted)" }}>
                    <Icon name="clock" size={14} />
                    {t("find.limit", { count: fmt.number(SEND_LIMIT) })}
                  </span>
                ) : (
                  <button className="jn-nav jk-link" onClick={() => void resend()} disabled={left > 0} style={{ fontSize: 13, color: left > 0 ? "var(--fg-subtle)" : "var(--accent-ink)", cursor: left > 0 ? "not-allowed" : "pointer" }}>
                    <Icon name="rotate-cw" size={14} />
                    <span>{left > 0 ? t("find.resendIn", { seconds: fmt.number(left) }) : t("find.resend")}</span>
                  </button>
                )}
                <button className="jn-nav jk-link" onClick={restartFind} style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                  {t("find.differentEmail")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DINER_STATUS: Record<string, string> = {
  placed: "track.badge.placed",
  confirmed: "track.badge.kitchen",
  preparing: "track.badge.kitchen",
  ready: "track.badge.ready",
  picked_up: "orders.status.picked",
  cancelled: "track.badge.cancelled",
  not_collected: "track.badge.notCollected",
};

/** Order again: the signed-in diner's orders; signed out, Find my order in its place. */
export function OrdersPage() {
  const person = useAccount((s) => s.person);
  if (person === null) return <FindPage />;
  return <Orders />;
}

function AccountMenu() {
  const { t } = useI18n();
  const open = useAccount((s) => s.menuOpen);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const items = () => [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    items()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      const all = items();
      const at = all.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") {
        toggleAccountMenu(false);
        button.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        all[(at + 1) % all.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        all[(at - 1 + all.length) % all.length]?.focus();
      }
    };
    const away = (e: MouseEvent) => {
      if (box.current !== null && !box.current.contains(e.target as Node) && e.target !== button.current && !button.current?.contains(e.target as Node)) toggleAccountMenu(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", away);
    };
  }, [open]);
  const item = (icon: "log-out" | "monitor-smartphone" | "trash-2", label: string, onClick: () => void, danger = false) => (
    <button className="jn-gi" role="menuitem" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 9, height: 38, paddingInline: 11, borderRadius: 9, border: "none", background: "transparent", color: danger ? "var(--danger)" : "var(--fg)", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "start" }}>
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
  return (
    <>
      <button ref={button} className="jn-gi" onClick={() => toggleAccountMenu()} aria-haspopup="menu" aria-expanded={open} style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
        <Icon name="user-round" size={14} />
        {t("orders.account")}
        <Icon name="chevron-down" size={13} />
      </button>
      {open && (
        <div ref={box} role="menu" aria-label={t("orders.account")} style={{ position: "absolute", insetInlineEnd: 8, insetBlockStart: 50, zIndex: 20, width: 240, padding: 5, borderRadius: 13, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 14px 34px rgba(20,20,35,.2)", display: "flex", flexDirection: "column", gap: 2 }}>
          {item("log-out", t("orders.signOut"), () => {
            void signOut().then(() => toast(t("orders.signedOut")));
          })}
          {item("monitor-smartphone", t("orders.signOutAll"), () => askSignOutAll(true))}
          {item("trash-2", t("orders.delete"), () => askDelete(true), true)}
        </div>
      )}
    </>
  );
}

function Orders() {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const day = useDay();
  const person = useAccount((s) => s.person)!;
  const orders = useAccount((s) => s.orders);
  const confirmAll = useAccount((s) => s.confirmSignOutAll);
  const deleteAsk = useAccount((s) => s.deleteAsk);
  const deletePending = useAccount((s) => s.deletePending);
  const busy = useAccount((s) => s.busy);
  const dishes = useDiner((s) => s.dishes);
  const menu = useDiner((s) => s.data?.menu ?? null);
  const reorder = useReorder();
  const [shown, setShown] = useState(PAGE);
  const forDay = activeDay(day.now);
  const list = orders ?? [];
  const stale = Math.floor((sources().clock.now() - Date.parse(person.at)) / 60_000) > 10;

  const tagOf = (o: OrderWithLines): string | null => {
    const d = venueDay(String(o.order["pickup_at"]), fmt.zone);
    const diff = daysBetween(d, day.today);
    if (diff === 0) return t("pick.today");
    if (diff === 1) return t("orders.yesterday");
    if (diff === -1) return t("pick.tomorrow");
    if (diff >= 2 && diff <= 7) return t("orders.last", { day: fmt.weekday(d) });
    return null;
  };
  const missing = (o: OrderWithLines): number =>
    o.lines.filter((l) => {
      const dish = menu?.dish(Number(l["menu_item_id"]));
      return dish === undefined || !dish.online || portionsOf(dishes[forDay] ?? null, dish.id).soldOut;
    }).length;

  const remove = async () => {
    const result = await deleteDetails(locale);
    if (result === "deleted") goDiner("find");
    else if (result === "failed") toast(t("orders.deleteFailed"), "warn");
  };

  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 760, paddingBlock: "clamp(22px,4vw,40px) clamp(34px,5vw,62px)" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 9px 9px 14px", paddingInlineStart: 14, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", marginBlockEnd: 22 }}>
          <Icon name="user-round" size={15} style={{ color: "var(--fg-subtle)" }} />
          <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            <Rich text={t("orders.signedInAs")} parts={{ email: <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{person.email}</span> }} />
          </span>
          <AccountMenu />
        </div>
        {deletePending && (
          <div role="status" className="jk-notice" style={{ marginBlockEnd: 18, background: "var(--info-soft)", color: "var(--info)", fontSize: 13.5, borderRadius: 13 }}>
            <Icon name="mail" size={15} style={{ marginBlockStart: 2 }} />
            <span>{t("orders.deletePending")}</span>
          </div>
        )}
        <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("orders.title")}</h1>
        <p style={{ margin: "10px 0 0", maxWidth: "52ch", fontSize: 15, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("orders.intro")}</p>

        {orders !== null && list.length === 0 && (
          <div style={{ marginBlockStart: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "clamp(46px,8vw,86px) 28px", border: "1px dashed var(--border-strong)", borderRadius: 20, background: "var(--surface)" }}>
            <span style={{ width: 66, height: 66, borderRadius: 19, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="rotate-ccw" size={26} />
            </span>
            <p style={{ margin: 0, maxWidth: "34ch", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>{t("orders.empty")}</p>
            <button className="jn-btn jk-btn-primary" onClick={() => goDiner("menu")} style={{ padding: "13px 22px", fontSize: 14 }}>
              <Icon name="utensils" size={16} />
              {t("home.cta.menu")}
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBlockStart: 24 }}>
          {list.slice(0, shown).map((o) => {
            const st = String(o.order["status"]);
            const done = st === "picked_up";
            const tag = tagOf(o);
            const miss = missing(o);
            const live = ["placed", "confirmed", "preparing", "ready"].includes(st);
            return (
              <div key={o.order.id} className="jn-card" style={{ padding: 20, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="jk-mono" style={{ fontSize: 15, fontWeight: 600 }}>{t("confirm.number", { number: String(o.order["number"]) })}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg-muted)" }}>{fmt.dayLong(venueDay(String(o.order["pickup_at"]), fmt.zone))}</span>
                  {tag !== null && <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{tag}</span>}
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: done ? "var(--pos-soft)" : "var(--surface-3)", color: done ? "var(--pos)" : "var(--fg-muted)", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{t((DINER_STATUS[st] ?? "track.badge.placed") as "track.badge.placed")}</span>
                  <span style={{ marginInlineStart: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
                    <span className="jk-mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmt.money(o.order["total"])}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-subtle)" }}>{done ? t("orders.paid") : st === "cancelled" || st === "not_collected" ? t("orders.nothingCharged") : t("orders.toPay")}</span>
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBlock: 14, marginBlock: 14, borderBlock: "1px solid var(--border)" }}>
                  {o.lines.map((l) => {
                    const mods = storedOptionsText(menu, l.options);
                    return (
                      <div key={l.id} style={{ position: "relative", paddingInlineStart: 34 }}>
                        <span className="jk-mono" style={{ position: "absolute", insetInlineStart: 0, insetBlockStart: 0, minWidth: 26, height: 22, paddingInline: 6, borderRadius: 7, background: "var(--surface-3)", color: "var(--fg-muted)", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {t("co.qty", { qty: fmt.number(Number(l["qty"])) })}
                        </span>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: "-.015em" }}>{String(l["name"])}</span>
                        {mods !== "" && <span style={{ display: "block", marginBlockStart: 3, fontSize: 12.5, lineHeight: 1.45, color: "var(--fg-muted)", textWrap: "pretty" }}>{mods}</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button className="jn-btn jk-btn-sm is-primary" onClick={() => reorder(o)} style={{ height: 44, paddingInline: 20, borderRadius: 12, fontSize: 14 }}>
                    <Icon name="rotate-ccw" size={15} />
                    {t("orders.again")}
                  </button>
                  {live && (
                    <button
                      className="jn-gi jk-btn-sm"
                      onClick={() => {
                        showAccountOrder(o);
                        goDiner("track");
                      }}
                      style={{ height: 44, paddingInline: 18, borderRadius: 12, fontSize: 14 }}
                    >
                      <Icon name="radar" size={15} />
                      {t("orders.follow")}
                    </button>
                  )}
                  {miss > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--warn)" }}>
                      <Icon name="alert-circle" size={14} />
                      {t("orders.missing", { count: fmt.number(miss) }, miss)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {list.length > shown && (
          <button className="jn-gi jk-btn-ghost" onClick={() => setShown(shown + PAGE)} style={{ marginBlockStart: 16, padding: "12px 18px", fontSize: 13.5, borderRadius: 12 }}>
            {t("orders.older")}
          </button>
        )}
      </div>
      {confirmAll && (
        <ConfirmDialog
          title={t("orders.signOutAll.title")}
          body={t("orders.signOutAll.body")}
          onClose={() => askSignOutAll(false)}
          buttons={[
            {
              id: "all",
              label: t("orders.signOutAll.yes"),
              kind: "primary",
              busy,
              onClick: () => {
                void signOutEverywhere().then(() => goDiner("find"));
              },
            },
            { id: "stay", label: t("orders.signOutAll.stay"), kind: "ghost", onClick: () => askSignOutAll(false) },
          ]}
        />
      )}
      {deleteAsk && (
        <ConfirmDialog
          title={t("orders.delete.title")}
          body={t("orders.delete.body")}
          onClose={() => askDelete(false)}
          buttons={[
            { id: "delete", label: t("orders.delete"), kind: "danger", busy, onClick: () => void remove() },
            { id: "keep", label: t("orders.delete.keep"), kind: "ghost", onClick: () => askDelete(false) },
          ]}
        >
          {stale && (
            <div className="jk-notice" style={{ marginBlockStart: 14, background: "var(--info-soft)", color: "var(--info)" }}>
              <Icon name="mail" size={14} style={{ marginBlockStart: 2 }} />
              {t("orders.delete.fresh")}
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
