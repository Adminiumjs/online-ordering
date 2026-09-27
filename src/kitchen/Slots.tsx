/**
 * Pickup slots: how full each time of today (or tomorrow) is, pausing one,
 * pausing the next hour, stopping online orders for the rest of today — and
 * taking them again. A phone order can still go into a paused slot.
 */
import { ConfirmDialog } from "../components/Confirm.tsx";
import { Icon } from "../components/Icon.tsx";
import { useNow } from "../data/sources.ts";
import { useI18n } from "../i18n/index.tsx";
import { hoursOn } from "../lib/day.ts";
import { addDays, minutesOf, venueMinutes } from "../lib/venueTime.ts";
import type { SlotCount } from "../data/wire.ts";
import { kToday, num, pauseMany, pauseSlot, reopenMany, reopenSlot, useKitchen } from "../state/kitchen.ts";
import { toast } from "../state/ui.ts";
import { useKFmt } from "./fmt.ts";

/** The times of today a diner may still book: from now + notice on. */
export function bookable(slots: readonly SlotCount[], nowMinutes: number, notice: number): SlotCount[] {
  return slots.filter((s) => minutesOf(s.time) >= nowMinutes + notice);
}

/** Every time a diner may still book today is paused (and there is one): the kitchen stopped for today. */
export function stoppedToday(slots: readonly SlotCount[], nowMinutes: number, notice: number): boolean {
  const left = bookable(slots, nowMinutes, notice).filter((s) => s.taken < s.size || s.pause !== null);
  return left.length > 0 && left.every((s) => s.pause !== null);
}

