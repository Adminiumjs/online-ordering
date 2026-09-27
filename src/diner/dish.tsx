/**
 * What a dish looks like wherever it shows: its tile (the photo, or a
 * coloured tile with its icon), its price for display ("from $15.50"), its
 * tags and "2 left today", and whether it can be ordered on the day the diner
 * is ordering for — Adminium's answer for that day's portions.
 */
import type { CSSProperties } from "react";

import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { fromPrice, portionsOf, type Dish } from "../lib/menu.ts";
import type { Day } from "../lib/venueTime.ts";
import { useDiner } from "../state/diner.ts";
import { useUi } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";

/** The coloured tile the design draws where there is no photo. */
export function tileStyle(hue: number, dark: boolean, radius: number, ratio?: string): CSSProperties {
  const h2 = (hue + 34) % 360;
  const h3 = (hue + 344) % 360;
  const background = dark
    ? `radial-gradient(120% 130% at 16% 8%, hsl(${hue} 62% 34% / .95) 0%, transparent 58%), radial-gradient(110% 120% at 88% 94%, hsl(${h2} 58% 26% / .9) 0%, transparent 62%), linear-gradient(158deg, hsl(${h3} 30% 19%), hsl(${hue} 26% 13%))`
    : `radial-gradient(120% 130% at 16% 8%, hsl(${hue} 78% 84% / .95) 0%, transparent 58%), radial-gradient(110% 120% at 88% 94%, hsl(${h2} 72% 70% / .85) 0%, transparent 62%), linear-gradient(158deg, hsl(${h3} 54% 92%), hsl(${hue} 46% 78%))`;
  return { borderRadius: radius, background, border: `1px solid ${dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.045)"}`, ...(ratio === undefined ? {} : { aspectRatio: ratio }) };
}

export const tileIconColor = (hue: number, dark: boolean): string => (dark ? `hsl(${hue} 72% 84% / .30)` : `hsl(${hue} 62% 26% / .26)`);

/** A photo over its tile, or the tile and the icon. Decorative: the words beside it name the dish. */
export function Tile({ hue, icon, photo, radius, ratio, iconSize, style }: { hue: number; icon: Dish["icon"] | null; photo: string | null; radius: number; ratio?: string; iconSize: number; style?: CSSProperties }) {
  const dark = useUi((s) => s.theme) === "dark";
  return (
    <div className="jk-tile" style={{ ...tileStyle(hue, dark, radius, ratio), ...style }}>
      {photo !== null ? <img src={photo} alt="" loading="lazy" /> : icon !== null && <span aria-hidden="true" style={{ display: "inline-flex", color: tileIconColor(hue, dark) }}><Icon name={icon} size={iconSize} stroke={1.25} /></span>}
    </div>
  );
}

/** "$12.50", or "from $15.50" when options add to it. */
export function usePriceLabel(): (dish: Dish) => string {
  const { t } = useI18n();
  const fmt = useFmt();
  return (dish) => {
    const price = fromPrice(dish);
    return price.from ? t("dish.from", { price: fmt.money(price.value) }) : fmt.money(price.value);
  };
}

/** Whether a dish needs building: it has an option group the diner must choose from. */
export const needsBuilding = (dish: Dish): boolean => dish.groups.some((g) => g.min >= 1);

/** A dish's portions on a day: sold out, or how many are left when few are. */
export function usePortions(day: Day): (dish: Dish) => { soldOut: boolean; left: number | null } {
  const states = useDiner((s) => s.dishes[day]) ?? null;
  return (dish) => {
    const p = portionsOf(states, dish.id);
    return { soldOut: p.soldOut || !dish.available, left: p.left };
  };
}

const TAG_TONES: Record<string, [string, string]> = { V: ["var(--pos-soft)", "var(--pos)"], Spicy: ["var(--danger-soft)", "var(--danger)"] };

export function DishTags({ dish, left, day, today }: { dish: Dish; left: number | null; day: Day; today: Day }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const tags = dish.tags.filter((tag) => tag === "V" || tag === "Spicy");
  const low = left !== null && left > 0 && left < 5;
  if (tags.length === 0 && !low) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBlockStart: "auto", paddingBlockStart: 6, flexWrap: "wrap" }}>
      {tags.map((tag) => {
        const [bg, fg] = TAG_TONES[tag] ?? ["var(--surface-3)", "var(--fg-muted)"];
        return (
          <span key={tag} className="jk-tag" title={t(tag === "V" ? "tags.V.tip" : "tags.Spicy.tip")} style={{ background: bg, color: fg }}>
            {t(tag === "V" ? "tags.V" : "tags.Spicy")}
          </span>
        );
      })}
      {low && (
        <span className="jk-tag" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
          <Icon name="clock" size={11} />
          {day === today ? t("dish.leftToday", {}, left) : t("dish.leftFor", { day: fmt.weekday(day) }, left)}
        </span>
      )}
    </div>
  );
}

export function SoldOutVeil({ day, today }: { day: Day; today: Day }) {
  const { t } = useI18n();
  const fmt = useFmt();
  return (
    <span style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--scrim-soft)", backdropFilter: "saturate(.25) blur(1px)" }}>
      <span style={{ padding: "7px 14px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-strong)", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
        {day === today ? t("dish.soldOutToday") : t("dish.soldOutFor", { day: fmt.weekday(day) })}
      </span>
    </span>
  );
}
