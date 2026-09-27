/**
 * A new phone order: the menu (the whole menu the kitchen sells, with today's
 * portions), the dishes the caller wants with their options, a pickup time —
 * any slot, a paused one too, from the next quarter-hour — who is calling,
 * and Adminium's figures before it goes on the board.
 */
import { useId, useState } from "react";

import { ConfirmDialog } from "../components/Confirm.tsx";
import { Icon } from "../components/Icon.tsx";
import { Modal, useNarrow } from "../components/Modal.tsx";
import { useNow } from "../data/sources.ts";
import type { Id } from "../data/wire.ts";
import { useI18n } from "../i18n/index.tsx";
import { asciiDigits } from "../lib/format.ts";
import { groupSlots } from "../lib/day.ts";
import { fromPrice, missingGroup, optionsText, unitPrice, type Dish, type Group } from "../lib/menu.ts";
import { minutesOf, venueMinutes } from "../lib/venueTime.ts";
import { EMAIL } from "../state/account.ts";
import { addPhoneLine, freshPhoneQuote, kToday, num, phoneDay, placePhone, setPhone, useKitchen, type PhoneDraft } from "../state/kitchen.ts";
import { toast } from "../state/ui.ts";
import { useKFmt } from "./fmt.ts";

/** A dish's portions on a day, from its limit and what is ordered. */
function useLeft(): (dish: Dish, day: string) => { sold: boolean; left: number | null } {
  const rows = useKitchen((s) => s.menuRows);
  const counts = useKitchen((s) => s.dishCounts);
  return (dish, day) => {
    const raw = rows?.items.find((r) => r.id === dish.id);
    if (raw === undefined || raw["stock_on"] !== day || raw["stock_today"] === null || raw["stock_today"] === undefined) return { sold: false, left: null };
    const left = num(raw["stock_today"]) - num(counts[day]?.[String(dish.id)]);
    return { sold: left <= 0, left: Math.max(0, left) };
  };
}

