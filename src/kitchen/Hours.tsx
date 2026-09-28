/**
 * Hours: taking online orders at all, the standing week, closures (and the
 * orders a closure would leave stranded), and the public holidays Holiday
 * calendars lends. Managers change these; everyone in the kitchen sees them.
 */
import { ConfirmDialog } from "../components/Confirm.tsx";
import { Icon } from "../components/Icon.tsx";
import { Switch } from "../components/Switch.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import type { Row } from "../data/wire.ts";
import { useNow } from "../data/sources.ts";
import { useI18n, type TFunction } from "../i18n/index.tsx";
import type { Formatter } from "../lib/format.ts";
import { hoursOn, lastPickup } from "../lib/day.ts";
import { addDays, hhmm, minutesOf, venueMinutes, weekdayOf, WEEKDAY_KEYS, type Day } from "../lib/venueTime.ts";
import { BOARD, addClosure, dayOf, isManager, kToday, num, setClosure, setHours, setOnline, useKitchen } from "../state/kitchen.ts";
import { toast } from "../state/ui.ts";
import { useKFmt } from "./fmt.ts";

const A_MONDAY: Day = "2026-07-27";
const TIMES = Array.from({ length: 96 }, (_, i) => hhmm(i * 15));

/** "2 orders are already in for Tuesday, August 11 (#2120, Ana; #2121, Bo) — they stay unless you cancel them." */
export function coverText(t: TFunction, fmt: Formatter, list: readonly OrderWithLines[]): string {
  const n = list.length;
  const which = list.map((o) => `#${String(o.order["number"])}, ${String(o.order["name"] ?? "")}`).join("; ");
  return t("kitchen.hours.cover", { count: fmt.number(n), date: fmt.dayLong(dayOf(list[0]!)), which }, n);
}

/** Orders still wanted between two days. */
function ordersIn(orders: readonly OrderWithLines[], from: Day, to: Day): OrderWithLines[] {
  return orders.filter((o) => (BOARD as readonly string[]).includes(String(o.order["status"])) && dayOf(o) >= from && dayOf(o) <= to);
}

