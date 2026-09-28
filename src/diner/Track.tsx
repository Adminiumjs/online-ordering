/**
 * An order by its own link: the confirmation on the first view after
 * placing, then Track — where it stands, each step's time, what is in it, when
 * and where to pick it up — read again every 30 seconds while it moves. The
 * diner may cancel while the kitchen has not taken it.
 */
import { useEffect } from "react";

import { Bdi } from "../components/Bdi.tsx";
import { ConfirmDialog } from "../components/Confirm.tsx";
import { Icon, type IconName } from "../components/Icon.tsx";
import { useNarrow } from "../components/Modal.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import { useI18n } from "../i18n/index.tsx";
import { Rich } from "../i18n/rich.tsx";
import { firstName, telHref } from "../lib/format.ts";
import { storedOptionsText } from "../lib/menu.ts";
import { venueDay } from "../lib/venueTime.ts";
import { useDiner } from "../state/diner.ts";
import { cancelTracked, moving, readTrack, useTrack } from "../state/track.ts";
import { goDiner, toast } from "../state/ui.ts";
import { useFmt, useVenue } from "../app/venue.ts";
import { useReorder } from "./Reorder.tsx";
import { useDay } from "./useDay.ts";

type Badge = { key: string; tone: "info" | "warn" | "pos" | "neutral" | "danger"; icon: IconName };
const BADGES: Record<string, Badge> = {
  placed: { key: "track.badge.placed", tone: "info", icon: "hourglass" },
  confirmed: { key: "track.badge.kitchen", tone: "warn", icon: "chef-hat" },
  preparing: { key: "track.badge.kitchen", tone: "warn", icon: "chef-hat" },
  ready: { key: "track.badge.ready", tone: "pos", icon: "bell" },
  picked_up: { key: "track.badge.picked", tone: "neutral", icon: "check-circle-2" },
  cancelled: { key: "track.badge.cancelled", tone: "danger", icon: "circle-slash" },
  not_collected: { key: "track.badge.notCollected", tone: "warn", icon: "circle-slash" },
};
const FLOW = ["placed", "confirmed", "preparing", "ready", "picked_up"] as const;
const STEP_ICONS: IconName[] = ["receipt-text", "check", "chef-hat", "bell", "hand-platter"];
const STAMPS = ["placed_at", "confirmed_at", "preparing_at", "ready_at", "picked_up_at"];

/** "Today, Tuesday, July 28" — the pickup day against the kitchen's today. */
function useDayWord(): (instant: string) => string {
  const { t } = useI18n();
  const fmt = useFmt();
  const day = useDay();
  return (instant) => {
    const d = venueDay(instant, fmt.zone);
    const word = d === day.today ? t("pick.today") : d === day.tomorrow ? t("pick.tomorrow") : null;
    return word === null ? fmt.dayLong(d) : t("track.dayWord", { word, date: fmt.dayLong(d) });
  };
}

export function TrackPage() {
  const state = useTrack((s) => s.state);
  const first = useTrack((s) => s.first);
  const order = useTrack((s) => s.order);
  const placed = useDiner((s) => s.placed);
  if (state === "idle") return <NoOrder />;
  if (state === "expired") return <Expired />;
  if (first && (order !== null || placed !== null)) return <Confirmation />;
  if (state === "loading" || order === null) return state === "error" ? <NoOrder /> : <Loading />;
  return <Tracking order={order} />;
}