export function Slots() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const k = useKitchen();
  const today = kToday(now);
  const day = k.slotDay === "today" ? today : addDays(today, 1);
  const slots = k.slots[day] ?? [];
  const nowMin = venueMinutes(now, k.zone);
  const notice = num(k.settings?.["lead_minutes"], 20);
  const cap = num(k.settings?.["slot_capacity"], 6);
  const online = k.settings?.["online_on"] !== false;
  const isToday = day === today;
  const todaySlots = k.slots[today] ?? [];
  const stopped = online && stoppedToday(todaySlots, nowMin, notice);
  const hours = hoursOn(day, k.hours, k.closures);
  const say = (time: string) => fmt.wall(day, time);

  const pauseHour = async () => {
    const times = bookable(todaySlots, nowMin, notice).slice(0, 4).map((s) => s.time);
    if (times.length === 0) return;
    const need = times.filter((time) => todaySlots.find((s) => s.time === time)?.pause === null);
    const result = await pauseMany(today, need);
    if (result.failedAt !== null) toast(t("kitchen.slots.pauseFailed", { time: say(result.failedAt) }), "warn");
    else toast(t("kitchen.slots.pausedRange", { from: say(times[0]!), to: say(times[times.length - 1]!) }), "warn");
  };

  const stop = async () => {
    useKitchen.setState({ askStop: false });
    const need = bookable(todaySlots, nowMin, notice)
      .filter((s) => s.pause === null)
      .map((s) => s.time);
    const result = await pauseMany(today, need);
    if (result.failedAt !== null) {
      useKitchen.setState({ stopFailed: { until: result.done[result.done.length - 1] ?? result.failedAt } });
      toast(t("kitchen.slots.stopFailed"), "warn");
    } else {
      useKitchen.setState({ stopFailed: null });
      toast(t("kitchen.slots.stopped"), "warn");
    }
  };

  const resume = async () => {
    const ids = bookable(useKitchen.getState().slots[today] ?? [], nowMin, notice).flatMap((s) => (s.pause === null ? [] : [s.pause.id]));
    if (await reopenMany(ids)) toast(t("kitchen.slots.resumed"));
    else toast(t("kitchen.slots.resumeFailed"), "warn");
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "clamp(19px,2.4vw,24px)", fontWeight: 800, letterSpacing: "-.03em" }}>{t("kitchen.slots.title")}</h2>
        <div role="group" aria-label={t("kitchen.slots.day")} className="jk-seg" style={{ marginInlineStart: "auto" }}>
          {(["today", "tomorrow"] as const).map((d) => (
            <button key={d} className="jn-chip jk-segbtn" aria-pressed={k.slotDay === d} onClick={() => useKitchen.setState({ slotDay: d })}>
              {t(d === "today" ? "pick.today" : "pick.tomorrow")}
            </button>
          ))}
        </div>
      </div>
      <p style={{ margin: "9px 0 0", maxWidth: "60ch", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("kitchen.slots.intro", { cap: fmt.number(cap) })}</p>
      {isToday && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBlockStart: 16 }}>
          <button className="jn-gi jk-btn-sm" onClick={() => void pauseHour()} disabled={!online || stopped || !hours.open}>
            <Icon name="pause" size={14} />
            {t("kitchen.slots.pauseHour")}
          </button>
          {!online ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, paddingInline: 12, borderRadius: 10, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 12.5, fontWeight: 800 }}>
              <Icon name="power-off" size={14} />
              {t("kitchen.slots.switchedOff")}
            </span>
          ) : stopped ? (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, paddingInline: 12, borderRadius: 10, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 12.5, fontWeight: 800 }}>
                <Icon name="power-off" size={14} />
                {t("kitchen.slots.stoppedToday")}
              </span>
              <button className="jn-btn jk-btn-sm is-primary" onClick={() => void resume()}>
                <Icon name="power" size={14} />
                {t("kitchen.slots.resume")}
              </button>
            </>
          ) : k.stopFailed !== null ? (
            <button className="jn-gi jk-btn-sm" onClick={() => void stop()} style={{ color: "var(--danger)" }}>
              <Icon name="power-off" size={14} />
              {t("kitchen.slots.finishStopping", { time: say(k.stopFailed.until) })}
            </button>
          ) : (
            <button className="jn-gi jk-btn-sm" onClick={() => useKitchen.setState({ askStop: true })} disabled={!hours.open} style={{ color: "var(--danger)" }}>
              <Icon name="power-off" size={14} />
              {t("kitchen.slots.stop")}
            </button>
          )}
        </div>
      )}
      {!hours.open ? (
        <div style={{ marginBlockStart: 18, padding: "34px 24px", border: "1px dashed var(--border-strong)", borderRadius: 16, textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
          {isToday ? (hours.closure?.reason ? t("kitchen.closedTodayFor", { reason: hours.closure.reason }) : t("kitchen.closedToday")) : t("kitchen.closedOn", { day: fmt.weekday(day) })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 18 }}>
          {slots.map((s) => {
            const m = minutesOf(s.time);
            const done = isToday && m < nowMin;
            const phoneOnly = isToday && !done && m < nowMin + notice;
            const paused = s.pause !== null;
            const full = s.taken >= s.size;
            const warm = !full && s.taken >= Math.max(1, s.size - 2);
            const colour = done || paused || !online ? "var(--fg-subtle)" : full ? "var(--danger)" : warm ? "var(--warn)" : "var(--pos)";
            const state = done
              ? t("kitchen.slots.done")
              : !online
                ? t("kitchen.slots.stoppedRow")
                : paused
                  ? s.pause?.by
                    ? t("kitchen.slots.pausedBy", { name: s.pause.by })
                    : t("kitchen.slots.paused")
                  : full
                    ? t("kitchen.slots.full")
                    : phoneOnly
                      ? t("kitchen.slots.phoneOnly")
                      : warm
                        ? t("kitchen.slots.filling")
                        : t("kitchen.slots.open");
            const quiet = done || paused || phoneOnly || !online;
            const button = !done && online && !phoneOnly;
            return (
              <div key={s.time} style={{ display: "flex", alignItems: "center", gap: "clamp(10px,1.6vw,18px)", flexWrap: "wrap", padding: "11px 14px", borderRadius: 13, background: done ? "var(--surface-2)" : "var(--surface)", border: "1px solid var(--border)", color: done ? "var(--fg-subtle)" : "var(--fg)" }}>
                <span className="jk-mono" style={{ flex: "none", minWidth: 82, fontSize: 14, fontWeight: 600 }}>
                  {say(s.time)}
                </span>
                <span role="img" aria-label={t("kitchen.slots.taken", { n: fmt.number(s.taken), size: fmt.number(s.size) })} style={{ position: "relative", flex: 1, minWidth: 100, height: 8, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
                  <span style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, width: `${String(Math.min(100, Math.round((s.taken / Math.max(1, s.size)) * 100)))}%`, borderRadius: 999, background: colour }} />
                </span>
                <span className="jk-mono" aria-hidden="true" style={{ flex: "none", minWidth: 48, textAlign: "end", fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>
                  {fmt.number(s.taken)} / {fmt.number(s.size)}
                </span>
                <span style={{ padding: "3px 9px", borderRadius: 999, background: quiet ? "var(--surface-3)" : full ? "var(--danger-soft)" : warm ? "var(--warn-soft)" : "var(--pos-soft)", color: quiet ? "var(--fg-muted)" : colour, fontSize: 10.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 84, textAlign: "center" }}>
                  {state}
                </span>
                {button ? (
                  <button
                    className="jn-gi"
                    onClick={() => void (paused ? reopenSlot(s.pause!.id).then((ok) => ok && toast(t("kitchen.slots.reopened", { time: say(s.time) }))) : pauseSlot(day, s.time).then((ok) => ok && toast(t("kitchen.slots.pausedOne", { time: say(s.time) }), "warn")))}
                    aria-label={paused ? t("kitchen.slots.reopenAria", { time: say(s.time) }) : t("kitchen.slots.pauseAria", { time: say(s.time) })}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, paddingInline: 12, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: paused ? "var(--accent-ink)" : "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", minWidth: 84, justifyContent: "center" }}
                  >
                    <Icon name={paused ? "play" : "pause"} size={13} />
                    {paused ? t("kitchen.slots.reopen") : t("kitchen.slots.pause")}
                  </button>
                ) : (
                  <span style={{ minWidth: 84 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
      {k.askStop && (
        <ConfirmDialog
          title={t("kitchen.stop.title")}
          body={t("kitchen.stop.body")}
          onClose={() => useKitchen.setState({ askStop: false })}
          buttons={[
            { id: "stop", label: t("kitchen.stop.yes"), kind: "danger", onClick: () => void stop() },
            { id: "keep", label: t("kitchen.stop.keep"), kind: "ghost", onClick: () => useKitchen.setState({ askStop: false }) },
          ]}
        />
      )}
    </div>
  );
}
