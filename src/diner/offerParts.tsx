/**
 * A code and a gift card at checkout — shown only while Offers & gift cards is
 * in use for the kitchen. Each starts as a link, opens to one field, and is
 * replaced by what Adminium answered: the code as applied, or what the card
 * pays and what is left for the counter.
 *
 * Nothing here knows what a code is worth or what a card holds: "Apply" asks
 * Adminium to price the order with it, and the answer is the only thing shown.
 * A refusal is one plain sentence under the field. A gift card's balance, its
 * holder and why it was refused are never told to the page, so never shown.
 */
import { useId, useRef, useState } from "react";

import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { applyCard, applyCode, clearCardError, clearCodeError, freshQuote, removeCode, setOfferDraft, useDiner, type CardError, type CodeError } from "../state/diner.ts";
import { goDiner } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";

const inputStyle = (bad: boolean): React.CSSProperties => ({
  flex: 1,
  minWidth: 0,
  height: 48,
  paddingInline: 14,
  borderRadius: 12,
  border: `1px solid ${bad ? "var(--danger)" : "var(--border-strong)"}`,
  background: "var(--surface-2)",
  color: "var(--fg)",
  fontSize: 14,
  letterSpacing: ".04em",
  textTransform: "uppercase",
});

const linkStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, minHeight: 32, border: "none", background: "transparent", padding: 0, color: "var(--accent-ink)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const noteStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8, padding: "11px 13px", borderRadius: 12, background: "var(--pos-soft, var(--surface-2))", border: "1px solid var(--border)", color: "var(--pos)", fontSize: 13, fontWeight: 700, lineHeight: 1.45 };

