/**
 * The cart's pieces, for the drawer and the order page alike: a line with
 * its options, note and warnings; the pickup-time picker over Adminium's
 * slot answer; and the totals — Adminium's dry run, never the page's sum.
 */
import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { groupSlots } from "../lib/day.ts";
import { portionsOf, unitPrice, optionsText, type Dish } from "../lib/menu.ts";
import type { Day } from "../lib/venueTime.ts";
import {
  activeDay,
  bumpQty,
  cartCount,
  choose,
  choosePickDay,
  freshQuote,
  openSheet,
  removeLine,
  rulesOf,
  runQuote,
  setDrawer,
  slotsOn,
  tomorrowOpenFor,
  useDiner,
  validPick,
  type CartLine,
} from "../state/diner.ts";
import { goDiner, toast } from "../state/ui.ts";
import { useFmt, useVenue } from "../app/venue.ts";
import { Tile } from "./dish.tsx";
import { MAX_PER_LINE, Stepper } from "./Sheet.tsx";
import { useDay } from "./useDay.ts";

export interface LineState {
  dish: Dish | undefined;
  gone: { name: string; dish: boolean } | null;
  sold: boolean;
  /** Fewer are left than the line asks for: how many. */
  over: number | null;
  left: number | null;
  day: Day;
}

/** What the page knows about a line on the pickup day: gone from the menu, sold out, or asking for more than is left. */
export function useLineStates(): { states: Map<string, LineState>; day: Day } {
  const day = useDay();
  const cart = useDiner((s) => s.cart);
  const menu = useDiner((s) => s.data?.menu ?? null);
  const alerts = useDiner((s) => s.alerts);
  const pick = useDiner((s) => s.pick);
  const dishes = useDiner((s) => s.dishes);
  useDiner((s) => s.pickDay);
  const forDay = pick?.day ?? activeDay(day.now);
  const states = new Map<string, LineState>();
  for (const line of cart) {
    const dish = menu?.dish(line.dishId);
    const alert = alerts[line.key];
    let gone: LineState["gone"] = null;
    if (dish === undefined || !dish.online) gone = { name: dish?.name ?? "", dish: true };
    else {
      const offered = line.options.map((id) => menu?.option(id));
      const off = offered.find((o) => o !== undefined && !o.available);
      if (off !== undefined) gone = { name: off.name, dish: false };
      else if (offered.some((o) => o === undefined)) gone = { name: "", dish: false };
    }
    if (alert?.kind === "gone") gone = { name: alert.name, dish: alert.dish };
    const p = portionsOf(dishes[forDay] ?? null, line.dishId);
    const sold = gone === null && (p.soldOut || alert?.kind === "soldout");
    const left = alert?.kind === "short" ? alert.left : p.left;
    const over = !sold && gone === null && left !== null && line.qty > left ? left : null;
    states.set(line.key, { dish, gone, sold, over, left, day: forDay });
  }
  return { states, day: forDay };
}

/** A line's amount: Adminium's when the dry run has answered for this cart, else the menu's preview. */
export function useLineAmount(): (line: CartLine, index: number, dish: Dish | undefined) => number {
  const quote = useDiner(() => freshQuote());
  return (line, index, dish) => {
    const answered = quote?.children?.order_items?.[index]?.data["line_total"];
    if (answered !== undefined && answered !== null) return Number(answered);
    return dish === undefined ? 0 : unitPrice(dish, line.options) * line.qty;
  };
}

