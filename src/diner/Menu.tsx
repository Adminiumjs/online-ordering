/**
 * The menu: every dish the kitchen offers online, by section, with its
 * price, tags and — for the day the diner is ordering for — "2 left" or
 * "Sold out". Before the kitchen opens for the day, or once today's pickups
 * are gone, the menu is for tomorrow and says so.
 */
import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { Rich } from "../i18n/rich.tsx";
import { hoursOn } from "../lib/day.ts";
import type { Dish } from "../lib/menu.ts";
import type { Day } from "../lib/venueTime.ts";
import { activeDay, loadDiner, openSheet, useDiner } from "../state/diner.ts";
import { useUi } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";
import { BuildFlag } from "./Home.tsx";
import { DishTags, SoldOutVeil, Tile, needsBuilding, usePortions, usePriceLabel } from "./dish.tsx";
import { useDay } from "./useDay.ts";

export function MenuPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const day = useDay();
  const load = useDiner((s) => s.load);
  const data = useDiner((s) => s.data);
  useDiner((s) => s.pickDay);
  const category = useUi((s) => s.category);
  const forDay = activeDay(day.now);
  const preorder = forDay !== day.today;
  const forHours = data === null ? null : hoursOn(forDay, data.hours, data.closures);
  const menu = data?.menu ?? null;
  const categories = menu?.categories ?? [];
  const list = (menu?.dishes ?? []).filter((d) => d.online && (category === "all" || d.categoryId === category));
  const chosen = categories.find((c) => c.id === category);
  return (
    <div className="jn-view jk-shell">
      <div style={{ paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("menu.title")}</h1>
        <p style={{ margin: "10px 0 0", maxWidth: "52ch", fontSize: 15, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("menu.intro")}</p>
        {preorder && forHours !== null && forHours.open && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBlockStart: 18, padding: "14px 16px", borderRadius: 14, background: "var(--accent-soft)", border: "1px solid var(--border)" }}>
            <Icon name="sunrise" size={16} style={{ color: "var(--accent-ink)", marginBlockStart: 1 }} />
            <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg-muted)" }}>
              <Rich
                text={t("menu.preorder")}
                parts={{
                  day: <strong style={{ color: "var(--fg)" }}>{fmt.dayLong(forDay)}</strong>,
                  time: <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{fmt.wall(forDay, forHours.opens)}</span>,
                }}
              />
            </span>
          </div>
        )}
        <div role="group" aria-label={t("menu.categories")} className="jn-row" style={{ display: "flex", gap: 8, marginBlock: 22, overflowX: "auto", paddingBlockEnd: 2 }}>
          <button className="jn-chip jk-chip" aria-pressed={category === "all"} onClick={() => useUi.setState({ category: "all" })}>
            {t("menu.everything")}
          </button>
          {categories.map((c) => (
            <button key={c.id} className="jn-chip jk-chip" aria-pressed={category === c.id} onClick={() => useUi.setState({ category: c.id })}>
              {c.name}
            </button>
          ))}
        </div>
        {load === "ok" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 18 }}>
              {list.map((dish) => (
                <MenuCard key={dish.id} dish={dish} day={forDay} today={day.today} />
              ))}
            </div>
            {list.length === 0 && (
              <div style={{ padding: "clamp(40px,7vw,70px) 24px", border: "1px dashed var(--border-strong)", borderRadius: 20, background: "var(--surface)", textAlign: "center", fontSize: 14.5, fontWeight: 700, color: "var(--fg-muted)" }}>
                {chosen === undefined ? t("menu.empty") : t("menu.emptyIn", { name: chosen.name })}
              </div>
            )}
          </>
        )}
        {load === "busy" && (
          <div role="status" aria-busy="true" aria-label={t("home.loading")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 18 }}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} style={{ border: "1px solid var(--border)", borderRadius: 18, background: "var(--surface)", overflow: "hidden" }}>
                <div className="jn-skel" style={{ aspectRatio: "16/10" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "18px 20px 22px" }}>
                  <div className="jn-skel" style={{ height: 15, width: "62%", borderRadius: 6 }} />
                  <div className="jn-skel" style={{ height: 11, width: "92%", borderRadius: 6 }} />
                  <div className="jn-skel" style={{ height: 11, width: "44%", borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {load === "err" && (
          <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "clamp(46px,8vw,86px) 28px", border: "1px dashed var(--border-strong)", borderRadius: 20, background: "var(--surface)" }}>
            <span style={{ width: 62, height: 62, borderRadius: 18, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="wifi-off" size={24} />
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.025em" }}>{t("home.loadError")}</span>
            <button className="jn-gi jk-btn-ghost" onClick={() => void loadDiner()} style={{ padding: "14px 21px", fontSize: 14.5 }}>
              <Icon name="rotate-cw" size={16} />
              {t("shell.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuCard({ dish, day, today }: { dish: Dish; day: Day; today: Day }) {
  const { t } = useI18n();
  const portions = usePortions(day)(dish);
  const price = usePriceLabel()(dish);
  const sold = portions.soldOut;
  return (
    <button
      className="jn-card"
      onClick={() => openSheet(dish.id)}
      disabled={sold}
      aria-label={sold ? t("dish.ariaSoldOut", { name: dish.name }) : t("dish.aria", { name: dish.name, price })}
      style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden", textAlign: "start", cursor: sold ? "not-allowed" : "pointer", color: "var(--fg)", opacity: sold ? 0.72 : 1 }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        <Tile hue={dish.hue} icon={dish.icon} photo={dish.image} radius={0} ratio="16/10" iconSize={68} style={{ width: "100%", borderInline: "none", borderBlockStart: "none", borderStartStartRadius: 17, borderStartEndRadius: 17 }} />
        {sold && <SoldOutVeil day={day} today={today} />}
        {!sold && needsBuilding(dish) && <BuildFlag />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "17px 19px 19px", flex: 1, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-.025em" }}>{dish.name}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{price}</span>
        </div>
        <p className="jk-own" style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{dish.description}</p>
        <DishTags dish={dish} left={sold ? null : portions.left} day={day} today={today} />
      </div>
    </button>
  );
}