/** One field with its "Apply": the word stays the button's name while it is busy, for a reader that cannot see the spinner. */
function ApplyField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onApply,
  busy,
  error,
  inputRef,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  onApply: () => void;
  busy: boolean;
  error: React.ReactNode | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id={id}
          ref={inputRef}
          className="jn-fld jk-mono"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          value={value}
          placeholder={placeholder}
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${id}-msg` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply();
            }
          }}
          style={inputStyle(error !== null)}
        />
        <button
          className="jn-btn"
          onClick={onApply}
          disabled={busy || value.trim() === ""}
          aria-busy={busy}
          style={{ flex: "none", minWidth: 84, height: 48, paddingInline: 16, borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {busy && <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} />}
          <span style={busy ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" } : undefined}>{busy ? t("offers.checking") : t("offers.apply")}</span>
        </button>
      </div>
      {error !== null && (
        <span id={`${id}-msg`} role="alert" style={{ display: "flex", alignItems: "center", gap: 6, marginBlockStart: 7, fontSize: 12, fontWeight: 600, color: "var(--danger)" }}>
          <Icon name="alert-circle" size={13} />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}

/** What a refused code says, in the diner's words. */
function CodeWords({ error }: { error: CodeError }) {
  const { t } = useI18n();
  const fmt = useFmt();
  if (error.kind === "minimum") return <>{t("offers.code.minimum", { amount: fmt.money(error.amount) })}</>;
  if (error.kind === "items") return <>{t("offers.code.items")}</>;
  if (error.kind === "busy") return <>{t("co.err.busy")}</>;
  if (error.kind === "off") return <>{t("offers.off")}</>;
  if (error.kind === "signin") {
    return (
      <>
        {t("offers.code.signin")}{" "}
        <button className="jn-nav" onClick={() => goDiner("orders")} style={{ border: "none", background: "transparent", padding: 0, color: "var(--accent-ink)", fontSize: 12, fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
          {t("offers.code.signinLink")}
        </button>
      </>
    );
  }
  return <>{t("offers.code.invalid")}</>;
}

/** What a refused gift card says: one sentence for every cause. */
function CardWords({ error }: { error: CardError }) {
  const { t } = useI18n();
  return <>{error === "busy" ? t("co.err.busy") : error === "off" ? t("offers.off") : t("offers.card.invalid")}</>;
}

/** The two fields, under the totals. Renders nothing while Offers & gift cards is not in use. */
export function OfferFields() {
  const { t } = useI18n();
  const fmt = useFmt();
  const on = useDiner((s) => s.data?.offers === true);
  const code = useDiner((s) => s.code);
  const card = useDiner((s) => s.card);
  const checking = useDiner((s) => s.checking);
  const codeError = useDiner((s) => s.codeError);
  const cardError = useDiner((s) => s.cardError);
  const fresh = useDiner(() => freshQuote());
  const [codeOpen, setCodeOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  // Kept with the order, not here: what is typed and not applied is asked about before the order is placed.
  const codeDraft = useDiner((s) => s.codeDraft);
  const cardDraft = useDiner((s) => s.cardDraft);
  const setCodeDraft = (text: string) => setOfferDraft("code", text);
  const setCardDraft = (text: string) => setOfferDraft("card", text);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLInputElement | null>(null);
  const codeDoneRef = useRef<HTMLSpanElement | null>(null);
  const cardDoneRef = useRef<HTMLDivElement | null>(null);
  const codeId = useId();
  const cardId = useId();
  if (!on) return null;
  const open = (which: "code" | "card") => {
    if (which === "code") setCodeOpen(true);
    else setCardOpen(true);
    requestAnimationFrame(() => (which === "code" ? codeRef : cardRef).current?.focus());
  };
  const sendCode = async () => {
    if (await applyCode(codeDraft)) {
      setCodeDraft("");
      setCodeOpen(false);
      // The field is gone: what took its place is where the reader is.
      requestAnimationFrame(() => codeDoneRef.current?.focus());
    } else codeRef.current?.focus();
  };
  const sendCard = async () => {
    if (await applyCard(cardDraft)) {
      setCardDraft("");
      setCardOpen(false);
      requestAnimationFrame(() => cardDoneRef.current?.focus());
    } else cardRef.current?.focus();
  };
  const told = fresh?.told ?? [];
  const payment = fresh?.payment ?? null;
  // A refusal that took the code or the card off (the cart changed, it ran out) opens its field again, to say why.
  const showCode = code === null && (codeOpen || codeError !== null || codeDraft !== "");
  const showCard = card === null && (cardOpen || cardError !== null || cardDraft !== "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBlockStart: 14 }}>
      {code !== null ? (
        <span ref={codeDoneRef} tabIndex={-1} role="status" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--pos)", outline: "none" }}>
          <Icon name="check" size={15} />
          <span>
            <bdi className="jk-mono">{t("offers.code.applied", { code })}</bdi>
          </span>
          {/* A code a better offer beat has no row among the totals to take it off from: taken off here. */}
          {fresh !== null && !(fresh.applied ?? []).some((one) => one.typed) && (
            <button className="jn-nav" onClick={() => { removeCode(); requestAnimationFrame(() => document.getElementById("jn-offer-code-open")?.focus()); }} aria-label={t("offers.remove.code", { name: code })} style={{ border: "none", background: "transparent", paddingBlock: 6, paddingInline: 6, marginBlock: -6, color: "var(--fg-subtle)", fontSize: 12, fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
              {t("offers.remove")}
            </button>
          )}
        </span>
      ) : showCode ? (
        <ApplyField
          id={codeId}
          label={t("offers.code.link")}
          value={codeDraft}
          onChange={(text) => {
            setCodeDraft(text);
            clearCodeError();
          }}
          onApply={() => void sendCode()}
          busy={checking === "code"}
          error={codeError === null ? null : <CodeWords error={codeError} />}
          inputRef={codeRef}
        />
      ) : (
        <button id="jn-offer-code-open" className="jn-nav" onClick={() => open("code")} style={linkStyle}>
          <Icon name="ticket" size={15} />
          {t("offers.code.link")}
        </button>
      )}
      {told.map((one) => (
        <span key={one.column} role="status" style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--fg-muted)" }}>
          {t("offers.better", { name: one.name })}
        </span>
      ))}
      {card !== null && payment === null ? (
        // The card is on the order and the order is being priced again: said, never a link that does nothing.
        <span role="status" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>{t("totals.checking")}</span>
      ) : card !== null && payment !== null ? (
        <div ref={cardDoneRef} tabIndex={-1} role="status" style={{ ...noteStyle, outline: "none" }}>
          <Icon name="gift" size={15} style={{ flex: "none", marginBlockStart: 2 }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>{Number(payment.due) > 0 ? t("offers.card.split", { paid: fmt.money(payment.amount), due: fmt.money(payment.due) }) : t("offers.card.full")}</span>
            <span style={{ fontWeight: 600, color: "var(--fg-muted)" }}>{t("offers.card.when", { paid: fmt.money(payment.amount) })}</span>
          </span>
        </div>
      ) : showCard ? (
        <ApplyField
          id={cardId}
          label={t("offers.card.label")}
          placeholder="GC-0000-0000-0000"
          value={cardDraft}
          onChange={(text) => {
            setCardDraft(text);
            clearCardError();
          }}
          onApply={() => void sendCard()}
          busy={checking === "card"}
          error={cardError === null ? null : <CardWords error={cardError} />}
          inputRef={cardRef}
        />
      ) : (
        <button id="jn-offer-card-open" className="jn-nav" onClick={() => open("card")} style={linkStyle}>
          <Icon name="gift" size={15} />
          {t("offers.card.link")}
        </button>
      )}
    </div>
  );
}

/** Above "Place order" after a save whose price moved because a code no longer applies. */
export function PriceMoved() {
  const { t } = useI18n();
  const moved = useDiner((s) => s.priceMoved);
  if (!moved) return null;
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 9, marginBlockStart: 14, padding: "12px 14px", borderRadius: 12, background: "var(--warn-soft, var(--surface-2))", border: "1px solid var(--border)", color: "var(--warn)", fontSize: 13, fontWeight: 700 }}>
      <Icon name="triangle-alert" size={15} />
      {t("offers.priceMoved")}
    </div>
  );
}