function Options({ dish, chosen, onToggle }: { dish: Dish; chosen: readonly Id[]; onToggle: (g: Group, optionId: Id) => void }) {
  const { t } = useI18n();
  const fmt = useKFmt();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {dish.groups.map((g) => {
        const options = g.options.filter((o) => o.available);
        const picked = options.filter((o) => chosen.includes(o.id));
        const capped = !g.one && picked.length >= g.max;
        return (
          <div key={g.id} role={g.one ? "radiogroup" : "group"} aria-label={g.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.022em" }}>{g.name}</span>
              {g.min >= 1 && <span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{t("sheet.required")}</span>}
              <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: capped ? "var(--accent-ink)" : "var(--fg-subtle)" }}>
                {g.one ? t("sheet.pickOne") : g.max > 0 ? t("sheet.nOf", { n: fmt.number(picked.length), max: fmt.number(g.max) }) : t("sheet.optional")}
              </span>
            </div>
            <div style={{ display: "grid", gap: 7, marginBlockStart: 10 }}>
              {options.map((o) => {
                const on = chosen.includes(o.id);
                const off = !on && capped;
                return (
                  <button key={o.id} className="jn-opt" onClick={() => onToggle(g, o.id)} disabled={off} {...(g.one ? { role: "radio", "aria-checked": on } : { "aria-pressed": on })} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", borderRadius: 12, border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, background: on ? "var(--accent-soft)" : "var(--surface)", color: "var(--fg)", cursor: off ? "not-allowed" : "pointer", textAlign: "start" }}>
                    <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: g.one ? 999 : 7, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--accent)" : "var(--surface-2)", border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, color: "var(--accent-fg)" }}>
                      <Icon name="check" size={13} style={{ opacity: on ? 1 : 0 }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: "start", fontSize: 13.5, fontWeight: 600 }}>{o.name}</span>
                    <span className="jk-mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                      {o.delta > 0 ? t("sheet.delta", { price: fmt.money(o.delta) }) : t("sheet.included")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toggled(chosen: readonly Id[], g: Group, optionId: Id): Id[] {
  const inGroup = chosen.filter((id) => g.options.some((o) => o.id === id));
  const others = chosen.filter((id) => !inGroup.includes(id));
  if (g.one) return [...others, ...(inGroup.includes(optionId) && g.min < 1 ? [] : [optionId])];
  if (inGroup.includes(optionId)) return [...others, ...inGroup.filter((id) => id !== optionId)];
  if (inGroup.length >= g.max) return [...chosen];
  return [...others, ...inGroup, optionId];
}

function Menu({ p }: { p: PhoneDraft }) {
  const { t } = useI18n();
  const fmt = useKFmt();
  const menu = useKitchen((s) => s.menu);
  const left = useLeft();
  const day = phoneDay(p);
  const today = kToday();
  if (menu === null) return null;
  if (p.sheet !== null) {
    const sheet = p.sheet;
    const dish = menu.dish(sheet.dishId)!;
    const groups = { ...dish, groups: dish.groups.map((g) => ({ ...g, options: g.options.filter((o) => o.available) })) };
    const missing = missingGroup(groups, sheet.options);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button className="jn-nav" onClick={() => setPhone({ sheet: null })} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: 0, color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Icon name="arrow-left" size={14} className="jk-flip" />
          {t("kitchen.phoneOrder.back")}
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.025em" }}>{dish.name}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 14, fontWeight: 600 }}>
            {fmt.money(unitPrice(dish, sheet.options) * sheet.qty)}
          </span>
        </div>
        <Options dish={dish} chosen={sheet.options} onToggle={(g, id) => setPhone({ sheet: { ...sheet, options: toggled(sheet.options, g, id) } })} />
        {missing !== null && (
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--warn)" }}>
            <Icon name="alert-circle" size={13} />
            {t("sheet.choose", { group: missing.name.toLocaleLowerCase() })}
          </span>
        )}
        <button className="jn-btn jk-btn-sm is-primary" disabled={missing !== null} onClick={() => addPhoneLine(dish.id, sheet.options, sheet.qty)} style={{ alignSelf: "flex-start", height: 44, paddingInline: 18, borderRadius: 12, fontSize: 14 }}>
          <Icon name="plus" size={15} />
          {t("kitchen.phoneOrder.add")}
        </button>
      </div>
    );
  }
  const dishes = menu.dishes.filter((d) => d.available && (p.category === "all" || d.categoryId === p.category));
  return (
    <div>
      <div role="group" aria-label={t("menu.categories")} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBlockEnd: 12 }}>
        <button className="jn-chip jk-chip" aria-pressed={p.category === "all"} onClick={() => setPhone({ category: "all" })} style={{ height: 32 }}>
          {t("menu.everything")}
        </button>
        {menu.categories.map((c) => (
          <button key={c.id} className="jn-chip jk-chip" aria-pressed={p.category === c.id} onClick={() => setPhone({ category: c.id })} style={{ height: 32 }}>
            {c.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dishes.map((dish) => {
          const portions = left(dish, day);
          const price = fromPrice(dish);
          const priceText = price.from ? t("dish.from", { price: fmt.money(price.value) }) : fmt.money(price.value);
          const hasOptions = dish.groups.length > 0;
          return (
            <button
              key={dish.id}
              className="jn-opt"
              disabled={portions.sold}
              aria-label={portions.sold ? t("dish.ariaSoldOut", { name: dish.name }) : t("dish.aria", { name: dish.name, price: priceText })}
              onClick={() => (hasOptions ? setPhone({ sheet: { dishId: dish.id, options: [], qty: 1 } }) : addPhoneLine(dish.id, [], 1))}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 13px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", cursor: "pointer", textAlign: "start" }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700 }}>{dish.name}</span>
              {!portions.sold && portions.left !== null && portions.left < 5 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 11, fontWeight: 800 }}>
                  <Icon name="clock" size={10} />
                  {day === today ? t("dish.leftToday", { count: fmt.number(portions.left) }, portions.left) : t("dish.leftFor", { count: fmt.number(portions.left), day: fmt.weekday(day) }, portions.left)}
                </span>
              )}
              {portions.sold && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>{day === today ? t("dish.soldOutToday") : t("dish.soldOutFor", { day: fmt.weekday(day) })}</span>}
              {hasOptions && <Icon name="sliders-horizontal" size={14} style={{ color: "var(--fg-subtle)" }} />}
              <span className="jk-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                {priceText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function block(t: ReturnType<typeof useI18n>["t"], p: PhoneDraft): string | null {
  if (p.lines.length === 0) return t("kitchen.phoneOrder.needDish");
  if (p.time === null) return t("co.block.time");
  if (p.name.trim().length < 2) return t("kitchen.phoneOrder.needName");
  if (p.phone.replace(/[^0-9]/g, "").length < 6) return t("kitchen.phoneOrder.needPhone");
  if (p.email.trim() !== "" && !EMAIL.test(p.email.trim())) return t("kitchen.phoneOrder.badEmail");
  if (p.quote?.state === "err") return t("co.block.prices");
  if (freshPhoneQuote(p) === null) return t("totals.checking");
  return null;
}

export function PhoneOrder() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const narrow = useNarrow();
  const p = useKitchen((s) => s.phone);
  const menu = useKitchen((s) => s.menu);
  const slots = useKitchen((s) => s.slots);
  const zone = useKitchen((s) => s.zone);
  const [askClose, setAskClose] = useState(false);
  const titleId = useId();
  if (p === null) return null;
  const day = phoneDay(p);
  const today = kToday(now);
  const firstMinute = day === today ? Math.ceil(venueMinutes(now, zone) / 15) * 15 : 0;
  const times = (slots[day] ?? []).filter((s) => minutesOf(s.time) >= firstMinute);
  const quote = freshPhoneQuote(p);
  const reason = block(t, p);
  const close = () => (p.lines.length > 0 ? setAskClose(true) : useKitchen.setState({ phone: null }));
  const place = async () => {
    if (reason !== null || p.placing) return;
    const result = await placePhone();
    if ("number" in result) toast(t("kitchen.phoneOrder.done", { number: result.number }));
  };
  const field = { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 14, fontWeight: 600 } as const;
  const error = p.error === "slot" ? t("kitchen.phoneOrder.errSlot") : p.error === "soldout" ? t("kitchen.phoneOrder.errSold") : p.error !== null ? t("kitchen.phoneOrder.errFailed") : null;
  return (
    <Modal labelledBy={titleId} width={1100} z={540} tall onClose={close}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "16px 20px", borderBlockEnd: "1px solid var(--border)" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="phone-incoming" size={16} />
        </span>
        <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.028em" }}>
          {t("kitchen.phoneOrder.title")}
        </h2>
        <button className="jn-gi jk-iconbtn is-sm" onClick={close} aria-label={t("shell.close")} style={{ marginInlineStart: "auto" }}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1.1fr) minmax(0,1fr)", overflow: narrow ? "auto" : "hidden" }}>
        <div className="jn-scroll" style={{ minHeight: 0, overflowY: "auto", padding: "16px 20px", borderInlineEnd: "1px solid var(--border)" }}>
          <Menu p={p} />
        </div>
        <div className="jn-scroll" style={{ minHeight: 0, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <span className="jk-kicker">{t("kitchen.phoneOrder.order")}</span>
            {p.lines.length === 0 && <div style={{ marginBlockStart: 10, padding: 20, border: "1px dashed var(--border-strong)", borderRadius: 12, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("kitchen.phoneOrder.empty")}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 10 }}>
              {p.lines.map((line, i) => {
                const dish = menu?.dish(line.dishId);
                const mods = dish === undefined ? "" : optionsText(dish, line.options);
                const answered = quote?.children?.order_items?.[i]?.data["line_total"];
                const amount = answered !== undefined && answered !== null ? Number(answered) : dish === undefined ? 0 : unitPrice(dish, line.options) * line.qty;
                const bump = (by: number) => setPhone({ lines: p.lines.map((l) => (l.key === line.key ? { ...l, qty: Math.min(20, l.qty + by) } : l)).filter((l) => l.qty > 0) });
                return (
                  <div key={line.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{dish?.name ?? ""}</span>
                      {mods !== "" && <span style={{ display: "block", marginBlockStart: 2, fontSize: 12, color: "var(--fg-muted)" }}>{mods}</span>}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-strong)", borderRadius: 9, overflow: "hidden", background: "var(--surface)" }}>
                      <button className="jn-gi" onClick={() => bump(-1)} aria-label={t("stepper.less", { name: dish?.name ?? "" })} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="minus" size={12} />
                      </button>
                      <span className="jk-mono" aria-live="polite" style={{ minWidth: 24, textAlign: "center", fontSize: 12.5, fontWeight: 600 }}>
                        {fmt.number(line.qty)}
                      </span>
                      <button className="jn-gi" onClick={() => bump(1)} disabled={line.qty >= 20} aria-label={t("stepper.more", { name: dish?.name ?? "" })} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="plus" size={12} />
                      </button>
                    </div>
                    <span className="jk-mono" style={{ minWidth: 58, textAlign: "end", fontSize: 13, fontWeight: 600 }}>
                      {fmt.money(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <span className="jk-kicker">{t("confirm.pickup")}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBlockStart: 10 }}>
              <div role="group" aria-label={t("pick.day")} className="jk-seg" style={{ alignSelf: "flex-start" }}>
                {(["today", "tomorrow"] as const).map((d) => (
                  <button key={d} className="jn-chip jk-segbtn" aria-pressed={p.day === d} onClick={() => setPhone({ day: d, time: null })}>
                    {t(d === "today" ? "pick.today" : "pick.tomorrow")}
                  </button>
                ))}
              </div>
              {times.length === 0 && <span style={{ fontSize: 13, color: "var(--fg-subtle)" }}>{t("kitchen.phoneOrder.noTimes")}</span>}
              {groupSlots(times).map((g) => (
                <div key={g.id} role="group" aria-label={t(`pick.group.${g.id}`)} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="jk-kicker">{t(`pick.group.${g.id}`)}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.slots.map((s) => {
                      const full = s.taken >= s.size;
                      const on = p.time === s.time && !full;
                      const label = fmt.wall(day, s.time);
                      return (
                        <button key={s.time} className="jn-chip jk-mono" onClick={() => setPhone({ time: s.time })} disabled={full} aria-pressed={on} aria-label={full ? t("pick.fullAria", { day: "", time: label }).trim() : s.pause !== null ? t("kitchen.phoneOrder.pausedAria", { time: label }) : label} style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none", height: 34, paddingInline: 11, borderRadius: 10, cursor: full ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? "transparent" : full ? "var(--border)" : "var(--border-strong)"}`, background: on ? "var(--accent)" : full ? "var(--surface-3)" : "var(--surface)", color: on ? "var(--accent-fg)" : full ? "var(--fg-subtle)" : "var(--fg-muted)", opacity: full ? 0.7 : 1 }}>
                          {label}
                          {(full || s.pause !== null) && <span style={{ fontFamily: "var(--sans)", fontSize: 10, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{full ? t("pick.full") : t("kitchen.slots.paused")}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="jk-kicker">{t("kitchen.phoneOrder.caller")}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBlockStart: 10 }}>
              <div>
                <label htmlFor="jn-po-name" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                  {t("co.name")}
                </label>
                <input id="jn-po-name" className="jn-fld" maxLength={80} value={p.name} onChange={(e) => setPhone({ name: e.target.value })} style={field} />
              </div>
              <div>
                <label htmlFor="jn-po-phone" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                  {t("large.phone")}
                </label>
                <input id="jn-po-phone" dir="ltr" type="tel" className="jn-fld" maxLength={32} value={p.phone} onChange={(e) => setPhone({ phone: asciiDigits(e.target.value) })} placeholder={t("co.phone.placeholder")} style={field} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="jn-po-email" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                  {t("co.email")} <span style={{ fontWeight: 600, color: "var(--fg-subtle)" }}>{t("kitchen.phoneOrder.emailOptional")}</span>
                </label>
                <input id="jn-po-email" dir="ltr" type="email" className="jn-fld" maxLength={254} value={p.email} onChange={(e) => setPhone({ email: e.target.value })} style={field} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label htmlFor="jn-po-note" style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                  {t("kitchen.phoneOrder.note")}
                </label>
                <input id="jn-po-note" className="jn-fld" value={p.note} maxLength={140} onChange={(e) => setPhone({ note: e.target.value })} style={field} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "14px 20px", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
        {quote !== null ? (
          [
            { key: "sub", label: t("totals.subtotal"), value: quote.data["subtotal"], size: 13 },
            { key: "tax", label: t("totals.tax", { rate: fmt.percent(quote.data["tax_rate"]) }), value: quote.data["tax"], size: 13 },
            { key: "total", label: t("totals.total"), value: quote.data["total"], size: 15 },
          ].map((r) => (
            <span key={r.key} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>
              {r.label}
              <span className="jk-mono" style={{ fontSize: r.size, fontWeight: 600, color: "var(--fg)" }}>
                {fmt.money(r.value)}
              </span>
            </span>
          ))
        ) : p.quote?.state === "busy" ? (
          <span role="status" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "var(--fg-muted)" }}>
            <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} />
            {t("totals.checking")}
          </span>
        ) : null}
        {(error ?? reason) !== null && (
          <span role={error !== null ? "alert" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: error !== null ? "var(--danger)" : "var(--fg-subtle)" }}>
            <Icon name="info" size={13} />
            {error ?? reason}
          </span>
        )}
        <button className="jn-btn" onClick={() => void place()} disabled={reason !== null || p.placing} style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 9, height: 48, paddingInline: 20, borderRadius: 12, border: "none", background: reason !== null ? "var(--surface-3)" : "var(--accent)", color: reason !== null ? "var(--fg-subtle)" : "var(--accent-fg)", fontSize: 14.5, fontWeight: 800, cursor: reason !== null ? "not-allowed" : "pointer" }}>
          <Icon name="layout-list" size={16} />
          {quote === null ? t("kitchen.phoneOrder.placeNoTotal") : t("kitchen.phoneOrder.place", { total: fmt.money(quote.data["total"]) })}
        </button>
      </div>
      {askClose && (
        <ConfirmDialog
          title={t("kitchen.phoneOrder.discardTitle")}
          body={t("kitchen.phoneOrder.discardBody")}
          onClose={() => setAskClose(false)}
          buttons={[
            {
              id: "discard",
              label: t("kitchen.phoneOrder.discard"),
              kind: "danger",
              onClick: () => {
                setAskClose(false);
                useKitchen.setState({ phone: null });
              },
            },
            { id: "keep", label: t("kitchen.phoneOrder.keep"), kind: "ghost", onClick: () => setAskClose(false) },
          ]}
        />
      )}
    </Modal>
  );
}
