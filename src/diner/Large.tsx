/**
 * Large orders: how many people, which day, what they have in mind, who to
 * call — sent once as an enquiry Adminium files under its own reference, and
 * answered by a call from the kitchen.
 */
import { useId } from "react";

import { Bdi } from "../components/Bdi.tsx";
import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { EMAIL } from "../lib/format.ts";
import { asciiDigits } from "../lib/format.ts";
import { hoursOn } from "../lib/day.ts";
import { addDays, type Day } from "../lib/venueTime.ts";
import { useDiner } from "../state/diner.ts";
import { HEADS_MAX, HEADS_MIN, sendAnother, sendEnquiry, setLarge, settleHeads, stepHeads, touchLarge, typeHeads, useLarge } from "../state/large.ts";
import { goDiner } from "../state/ui.ts";
import { useFmt, useVenue } from "../app/venue.ts";
import { phoneBad } from "./Checkout.tsx";
import { useDay } from "./useDay.ts";

/**
 * What the enquiry's door takes in a note: 200 characters and four digits in
 * all (its `plainText` rule). The form used to offer 240 and any digits, so a
 * note with a time or a head count in it was refused with "Try again".
 */
export const NOTES_MAX = 200;
export const NOTES_DIGITS = 4;
/** Whether a note holds more digits than the door takes. */
export const tooManyDigits = (notes: string): boolean => (notes.match(/\p{Nd}/gu) ?? []).length > NOTES_DIGITS;

const fieldStyle = (bad: boolean): React.CSSProperties => ({ width: "100%", padding: "13px 15px", borderRadius: 12, border: `1px solid ${bad ? "var(--danger)" : "var(--border-strong)"}`, background: "var(--surface-2)", color: "var(--fg)", fontSize: 14.5, fontWeight: 600 });

export function LargePage() {
  const sent = useLarge((s) => s.sent);
  return sent === null ? <LargeForm /> : <LargeSent />;
}