function Loading() {
  const { t } = useI18n();
  return (
    <div className="jn-view jk-shell">
      <div role="status" aria-busy="true" aria-label={t("shell.loading")} style={{ maxWidth: 980, marginInline: "auto", paddingBlock: "clamp(24px,4vw,44px)", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="jn-skel" style={{ height: 40, width: 180, borderRadius: 10 }} />
        <div className="jn-skel" style={{ height: 260, borderRadius: 20 }} />
      </div>
    </div>
  );
}

/** No order on this device: say so and offer Find my order — never another order's number. */
function NoOrder() {
  const { t } = useI18n();
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 540, marginInline: "auto", marginBlock: "clamp(24px,4vw,44px)", display: "flex", flexDirection: "column", gap: 14, padding: "clamp(22px,3vw,30px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(22px,3.2vw,28px)", fontWeight: 800, letterSpacing: "-.034em" }}>{t("track.none.title")}</h1>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>{t("track.none.body")}</p>
        <button className="jn-btn jk-btn-primary" onClick={() => goDiner("find")} style={{ alignSelf: "flex-start", padding: "14px 23px", fontSize: 14.5 }}>
          <Icon name="mail-search" size={16} />
          {t("track.none.find")}
        </button>
      </div>
    </div>
  );
}

function Expired() {
  const { t } = useI18n();
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 980, marginInline: "auto", paddingBlock: "clamp(24px,4vw,44px) clamp(34px,5vw,64px)" }}>
        <div style={{ maxWidth: 540, marginInline: "auto", display: "flex", flexDirection: "column", gap: 14, padding: "clamp(22px,3vw,30px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span style={{ width: 50, height: 50, borderRadius: 15, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="link-2-off" size={22} />
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(22px,3.2vw,28px)", fontWeight: 800, letterSpacing: "-.034em", textWrap: "pretty" }}>{t("track.expired.title")}</h1>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>{t("track.expired.body")}</p>
          <button className="jn-btn jk-btn-primary" onClick={() => goDiner("find")} style={{ alignSelf: "flex-start", padding: "14px 23px", fontSize: 14.5 }}>
            <Icon name="mail" size={16} />
            {t("track.expired.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Confirmation() {
  const { t } = useI18n();
  const fmt = useFmt();
  const venue = useVenue();
  const dayWord = useDayWord();
  const placed = useDiner((s) => s.placed);
  const order = useTrack((s) => s.order);
  const token = useTrack((s) => s.token);
  const o = order?.order;
  const name = firstName(placed?.name ?? o?.["name"]);
  const email = placed?.email ?? String(o?.["email"] ?? "");
  const number = String(o?.["number"] ?? placed?.number ?? "");
  const pickup = String(o?.["pickup_at"] ?? placed?.pickupAt ?? "");
  const total = o?.["total"] ?? placed?.total ?? 0;
  const big: React.CSSProperties = { fontFamily: "var(--mono)", unicodeBidi: "plaintext", fontSize: 20, fontWeight: 600 };
  const facts = [
    { label: t("confirm.order"), value: t("confirm.number", { number }), style: big, sub: null },
    { label: t("confirm.pickup"), value: pickup === "" ? "" : fmt.time(pickup), style: big, sub: pickup === "" ? null : dayWord(pickup) },
    { label: t("confirm.pay"), value: fmt.money(total), style: big, sub: t("confirm.cashOrCard") },
    { label: t("confirm.address"), value: venue.street !== "" ? venue.street : venue.address, style: { fontSize: 15.5, fontWeight: 800, letterSpacing: "-.02em" } as React.CSSProperties, sub: venue.area },
  ];
  useEffect(() => {
    document.getElementById("jn-view-title")?.focus();
  }, []);
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 720, marginInline: "auto", paddingBlock: "clamp(34px,6vw,74px) clamp(40px,6vw,80px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
        <span style={{ width: 88, height: 88, borderRadius: 26, background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center", animation: "jn-check .4s cubic-bezier(.2,.9,.3,1)" }}>
          <Icon name="check" size={44} />
        </span>
        <h1 id="jn-view-title" tabIndex={-1} style={{ margin: 0, fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, letterSpacing: "-.038em", outline: "none" }}>
          {name === "" ? t("confirm.titleNoName") : t("confirm.title", { name })}
        </h1>
        <p style={{ margin: 0, maxWidth: "40ch", fontSize: 15.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
          <Rich text={token === null ? t("confirm.emailedReplay") : t("confirm.emailed")} parts={{ email: <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{email}</span> }} />
        </p>
        {venue.phone !== null && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--fg-subtle)" }}>
            <Rich
              text={t("confirm.typo")}
              parts={{
                phone: (
                  <a href={telHref(venue.phone)} className="jk-mono" style={{ color: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}>
                    <Bdi>{venue.phone}</Bdi>
                  </a>
                ),
              }}
            />
          </p>
        )}
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBlockStart: 10 }}>
          {facts.map((f) => (
            <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 5, padding: "17px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "start" }}>
              <span className="jk-kicker">{f.label}</span>
              <span style={f.style}>
                <bdi>{f.value}</bdi>
              </span>
              {f.sub !== null && <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{f.sub}</span>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 11, justifyContent: "center", marginBlockStart: 12 }}>
          {token !== null ? (
            <button className="jn-btn jk-btn-primary" onClick={() => useTrack.setState({ first: false })}>
              <Icon name="radar" size={17} />
              {t("confirm.follow")}
            </button>
          ) : (
            <button className="jn-btn jk-btn-primary" onClick={() => goDiner("find")}>
              <Icon name="mail-search" size={17} />
              {t("track.none.find")}
            </button>
          )}
          <button className="jn-gi jk-btn-ghost" onClick={() => goDiner("menu")}>
            <Icon name="utensils" size={17} />
            {t("confirm.more")}
          </button>
        </div>
      </div>
    </div>
  );
}

function cancelReason(order: OrderWithLines["order"], t: ReturnType<typeof useI18n>["t"]): string | null {
  switch (order["cancel_code"]) {
    case "ran_out":
      return order["cancel_dish"] ? t("track.reason.ranOutDish", { dish: String(order["cancel_dish"]) }) : t("track.reason.ranOut");
    case "too_busy":
      return t("track.reason.busy");
    case "customer_asked":
      return t("track.reason.asked");
    case "other":
      return order["cancel_note"] ? String(order["cancel_note"]) : null;
    default:
      return null;
  }
}

function Tracking({ order }: { order: OrderWithLines }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const venue = useVenue();
  const narrow = useNarrow(900);
  const dayWord = useDayWord();
  const reorder = useReorder();
  const menu = useDiner((s) => s.data?.menu ?? null);
  const updatedAt = useTrack((s) => s.updatedAt);
  const stale = useTrack((s) => s.stale);
  const cancelAsk = useTrack((s) => s.cancelAsk);
  const cancelling = useTrack((s) => s.cancelling);
  const o = order.order;
  const status = String(o["status"]);
  const badge = BADGES[status] ?? BADGES["placed"]!;
  const live = status !== "cancelled" && status !== "not_collected";
  const cur = FLOW.indexOf(status as (typeof FLOW)[number]);
  const pickup = String(o["pickup_at"]);
  const phone = venue.phone;
  const callLink = (text: string) =>
    phone === null ? null : (
      <Rich
        text={text}
        parts={{
          phone: (
            <a href={telHref(phone)} className="jk-mono" style={{ fontWeight: 700, color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
              <Bdi>{phone}</Bdi>
            </a>
          ),
        }}
      />
    );

  useEffect(() => {
    if (!moving(order)) return;
    const timer = setInterval(() => void readTrack(), 30_000);
    return () => clearInterval(timer);
  }, [order]);

  const cancel = async () => {
    const result = await cancelTracked();
    if (result === "cancelled") toast(t("track.cancel.done"));
    else if (result === "started") toast(phone === null ? t("track.started.noPhone") : t("track.started.toast", { phone: `\u2066${phone}\u2069` }), "warn");
    else toast(t("track.cancel.failed"), "warn");
  };

  const selfCancel = o["cancel_code"] === "self";
  const closing = o["cancel_code"] === "closed";
  const reason = status === "cancelled" && !selfCancel && !closing ? cancelReason(o, t) : null;
  const cancelledAt = o["cancelled_at"] ? fmt.time(String(o["cancelled_at"])) : "";

  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 980, marginInline: "auto", paddingBlock: "clamp(24px,4vw,44px) clamp(34px,5vw,64px)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBlockEnd: 20 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <span className="jk-kicker" style={{ display: "block", fontSize: 11 }}>{t("confirm.order")}</span>
            <h1 id="jn-view-title" tabIndex={-1} className="jk-mono" style={{ display: "block", margin: "5px 0 0", fontSize: "clamp(26px,4vw,38px)", fontWeight: 600, letterSpacing: "-.02em", outline: "none" }}>
              {t("confirm.number", { number: String(o["number"]) })}
            </h1>
          </div>
          <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 999, background: badge.tone === "neutral" ? "var(--surface-3)" : `var(--${badge.tone}-soft)`, color: badge.tone === "neutral" ? "var(--fg-muted)" : `var(--${badge.tone})`, fontSize: 13.5, fontWeight: 800 }}>
            <Icon name={badge.icon} size={14} />
            {t(badge.key as "track.badge.placed")}
          </span>
        </div>

        {status === "cancelled" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "24px clamp(18px,3vw,26px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--danger-soft)" }}>
            <span style={{ width: 54, height: 54, borderRadius: 16, background: "var(--danger-soft)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="circle-slash" size={26} />
            </span>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.028em" }}>{selfCancel ? t("track.cancelled.self", { time: cancelledAt }) : closing ? t("track.cancelled.closing") : t("track.cancelled.kitchen")}</span>
            {reason !== null && <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.6 }}>{reason}</p>}
            <p style={{ margin: 0, maxWidth: "48ch", fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("track.cancelled.nothing")}</p>
            {cancelledAt !== "" && (
              <span className="jk-mono" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 9, background: "var(--surface-3)", fontSize: 12, fontWeight: 500, color: "var(--fg-muted)" }}>
                <Icon name="clock" size={13} />
                {t("track.cancelledAt", { time: cancelledAt })}
              </span>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 11, marginBlockStart: 6 }}>
              <button className="jn-btn jk-btn-primary" onClick={() => reorder(order)} style={{ padding: "13px 21px", fontSize: 14, borderRadius: 12 }}>
                <Icon name="rotate-ccw" size={15} />
                {t("track.again")}
              </button>
              <button className="jn-gi jk-btn-ghost" onClick={() => goDiner("menu")} style={{ padding: "13px 19px", fontSize: 14, borderRadius: 12 }}>
                <Icon name="utensils" size={15} />
                {t("home.cta.menu")}
              </button>
            </div>
          </div>
        )}

        {status === "not_collected" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "24px clamp(18px,3vw,26px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <span style={{ width: 54, height: 54, borderRadius: 16, background: "var(--warn-soft)", color: "var(--warn)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="package-x" size={26} />
            </span>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.028em" }}>{t("track.badge.notCollected")}</span>
            <p style={{ margin: 0, maxWidth: "48ch", fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
              {t("track.notCollected.body")} {callLink(t("track.notCollected.call"))}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {(["confirmed_at", "preparing_at", "ready_at", "not_collected_at"] as const)
                .filter((k) => o[k] !== null && o[k] !== undefined)
                .map((k) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
                    {t(`track.stamp.${k}`)}
                    <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{fmt.time(String(o[k]))}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {live && (
          <div style={{ padding: "22px clamp(18px,3vw,26px)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {FLOW.map((step, i) => {
                const stamp = o[STAMPS[i]!];
                const done = i < cur || (status === "picked_up" && i === 4);
                const isCur = i === cur && status !== "picked_up";
                const later = i === 0 && venueDay(pickup, fmt.zone) !== venueDay(String(o["placed_at"] ?? pickup), fmt.zone);
                return (
                  <li key={step} aria-current={isCur ? "step" : undefined} style={{ position: "relative", display: "flex", gap: 12, paddingInlineStart: 44, paddingBlockEnd: i < 4 ? 22 : 0 }}>
                    <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: 0, insetBlockStart: 0, zIndex: 2, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--pos-soft)" : isCur ? "var(--accent)" : "var(--surface-3)", color: done ? "var(--pos)" : isCur ? "var(--accent-fg)" : "var(--fg-subtle)", border: `1px solid ${done ? "var(--pos-soft)" : isCur ? "var(--accent)" : "var(--border)"}`, animation: isCur ? "jn-breathe 2.1s ease-in-out infinite" : "none" }}>
                      <Icon name={done ? "check" : STEP_ICONS[i]!} size={14} />
                    </span>
                    {i < 4 && <span aria-hidden="true" style={{ position: "absolute", insetInlineStart: 14, insetBlockStart: 30, width: 2, insetBlockEnd: 0, background: i < cur ? "var(--pos)" : "var(--border)", opacity: i < cur ? 0.4 : 1 }} />}
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, paddingBlock: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: isCur ? 800 : 700, letterSpacing: "-.02em", color: done || isCur ? "var(--fg)" : "var(--fg-subtle)" }}>{t(`track.step.${step}`)}</span>
                      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-subtle)" }}>{later ? t("track.step.placed.later", { date: fmt.dayLong(venueDay(pickup, fmt.zone)) }) : t(`track.step.${step}.sub`)}</span>
                    </span>
                    {stamp !== null && stamp !== undefined && (
                      <span className="jk-mono" style={{ marginInlineStart: "auto", alignSelf: "center", fontSize: 12.5, fontWeight: 500, color: "var(--fg-muted)" }}>
                        {fmt.time(String(stamp))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBlockStart: 20, paddingBlockStart: 16, borderBlockStart: "1px solid var(--border)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: stale ? "var(--warn)" : "var(--fg-subtle)" }}>
                <Icon name="refresh-cw" size={13} />
                {stale ? (
                  <span>{t("track.stale")}</span>
                ) : (
                  <span>
                    <Rich text={t("track.updated")} parts={{ time: <span className="jk-mono" style={{ fontWeight: 600 }}>{updatedAt === null ? "" : fmt.time(updatedAt)}</span> }} />
                  </span>
                )}
              </span>
              {status === "placed" && (
                <button className="jn-nav" onClick={() => useTrack.setState({ cancelAsk: true })} style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, fontSize: 13, cursor: "pointer", color: "var(--fg-muted)", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 700 }}>
                  {t("track.cancel")}
                </button>
              )}
              {(status === "confirmed" || status === "preparing") && <span style={{ marginInlineStart: "auto", fontSize: 12.5, color: "var(--fg-muted)" }}>{phone === null ? t("track.started.noPhone") : callLink(t("track.started"))}</span>}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1.35fr) minmax(0,1fr)", gap: 16, marginBlockStart: 16, alignItems: "start" }}>
          <div style={{ padding: "18px 20px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", minWidth: 0 }}>
            <span className="jk-kicker" style={{ display: "block", fontSize: 11 }}>{t("track.inOrder")}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBlockStart: 13 }}>
              {order.lines.map((line) => {
                const mods = storedOptionsText(menu, line.options);
                return (
                  <div key={line.id} style={{ position: "relative", display: "flex", gap: 10, paddingInlineStart: 34 }}>
                    <span className="jk-mono" style={{ position: "absolute", insetInlineStart: 0, insetBlockStart: 0, minWidth: 26, height: 22, paddingInline: 6, borderRadius: 7, background: "var(--surface-3)", color: "var(--fg-muted)", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {t("co.qty", { qty: fmt.number(Number(line["qty"])) })}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, letterSpacing: "-.015em" }}>{String(line["name"])}</span>
                      {mods !== "" && <span style={{ display: "block", marginBlockStart: 3, fontSize: 12, lineHeight: 1.45, color: "var(--fg-subtle)" }}>{mods}</span>}
                      {line["note"] ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBlockStart: 3, fontSize: 12, color: "var(--warn)", fontWeight: 600 }}>
                          <Icon name="message-square" size={11} />
                          {String(line["note"])}
                        </span>
                      ) : null}
                    </span>
                    <span className="jk-mono" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt.money(line["line_total"])}</span>
                  </div>
                );
              })}
            </div>
            {o["note"] ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBlockStart: 14, padding: "10px 12px", borderRadius: 10, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.45 }}>
                <Icon name="message-square" size={13} style={{ marginBlockStart: 2 }} />
                {String(o["note"])}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 14, paddingBlockStart: 14, borderBlockStart: "1px solid var(--border)" }}>
              {[
                { label: t("totals.subtotal"), value: o["subtotal"], big: false },
                { label: t("totals.tax", { rate: fmt.percent(o["tax_rate"]) }), value: o["tax"], big: false },
                { label: t("totals.total"), value: o["total"], big: true },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: 10, ...(r.big ? { paddingBlockStart: 10, borderBlockStart: "1px solid var(--border)" } : {}) }}>
                  <span style={{ fontSize: r.big ? 17 : 13.5, fontWeight: r.big ? 800 : 600, color: r.big ? "var(--fg)" : "var(--fg-muted)" }}>{r.label}</span>
                  <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: r.big ? 17 : 13.5, fontWeight: 600, color: r.big ? "var(--fg)" : "var(--fg-muted)" }}>{fmt.money(r.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "17px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="jk-kicker">{t("pick.title")}</span>
              <span className="jk-mono" style={{ fontSize: 19, fontWeight: 600 }}>{fmt.time(pickup)}</span>
              <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{dayWord(pickup)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "17px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="jk-kicker">{t("track.pickUpAt")}</span>
              <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.02em" }}>
                <bdi>{venue.street !== "" ? venue.street : venue.name}</bdi>
              </span>
              {venue.area !== null && <span className="jk-own" style={{ fontSize: 12, color: "var(--fg-muted)" }}>{venue.area}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 18px", borderRadius: 16, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <Icon name="wallet" size={16} style={{ color: "var(--fg-muted)" }} />
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{t("confirm.pay")}</span>
              <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 15, fontWeight: 600 }}>{fmt.money(o["total"])}</span>
            </div>
          </div>
        </div>
      </div>
      {cancelAsk && (
        <ConfirmDialog
          title={t("track.cancel.title", { number: String(o["number"]) })}
          body={t("track.cancel.body")}
          onClose={() => useTrack.setState({ cancelAsk: false })}
          buttons={[
            { id: "cancel", label: t("track.cancel.yes"), kind: "danger", onClick: () => void cancel(), busy: cancelling },
            { id: "keep", label: t("track.cancel.keep"), kind: "ghost", onClick: () => useTrack.setState({ cancelAsk: false }) },
          ]}
        />
      )}
    </div>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 520, marginInline: "auto", paddingBlock: "clamp(50px,9vw,110px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
        <span className="jk-mono" aria-hidden="true" style={{ fontSize: "clamp(56px,11vw,104px)", fontWeight: 600, letterSpacing: "-.05em", color: "var(--accent-ink)" }}>
          404
        </span>
        <h1 style={{ margin: 0, fontSize: "clamp(23px,3.4vw,32px)", fontWeight: 800, letterSpacing: "-.035em" }}>{t("notFound.title")}</h1>
        <p style={{ margin: 0, maxWidth: "34ch", fontSize: 15, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("notFound.body")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 11, justifyContent: "center", marginBlockStart: 8 }}>
          <button className="jn-btn jk-btn-primary" onClick={() => goDiner("menu")} style={{ padding: "14px 23px", fontSize: 14.5 }}>
            <Icon name="utensils" size={16} />
            {t("home.cta.menu")}
          </button>
          <button className="jn-gi jk-btn-ghost" onClick={() => goDiner("home")} style={{ padding: "14px 21px", fontSize: 14.5 }}>
            <Icon name="home" size={16} />
            {t("notFound.home")}
          </button>
        </div>
      </div>
    </div>
  );
}
