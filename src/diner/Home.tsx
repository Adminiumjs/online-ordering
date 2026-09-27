/**
 * Home: the open hero (or the closed one, and why), today's card, how pickup
 * works, where to find the kitchen, the featured dishes, the sections, the
 * week's hours and the way in. Every word about this kitchen is its own
 * settings; every time is on its clock.
 */
import { Icon } from "../components/Icon.tsx";
import { Bdi } from "../components/Bdi.tsx";
import { useI18n } from "../i18n/index.tsx";
import { telHref } from "../lib/format.ts";
import { weekRows } from "../lib/day.ts";
import { addDays, minutesOf, weekdayOf, WEEKDAY_KEYS, type Day } from "../lib/venueTime.ts";
import type { Dish } from "../lib/menu.ts";
import type { Row } from "../data/wire.ts";
import { choosePickDay, loadDiner, openSheet, useDiner } from "../state/diner.ts";
import { goDiner } from "../state/ui.ts";
import { useFmt, useVenue, type Venue } from "../app/venue.ts";
import { OpenPill, toSection } from "./Shell.tsx";
import { DishTags, SoldOutVeil, Tile, needsBuilding, usePortions, usePriceLabel } from "./dish.tsx";
import { useDay, type DayFacts } from "./useDay.ts";

const NO_ROWS: readonly Row[] = [];

/** A Monday, to name the weekdays in the reader's language. */
const A_MONDAY: Day = "2026-07-27";

function useWide(): { narrow: boolean; phone: boolean } {
  const w = typeof window === "undefined" ? 1200 : window.innerWidth;
  return { narrow: w < 860, phone: w < 560 };
}

export function Home() {
  const day = useDay();
  const openHero = day.state === "open" || day.state === "later";
  return (
    <div className="jn-view">
      {openHero ? <OpenHome day={day} /> : <ClosedHero day={day} />}
      <Hours day={day} />
      <FindUs day={day} />
    </div>
  );
}

