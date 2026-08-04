/**
 * HOME — the shop window.
 *
 * Hero, an open-now strip, today's featured items, category shortcuts, and the
 * two anchor sections the header links to: Hours and Find us. They are
 * sections rather than views because that is what they are on every
 * restaurant site ever built, and pretending otherwise would put two nearly
 * empty pages in the router for no reason.
 */

import { useEffect, useRef } from "react";
import { ArrowRight, Clock, MapPin, ShoppingBag, Timer, Utensils } from "lucide-react";

import { CLOSE_AT, OPEN_AT, SLOT_STEP } from "../data/demo.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock, clockRange, label } from "../lib/format.ts";
import { chosenPickup, kitchenOpen, slotsAt, useStore } from "../state/store.ts";
import MenuCard from "./MenuCard.tsx";
import { Button, FoodTile, Glyph, Mono, Pill, SectionLabel } from "../components/Primitives.tsx";

export default function Home() {
  const { t } = useI18n();
  const go = useStore((s) => s.go);
  const setCat = useStore((s) => s.setCat);
  const goSection = useStore((s) => s.goSection);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const venue = useStore((s) => s.venue);
  const weekHours = useStore((s) => s.weekHours);
  const now = useStore((s) => s.now);
  const myNums = useStore((s) => s.myNums);
  const anchor = useStore((s) => s.anchor);
  const clearAnchor = useStore((s) => s.clearAnchor);

  const hoursRef = useRef<HTMLElement>(null);
  const findUsRef = useRef<HTMLElement>(null);

  /*
   * `go()` scrolls to the top on every view change (house layout rule 3), so a
   * header link to Hours has to reassert itself after the paint rather than
   * fight the store. The anchor is cleared once used, or the next arrival at
   * Home would jump again for no reason.
   */
  useEffect(() => {
    if (anchor === null) return;
    const target = anchor === "hours" ? hoursRef.current : findUsRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    clearAnchor();
  }, [anchor, clearAnchor]);

  const open = kitchenOpen(now);
  const slots = slotsAt(now);
  const nextSlot = chosenPickup(null, now);
  const featured = items.filter((i) => i.feat === true);
  const today = weekHours.find((d) => d.today === true) ?? weekHours[0];
  const byoTint = categories.find((c) => c.id === "pizza")?.tint ?? "--ft-pizza";
  const byo = items.find((i) => i.id === "byo");

  return (
    <div className="jk-site jk-screen">
      {/* ------------------------------------------------------------ hero */}
      <section className="jk-hero">
        <div className="jk-hero__copy">
          <Pill tone="accent">
            <Utensils size={11} aria-hidden="true" />
            {t("home.kicker")}
          </Pill>
          <h1 className="jk-h1">{t("home.headline")}</h1>
          <p className="jk-lede">{t("home.lede")}</p>
          <div className="jk-hero__actions">
            <Button onClick={() => go("menu")}>
              <Utensils size={16} aria-hidden="true" />
              {t("home.browse")}
            </Button>
            {myNums.length > 0 ? (
              <Button tone="ghost" onClick={() => go("track")}>
                <Timer size={16} aria-hidden="true" />
                {t("home.trackMine")}
              </Button>
            ) : (
              <Button tone="ghost" onClick={() => goSection("hours")}>
                <Clock size={16} aria-hidden="true" />
                {t("home.hoursAndPickup")}
              </Button>
            )}
          </div>
        </div>

        {/*
         * House layout rule 2: the "next pickup" badge sits in the corner
         * OPPOSITE the tile's own filename chip, which lives at the block-end
         * inline-start corner. `FoodTile` owns that placement.
         */}
        <FoodTile
          tint={byoTint}
          index={3}
          height={300}
          radius={20}
          icon={<Glyph name="pizza" size={120} />}
          file={byo?.file}
          className="jk-hero__tile"
          badge={
            <span className="jk-nextpickup">
              <span className="jk-nextpickup__icon" aria-hidden="true">
                <Timer size={15} />
              </span>
              <span>
                <span className="jk-nextpickup__title">
                  {nextSlot === null
                    ? t("home.nextPickup.tomorrow")
                    : t("home.nextPickup", { time: clock(nextSlot) })}
                </span>
                <span className="jk-nextpickup__sub">{t("home.nextPickup.sub")}</span>
              </span>
            </span>
          }
        />
      </section>

      {/* ---------------------------------------------------- open-now strip */}
      <section className="jk-strip">
        <div className="jk-infocard">
          <span className={`jk-infocard__tile${open ? " jk-infocard__tile--pos" : ""}`} aria-hidden="true">
            <Clock size={18} />
          </span>
          <span className="jk-infocard__body">
            <span className="jk-infocard__title">
              {open
                ? t("home.openUntil", { time: clock(CLOSE_AT) })
                : t("home.closedUntil", { time: clock(OPEN_AT) })}
            </span>
            <span className="jk-infocard__sub">
              {t("home.kitchenHours")} <Mono>{clockRange(today.open, today.close)}</Mono>
            </span>
          </span>
        </div>

        <div className="jk-infocard">
          <span className="jk-infocard__tile jk-infocard__tile--accent" aria-hidden="true">
            <ShoppingBag size={18} />
          </span>
          <span className="jk-infocard__body">
            <span className="jk-infocard__title">{t("home.orderAhead")}</span>
            <span className="jk-infocard__sub">
              {t("home.slotsEvery", { step: SLOT_STEP })}{" "}
              <Mono>{slots.length > 0 ? clock(slots[0]) : "—"}</Mono>
            </span>
          </span>
        </div>

        <button type="button" className="jk-infocard jk-card jk-btn" onClick={() => goSection("findus")}>
          <FoodTile
            tint="--ft-drink"
            index={2}
            height={38}
            radius={10}
            icon={<MapPin size={18} />}
            className="jk-infocard__foodtile"
          />
          <span className="jk-infocard__body">
            <span className="jk-infocard__title">{venue.line1}</span>
            <span className="jk-infocard__sub">
              {venue.line2} · {t("home.findUsLink")}
            </span>
          </span>
        </button>
      </section>

      {/* --------------------------------------------------------- featured */}
      <section className="jk-band">
        <div className="jk-band__head">
          <SectionLabel>{t("home.fromTheKitchen")}</SectionLabel>
          <span className="jk-shead__spacer" />
          <button type="button" className="jk-linkbtn jk-btn" onClick={() => go("menu")}>
            {t("home.fullMenu")}
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="jk-featrow">
          {featured.map((item, i) => (
            <MenuCard key={item.id} item={item} index={i} compact />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ category shortcuts */}
      <section className="jk-band">
        <SectionLabel>{t("home.jumpTo")}</SectionLabel>
        <div className="jk-catgrid">
          {categories.map((cat, i) => {
            const count = items.filter((it) => it.cat === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                className="jk-cattile jk-card jk-btn"
                onClick={() => setCat(cat.id)}
              >
                <FoodTile
                  tint={cat.tint}
                  index={i}
                  height={40}
                  radius={12}
                  icon={<Glyph name={cat.icon} size={20} />}
                />
                <span className="jk-cattile__name">{label(cat.name)}</span>
                <Mono className="jk-cattile__count">
                  {t("chrome.itemCount", { count }, count)}
                </Mono>
              </button>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ hours */}
      <section className="jk-band" id="hours" ref={hoursRef}>
        <SectionLabel>{t("chrome.nav.hours")}</SectionLabel>
        <div className="jk-panel jk-hourcard">
          {weekHours.map((day) => (
            <div
              key={day.day}
              className={`jk-hourrow${day.today === true ? " jk-hourrow--today" : ""}`}
            >
              <span className="jk-hourrow__day">
                {label(day.day)}
                {day.today === true && ` · ${t("home.today")}`}
              </span>
              <Mono className="jk-hourrow__time">{clockRange(day.open, day.close)}</Mono>
            </div>
          ))}
        </div>
        <p className="jk-band__note">
          {t("home.lastSlot")} <Mono>{clock(CLOSE_AT - SLOT_STEP)}</Mono>
          {" — "}
          {t("home.lastSlot.tail")}
        </p>
      </section>

      {/* ----------------------------------------------------------- find us */}
      <section className="jk-band" id="findus" ref={findUsRef}>
        <SectionLabel>{t("chrome.nav.findUs")}</SectionLabel>
        <div className="jk-panel jk-mapcard">
          <FoodTile
            tint="--ft-drink"
            index={4}
            height={150}
            radius={0}
            icon={<MapPin size={44} />}
            file="alder-street-map.png"
          />
          <div className="jk-mapcard__body">
            <span className="jk-mapcard__addr">
              {venue.line1}, {venue.line2}
            </span>
            <p className="jk-mapcard__note">{label(venue.note)}</p>
            <p className="jk-mapcard__extra">{t("home.parking")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
