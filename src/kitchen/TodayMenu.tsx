/**
 * Today's menu: each dish on or off the menu, today's portions, how many are
 * ordered and left, "Sold out" and "Back on" — and each option's switch.
 * Portions and sold out hold for today; tomorrow starts fresh.
 */
import { useEffect, useState } from "react";

import { Icon } from "../components/Icon.tsx";
import { Switch } from "../components/Switch.tsx";
import { useNow } from "../data/sources.ts";
import { useI18n } from "../i18n/index.tsx";
import { asciiDigits } from "../lib/format.ts";
import type { Dish } from "../lib/menu.ts";
import { kToday, num, setDish, setOption, useKitchen } from "../state/kitchen.ts";
import { toast } from "../state/ui.ts";
import { useKFmt } from "./fmt.ts";

function Portions({ dish, value, today }: { dish: Dish; value: number | null; today: string }) {
  const { t } = useI18n();
  const [text, setText] = useState(value === null ? "" : String(value));
  useEffect(() => setText(value === null ? "" : String(value)), [value]);
  const commit = () => {
    const clean = text.trim();
    const next = clean === "" ? null : Math.max(0, Number.parseInt(clean, 10) || 0);
    if (next === value) return;
    void setDish(dish.id, next === null ? { stock_today: null, stock_on: null } : { stock_today: next, stock_on: today }).then((ok) => {
      if (!ok) toast(t("kitchen.menu.saveFailed", { name: dish.name }), "warn");
    });
  };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
      {t("kitchen.menu.portions")}
      <input
        dir="ltr"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(asciiDigits(e.target.value).replace(/[^0-9]/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        placeholder="—"
        aria-label={t("kitchen.menu.portionsAria", { name: dish.name })}
        className="jn-fld jk-mono"
        style={{ width: 64, height: 32, paddingInline: 9, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 13, fontWeight: 600 }}
      />
    </label>
  );
}

function DishRow({ dish, last }: { dish: Dish; last: boolean }) {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const today = kToday(now);
  const raw = useKitchen((s) => s.menuRows?.items.find((r) => r.id === dish.id));
  const ordered = num(useKitchen((s) => s.dishCounts[today]?.[String(dish.id)]));
  const open = useKitchen((s) => s.menuOpen[String(dish.id)] === true);
  const limit = raw !== undefined && raw["stock_on"] === today && raw["stock_today"] !== null && raw["stock_today"] !== undefined ? num(raw["stock_today"]) : null;
  const sold = limit !== null && ordered >= limit;
  const on = dish.available;
  const counts = sold
    ? ordered > 0
      ? t("kitchen.menu.orderedSold", { n: fmt.number(ordered) })
      : t("dish.soldOutToday")
    : limit !== null
      ? t("kitchen.menu.orderedLeft", { n: fmt.number(ordered), left: fmt.number(limit - ordered) })
      : t("kitchen.menu.orderedNoLimit", { n: fmt.number(ordered) });
  const toggleOpen = () => useKitchen.setState({ menuOpen: { ...useKitchen.getState().menuOpen, [String(dish.id)]: !open } });
  return (
    <div style={{ borderBlockEnd: last ? "none" : "1px solid var(--border)", background: open ? "var(--surface-2)" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "clamp(10px,1.6vw,18px)", flexWrap: "wrap", padding: "12px 16px" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {dish.groups.length > 0 && (
            <button className="jn-gi" onClick={toggleOpen} aria-expanded={open} aria-label={open ? t("kitchen.menu.hideOptions", { name: dish.name }) : t("kitchen.menu.showOptions", { name: dish.name })} style={{ width: 28, height: 28, flex: "none", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
            </button>
          )}
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.02em", color: on ? "var(--fg)" : "var(--fg-subtle)" }}>{dish.name}</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
          {t("kitchen.menu.onMenu")}
          <Switch on={on} label={t("kitchen.menu.onMenuAria", { name: dish.name })} onToggle={() => void setDish(dish.id, { available: !on }).then((ok) => toast(ok ? t(on ? "kitchen.menu.off" : "kitchen.menu.on", { name: dish.name }) : t("kitchen.menu.saveFailed", { name: dish.name }), ok && on ? "warn" : ok ? "ok" : "warn"))} />
        </span>
        <Portions dish={dish} value={limit} today={today} />
        <span className="jk-mono" style={{ minWidth: 120, fontSize: 12, fontWeight: 600, color: sold ? "var(--danger)" : "var(--fg-muted)" }}>
          {counts}
        </span>
        <button
          className="jn-gi"
          onClick={() =>
            void setDish(dish.id, sold ? { stock_today: null, stock_on: null } : { stock_today: 0, stock_on: today }).then((ok) => {
              toast(ok ? t(sold ? "kitchen.menu.backOnDone" : "kitchen.menu.soldDone", { name: dish.name }) : t("kitchen.menu.saveFailed", { name: dish.name }), ok && !sold ? "warn" : ok ? "ok" : "warn");
            })
          }
          style={{ display: "inline-flex", alignItems: "center", height: 32, paddingInline: 12, borderRadius: 9, border: `1px solid ${sold ? "var(--border-strong)" : "var(--danger-soft)"}`, background: "var(--surface)", color: sold ? "var(--fg)" : "var(--danger)", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {sold ? t("kitchen.menu.backOn") : t("kitchen.menu.soldOut")}
        </button>
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 16px 16px", paddingInlineStart: 52 }}>
          {dish.groups.map((g) => (
            <div key={g.id}>
              <span className="jk-kicker">{g.name}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 6, marginBlockStart: 8 }}>
                {g.options.map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: o.available ? "var(--fg)" : "var(--fg-subtle)" }}>{o.name}</span>
                    <Switch on={o.available} label={t("kitchen.menu.optionAria", { name: o.name })} onToggle={() => void setOption(o.id, !o.available).then((ok) => toast(ok ? t(o.available ? "kitchen.menu.off" : "kitchen.menu.on", { name: o.name }) : t("kitchen.menu.saveFailed", { name: o.name }), ok && o.available ? "warn" : ok ? "ok" : "warn"))} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TodayMenu() {
  const { t } = useI18n();
  const menu = useKitchen((s) => s.menu);
  const shared = useKitchen((s) => s.menuShared);
  if (menu === null) return null;
  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ margin: 0, fontSize: "clamp(19px,2.4vw,24px)", fontWeight: 800, letterSpacing: "-.03em" }}>{t("kitchen.menu.title")}</h2>
      <p style={{ margin: "9px 0 0", maxWidth: "60ch", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("kitchen.menu.intro")}</p>
      {/* Only when the till's menu is this one: the design always showed it. */}
      {shared && (
        <p role="note" style={{ margin: "12px 0 0", display: "flex", alignItems: "flex-start", gap: 8, maxWidth: "60ch", fontSize: 13, lineHeight: 1.55, color: "var(--fg-muted)" }}>
          <Icon name="info" size={15} />
          <span>{t("kitchen.menu.shared")}</span>
        </p>
      )}
      {menu.categories.map((c) => {
        const dishes = menu.dishes.filter((d) => d.categoryId === c.id);
        if (dishes.length === 0) return null;
        return (
          <section key={c.id} aria-label={c.name} style={{ marginBlockStart: 22 }}>
            <h3 className="jk-kicker" style={{ margin: "0 0 10px" }}>
              {c.name}
            </h3>
            <div style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)", overflow: "hidden" }}>
              {dishes.map((d, i) => (
                <DishRow key={d.id} dish={d} last={i === dishes.length - 1} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
