/**
 * Checkout: who is picking up, the pickup time, how they pay (at the
 * counter), the order's summary with Adminium's totals, and "Place order" —
 * then the refusals a place can meet: a changed price, a dish just sold out,
 * a time just taken, online orders switched off, the item limit.
 */
import { useId } from "react";

import { Icon } from "../components/Icon.tsx";
import { Modal, useNarrow } from "../components/Modal.tsx";
import { useI18n } from "../i18n/index.tsx";
import { Rich } from "../i18n/rich.tsx";
import { EMAIL } from "../lib/format.ts";
import { optionsText } from "../lib/menu.ts";
import { asciiDigits, telHref } from "../lib/format.ts";
import {
  acceptNewPrice,
  cartCount,
  closeSoldOut,
  dismissPriceChanged,
  freshQuote,
  placeOrder,
  rulesOf,
  setField,
  takeOff,
  touch,
  useDiner,
  validPick,
  type Placed,
} from "../state/diner.ts";
import { openTrack, showWithoutLink } from "../state/track.ts";
import { goDiner, toast } from "../state/ui.ts";
import { useFmt, useVenue } from "../app/venue.ts";
import { Bdi } from "../components/Bdi.tsx";
import { PickupCard } from "./Cart.tsx";
import { Totals, useLineAmount, useLineStates } from "./cartParts.tsx";
import { Tile } from "./dish.tsx";
import { useDay } from "./useDay.ts";

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 32;
export const ORDER_NOTE_MAX = 140;

export function phoneBad(phone: string): boolean {
  const s = phone.trim();
  if (s === "") return false;
  return !/^[0-9+()\-.\s]+$/.test(s) || s.replace(/[^0-9]/g, "").length < 6;
}

/** After a place: the order's own page, by its link, or its facts when the answer was a replay. */
export async function followPlaced(placed: Placed): Promise<void> {
  if (placed.token !== null) {
    window.location.hash = placed.token;
    goDiner("track");
    await openTrack(placed.token, true);
  } else {
    showWithoutLink();
    goDiner("track");
  }
}

function useBlock(): string | null {
  const { t } = useI18n();
  const fmt = useFmt();
  const day = useDay();
  const s = useDiner();
  const { states } = useLineStates();
  const f = s.form;
  const rules = rulesOf();
  const lines = [...states.values()];
  if (s.cart.length === 0) return t("co.block.empty");
  if (!day.online) return t("sheet.offline");
  if (f.name.trim().length < 2) return t("co.block.name");
  if (!EMAIL.test(f.email.trim())) return t("co.block.email");
  if (phoneBad(f.phone)) return t("co.block.phone");
  if (lines.some((l) => l.sold)) return t("co.block.sold");
  if (lines.some((l) => l.gone !== null || l.options)) return t("co.block.gone");
  if (s.fieldErrors.name !== undefined) return t("co.block.name");
  if (s.fieldErrors.email !== undefined) return t("co.block.email");
  if (s.fieldErrors.phone !== undefined) return t("co.block.phone");
  const over = lines.find((l) => l.over !== null || l.fewer);
  if (over !== undefined) return t("co.block.over", { name: over.dish?.name ?? "" });
  if (cartCount(s.cart) > rules.maxItems) return t("sheet.full", { max: fmt.number(rules.maxItems) });
  if (validPick(day.now) === null) return t("co.block.time");
  if (s.quote?.state === "err") return t("co.block.prices");
  if (freshQuote() === null) return t("totals.checking");
  return null;
}

