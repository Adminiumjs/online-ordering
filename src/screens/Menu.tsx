/**
 * MENU — the card grid, filtered by a row of category chips.
 *
 * "Everything" groups by category with a heading per group rather than
 * dumping eighteen cards in one run, because a menu is read by section: a
 * reader looking for a drink should not have to scroll past four pizzas to
 * find out there are three.
 */

import { useEffect } from "react";

import { useI18n } from "../i18n/index.tsx";
import { label } from "../lib/format.ts";
import { useStore } from "../state/store.ts";
import { Chip, Glyph, SectionLabel } from "../components/Primitives.tsx";
import MenuCard from "./MenuCard.tsx";

/** The shimmer that stands in for the menu's first fetch. */
function MenuSkeleton() {
  return (
    <div className="jk-menugrid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="jk-panel jk-menuskel">
          <div className="jk-skel jk-menuskel__tile" />
          <div className="jk-menuskel__lines">
            <div className="jk-skel jk-menuskel__l1" />
            <div className="jk-skel jk-menuskel__l2" />
            <div className="jk-skel jk-menuskel__l3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Menu() {
  const { t } = useI18n();
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const cat = useStore((s) => s.cat);
  const setCat = useStore((s) => s.setCat);
  const loaded = useStore((s) => s.menuLoaded);
  const markLoaded = useStore((s) => s.markMenuLoaded);

  /*
   * The shimmer runs once per session, not once per visit: a reader coming
   * back from the cart has already waited for this menu, and making them
   * watch it load again would be theatre rather than feedback.
   */
  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(markLoaded, 420);
    return () => window.clearTimeout(timer);
  }, [loaded, markLoaded]);

  const shown = cat === "all" ? items : items.filter((i) => i.cat === cat);

  return (
    <div className="jk-site jk-screen">
      <header className="jk-head">
        <h1 className="jk-head__title">{t("menu.title")}</h1>
        <p className="jk-head__sub">{t("menu.sub")}</p>
      </header>

      <div className="jk-catbar jk-scroll" role="group" aria-label={t("menu.filter")}>
        <Chip onClick={() => setCat("all")} pressed={cat === "all"}>
          {t("menu.everything")}
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} onClick={() => setCat(c.id)} pressed={cat === c.id}>
            <Glyph name={c.icon} size={14} />
            {label(c.name)}
          </Chip>
        ))}
      </div>

      {!loaded ? (
        <MenuSkeleton />
      ) : cat === "all" ? (
        categories.map((c) => {
          const group = items.filter((i) => i.cat === c.id);
          return (
            <section key={c.id} className="jk-menusec">
              <div className="jk-menusec__head">
                <span style={{ color: `var(${c.tint})`, display: "inline-flex" }}>
                  <Glyph name={c.icon} size={15} />
                </span>
                <SectionLabel>{label(c.name)}</SectionLabel>
                <span className="jk-menusec__rule" />
              </div>
              <div className="jk-menugrid">
                {group.map((item, i) => (
                  <MenuCard key={item.id} item={item} index={i} />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="jk-menugrid">
          {shown.map((item, i) => (
            <MenuCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