function LargeForm() {
  const { t, locale } = useI18n();
  const fmt = useFmt();
  const venue = useVenue();
  const day = useDay();
  const data = useDiner((s) => s.data);
  const { form: f, touched, sending, failed } = useLarge();
  const ids = { heads: useId(), day: useId(), date: useId(), notes: useId(), name: useId(), phone: useId(), email: useId(), reason: useId() };
  const dates: Day[] = [];
  for (let d = 1; dates.length < 6 && d < 21; d += 1) {
    const candidate = addDays(day.today, d);
    if (data !== null && hoursOn(candidate, data.hours, data.closures).open) dates.push(candidate);
  }
  const otherClosed = f.date === "other" && f.other !== "" && data !== null && !hoursOn(f.other, data.hours, data.closures).open;
  const nameBad = f.name.trim().length < 2;
  const phoneWrong = f.phone.replace(/[^0-9]/g, "").length < 6 || phoneBad(f.phone);
  const emailBad = !EMAIL.test(f.email.trim());
  const noDay = f.date === "" || (f.date === "other" && f.other === "");
  const notesBad = tooManyDigits(f.notes);
  const reason = noDay ? t("large.block.day") : otherClosed ? t("large.closedDay") : notesBad ? t("large.notes.digits") : nameBad ? t("large.name.error") : phoneWrong ? t("large.phone.error") : emailBad ? t("large.email.error") : null;
  const blocked = reason !== null || sending;
  const err = { name: touched.name === true && nameBad, phone: touched.phone === true && phoneWrong, email: touched.email === true && emailBad };
  const send = () => {
    if (!blocked) void sendEnquiry(locale);
  };
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 680, paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("large.title")}</h1>
        <p style={{ margin: "10px 0 0", maxWidth: "52ch", fontSize: 15, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("large.intro")}</p>
        <fieldset disabled={sending} style={{ border: 0, padding: 0, margin: "26px 0 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <legend className="jn-sr">{t("large.legend")}</legend>
          <div className="jk-card" style={{ gap: 0 }}>
            <label htmlFor={ids.heads} className="jk-cardlabel" style={{ gap: 8 }}>
              <Icon name="users" size={14} style={{ color: "var(--accent-ink)" }} />
              {t("large.heads")}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBlockStart: 16 }}>
              <div style={{ flex: "none", display: "flex", alignItems: "center", border: "1px solid var(--border-strong)", borderRadius: 12, overflow: "hidden", background: "var(--surface-2)" }}>
                <button className="jn-gi" onClick={() => stepHeads(-1)} disabled={f.heads <= HEADS_MIN} aria-label={t("large.heads.less")} style={{ width: 46, height: 50, border: "none", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="minus" size={16} />
                </button>
                <input id={ids.heads} dir="ltr" value={f.headsText} onChange={(e) => typeHeads(asciiDigits(e.target.value))} onBlur={settleHeads} inputMode="numeric" aria-describedby={`${ids.heads}-hint`} style={{ width: 64, height: 50, border: "none", background: "transparent", textAlign: "center", color: "var(--fg)", fontFamily: "var(--mono)", fontSize: 20, fontWeight: 600 }} />
                <button className="jn-gi" onClick={() => stepHeads(1)} disabled={f.heads >= HEADS_MAX} aria-label={t("large.heads.more")} style={{ width: 46, height: 50, border: "none", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <span id={`${ids.heads}-hint`} style={{ flex: 1, minWidth: 180, fontSize: 13, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                {t("large.heads.hint")}
              </span>
            </div>
          </div>
          <div className="jk-card" style={{ gap: 0 }}>
            <span id={ids.day} className="jk-cardlabel" style={{ gap: 8 }}>
              <Icon name="calendar" size={14} style={{ color: "var(--accent-ink)" }} />
              {t("large.day")}
            </span>
            <div role="group" aria-labelledby={ids.day} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlockStart: 16 }}>
              {dates.map((d) => (
                <button key={d} className="jn-chip jk-chip" aria-pressed={f.date === d} onClick={() => setLarge({ date: d })}>
                  {fmt.dayShort(d)}
                </button>
              ))}
              <button className="jn-chip jk-chip" aria-pressed={f.date === "other"} onClick={() => setLarge({ date: "other" })}>
                {t("large.another")}
              </button>
            </div>
            {f.date === "other" && (
              <div style={{ marginBlockStart: 14, maxWidth: 240 }}>
                <label htmlFor={ids.date} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
                  {t("large.pickDate")}
                </label>
                <input id={ids.date} type="date" className="jn-fld" min={day.tomorrow} value={f.other} onChange={(e) => setLarge({ other: e.target.value })} aria-invalid={otherClosed} aria-describedby={otherClosed ? `${ids.date}-msg` : undefined} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${otherClosed ? "var(--danger)" : "var(--border-strong)"}`, background: "var(--surface-2)", color: "var(--fg)", fontFamily: "var(--mono)", fontSize: 14 }} />
                {otherClosed && (
                  <span id={`${ids.date}-msg`} role="alert" className="jk-error" style={{ marginBlockStart: 7, fontSize: 12, fontWeight: 600 }}>
                    <Icon name="alert-circle" size={13} />
                    {t("large.closedDay")}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="jk-card" style={{ gap: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <label htmlFor={ids.notes} className="jk-cardlabel" style={{ gap: 8 }}>
                <Icon name="message-square" size={14} style={{ color: "var(--accent-ink)" }} />
                {t("large.notes")}
              </label>
              <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 11.5, fontWeight: 500, color: "var(--fg-subtle)" }}>
                {t("sheet.count", { n: fmt.number(f.notes.length), max: fmt.number(NOTES_MAX) })}
              </span>
            </div>
            <textarea id={ids.notes} className="jn-fld" value={f.notes} onChange={(e) => setLarge({ notes: e.target.value.slice(0, NOTES_MAX) })} maxLength={NOTES_MAX} rows={3} placeholder={t("large.notes.placeholder")} style={{ width: "100%", marginBlockStart: 14, padding: "13px 15px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 14.5, lineHeight: 1.55, resize: "none" }} />
          </div>
          <div className="jk-card" style={{ gap: 0 }}>
            <span className="jk-cardlabel" style={{ gap: 8 }}>
              <Icon name="user-round" size={14} style={{ color: "var(--accent-ink)" }} />
              {t("large.who")}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBlockStart: 16 }}>
              <LargeField id={ids.name} label={t("co.name")} error={err.name ? t("large.name.error") : null} hint={t("large.name.hint")}>
                <input id={ids.name} className="jn-fld" autoComplete="name" maxLength={80} value={f.name} onChange={(e) => setLarge({ name: e.target.value })} onBlur={() => touchLarge("name")} placeholder={t("co.name.hint")} aria-invalid={err.name} aria-describedby={`${ids.name}-msg`} style={fieldStyle(err.name)} />
              </LargeField>
              <LargeField id={ids.phone} label={t("large.phone")} error={err.phone ? t("large.phone.error") : null} hint={t("large.phone.hint")}>
                <input id={ids.phone} className="jn-fld" type="tel" dir="ltr" autoComplete="tel" maxLength={32} value={f.phone} onChange={(e) => setLarge({ phone: asciiDigits(e.target.value) })} onBlur={() => touchLarge("phone")} placeholder={t("co.phone.placeholder")} aria-invalid={err.phone} aria-describedby={`${ids.phone}-msg`} style={fieldStyle(err.phone)} />
              </LargeField>
              <div style={{ gridColumn: "1/-1" }}>
                <LargeField id={ids.email} label={t("co.email")} error={err.email ? t("large.email.error") : null} hint={t("large.email.hint")}>
                  <input id={ids.email} className="jn-fld" type="email" dir="ltr" autoComplete="email" maxLength={254} value={f.email} onChange={(e) => setLarge({ email: e.target.value })} onBlur={() => touchLarge("email")} placeholder={t("co.email.placeholder")} aria-invalid={err.email} aria-describedby={`${ids.email}-msg`} style={fieldStyle(err.email)} />
                </LargeField>
              </div>
            </div>
          </div>
        </fieldset>
        {failed !== false && (
          <div role="alert" className="jk-notice" style={{ marginBlockStart: 16, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 13.5, borderRadius: 12 }}>
            <Icon name="wifi-off" size={15} style={{ marginBlockStart: 2 }} />
            <span>{failed === "limit" ? (venue.phone === null ? t("large.limitNoPhone") : t("large.limit", { phone: `\u2066${venue.phone}\u2069` })) : failed === "notes" ? t("large.notes.digits") : t("large.failed")}</span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBlockStart: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <button className="jn-btn" onClick={send} disabled={blocked} aria-describedby={reason !== null ? ids.reason : undefined} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 50, paddingInline: 26, borderRadius: 13, border: "none", background: reason !== null ? "var(--surface-3)" : "var(--accent)", color: reason !== null ? "var(--fg-subtle)" : "var(--accent-fg)", fontSize: 15, fontWeight: 800, cursor: blocked ? "not-allowed" : "pointer" }}>
              {sending ? <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} /> : <Icon name="send" size={16} />}
              {sending ? t("large.sending") : t("large.send")}
            </button>
            {reason !== null && (
              <span id={ids.reason} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
                <Icon name="info" size={13} />
                {reason}
              </span>
            )}
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--fg-muted)" }}>
            <Icon name="phone-call" size={14} style={{ color: "var(--accent-ink)" }} />
            {t("large.promise")}
          </span>
        </div>
      </div>
    </div>
  );
}

function LargeField({ id, label, hint, error, children }: { id: string; label: string; hint: string; error: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
        {label}
      </label>
      {children}
      {error !== null ? (
        <span id={`${id}-msg`} role="alert" className="jk-error" style={{ marginBlockStart: 7, fontSize: 12, fontWeight: 600 }}>
          <Icon name="alert-circle" size={13} />
          {error}
        </span>
      ) : (
        <span id={`${id}-msg`} className="jk-hint" style={{ display: "block", marginBlockStart: 7 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function LargeSent() {
  const { t } = useI18n();
  const fmt = useFmt();
  const sent = useLarge((s) => s.sent)!;
  const heads = Number(sent["heads"] ?? 0);
  const wanted = String(sent["wanted_on"] ?? "");
  const phone = String(sent["phone"] ?? useLarge.getState().form.phone);
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 680, paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 15, paddingBlock: "clamp(26px,5vw,60px)" }}>
          <span style={{ width: 82, height: 82, borderRadius: 24, background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center", animation: "jn-check .4s cubic-bezier(.2,.9,.3,1)" }}>
            <Icon name="check" size={40} />
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(25px,3.8vw,38px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("large.sent.title")}</h1>
          <p style={{ margin: 0, maxWidth: "40ch", fontSize: 15, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
            {t("large.sent.body", { phone: `\u2066${phone}\u2069` })}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, width: "100%", maxWidth: 460, marginBlockStart: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "17px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "start" }}>
              <span className="jk-kicker">{t("large.sent.ref")}</span>
              <span className="jk-mono" style={{ fontSize: 19, fontWeight: 600 }}>
                <Bdi>{String(sent["ref"] ?? "")}</Bdi>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "17px 18px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "start" }}>
              <span className="jk-kicker">{t("large.sent.enquiry")}</span>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.015em" }}>{t("large.sent.summary", { heads: fmt.number(heads), day: wanted === "" ? "" : fmt.dayShort(wanted) }, heads)}</span>
            </div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>
            <Icon name="mail" size={14} />
            {t("large.sent.emailed")}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 11, justifyContent: "center", marginBlockStart: 10 }}>
            <button className="jn-btn jk-btn-primary" onClick={() => goDiner("menu")} style={{ padding: "14px 23px", fontSize: 14.5 }}>
              <Icon name="utensils" size={16} />
              {t("home.cta.menu")}
            </button>
            <button className="jn-gi jk-btn-ghost" onClick={sendAnother} style={{ padding: "14px 21px", fontSize: 14.5 }}>
              <Icon name="rotate-ccw" size={16} />
              {t("large.sent.another")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