function HeroBadge({ label, value, icon, quiet, phone }: { label: string; value: React.ReactNode; icon: "timer" | "moon"; quiet?: boolean; phone: boolean }) {
  return (
    <div style={{ position: "absolute", zIndex: 2, insetBlockStart: phone ? 22 : 46, insetInlineStart: phone ? 10 : -14, display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderRadius: 15, background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "0 18px 40px -20px rgba(10,10,25,.4)" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: quiet ? "var(--surface-3)" : "var(--accent-soft)", color: quiet ? "var(--fg-muted)" : "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={icon} size={15} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span className="jk-kicker">{label}</span>
        <span className="jk-mono" style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
      </span>
    </div>
  );
}

function OpenHome({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const fmt = useFmt();
  const { narrow, phone } = useWide();
  const menu = useDiner((s) => s.data?.menu ?? null);
  const load = useDiner((s) => s.load);
  const dishes = menu?.dishes.filter((d) => d.online) ?? [];
  const plants = dishes.length > 0 && dishes.filter((d) => d.tags.includes("V")).length * 4 >= dishes.length;
  const facts: { icon: "timer" | "shopping-bag" | "leaf"; label: string }[] = [
    { icon: "timer", label: t("home.fact.ready", { minutes: fmt.number(day.notice) }) },
    { icon: "shopping-bag", label: t("home.fact.pickup") },
    ...(plants ? [{ icon: "leaf" as const, label: t("home.fact.plants") }] : []),
  ];
  const cta = !day.online ? t("home.cta.menu") : day.state === "later" ? t("home.cta.today") : t("home.cta.build");
  const next = day.firstFreeToday !== null ? fmt.wall(day.today, day.firstFreeToday) : day.nextOpen !== null && day.nextFirst !== null ? fmt.wall(day.nextOpen, day.nextFirst) : "";
  return (
    <div>
      <section className="jk-shell">
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.05fr .95fr", gap: "clamp(18px,3vw,44px)", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBlock: "clamp(28px,5vw,58px)" }}>
            <span className="jk-eyebrow">
              <Icon name="flame" size={13} />
              {t("home.eyebrow")}
            </span>
            <h1 className="jk-h1">{venue.headline ?? t("home.headline")}</h1>
            <p className="jk-lead">{venue.intro ?? t("home.intro")}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 11 }}>
              <button className="jn-btn jk-btn-primary" onClick={() => goDiner("menu")}>
                <Icon name="utensils" size={17} />
                {cta}
              </button>
              <button className="jn-gi jk-btn-ghost" onClick={() => toSection("jn-hours")}>
                <Icon name="clock" size={17} />
                {t("home.todayHours")}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, paddingBlockStart: 6 }}>
              {facts.map((f) => (
                <span key={f.icon} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
                  <Icon name={f.icon} size={14} style={{ color: "var(--accent-ink)" }} />
                  {f.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", paddingBlock: "clamp(10px,3vw,34px)" }}>
            <Tile hue={26} icon={null} photo={venue.photos.hero} radius={26} ratio={phone ? "4/3" : "5/4"} iconSize={0} style={{ width: "100%" }} />
            {day.online ? (
              <HeroBadge label={t("home.badge.next")} value={next} icon="timer" phone={phone} />
            ) : (
              <HeroBadge label={t("home.badge.paused")} value={venue.phone === null ? "" : <Bdi>{venue.phone}</Bdi>} icon="timer" phone={phone} />
            )}
          </div>
        </div>
      </section>

      <section className="jk-shell">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, paddingBlock: "clamp(16px,3vw,30px)" }}>
          <TodayCard day={day} venue={venue} />
          <div className="jn-card jk-card">
            <span className="jk-cardlabel">
              <Icon name="shopping-bag" size={14} style={{ color: "var(--accent-ink)" }} />
              {t("home.how")}
            </span>
            <ol style={{ display: "flex", flexDirection: "column", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>
              {(["home.how.1", "home.how.2", "home.how.3"] as const).map((key, i) => (
                <li key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                  <span className="jk-mono" aria-hidden="true" style={{ flex: "none", width: 20, height: 20, borderRadius: 6, background: "var(--surface-3)", color: "var(--fg)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {fmt.number(i + 1)}
                  </span>
                  {t(key)}
                </li>
              ))}
            </ol>
            <button className="jn-nav jk-link" onClick={() => goDiner("menu")} style={{ alignSelf: "flex-start", fontSize: 13 }}>
              {t("home.how.start")}
              <Icon name="arrow-right" size={14} className="jk-flip" />
            </button>
          </div>
          <div className="jn-card jk-card" style={{ gap: 14 }}>
            <span className="jk-cardlabel">
              <Icon name="map-pin" size={14} style={{ color: "var(--accent-ink)" }} />
              {t("home.findUs")}
            </span>
            <Tile hue={196} icon={null} photo={venue.photos.street} radius={14} ratio="16/7" iconSize={0} style={{ width: "100%" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.02em" }}>
                <bdi>{venue.street}</bdi>
              </span>
              {venue.area !== null && <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{venue.area}</span>}
            </div>
          </div>
        </div>
      </section>

      <Featured load={load} />
      <Sections />
    </div>
  );
}

function TodayCard({ day, venue }: { day: DayFacts; venue: Venue }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const hours = day.hours;
  return (
    <div className="jn-card jk-card">
      <span className="jk-cardlabel">
        <Icon name="clock" size={14} style={{ color: "var(--accent-ink)" }} />
        {t("home.today", { date: fmt.dayLong(day.today) })}
      </span>
      <span className="jk-mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>
        {hours.open ? t("home.hoursRange", { from: fmt.wall(day.today, hours.opens), to: fmt.wall(day.today, hours.closes) }) : t("home.closed")}
      </span>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>
        {t("home.pickupEvery", { minutes: fmt.number(day.slotMinutes), time: fmt.wall(day.today, day.lastPickupToday) })}
        {fmt.otherZone && t("home.zoneSuffix", { zone: fmt.zoneName })}
      </p>
      {!day.online && venue.phone !== null && (
        <a href={telHref(venue.phone)} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--fg)" }}>
          <Icon name="phone" size={14} style={{ color: "var(--accent-ink)" }} />
          <span className="jk-mono">
            <Bdi>{venue.phone}</Bdi>
          </span>
        </a>
      )}
      <OpenPill day={day} />
    </div>
  );
}

function Featured({ load }: { load: "busy" | "ok" | "err" }) {
  const { t } = useI18n();
  const menu = useDiner((s) => s.data?.menu ?? null);
  const day = useDay();
  const today = day.today;
  const portions = usePortions(today);
  const price = usePriceLabel();
  const featured = menu?.dishes.filter((d) => d.featured && d.online) ?? [];
  if (load === "ok" && featured.length === 0) return null;
  return (
    <section className="jk-shell">
      <div style={{ paddingBlock: "clamp(18px,3vw,34px)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBlockEnd: 18 }}>
          <div>
            <h2 className="jk-h2">{t("home.featured")}</h2>
            <p style={{ margin: "7px 0 0", fontSize: 14, color: "var(--fg-muted)" }}>{t("home.featured.sub")}</p>
          </div>
          <button className="jn-nav jk-link" onClick={() => goDiner("menu")} style={{ marginInlineStart: "auto" }}>
            {t("home.featured.all")}
            <Icon name="arrow-right" size={15} className="jk-flip" />
          </button>
        </div>
        {load === "ok" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
            {featured.map((dish) => (
              <FeaturedCard key={dish.id} dish={dish} portions={portions(dish)} price={price(dish)} today={today} />
            ))}
          </div>
        )}
        {load === "busy" && (
          <div role="status" aria-busy="true" aria-label={t("home.loading")} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ border: "1px solid var(--border)", borderRadius: 18, background: "var(--surface)", overflow: "hidden" }}>
                <div className="jn-skel" style={{ aspectRatio: "16/10" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "18px 20px 22px" }}>
                  <div className="jn-skel" style={{ height: 15, width: "62%", borderRadius: 6 }} />
                  <div className="jn-skel" style={{ height: 11, width: "88%", borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {load === "err" && <LoadFailed />}
      </div>
    </section>
  );
}

export function LoadFailed() {
  const { t } = useI18n();
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "20px 22px", borderRadius: 18, border: "1px dashed var(--border-strong)", background: "var(--surface)" }}>
      <Icon name="wifi-off" size={18} style={{ color: "var(--fg-subtle)" }} />
      <span style={{ fontSize: 14, fontWeight: 700 }}>{t("home.loadError")}</span>
      <button className="jn-gi jk-btn-sm" onClick={() => void loadDiner()} style={{ marginInlineStart: "auto" }}>
        <Icon name="rotate-cw" size={14} />
        {t("shell.retry")}
      </button>
    </div>
  );
}

function FeaturedCard({ dish, portions, price, today }: { dish: Dish; portions: { soldOut: boolean; left: number | null }; price: string; today: Day }) {
  const { t } = useI18n();
  return (
    <button
      className="jn-card"
      onClick={() => openSheet(dish.id)}
      disabled={portions.soldOut}
      aria-label={portions.soldOut ? t("dish.ariaSoldOut", { name: dish.name }) : t("dish.aria", { name: dish.name, price })}
      style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden", textAlign: "start", cursor: portions.soldOut ? "not-allowed" : "pointer", color: "var(--fg)", opacity: portions.soldOut ? 0.72 : 1 }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        <Tile hue={dish.hue} icon={dish.icon} photo={dish.image} radius={0} ratio="16/10" iconSize={76} style={{ width: "100%", borderInline: "none", borderBlockStart: "none", borderStartStartRadius: 17, borderStartEndRadius: 17 }} />
        {portions.soldOut && <SoldOutVeil day={today} today={today} />}
        {!portions.soldOut && needsBuilding(dish) && <BuildFlag />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "18px 20px 20px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-.025em" }}>{dish.name}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap" }}>{price}</span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{dish.description}</p>
        <DishTags dish={dish} left={portions.soldOut ? null : portions.left} day={today} today={today} />
      </div>
    </button>
  );
}

export function BuildFlag() {
  const { t } = useI18n();
  return (
    <span style={{ position: "absolute", zIndex: 2, insetBlockStart: 11, insetInlineStart: 11, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, background: "var(--accent)", color: "var(--accent-fg)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>
      <Icon name="sliders-horizontal" size={11} />
      {t("dish.buildIt")}
    </span>
  );
}

function Sections() {
  const { t } = useI18n();
  const fmt = useFmt();
  const menu = useDiner((s) => s.data?.menu ?? null);
  if (menu === null) return null;
  const cards = menu.categories
    .map((c) => ({ category: c, count: menu.dishes.filter((d) => d.categoryId === c.id && d.online && d.available).length }))
    .filter((c) => c.count > 0);
  if (cards.length === 0) return null;
  return (
    <section className="jk-shell">
      <div style={{ paddingBlock: "clamp(10px,2vw,24px)" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "clamp(18px,2.2vw,22px)", fontWeight: 800, letterSpacing: "-.028em" }}>{t("home.sections")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {cards.map(({ category, count }) => (
            <button
              key={category.id}
              className="jn-card"
              onClick={() => goDiner("menu", { category: category.id })}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 15, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--fg)", textAlign: "start" }}
            >
              <Tile hue={category.hue} icon={category.icon} photo={null} radius={12} iconSize={22} style={{ width: 44, height: 44 }} />
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.02em" }}>{category.name}</span>
                <span className="jk-mono" style={{ fontSize: 11, color: "var(--fg-subtle)" }}>{t("home.sectionCount", { count: fmt.number(count) }, count)}</span>
              </span>
              <Icon name="chevron-right" size={16} className="jk-flip" style={{ marginInlineStart: "auto", color: "var(--fg-subtle)" }} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosedHero({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const fmt = useFmt();
  const { phone } = useWide();
  const next = day.nextOpen;
  const nextHours = day.nextHours;
  const opens = next !== null && nextHours !== null ? fmt.wall(next, nextHours.opens) : "";
  const tomorrow = next !== null && next === day.tomorrow;
  const nextWord = next === null ? "" : tomorrow ? t("home.dayTomorrow") : fmt.dayLong(next);
  /** A pre-order is offered only for tomorrow, and only while online orders are on. */
  const preorder = tomorrow && day.online;
  const noneBody = venue.phone === null ? t("home.closed.body.noneNoPhone") : t("home.closed.body.none", { phone: `\u2066${venue.phone}\u2069` });
  /** Tomorrow is closed too: say when the kitchen is back, and offer no pre-order. */
  const later = next !== null && !tomorrow ? t("home.closed.body.tomorrowToo", { day: nextWord, time: opens }) : null;

  let badge: string;
  let title: string;
  let body: string;
  if (day.state === "closedToday") {
    badge = t("home.closed.badge.today");
    const reason = day.hours.closure?.reason ?? null;
    title = reason === null ? t("home.closed.title.todayPlain") : t("home.closed.title.today", { reason });
    body = next === null ? noneBody : (later ?? t("home.closed.body.back", { day: nextWord, time: opens }) + (preorder ? ` ${t("home.closed.body.preorderToo")}` : ""));
  } else if (day.state === "noSlots" && day.stopped) {
    badge = t("home.closed.badge.paused");
    title = t("home.closed.title.paused");
    body = venue.phone === null ? t("home.closed.body.paused") : t("home.closed.body.pausedCall", { phone: `\u2066${venue.phone}\u2069` });
  } else if (day.state === "noSlots") {
    badge = t("home.closed.badge.noSlots");
    title = t("home.closed.title.noSlots");
    body =
      next === null
        ? noneBody
        : later !== null
          ? later
          : t("home.closed.body.noSlots", { minutes: fmt.number(day.notice), time: fmt.wall(day.today, day.lastPickupToday), day: nextWord, opens });
  } else {
    badge = t("home.closed.badge.tonight");
    title = t("home.closed.title.tonight");
    body = next === null ? noneBody : (later ?? t("home.closed.body.back", { day: nextWord, time: opens }) + (preorder ? ` ${t("home.closed.body.buildNow")}` : ""));
  }

  return (
    <section className="jk-shell">
      <div style={{ paddingBlock: "clamp(26px,5vw,54px) clamp(20px,3vw,34px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(18px,3vw,40px)", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span className="jk-eyebrow is-quiet">
              <Icon name="door-closed" size={13} />
              {badge}
            </span>
            <h1 className="jk-h1" style={{ fontSize: "clamp(30px,4.6vw,52px)", lineHeight: 1.04, textWrap: "pretty" }}>{title}</h1>
            <p className="jk-lead" style={{ maxWidth: "44ch", fontSize: "clamp(15px,1.6vw,17.5px)" }}>{body}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 11 }}>
              {preorder && (
                <button
                  className="jn-btn jk-btn-primary"
                  onClick={() => {
                    choosePickDay("tomorrow");
                    goDiner("menu");
                  }}
                >
                  <Icon name="sunrise" size={17} />
                  {t("home.closed.cta")}
                </button>
              )}
              <button className="jn-gi jk-btn-ghost" onClick={() => goDiner("orders")}>
                <Icon name="rotate-ccw" size={17} />
                {t("home.closed.orderAgain")}
              </button>
            </div>
            {next !== null && nextHours !== null && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 20px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="jk-cardlabel">
                  <Icon name="sunrise" size={14} style={{ color: "var(--accent-ink)" }} />
                  {tomorrow ? t("home.closed.tomorrow") : fmt.weekday(next)}
                </span>
                <span className="jk-mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.02em" }}>
                  {t("home.hoursRange", { from: opens, to: fmt.wall(next, nextHours.closes) })}
                </span>
                <span style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>{t("home.closed.firstPickup", { date: fmt.dayLong(next), time: fmt.wall(next, day.nextFirst ?? nextHours.opens) })}</span>
              </div>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <Tile hue={26} icon={null} photo={venue.photos.closed} radius={26} ratio={phone ? "4/3" : "5/4"} iconSize={0} style={{ width: "100%" }} />
            {opens !== "" && <HeroBadge label={t("home.badge.opens")} value={opens} icon="moon" quiet phone={phone} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function Hours({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const fmt = useFmt();
  const hours = useDiner((s) => s.data?.hours) ?? NO_ROWS;
  const rows = weekRows(hours);
  const name = (i: number) => fmt.weekday(addDays(A_MONDAY, i));
  const todayIndex = WEEKDAY_KEYS.indexOf(weekdayOf(day.today));
  const intro = hoursIntro(hours, name, t);
  return (
    <section id="jn-hours" className="jk-shell" style={{ scrollMarginTop: 84 }}>
      <div style={{ paddingBlock: "clamp(24px,4vw,48px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(18px,3vw,40px)", alignItems: "start" }}>
          <div>
            <h2 className="jk-h2">{t("hours.title")}</h2>
            <p style={{ margin: "9px 0 0", maxWidth: "40ch", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
              {intro !== "" && <span>{intro} </span>}
              <span>{t("hours.rule", { minutes: fmt.number(day.slotMinutes) })}</span>
            </p>
            {venue.phone !== null && (
              <a href={telHref(venue.phone)} className="jn-gi jk-mono" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBlockStart: 16, padding: "9px 13px", borderRadius: 11, border: "1px solid transparent", background: "var(--surface-3)", fontSize: 12, fontWeight: 500, color: "var(--fg-muted)" }}>
                <Icon name="phone" size={13} />
                <Bdi>{venue.phone}</Bdi>
              </a>
            )}
            {fmt.otherZone && <span style={{ display: "block", marginBlockStart: 7, fontSize: 12, lineHeight: 1.45, color: "var(--fg-subtle)" }}>{t("hours.zone", { zone: fmt.zoneName })}</span>}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 18, background: "var(--surface)", overflow: "hidden" }}>
            {rows.map((r, k) => {
              const isToday = todayIndex >= r.from && todayIndex <= r.to;
              const closure = isToday ? day.hours.closure : null;
              const label = r.from === r.to ? name(r.from) : t("hours.range", { from: name(r.from), to: name(r.to) });
              const value =
                closure !== null
                  ? closure.reason === null
                    ? t("home.closed")
                    : t("hours.closedFor", { reason: closure.reason })
                  : r.open
                    ? t("home.hoursRange", { from: fmt.wall(day.today, r.opens), to: fmt.wall(day.today, r.closes) })
                    : t("home.closed");
              return (
                <div key={r.from} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBlockEnd: k === rows.length - 1 ? "none" : "1px solid var(--border)", background: isToday ? "var(--surface-2)" : "transparent" }}>
                  <span style={{ fontSize: 13.5, fontWeight: isToday ? 800 : 600 }}>{label}</span>
                  {isToday && <span style={{ padding: "3px 8px", borderRadius: 999, background: "var(--pos-soft)", color: "var(--pos)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>{t("hours.today")}</span>}
                  <span className={closure === null ? "jk-mono" : undefined} style={{ marginInlineStart: "auto", fontSize: 13, color: "var(--fg-muted)", whiteSpace: closure === null ? "nowrap" : undefined }}>{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Open every day." / "Open every day — later on Friday and Saturday." / nothing for an irregular week. */
function hoursIntro(hours: readonly Record<string, unknown>[], name: (i: number) => string, t: ReturnType<typeof useI18n>["t"]): string {
  const week = WEEKDAY_KEYS.map((w) => hours.find((h) => h["weekday"] === w));
  if (week.some((h) => h === undefined || h["open"] === false)) return "";
  const closes = week.map((h) => minutesOf(String(h?.["closes"] ?? "00:00")));
  const tally = new Map<number, number>();
  for (const c of closes) tally.set(c, (tally.get(c) ?? 0) + 1);
  const usual = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
  const later = closes.map((c, i) => (c > usual ? i : -1)).filter((i) => i >= 0);
  if (later.length === 0) return t("hours.everyDay");
  if (later.length === 1) return t("hours.laterOn1", { day: name(later[0]!) });
  if (later.length === 2) return t("hours.laterOn2", { day1: name(later[0]!), day2: name(later[1]!) });
  return t("hours.everyDay");
}

function FindUs({ day }: { day: DayFacts }) {
  const { t } = useI18n();
  const venue = useVenue();
  const fmt = useFmt();
  const hours = useDiner((s) => s.data?.hours) ?? NO_ROWS;
  const { phone } = useWide();
  const allOpen = hours.length === 7 && hours.every((h) => h["open"] !== false && h["opens"] === hours[0]?.["opens"]);
  const openLine = allOpen ? t("findUs.everyDay", { time: fmt.wall(day.today, String(hours[0]?.["opens"])) }) : day.hours.open ? t("findUs.from", { time: fmt.wall(day.today, day.hours.opens) }) : null;
  return (
    <section id="jn-findus" className="jk-shell" style={{ scrollMarginTop: 84 }}>
      <div style={{ paddingBlock: "clamp(10px,2vw,30px) clamp(30px,5vw,64px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(18px,3vw,40px)", alignItems: "center" }}>
          <div>
            <h2 className="jk-h2">{t("findUs.title")}</h2>
            {venue.directions !== null && <p style={{ margin: "9px 0 0", maxWidth: "38ch", fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{venue.directions}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBlockStart: 18 }}>
              {venue.address !== "" && (
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--fg-muted)" }}>
                  <Icon name="map-pin" size={15} style={{ color: "var(--accent-ink)" }} />
                  <bdi>{venue.address}</bdi>
                </span>
              )}
              {openLine !== null && (
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--fg-muted)" }}>
                  <Icon name="clock" size={15} style={{ color: "var(--accent-ink)" }} />
                  {openLine}
                </span>
              )}
              {venue.phone !== null && (
                <a href={telHref(venue.phone)} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--fg-muted)" }}>
                  <Icon name="phone" size={15} style={{ color: "var(--accent-ink)" }} />
                  <span className="jk-mono">
                    <Bdi>{venue.phone}</Bdi>
                  </span>
                </a>
              )}
            </div>
          </div>
          <Tile hue={150} icon={null} photo={venue.photos.store} radius={22} ratio={phone ? "4/3" : "16/11"} iconSize={0} style={{ width: "100%" }} />
        </div>
      </div>
    </section>
  );
}