function Field({ id, label, optional, hint, error, children }: { id: string; label: string; optional?: boolean; hint: string; error: string | null; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
        {label}
        {optional === true && <span style={{ fontWeight: 600, color: "var(--fg-subtle)" }}> {t("co.optional")}</span>}
      </label>
      {children}
      {error !== null ? (
        <span id={`${id}-msg`} role="alert" style={{ display: "flex", alignItems: "center", gap: 6, marginBlockStart: 7, fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>
          <Icon name="alert-circle" size={13} />
          {error}
        </span>
      ) : (
        <span id={`${id}-msg`} style={{ display: "block", marginBlockStart: 7, fontSize: 12, lineHeight: 1.45, color: "var(--fg-subtle)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}

const fieldStyle = (bad: boolean): React.CSSProperties => ({ width: "100%", padding: "13px 15px", borderRadius: 12, border: `1px solid ${bad ? "var(--danger)" : "var(--border-strong)"}`, background: "var(--surface-2)", color: "var(--fg)", fontSize: 14.5, fontWeight: 600 });

export function Checkout() {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const venue = useVenue();
  const narrow = useNarrow(860);
  const day = useDay();
  const s = useDiner();
  const fresh = useDiner(() => freshQuote());
  const { states } = useLineStates();
  const amount = useLineAmount();
  const block = useBlock();
  const reasonId = useId();
  const f = s.form;
  const nameErr = (s.touched.name === true && f.name.trim().length < 2) || s.fieldErrors.name !== undefined;
  const emailErr = (s.touched.email === true && !EMAIL.test(f.email.trim())) || s.fieldErrors.email !== undefined;
  const phoneErr = (f.phone.trim().length > 3 && phoneBad(f.phone)) || s.fieldErrors.phone !== undefined;
  const pick = validPick(day.now);
  const pickWord = pick === null ? t("co.pickATime") : t("co.pickup", { day: pick.day === day.today ? t("pick.today") : pick.day === day.tomorrow ? t("pick.tomorrow") : fmt.weekday(pick.day), time: fmt.wall(pick.day, pick.time) });
  const total = fresh === null ? null : fmt.money(fresh.data["total"]);
  const place = async () => {
    if (block !== null) return;
    const placed = await placeOrder(locale);
    if (placed !== null) await followPlaced(placed);
  };
  if (s.cart.length === 0 && !s.placing) {
    return (
      <div className="jn-view jk-shell">
        <div style={{ paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
          <h1 style={{ margin: "0 0 22px", fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("co.title")}</h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--fg-muted)" }}>{t("co.block.empty")}</p>
          <button className="jn-btn jk-btn-primary" onClick={() => goDiner("menu")} style={{ marginBlockStart: 18 }}>
            <Icon name="utensils" size={17} />
            {t("cart.browse")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="jn-view jk-shell">
      <div style={{ paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
        <button className="jn-nav" onClick={() => goDiner("cart")} disabled={s.placing} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "transparent", padding: 0, marginBlockEnd: 16, color: "var(--fg-muted)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Icon name="arrow-left" size={15} className="jk-flip" />
          {t("co.back")}
        </button>
        <h1 style={{ margin: "0 0 22px", fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("co.title")}</h1>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 340px", gap: "clamp(16px,2.5vw,28px)", alignItems: "start" }}>
          <fieldset disabled={s.placing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <legend className="jn-sr">{t("co.legend")}</legend>
            <div style={{ padding: 22, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="jk-cardlabel" style={{ gap: 8 }}>
                <Icon name="user-round" size={14} style={{ color: "var(--accent-ink)" }} />
                {t("co.details")}
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBlockStart: 16 }}>
                <Field id="jn-co-name" label={t("co.name")} hint={t("co.name.hint")} error={nameErr ? t(s.fieldErrors.name === "plain" ? "co.name.plain" : "co.name.error") : null}>
                  <input id="jn-co-name" className="jn-fld" autoComplete="given-name" value={f.name} maxLength={NAME_MAX} onChange={(e) => setField("name", e.target.value)} onBlur={() => touch("name")} placeholder={t("co.name.placeholder")} aria-invalid={nameErr} aria-describedby="jn-co-name-msg" style={fieldStyle(nameErr)} />
                </Field>
                <Field id="jn-co-email" label={t("co.email")} hint={t("co.email.hint")} error={emailErr ? t("co.email.error") : null}>
                  <input id="jn-co-email" className="jn-fld" type="email" autoComplete="email" dir="ltr" value={f.email} maxLength={EMAIL_MAX} onChange={(e) => setField("email", e.target.value)} onBlur={() => touch("email")} placeholder={t("co.email.placeholder")} aria-invalid={emailErr} aria-describedby="jn-co-email-msg" style={fieldStyle(emailErr)} />
                </Field>
                <Field id="jn-co-phone" label={t("co.phone")} optional hint={t("co.phone.hint")} error={phoneErr ? t("co.phone.error") : null}>
                  <input id="jn-co-phone" className="jn-fld" type="tel" autoComplete="tel" dir="ltr" value={f.phone} maxLength={PHONE_MAX} onChange={(e) => setField("phone", asciiDigits(e.target.value))} placeholder={t("co.phone.placeholder")} aria-invalid={phoneErr} aria-describedby="jn-co-phone-msg" style={fieldStyle(phoneErr)} />
                </Field>
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBlockEnd: 7 }}>
                    <label htmlFor="jn-co-note" style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {t("co.note")}
                      <span style={{ fontWeight: 600, color: "var(--fg-subtle)" }}> {t("co.optional")}</span>
                    </label>
                    <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--fg-subtle)" }}>
                      {t("sheet.count", { n: fmt.number(f.note.length), max: fmt.number(ORDER_NOTE_MAX) })}
                    </span>
                  </div>
                  <textarea id="jn-co-note" className="jn-fld" value={f.note} onChange={(e) => setField("note", e.target.value.slice(0, ORDER_NOTE_MAX))} maxLength={ORDER_NOTE_MAX} rows={2} placeholder={t("co.note.placeholder")} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 14.5, lineHeight: 1.5, resize: "none" }} />
                </div>
              </div>
            </div>
            <PickupCard compact={false} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "20px 22px", borderRadius: 18, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <span style={{ flex: "none", width: 38, height: 38, borderRadius: 11, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="wallet" size={17} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.02em" }}>{t("co.pay")}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg-muted)" }}>
                  {total === null ? (
                    t("co.pay.checking")
                  ) : (
                    <Rich text={t("co.pay.body")} parts={{ total: <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{total}</span> }} />
                  )}
                </span>
              </span>
            </div>
          </fieldset>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div style={{ padding: 20, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span className="jk-kicker" style={{ display: "block", fontSize: 11 }}>{t("co.summary")}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBlock: 14 }}>
                {s.cart.map((line, i) => {
                  const st = states.get(line.key)!;
                  const mods = st.dish === undefined ? "" : optionsText(st.dish, line.options);
                  return (
                    <div key={line.key} style={{ display: "flex", gap: 10, paddingInlineStart: 34, position: "relative" }}>
                      <span className="jk-mono" style={{ position: "absolute", insetInlineStart: 0, insetBlockStart: 1, minWidth: 26, height: 22, paddingInline: 6, borderRadius: 7, background: "var(--surface-3)", color: "var(--fg-muted)", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {t("co.qty", { qty: fmt.number(line.qty) })}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-.015em" }}>{st.dish?.name ?? st.gone?.name ?? ""}</span>
                        {mods !== "" && <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--fg-subtle)", textWrap: "pretty" }}>{mods}</span>}
                        {line.note !== "" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--warn)", fontWeight: 600 }}>
                            <Icon name="message-square" size={11} />
                            {line.note}
                          </span>
                        )}
                        {st.sold && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>{st.day === day.today ? t("cart.soldToday") : t("cart.soldFor", { day: fmt.weekday(st.day) })}</span>}
                        {st.over !== null && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>{t("cart.onlyLeftToday", { count: fmt.number(st.over) }, st.over)}</span>}
                        {st.gone !== null && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>{st.gone.name === "" ? t("cart.goneAny") : t("cart.gone", { name: st.gone.name })}</span>}
                      </span>
                      <span className="jk-mono" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{fmt.money(amount(line, i, st.dish))}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ paddingBlockStart: 14, borderBlockStart: "1px solid var(--border)" }}>
                <Totals gap={10} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBlockStart: 16, padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <Icon name="map-pin" size={15} style={{ color: "var(--accent-ink)" }} />
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--fg-muted)" }}>
                  <Rich
                    text={t("co.strip")}
                    parts={{
                      place: (
                        <strong style={{ color: "var(--fg)" }}>
                          <bdi>{venue.street !== "" ? venue.street : venue.name}</bdi>
                        </strong>
                      ),
                      time: <span className="jk-mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{pickWord}</span>,
                    }}
                  />
                </span>
              </div>
              <PlaceError />
              <button
                className="jn-btn"
                onClick={() => void place()}
                disabled={block !== null || s.placing}
                aria-describedby={block !== null && !s.placing ? reasonId : undefined}
                style={{ width: "100%", marginBlockStart: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 52, borderRadius: 13, border: "none", background: block !== null ? "var(--surface-3)" : "var(--accent)", color: block !== null ? "var(--fg-subtle)" : "var(--accent-fg)", fontSize: 15, fontWeight: 800, cursor: block !== null || s.placing ? "not-allowed" : "pointer" }}
              >
                {s.placing ? <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} /> : <Icon name="check" size={17} />}
                {s.placing ? t("co.placing") : total === null ? t("co.placeNoTotal") : t("co.place", { total })}
              </button>
              {block !== null && !s.placing && (
                <span id={reasonId} style={{ display: "flex", alignItems: "center", gap: 7, marginBlockStart: 11, fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
                  <Icon name="info" size={13} />
                  {block}
                </span>
              )}
            </div>
          </aside>
        </div>
      </div>
      <PriceChanged />
      <SoldOut />
    </div>
  );
}

function PlaceError() {
  const { t } = useI18n();
  const fmt = useFmt();
  const venue = useVenue();
  const error = useDiner((s) => s.placeError);
  if (error === null) return null;
  const warn = error === "toomany" || error === "busy" || error === "limit" || error === "pending";
  const phone = venue.phone;
  const call =
    phone === null ? (
      t("co.err.counter")
    ) : (
      <Rich
        text={t("co.err.call")}
        parts={{
          phone: (
            <a href={telHref(phone)} className="jk-mono" style={{ fontWeight: 700, color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
              <Bdi>{phone}</Bdi>
            </a>
          ),
        }}
      />
    );
  const text =
    error === "stopped"
      ? t("co.err.stopped")
      : error === "toomany"
        ? t("sheet.full", { max: fmt.number(rulesOf().maxItems) })
        : error === "offline"
          ? t("co.err.offline")
          : error === "pending"
            ? t("co.err.pending")
          : error === "busy"
            ? t("co.err.busy")
            : error === "limit"
              ? t("co.err.limit")
              : t("co.err.failed");
  return (
    <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBlockStart: 14, padding: "13px 15px", borderRadius: 12, background: warn ? "var(--warn-soft)" : "var(--danger-soft)", color: warn ? "var(--warn)" : "var(--danger)", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
      <Icon name="alert-circle" size={15} style={{ marginBlockStart: 2 }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span>{text}</span>
        {(error === "stopped" || error === "limit") && <span>{call}</span>}
        {error === "toomany" && (
          <button className="jn-nav" onClick={() => goDiner("large")} style={{ alignSelf: "flex-start", border: "none", background: "transparent", padding: 0, color: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer", textDecoration: "underline" }}>
            {t("cart.large")}
          </button>
        )}
      </span>
    </div>
  );
}

function PriceChanged() {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const changed = useDiner((s) => s.priceChanged);
  const titleId = useId();
  if (changed === null) return null;
  const back = () => {
    dismissPriceChanged();
    goDiner("cart");
  };
  return (
    <Modal labelledBy={titleId} width={440} z={600} onClose={back}>
      <div style={{ padding: 24 }}>
        <span className="jk-kicker" style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="tag" size={14} style={{ color: "var(--warn)" }} />
          {t("price.eyebrow")}
        </span>
        <h2 id={titleId} style={{ margin: "12px 0 0", fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", textWrap: "pretty" }}>
          {t("price.title")}
        </h2>
        {changed.lines.map((l, i) => (
          <div key={`${String(i)}-${l.name}`} style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBlockStart: 16, padding: "13px 15px", borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{l.name}</span>
            <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ color: "var(--fg-subtle)", textDecoration: "line-through" }}>{fmt.money(l.from)}</span> → {fmt.money(l.to)}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBlockStart: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{t("price.newTotal")}</span>
          <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 22, fontWeight: 600 }}>{fmt.money(changed.total)}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 24px 22px", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <button
          className="jn-btn"
          onClick={() =>
            void acceptNewPrice(locale).then((placed) => {
              if (placed !== null) void followPlaced(placed);
            })
          }
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 48, borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}
        >
          <Icon name="check" size={16} />
          <Rich text={t("price.place")} parts={{ total: <span className="jk-mono">{fmt.money(changed.total)}</span> }} />
        </button>
        <button className="jn-gi" onClick={back} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 46, borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {t("co.back")}
        </button>
      </div>
    </Modal>
  );
}

function SoldOut() {
  const { t } = useI18n();
  const fmt = useFmt();
  const day = useDay();
  const sold = useDiner((s) => s.soldOut);
  const dish = useDiner((s) => (s.soldOut === null ? undefined : s.data?.menu.dish(s.soldOut.dishId)));
  const titleId = useId();
  if (sold === null) return null;
  const name = dish?.name ?? "";
  const today = sold.day === day.today;
  const title = sold.short
    ? sold.left === null
      ? today
        ? t("soldout.fewerToday", { name })
        : t("soldout.fewerFor", { name, day: fmt.weekday(sold.day) })
      : today
        ? t("soldout.shortToday", { name, count: fmt.number(sold.left) }, sold.left)
        : t("soldout.shortFor", { name, count: fmt.number(sold.left), day: fmt.weekday(sold.day) }, sold.left)
    : today
      ? t("soldout.titleToday", { name })
      : t("soldout.titleFor", { name, day: fmt.weekday(sold.day) });
  const drop = () => {
    takeOff(sold.dishId);
    toast(t("soldout.dropped", { name }), "warn");
  };
  return (
    <Modal labelledBy={titleId} width={460} z={600} onClose={closeSoldOut}>
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <Tile hue={dish?.hue ?? 20} icon={dish?.icon ?? "utensils"} photo={null} radius={15} iconSize={26} style={{ width: 56, height: 56 }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>
            <Icon name="alert-circle" size={12} />
            {sold.short ? t("soldout.badgeShort") : t("soldout.badge")}
          </span>
        </div>
        <h2 id={titleId} style={{ margin: "16px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-.032em", textWrap: "pretty" }}>
          {title}
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{sold.short ? t("soldout.shortBody") : today ? t("soldout.bodyToday") : t("soldout.bodyFor", { day: fmt.weekday(sold.day) })}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 24px 22px", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <button
          className="jn-btn"
          onClick={() => {
            closeSoldOut();
            goDiner(sold.short ? "cart" : "menu", sold.short || dish?.categoryId == null ? {} : { category: dish.categoryId });
          }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 48, borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}
        >
          <Icon name={sold.short ? "pencil" : "utensils"} size={16} />
          {sold.short ? t("soldout.change") : t("cart.pickElse")}
        </button>
        <button className="jn-gi" onClick={drop} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height: 46, borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <Icon name="trash-2" size={15} />
          {t("cart.takeOff")}
        </button>
      </div>
    </Modal>
  );
}