export function CartLineRow({ line, index, state, size }: { line: CartLine; index: number; state: LineState; size: "sm" | "lg" }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const today = useDay().today;
  const amount = useLineAmount()(line, index, state.dish);
  const lg = size === "lg";
  const dish = state.dish;
  const name = dish?.name ?? state.gone?.name ?? "";
  const mods = dish === undefined ? "" : optionsText(dish, line.options);
  const cap = Math.min(MAX_PER_LINE, state.left ?? MAX_PER_LINE);
  const dayWord = state.day === today ? null : fmt.weekday(state.day);
  const remove = () => {
    removeLine(line.key);
    toast(t("cart.removed"), "warn");
  };
  const fix = () => {
    if (state.gone?.dish === true || dish === undefined) {
      setDrawer(false);
      goDiner("menu", dish === undefined || dish.categoryId === null ? {} : { category: dish.categoryId });
    } else openSheet(line.dishId, line.key);
  };
  const chip = (tone: "warn" | "danger", icon: "alert-circle" | "circle-slash", text: string) => (
    <span role="alert" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: lg ? 6 : 5, padding: lg ? "5px 10px" : "4px 9px", borderRadius: lg ? 8 : 7, background: `var(--${tone}-soft)`, color: `var(--${tone})`, fontSize: lg ? 12 : 11.5, fontWeight: 700 }}>
      <Icon name={icon} size={lg ? 12 : 11} />
      {text}
    </span>
  );
  return (
    <div style={{ display: "flex", gap: lg ? 14 : 12, padding: lg ? 16 : 13, borderRadius: lg ? 17 : 15, background: lg ? "var(--surface)" : "var(--surface-2)", border: "1px solid var(--border)" }}>
      <Tile hue={dish?.hue ?? 20} icon={dish?.icon ?? "utensils"} photo={dish?.image ?? null} radius={lg ? 13 : 11} iconSize={lg ? 26 : 21} style={{ width: lg ? 64 : 48, height: lg ? 64 : 48 }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: lg ? 6 : 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: lg ? 10 : 9 }}>
          <span style={{ fontSize: lg ? 15 : 14, fontWeight: 800, letterSpacing: "-.02em" }}>{name}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: lg ? 14 : 13, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt.money(amount)}</span>
        </div>
        {mods !== "" && <span style={{ fontSize: lg ? 12.5 : 12, lineHeight: 1.45, color: "var(--fg-muted)", textWrap: "pretty" }}>{mods}</span>}
        {line.note !== "" && (
          <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, padding: lg ? "5px 10px" : "4px 9px", borderRadius: lg ? 8 : 7, background: "var(--warn-soft)", color: "var(--warn)", fontSize: lg ? 12 : 11.5, fontWeight: lg ? 600 : 700 }}>
            <Icon name="message-square" size={lg ? 12 : 11} />
            {line.note}
          </span>
        )}
        {state.sold && chip("danger", "circle-slash", dayWord === null ? t("cart.soldToday") : t("cart.soldFor", { day: dayWord }))}
        {state.over !== null &&
          chip("warn", "alert-circle", dayWord === null ? t("cart.onlyLeftToday", { count: fmt.number(state.over) }, state.over) : t("cart.onlyLeftFor", { count: fmt.number(state.over), day: dayWord }, state.over))}
        {state.gone !== null && (
          <div role="alert" style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 10, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.45 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="circle-slash" size={13} />
              {state.gone.name === "" ? t("cart.goneAny") : t("cart.gone", { name: state.gone.name })}
            </span>
            <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button className="jn-nav" onClick={fix} style={{ border: "none", background: "transparent", padding: 0, color: "inherit", fontSize: 12.5, fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
                {t("cart.pickElse")}
              </button>
              <button className="jn-nav" onClick={remove} style={{ border: "none", background: "transparent", padding: 0, color: "inherit", fontSize: 12.5, fontWeight: 800, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}>
                {t("cart.takeOff")}
              </button>
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: lg ? 10 : 9, flexWrap: "wrap", marginBlockStart: lg ? 4 : 3 }}>
          <Stepper qty={line.qty} name={name} size={lg ? "md" : "sm"} onLess={() => bumpQty(line.key, -1)} onMore={() => bumpQty(line.key, 1)} lessOff={line.qty <= 1} moreOff={line.qty >= cap} />
          {dish !== undefined && state.gone === null && (
            <button className="jn-nav" onClick={() => openSheet(line.dishId, line.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, color: "var(--accent-ink)", fontSize: lg ? 12.5 : 12, fontWeight: 800, cursor: "pointer" }}>
              {lg && <Icon name="pencil" size={13} />}
              {t("cart.edit")}
            </button>
          )}
          <button className="jn-nav" onClick={remove} style={{ marginInlineStart: lg ? undefined : "auto", display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, color: "var(--fg-subtle)", fontSize: lg ? 12.5 : 12, fontWeight: 700, cursor: "pointer" }}>
            {lg && <Icon name="trash-2" size={13} />}
            {t("cart.remove")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Today or tomorrow, then a time: Adminium's free times, the full ones shown and not pickable. */
export function PickupPicker({ compact }: { compact: boolean }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const venue = useVenue();
  const day = useDay();
  const pick = useDiner((s) => s.pick);
  const slotNotice = useDiner((s) => s.slotNotice);
  useDiner((s) => s.slots);
  useDiner((s) => s.pickDay);
  const rules = rulesOf();
  const forDay = activeDay(day.now);
  const todayAny = slotsOn(day.today, day.now).some((s) => !s.off);
  const tomorrowOk = tomorrowOpenFor(day.now) && slotsOn(day.tomorrow, day.now).some((s) => !s.off);
  const valid = validPick(day.now);
  const lapsed = slotNotice ?? (pick !== null && valid === null && pick.day === forDay ? { time: pick.time, day: pick.day } : null);
  const word = (d: Day) => (d === day.today ? t("pick.today") : d === day.tomorrow ? t("pick.tomorrow") : fmt.weekday(d));
  const phone = venue.phone === null ? null : `\u2066${venue.phone}\u2069`;
  const dayNote = todayAny
    ? null
    : !tomorrowOk
      ? phone === null
        ? t("pick.noneNoPhone")
        : t("pick.none", { phone })
      : day.stopped
        ? phone === null
          ? t("home.closed.title.paused")
          : `${t("home.closed.title.paused")} ${t("home.closed.body.pausedCall", { phone })}`
        : t("pick.tomorrowBelow");
  const groups = groupSlots(slotsOn(forDay, day.now));
  const days: { id: "today" | "tomorrow"; label: string; off: boolean; on: boolean }[] = [
    { id: "today", label: t("pick.today"), off: !todayAny, on: forDay === day.today && todayAny },
    { id: "tomorrow", label: tomorrowOk ? t("pick.tomorrow") : t("pick.closedTomorrow"), off: !tomorrowOk, on: forDay === day.tomorrow },
  ];
  const size = compact ? { h: 34, p: 11, f: 12.5 } : { h: 38, p: 14, f: 13 };
  const hint = valid === null ? t("pick.hint", { minutes: fmt.number(rules.slot) }) : t("pick.hintPicked", { minutes: fmt.number(rules.slot), prep: fmt.number(rules.prep), time: fmt.wall(valid.day, valid.time) });
  const noteId = compact ? "jn-pick-note-drawer" : "jn-pick-note";
  const open = groups.flatMap((g) => g.slots).filter((x) => !x.off);
  /** The one time Tab reaches: the chosen one, or the first free. */
  const focusTime = valid !== null && valid.day === forDay ? valid.time : (open[0]?.time ?? null);
  /** Arrow keys move between the free times and choose the one they land on, as a radio group does. */
  const moveBetweenTimes = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let by = keys[e.key];
    if (by === undefined || open.length === 0) return;
    e.preventDefault();
    if (document.documentElement.dir === "rtl" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) by = -by;
    const at = open.findIndex((x) => x.time === (e.target as HTMLElement).dataset["time"]);
    const next = open[(at + by + open.length) % open.length]!;
    choose(next.day, next.time);
    e.currentTarget.querySelector<HTMLElement>(`[data-time="${next.time}"]`)?.focus();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBlockStart: compact ? 12 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div role="group" aria-label={t("pick.day")} style={{ display: "flex", gap: 3, background: compact ? "var(--surface)" : "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
          {days.map((d) => (
            <button key={d.id} className="jn-chip jk-segbtn" onClick={() => choosePickDay(d.id)} disabled={d.off} aria-pressed={d.on} aria-describedby={d.off && dayNote !== null ? noteId : undefined}>
              {d.label}
            </button>
          ))}
        </div>
        <span className="jk-mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
          {valid === null ? t("pick.none.summary") : t("pick.summary", { day: word(valid.day), time: fmt.wall(valid.day, valid.time) })}
        </span>
      </div>
      {lapsed !== null && (
        <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: compact ? "10px 12px" : "11px 13px", borderRadius: 11, background: "var(--warn-soft)", color: "var(--warn)", fontSize: compact ? 12.5 : 13, fontWeight: 700, lineHeight: 1.5 }}>
          <Icon name="timer-off" size={14} style={{ marginBlockStart: 2 }} />
          <span>{t("pick.lapsed", { time: fmt.wall(lapsed.day, lapsed.time) })}</span>
        </div>
      )}
      {dayNote !== null && (
        <div id={noteId} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: compact ? "10px 12px" : "11px 13px", borderRadius: 11, background: "var(--info-soft)", color: "var(--info)", fontSize: compact ? 12.5 : 13, fontWeight: 700, lineHeight: 1.5 }}>
          <Icon name="sunrise" size={14} style={{ marginBlockStart: 2 }} />
          <span>{dayNote}</span>
        </div>
      )}
      <div role="radiogroup" aria-label={t("pick.times")} onKeyDown={moveBetweenTimes} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((g) => (
          <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span className="jk-kicker" aria-hidden="true">{t(`pick.group.${g.id}`)}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 7 : 8 }}>
              {g.slots.map((s) => {
                const on = valid !== null && valid.day === s.day && valid.time === s.time;
                const label = fmt.wall(s.day, s.time);
                return (
                  <button
                    key={s.time}
                    role="radio"
                    className="jn-chip jk-mono"
                    onClick={() => choose(s.day, s.time)}
                    disabled={s.off}
                    aria-checked={on}
                    tabIndex={s.time === focusTime ? 0 : -1}
                    data-time={s.time}
                    aria-label={s.off ? t("pick.fullAria", { day: word(s.day), time: label }) : `${word(s.day)} ${label}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none", height: size.h, paddingInline: size.p, borderRadius: 10, cursor: s.off ? "not-allowed" : "pointer", fontSize: size.f, fontWeight: 600, border: `1px solid ${on ? "transparent" : s.off ? "var(--border)" : "var(--border-strong)"}`, background: on ? "var(--accent)" : s.off ? "var(--surface-3)" : "var(--surface)", color: on ? "var(--accent-fg)" : s.off ? "var(--fg-subtle)" : "var(--fg-muted)", opacity: s.off ? 0.7 : 1 }}
                  >
                    {label}
                    {s.off && <span style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{t("pick.full")}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: compact ? 12 : 12.5, lineHeight: 1.55, color: "var(--fg-subtle)", textWrap: "pretty" }}>
        {hint}
        {fmt.otherZone && ` ${t("hours.zone", { zone: fmt.zoneName })}`}
      </p>
    </div>
  );
}

/** Subtotal, tax and total — Adminium's dry run for this very cart and time, "Checking prices…" meanwhile. */
export function Totals({ gap }: { gap: number }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const quote = useDiner((s) => s.quote);
  const fresh = useDiner(() => freshQuote());
  const settingsRate = useDiner((s) => s.data?.settings["tax_rate"]);
  const failed = quote?.state === "err";
  const busy = !failed && fresh === null;
  const rate = fresh?.data["tax_rate"] ?? settingsRate ?? 0;
  const rows = [
    { key: "sub", label: t("totals.subtotal"), value: fresh?.data["subtotal"] },
    { key: "tax", label: t("totals.tax", { rate: fmt.percent(rate) }), value: fresh?.data["tax"] },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-muted)" }}>{r.label}</span>
          {fresh !== null && <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 13.5, fontWeight: 600, color: "var(--fg-muted)" }}>{fmt.money(r.value)}</span>}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBlockStart: 10, borderBlockStart: "1px solid var(--border)" }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: "var(--fg)" }}>{t("totals.total")}</span>
        {fresh !== null && <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 17, fontWeight: 600 }}>{fmt.money(fresh.data["total"])}</span>}
        {busy && (
          <span role="status" style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--fg-muted)" }}>
            <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} />
            {t("totals.checking")}
          </span>
        )}
        {failed && (
          <button className="jn-nav" onClick={() => void runQuote()} style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, color: "var(--accent-ink)", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
            <Icon name="rotate-cw" size={13} />
            {t("totals.retry")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Why Checkout is off from the cart: online orders off, or more than the online limit. */
export function useCheckoutBlock(): string | null {
  const { t } = useI18n();
  const fmt = useFmt();
  const day = useDay();
  const cart = useDiner((s) => s.cart);
  const rules = rulesOf();
  if (!day.online) return t("sheet.offline");
  if (cartCount(cart) > rules.maxItems) return t("sheet.full", { max: fmt.number(rules.maxItems) });
  return null;
}

export function EmptyCart({ large }: { large: boolean }) {
  const { t } = useI18n();
  return (
    <div style={large ? { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "clamp(46px,8vw,86px) 28px", border: "1px dashed var(--border-strong)", borderRadius: 20, background: "var(--surface)" } : { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12, padding: 30 }}>
      <span style={{ width: large ? 66 : 62, height: large ? 66 : 62, borderRadius: large ? 19 : 18, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="shopping-bag" size={large ? 26 : 24} />
      </span>
      <span style={{ fontSize: large ? 19 : 17, fontWeight: 800, letterSpacing: "-.025em" }}>{t("cart.empty")}</span>
      <p style={{ margin: 0, maxWidth: large ? "34ch" : "26ch", fontSize: large ? 14 : 13.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>{large ? t("cart.emptyPage") : t("cart.emptyDrawer")}</p>
      <button
        className="jn-btn"
        onClick={() => {
          setDrawer(false);
          goDiner("menu");
        }}
        style={{ marginBlockStart: large ? 6 : 0, display: "inline-flex", alignItems: "center", gap: 8, padding: large ? "13px 22px" : "12px 20px", borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: large ? 14 : 13.5, fontWeight: 800, cursor: "pointer" }}
      >
        <Icon name="utensils" size={large ? 16 : 15} />
        {t("cart.browse")}
      </button>
    </div>
  );
}
