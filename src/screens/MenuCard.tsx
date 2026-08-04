/**
 * One menu card, shared by the home page's featured band and the menu grid.
 *
 * The whole tile-and-title block is the button, because a card that only
 * responds on its 40px "Build" chip is a card people tap three times before
 * it works. The sold-out item keeps its card and disables it rather than
 * disappearing: a menu that quietly drops what it ran out of tells the reader
 * nothing about what to come back for.
 */

import { Plus } from "lucide-react";

import type { Item } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { label, money } from "../lib/format.ts";
import { useStore } from "../state/store.ts";
import { tintFor } from "../components/OrderLine.tsx";
import { Chip, FoodTile, Glyph, Mono } from "../components/Primitives.tsx";

export default function MenuCard({
  item,
  index,
  compact,
}: {
  item: Item;
  index: number;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const categories = useStore((s) => s.categories);
  const openSheet = useStore((s) => s.openSheet);
  const sold = item.soldOut === true;

  return (
    <article className={`jk-menucard${sold ? " jk-menucard--sold" : " jk-card"}`}>
      <button
        type="button"
        className="jk-menucard__hit jk-btn"
        disabled={sold}
        onClick={() => openSheet(item.id)}
        aria-label={sold ? t("menu.soldOutOf", { item: label(item.name) }) : label(item.name)}
      >
        <FoodTile
          tint={tintFor(item, categories)}
          index={index}
          height={compact === true ? 116 : 132}
          radius={0}
          icon={<Glyph name={item.icon} size={compact === true ? 52 : 58} />}
          file={item.file}
        />
        <span className="jk-menucard__body">
          <span className="jk-menucard__top">
            <span className="jk-menucard__name">{label(item.name)}</span>
            <Mono className="jk-menucard__price">
              {money(item.price)}
              {item.mods.length > 0 && <span className="jk-menucard__plus">+</span>}
            </Mono>
          </span>
          <span className="jk-menucard__desc">{label(item.desc)}</span>
        </span>
      </button>

      <div className="jk-menucard__foot">
        {item.tags.map((tag) => (
          <Chip key={tag} tone={tag === "Spicy" ? "warn" : "pos"}>
            {t(tag === "Spicy" ? "menu.tag.spicy" : "menu.tag.veg")}
          </Chip>
        ))}
        <span className="jk-shead__spacer" />
        {sold ? (
          <span className="jk-menucard__soldnote">{t("menu.backTomorrow")}</span>
        ) : (
          <button type="button" className="jk-buildbtn jk-btn" onClick={() => openSheet(item.id)}>
            <Plus size={14} aria-hidden="true" />
            {t(item.mods.length > 0 ? "menu.build" : "menu.add")}
          </button>
        )}
      </div>

      {sold && <span className="jk-menucard__veil" aria-hidden="true" />}
    </article>
  );
}
