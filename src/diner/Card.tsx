/**
 * A gift card's balance — the page Offers & gift cards' own email links to,
 * and a diner can open from the footer. One field: the code on the card.
 * It answers what is on the card and until when it can be used, and nothing
 * else: no holder, no history, and one sentence for every code that is not a
 * card that can still pay.
 *
 * While Offers & gift cards is not in use for the kitchen this address is the
 * page-not-found page: there is nothing here to ask.
 */
import { useId, useState } from "react";

import { Icon } from "../components/Icon.tsx";
import { useI18n } from "../i18n/index.tsx";
import { sources } from "../data/sources.ts";
import { isApiError } from "../data/wire.ts";
import { cardAsKept, useDiner } from "../state/diner.ts";
import { goDiner } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";
import { NotFound } from "./Track.tsx";

type Answer = { kind: "idle" } | { kind: "busy" } | { kind: "invalid" } | { kind: "wait" } | { kind: "failed" } | { kind: "card"; balance: string; expiresOn: string | null };

export function CardPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const loaded = useDiner((s) => s.load);
  const offers = useDiner((s) => s.data?.offers === true);
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState<Answer>({ kind: "idle" });
  const id = useId();
  if (loaded === "ok" && !offers) return <NotFound />;
  const ask = async () => {
    if (answer.kind === "busy") return;
    // Twelve characters after the prefix, or it is no card: said without asking, and no guess is spent.
    const kept = cardAsKept(code);
    if (kept === null) return setAnswer({ kind: "invalid" });
    setAnswer({ kind: "busy" });
    try {
      const card = await sources().diner.cardBalance({ code: kept });
      setAnswer(card === null ? { kind: "invalid" } : { kind: "card", ...card });
    } catch (error) {
      // Not reached, or the kitchen's side failed: said as that, never as a card that is not valid.
      const unreached = !isApiError(error) || error.status === 0 || error.status >= 500;
      setAnswer(unreached ? { kind: "failed" } : error.code === "PUBLIC_RATE_LIMITED" ? { kind: "wait" } : { kind: "invalid" });
    }
  };
  const bad = answer.kind === "invalid" || answer.kind === "wait" || answer.kind === "failed";
  return (
    <div className="jn-view jk-shell">
      <div style={{ maxWidth: 520, paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
        <h1 id="jn-view-title" tabIndex={-1} style={{ margin: "0 0 10px", fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em", outline: "none" }}>
          {t("card.title")}
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 15, lineHeight: 1.55, color: "var(--fg-muted)" }}>{t("card.intro")}</p>
        <div style={{ padding: 20, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <label htmlFor={id} style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBlockEnd: 7 }}>
            {t("card.label")}
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id={id}
              className="jn-fld jk-mono"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={24}
              value={code}
              placeholder="GC-0000-0000-0000"
              aria-invalid={bad}
              aria-describedby={bad ? `${id}-msg` : undefined}
              onChange={(e) => {
                setCode(e.target.value);
                if (answer.kind !== "idle") setAnswer({ kind: "idle" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ask();
              }}
              style={{ flex: "1 1 220px", minWidth: 0, height: 48, paddingInline: 14, borderRadius: 12, border: `1px solid ${bad ? "var(--danger)" : "var(--border-strong)"}`, background: "var(--surface-2)", color: "var(--fg)", fontSize: 15, letterSpacing: ".04em", textTransform: "uppercase" }}
            />
            <button className="jn-btn" onClick={() => void ask()} disabled={answer.kind === "busy" || code.trim() === ""} aria-busy={answer.kind === "busy"} style={{ flex: "none", height: 48, paddingInline: 18, borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {answer.kind === "busy" ? t("card.checking") : t("card.check")}
            </button>
          </div>
          {bad && (
            <span id={`${id}-msg`} role="alert" style={{ display: "flex", alignItems: "center", gap: 6, marginBlockStart: 9, fontSize: 12.5, fontWeight: 600, color: "var(--danger)" }}>
              <Icon name="alert-circle" size={13} />
              {answer.kind === "wait" ? t("co.err.busy") : answer.kind === "failed" ? t("card.failed") : t("card.invalid")}
            </span>
          )}
          {answer.kind === "card" && (
            <div role="status" style={{ display: "flex", flexDirection: "column", gap: 4, marginBlockStart: 16, padding: "16px 18px", borderRadius: 14, background: "var(--pos-soft)", border: "1px solid var(--border)" }}>
              <span className="jk-kicker" style={{ color: "var(--pos)" }}>{t("card.balance")}</span>
              <span className="jk-mono" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.02em", color: "var(--fg)" }}>{fmt.money(answer.balance)}</span>
              <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{answer.expiresOn === null ? t("card.noExpiry") : t("card.useBy", { date: fmt.dayLong(answer.expiresOn) })}</span>
            </div>
          )}
        </div>
        {answer.kind === "card" && (
          <button className="jn-btn jk-btn-primary" onClick={() => goDiner("menu")} style={{ marginBlockStart: 18 }}>
            <Icon name="utensils" size={17} />
            {t("card.order")}
          </button>
        )}
      </div>
    </div>
  );
}