function Section({ id, title, children, aside }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ padding: 20, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 id={id} className="jk-kicker" style={{ margin: 0 }}>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Hours() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const k = useKitchen();
  const manager = isManager();
  const today = kToday(now);
  const online = k.settings?.["online_on"] !== false;
  const slot = num(k.settings?.["slot_minutes"], 15);
  const name = (i: number) => fmt.weekday(addDays(A_MONDAY, i));
  const todayIndex = WEEKDAY_KEYS.indexOf(weekdayOf(today));
  const week = WEEKDAY_KEYS.map((w) => k.hours.find((h) => h["weekday"] === w)).filter((h): h is Row => h !== undefined);
  const saved = (ok: boolean) => toast(ok ? t("kitchen.hours.saved") : t("kitchen.hours.saveFailed"), ok ? "ok" : "warn");

  // The next seven days' orders a day's closing, or earlier closing, would strand.
  const warnings: OrderWithLines[][] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(today, i);
    const h = hoursOn(d, k.hours, k.closures);
    const hit = ordersIn(k.orders, d, d).filter((o) => !h.open || venueMinutes(String(o.order["pickup_at"]), k.zone) > minutesOf(lastPickup(h.closes, slot)));
    if (hit.length > 0) warnings.push(hit);
  }
  const closures = k.closures.filter((c) => String(c["to_date"] ?? c["from_date"]) >= today).sort((a, b) => String(a["from_date"]).localeCompare(String(b["from_date"])));
  const draft = k.closureDraft;
  const setDraft = (patch: Partial<typeof draft>) => useKitchen.setState({ closureDraft: { ...draft, ...patch } });
  const draftHits = draft.from === "" ? [] : ordersIn(k.orders, draft.from, draft.to === "" ? draft.from : draft.to);
  const draftBad = draft.from !== "" && (draft.from < today || (draft.to !== "" && draft.to < draft.from));
  const whenOf = (c: Row) => {
    const from = String(c["from_date"]);
    const to = String(c["to_date"] ?? from);
    return from === to ? fmt.dayShort(from) : t("hours.range", { from: fmt.dayShort(from), to: fmt.dayShort(to) });
  };
  const covered = (day: string) => k.closures.some((c) => c["active"] !== false && String(c["from_date"]) <= day && day <= String(c["to_date"] ?? c["from_date"]));

  return (
    <div style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "clamp(19px,2.4vw,24px)", fontWeight: 800, letterSpacing: "-.03em" }}>{t("kitchen.hours.title")}</h2>
        <p style={{ margin: "9px 0 0", maxWidth: "60ch", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("kitchen.hours.intro")}</p>
      </div>

      <Section id="jn-kh-online" title={t("kitchen.hours.online")}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBlockStart: 14 }}>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.022em" }}>{t("kitchen.hours.taking")}</span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-muted)" }}>{t("kitchen.hours.takingHint")}</span>
          </span>
          <Switch
            on={online}
            label={t("kitchen.hours.taking")}
            disabled={!manager}
            onToggle={() => {
              if (online) useKitchen.setState({ askOnlineOff: true });
              else void setOnline(true).then((ok) => toast(ok ? t("kitchen.hours.onlineOn") : t("kitchen.hours.saveFailed"), ok ? "ok" : "warn"));
            }}
          />
        </div>
      </Section>

      <Section id="jn-kh-week" title={t("kitchen.hours.week")}>
        <div style={{ display: "flex", flexDirection: "column", marginBlockStart: 8 }}>
          {week.map((w) => {
            const open = w["open"] !== false;
            const opens = String(w["opens"] ?? "11:00");
            const closes = String(w["closes"] ?? "21:00");
            // Named by its own weekday, not its place in the list (a missing row would shift every name after it).
            const i = WEEKDAY_KEYS.indexOf(String(w["weekday"]) as (typeof WEEKDAY_KEYS)[number]);
            const day = name(i);
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBlock: 10, borderBlockEnd: "1px solid var(--border)" }}>
                <span style={{ flex: "1 1 110px", fontSize: 14, fontWeight: i === todayIndex ? 800 : 600 }}>{day}</span>
                <Switch on={open} label={t("kitchen.hours.openOn", { day })} disabled={!manager} onToggle={() => void setHours(w.id, { open: !open }).then(saved)} />
                {open ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label className="jn-sr" htmlFor={`jn-wk-from-${String(i)}`}>
                      {t("kitchen.hours.opens")}
                    </label>
                    <select id={`jn-wk-from-${String(i)}`} className="jn-fld jk-mono" value={opens} disabled={!manager} onChange={(e) => void setHours(w.id, { opens: e.target.value }).then(saved)} style={{ height: 34, paddingInline: 10, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 12.5, fontWeight: 600 }}>
                      {TIMES.filter((x) => x < closes).map((x) => (
                        <option key={x} value={x}>
                          {fmt.wall(today, x)}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" style={{ color: "var(--fg-subtle)" }}>
                      –
                    </span>
                    <label className="jn-sr" htmlFor={`jn-wk-to-${String(i)}`}>
                      {t("kitchen.hours.closes")}
                    </label>
                    <select id={`jn-wk-to-${String(i)}`} className="jn-fld jk-mono" value={closes} disabled={!manager} onChange={(e) => void setHours(w.id, { closes: e.target.value }).then(saved)} style={{ height: 34, paddingInline: 10, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 12.5, fontWeight: 600 }}>
                      {TIMES.filter((x) => x > opens).map((x) => (
                        <option key={x} value={x}>
                          {fmt.wall(today, x)}
                        </option>
                      ))}
                    </select>
                  </span>
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{t("home.closed")}</span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="jn-kh-closures" title={t("kitchen.hours.closures")}>
        <div style={{ display: "flex", flexDirection: "column", marginBlockStart: 8 }}>
          {closures.length === 0 && <span style={{ paddingBlock: 10, fontSize: 13, color: "var(--fg-subtle)" }}>{t("kitchen.hours.noClosures")}</span>}
          {closures.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBlock: 10, borderBlockEnd: "1px solid var(--border)" }}>
              <span className="jk-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                {whenOf(c)}
              </span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{c["reason"] ? String(c["reason"]) : t("home.closed")}</span>
              <Switch on={c["active"] !== false} label={t("kitchen.hours.closureAria", { when: whenOf(c) })} disabled={!manager} onToggle={() => void setClosure(c.id, c["active"] === false).then(saved)} />
            </div>
          ))}
        </div>
        {warnings.map((hit) => (
          <div key={dayOf(hit[0]!)} role="alert" className="jk-notice" style={{ flexWrap: "wrap", marginBlockStart: 12, background: "var(--warn-soft)", color: "var(--warn)" }}>
            <Icon name="triangle-alert" size={15} style={{ marginBlockStart: 2 }} />
            <span style={{ flex: 1, minWidth: 200 }}>{coverText(t, fmt, hit)}</span>
            <button className="jn-nav" onClick={() => useKitchen.setState({ ticket: hit[0]!.order.id })} style={{ border: "none", background: "transparent", padding: 0, color: "inherit", fontSize: 13, fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>
              {t("kitchen.hours.seeOrder")}
            </button>
          </div>
        ))}
        {manager && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBlockStart: 16, padding: 14, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ flexBasis: "100%", fontSize: 13, fontWeight: 800 }}>{t("kitchen.hours.addClosure")}</span>
            <div>
              <label htmlFor="jn-cl-from" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                {t("kitchen.hours.from")}
              </label>
              <input id="jn-cl-from" type="date" className="jn-fld jk-mono" min={today} value={draft.from} onChange={(e) => setDraft({ from: e.target.value, to: draft.to !== "" && draft.to >= e.target.value ? draft.to : e.target.value })} style={{ height: 38, paddingInline: 10, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 13 }} />
            </div>
            <div>
              <label htmlFor="jn-cl-to" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                {t("kitchen.hours.to")}
              </label>
              <input id="jn-cl-to" type="date" className="jn-fld jk-mono" min={draft.from === "" ? today : draft.from} value={draft.to} onChange={(e) => setDraft({ to: e.target.value })} style={{ height: 38, paddingInline: 10, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 13 }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="jn-cl-reason" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                {t("kitchen.hours.reason")}
              </label>
              <input id="jn-cl-reason" className="jn-fld" value={draft.reason} maxLength={120} onChange={(e) => setDraft({ reason: e.target.value })} placeholder={t("kitchen.hours.reasonPlaceholder")} style={{ width: "100%", height: 38, paddingInline: 11, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 13.5, fontWeight: 600 }} />
            </div>
            <button
              className="jn-btn jk-btn-sm is-primary"
              disabled={draft.from === "" || draftBad}
              onClick={() =>
                void addClosure({ from_date: draft.from, to_date: draft.to === "" ? draft.from : draft.to, reason: draft.reason.trim() === "" ? null : draft.reason.trim() }).then((ok) => {
                  if (ok) useKitchen.setState({ closureDraft: { from: "", to: "", reason: "" } });
                  toast(ok ? t("kitchen.hours.closureAdded") : t("kitchen.hours.saveFailed"), ok ? "ok" : "warn");
                })
              }
            >
              <Icon name="plus" size={14} />
              {t("kitchen.hours.add")}
            </button>
            {draftHits.length > 0 && (
              <div role="alert" className="jk-notice" style={{ flexBasis: "100%", flexWrap: "wrap", background: "var(--warn-soft)", color: "var(--warn)" }}>
                <Icon name="triangle-alert" size={15} style={{ marginBlockStart: 2 }} />
                <span style={{ flex: 1, minWidth: 200 }}>{coverText(t, fmt, draftHits)}</span>
                <button className="jn-nav" onClick={() => useKitchen.setState({ ticket: draftHits[0]!.order.id })} style={{ border: "none", background: "transparent", padding: 0, color: "inherit", fontSize: 13, fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>
                  {t("kitchen.hours.seeOrder")}
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      {k.holidays !== null && (
        <Section
          id="jn-kh-hol"
          title={t("kitchen.hours.holidays")}
          aside={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
              <Icon name="calendar-days" size={13} />
              {t("kitchen.hours.holidaysFrom")}
            </span>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", marginBlockStart: 8 }}>
            {k.holidays
              .filter((h) => h.date >= today)
              .map((h) => {
                const added = covered(h.date);
                return (
                  <div key={h.date} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBlock: 10, borderBlockEnd: "1px solid var(--border)" }}>
                    <span style={{ flex: "1 1 160px", fontSize: 13.5, fontWeight: 700 }}>{h.name}</span>
                    <span className="jk-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>
                      {fmt.dayShort(h.date)}
                    </span>
                    {added ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, paddingInline: 11, borderRadius: 9, background: "var(--surface-3)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 800 }}>
                        <Icon name="check" size={13} />
                        {t("home.closed")}
                      </span>
                    ) : manager ? (
                      <button className="jn-gi jk-btn-sm" style={{ height: 32 }} onClick={() => void addClosure({ from_date: h.date, to_date: h.date, reason: h.name }).then((ok) => toast(ok ? t("kitchen.hours.holidayAdded", { name: h.name }) : t("kitchen.hours.saveFailed"), ok ? "ok" : "warn"))}>
                        <Icon name="calendar-x" size={13} />
                        {t("kitchen.hours.addHoliday")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </Section>
      )}

      {k.askOnlineOff && (
        <ConfirmDialog
          title={t("kitchen.online.title")}
          body={t("kitchen.online.body")}
          onClose={() => useKitchen.setState({ askOnlineOff: false })}
          buttons={[
            {
              id: "off",
              label: t("kitchen.online.yes"),
              kind: "danger",
              onClick: () => {
                useKitchen.setState({ askOnlineOff: false });
                void setOnline(false).then((ok) => toast(ok ? t("kitchen.hours.onlineOff") : t("kitchen.hours.saveFailed"), "warn"));
              },
            },
            { id: "keep", label: t("kitchen.online.keep"), kind: "ghost", onClick: () => useKitchen.setState({ askOnlineOff: false }) },
          ]}
        />
      )}
    </div>
  );
}
