/**
 * A dish, opened: its photo or tile, price, description, allergens and tags,
 * each option group to choose from, a note for the kitchen, how many — and
 * "Add to order" (or "Update order" for a line already in the cart).
 */
import { useId } from "react";

import { Icon } from "../components/Icon.tsx";
import { Modal, useNarrow } from "../components/Modal.tsx";
import { useI18n } from "../i18n/index.tsx";
import { allergensOf, missingGroup, optionsAddAllergens, unitPrice, type Group } from "../lib/menu.ts";
import { activeDay, addSheetToCart, cartCount, closeSheet, rulesOf, setSheet, toggleOption, useDiner } from "../state/diner.ts";
import { toast } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";
import { DishTags, Tile, usePortions, usePriceLabel } from "./dish.tsx";
import { useDay } from "./useDay.ts";

export const MAX_PER_LINE = 20;
export const NOTE_MAX = 80;

export function DishSheet() {
  const sheet = useDiner((s) => s.sheet);
  const dish = useDiner((s) => (s.sheet === null ? undefined : s.data?.menu.dish(s.sheet.dishId)));
  if (sheet === null || dish === undefined) return null;
  return <SheetBody />;
}

function SheetBody() {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const narrow = useNarrow();
  const phone = useNarrow(560);
  const day = useDay();
  const sheet = useDiner((s) => s.sheet)!;
  const dish = useDiner((s) => s.data?.menu.dish(sheet.dishId))!;
  const cart = useDiner((s) => s.cart);
  useDiner((s) => s.pickDay);
  const nameId = useId();
  const reasonId = useId();
  const noteId = useId();
  const noteHintId = useId();
  const forDay = activeDay(day.now);
  const portions = usePortions(forDay)(dish);
  const price = usePriceLabel()(dish);
  const rules = rulesOf();
  const groups = dish.groups.map((g) => ({ ...g, options: g.options.filter((o) => o.available) })).filter((g) => g.options.length > 0);
  const inCart = cartCount(cart.filter((l) => l.key !== sheet.editKey));
  const cap = Math.max(1, Math.min(MAX_PER_LINE, portions.left ?? MAX_PER_LINE, rules.maxItems - inCart));
  const allergens = allergensOf(dish, sheet.options);
  const missing = missingGroup({ ...dish, groups }, sheet.options);
  const noDay = forDay === day.today && day.firstFreeToday === null;
  const reason = !day.online
    ? t("sheet.offline")
    : portions.soldOut
      ? forDay === day.today
        ? t("dish.soldOutToday")
        : t("dish.soldOutFor", { day: fmt.weekday(forDay) })
      : noDay
        ? day.nextOpen === null
          ? t("sheet.closed")
          : t("sheet.closedUntil", { day: fmt.dayLong(day.nextOpen) })
        : inCart >= rules.maxItems
          ? t("sheet.full", { max: fmt.number(rules.maxItems) })
          : missing !== null
            ? t("sheet.choose", { group: locale.startsWith("en") ? missing.name.toLocaleLowerCase(locale) : missing.name })
            : null;
  const total = unitPrice(dish, sheet.options) * Math.min(sheet.qty, cap);
  const add = () => {
    if (reason !== null) return;
    if (sheet.qty > cap) setSheet({ qty: cap });
    const edited = addSheetToCart();
    toast(edited === null ? t("sheet.added", { name: dish.name }) : t("sheet.updated", { name: dish.name }));
  };
  return (
    <Modal labelledBy={nameId} width={560} z={520} onClose={closeSheet} first="[data-first]">
      <div style={{ flex: "none", position: "relative" }}>
        <Tile hue={dish.hue} icon={dish.icon} photo={dish.image} radius={0} iconSize={phone ? 68 : 86} style={{ width: "100%", height: phone ? 132 : dish.image !== null ? 200 : 146, borderInline: "none", borderBlockStart: "none" }} />
        <button className="jn-gi jk-iconbtn is-sm" data-first onClick={closeSheet} aria-label={t("shell.close")} style={{ position: "absolute", insetBlockStart: 13, insetInlineEnd: 13, zIndex: 3, color: "var(--fg)" }}>
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="jn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "20px clamp(18px,3vw,26px)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 id={nameId} style={{ margin: 0, fontSize: "clamp(20px,2.6vw,26px)", fontWeight: 800, letterSpacing: "-.032em" }}>{dish.name}</h2>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>{price}</span>
        </div>
        {dish.description !== "" && <p style={{ margin: "9px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{dish.description}</p>}
        {allergens.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 7, marginBlockStart: 10, fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>
            <Icon name="info" size={13} />
            {t("sheet.contains", { list: allergens.join(", ") })}
            {optionsAddAllergens(dish) && ` ${t("sheet.optionsAdd")}`}
          </span>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBlockStart: 12 }}>
          {portions.soldOut ? (
            <span className="jk-tag" style={{ background: "var(--surface-3)", color: "var(--fg-muted)" }}>
              {forDay === day.today ? t("dish.soldOutToday") : t("dish.soldOutFor", { day: fmt.weekday(forDay) })}
            </span>
          ) : (
            <DishTags dish={dish} left={portions.left} day={forDay} today={day.today} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginBlockStart: 24 }}>
          {groups.map((g) => (
            <OptionGroup key={g.id} group={g} chosen={sheet.options} />
          ))}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <label htmlFor={noteId} style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.022em" }}>
                {t("sheet.note")}
              </label>
              <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: sheet.note.length >= NOTE_MAX ? "var(--accent-ink)" : "var(--fg-subtle)" }}>
                {t("sheet.count", { n: fmt.number(sheet.note.length), max: fmt.number(NOTE_MAX) })}
              </span>
            </div>
            <textarea
              id={noteId}
              aria-describedby={noteHintId}
              className="jn-fld"
              value={sheet.note}
              onChange={(e) => setSheet({ note: e.target.value.slice(0, NOTE_MAX) })}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder={t("sheet.notePlaceholder")}
              style={{ width: "100%", marginBlockStart: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 14, lineHeight: 1.5, resize: "none" }}
            />
            <span id={noteHintId} style={{ display: "flex", alignItems: "center", gap: 6, marginBlockStart: 8, fontSize: 12.5, color: "var(--fg-subtle)" }}>
              <Icon name="shield-alert" size={13} />
              {t("sheet.noteHint")}
            </span>
          </div>
        </div>
      </div>

      <div style={{ flex: "none", padding: "16px clamp(18px,3vw,26px) 20px", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
        {reason !== null && (
          <span id={reasonId} style={{ display: "flex", alignItems: "center", gap: 7, marginBlockEnd: 12, fontSize: 13, fontWeight: 700, color: "var(--warn)" }}>
            <Icon name="alert-circle" size={14} />
            {reason}
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Stepper
            qty={Math.min(sheet.qty, cap)}
            name={dish.name}
            size="lg"
            onLess={() => setSheet({ qty: Math.max(1, sheet.qty - 1) })}
            onMore={() => setSheet({ qty: Math.min(cap, sheet.qty + 1) })}
            lessOff={sheet.qty <= 1}
            moreOff={sheet.qty >= cap}
          />
          <button
            className="jn-btn"
            onClick={add}
            disabled={reason !== null}
            aria-describedby={reason !== null ? reasonId : undefined}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, paddingInline: 22, height: 46, borderRadius: 12, border: "none", background: reason !== null ? "var(--surface-3)" : "var(--accent)", color: reason !== null ? "var(--fg-subtle)" : "var(--accent-fg)", fontSize: 14.5, fontWeight: 800, cursor: reason !== null ? "not-allowed" : "pointer", flex: narrow ? 1 : undefined }}
          >
            <span>{sheet.editKey === null ? t("sheet.add") : t("sheet.update")}</span>
            <span className="jk-mono" style={{ fontSize: 14, fontWeight: 600 }}>{fmt.money(total)}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OptionGroup({ group, chosen }: { group: Group; chosen: readonly number[] }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const headId = useId();
  const picked = group.options.filter((o) => chosen.includes(o.id));
  const capped = !group.one && picked.length >= group.max;
  const hint = group.one ? t("sheet.pickOne") : group.max > 0 ? t("sheet.nOf", { n: fmt.number(picked.length), max: fmt.number(group.max) }) : t("sheet.optional");
  return (
    <div role={group.one ? "radiogroup" : "group"} aria-labelledby={headId}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <span id={headId} style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.022em" }}>
          {group.name}
        </span>
        {group.min >= 1 && <span style={{ padding: "3px 9px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{t("sheet.required")}</span>}
        <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: capped ? "var(--accent-ink)" : "var(--fg-subtle)" }}>{hint}</span>
      </div>
      <div style={{ display: "grid", gap: 8, marginBlockStart: 12 }}>
        {group.options.map((o) => {
          const on = chosen.includes(o.id);
          const off = !on && capped;
          return (
            <button
              key={o.id}
              className="jn-opt"
              onClick={() => toggleOption(group.id, o.id)}
              disabled={off}
              {...(group.one ? { role: "radio", "aria-checked": on } : { "aria-pressed": on })}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 13, border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, background: on ? "var(--accent-soft)" : "var(--surface)", color: "var(--fg)", cursor: off ? "not-allowed" : "pointer", textAlign: "start" }}
            >
              <span aria-hidden="true" style={{ flex: "none", width: 22, height: 22, borderRadius: group.one ? 999 : 7, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--accent)" : "var(--surface-2)", border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, color: "var(--accent-fg)" }}>
                <Icon name="check" size={13} style={{ opacity: on ? 1 : 0 }} />
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: "start", fontSize: 14, fontWeight: 600 }}>
                {o.name}
                {o.allergens !== null && o.allergens !== "" && (
                  <>
                    <span aria-hidden="true" style={{ marginInline: 6, fontSize: 12, fontWeight: 500, color: "var(--fg-subtle)" }}>·</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-subtle)" }}>{o.allergens}</span>
                  </>
                )}
              </span>
              <span className="jk-mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>{o.delta > 0 ? t("sheet.delta", { price: fmt.money(o.delta) }) : t("sheet.included")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Fewer / how many / More, each naming the dish. */
export function Stepper({ qty, name, size, onLess, onMore, lessOff, moreOff }: { qty: number; name: string; size: "sm" | "md" | "lg"; onLess: () => void; onMore: () => void; lessOff?: boolean; moreOff?: boolean }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const d = size === "lg" ? { w: 42, h: 44, i: 16, n: 38, f: 15, r: 12 } : size === "md" ? { w: 34, h: 34, i: 14, n: 34, f: 13.5, r: 10 } : { w: 30, h: 30, i: 13, n: 28, f: 13, r: 9 };
  const btn = { width: d.w, height: d.h, border: "none", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" } as const;
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-strong)", borderRadius: d.r, overflow: "hidden", background: "var(--surface)" }}>
      <button className="jn-gi" onClick={onLess} disabled={lessOff} aria-label={t("stepper.less", { name })} style={{ ...btn, opacity: lessOff ? 0.45 : 1 }}>
        <Icon name="minus" size={d.i} />
      </button>
      <span className="jk-mono" aria-live="polite" style={{ minWidth: d.n, textAlign: "center", fontSize: d.f, fontWeight: 600 }}>
        {fmt.number(qty)}
      </span>
      <button className="jn-gi" onClick={onMore} disabled={moreOff} aria-label={t("stepper.more", { name })} style={{ ...btn, opacity: moreOff ? 0.45 : 1 }}>
        <Icon name="plus" size={d.i} />
      </button>
    </div>
  );
}
