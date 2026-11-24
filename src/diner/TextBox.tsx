/**
 * "Text me when my order is ready": the checkout's box for the ready text,
 * under the mobile field.
 *
 * It is the diner's own and nobody else's: shown only once a number is typed
 * (and only while the kitchen offers texts), never ticked for them, never
 * needed to order, and apart from the newsletter's tick, which never ticks it.
 * Its three lines are the wording Adminium's text consent log keeps
 * (`manifest/people.ts`, `TEXT_BOX`). A number in mainland China takes no
 * texts: the box is off there, a line says why, and the number stays for a
 * call.
 */
import { useI18n } from "../i18n/index.tsx";
import { mainlandChina } from "../lib/textPhone.ts";
import { setTextsOk, textsOffered, useDiner } from "../state/diner.ts";

export function TextBox() {
  const { t } = useI18n();
  const phone = useDiner((s) => s.form.phone);
  const ticked = useDiner((s) => s.form.textsOk);
  const offered = useDiner((s) => textsOffered(s.data?.settings));
  if (!offered || phone.trim() === "") return null;
  const china = mainlandChina(phone);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBlockStart: 12 }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, fontWeight: 600, cursor: china ? "default" : "pointer", color: china ? "var(--fg-subtle)" : "var(--fg)" }}>
        <input
          id="jn-co-texts"
          type="checkbox"
          checked={ticked && !china}
          disabled={china}
          onChange={(e) => setTextsOk(e.target.checked)}
          aria-describedby="jn-co-texts-msg"
          style={{ inlineSize: 18, blockSize: 18, margin: 0, marginBlockStart: 1, flexShrink: 0, accentColor: "var(--accent)", cursor: china ? "default" : "pointer" }}
        />
        <span>{t("co.texts")}</span>
      </label>
      <span id="jn-co-texts-msg" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 2, paddingInlineStart: 28, fontSize: 12, lineHeight: 1.45, color: "var(--fg-subtle)" }}>
        {china ? (
          <span>{t("co.texts.china")}</span>
        ) : (
          <>
            <span>{t("co.texts.note")}</span>
            <span>{t("co.texts.optional")}</span>
          </>
        )}
      </span>
    </div>
  );
}
