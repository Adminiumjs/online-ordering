/**
 * The pickup shelf: every ready bag by number, how long it has waited, what
 * to collect, and the hand-off.
 */
import { Icon } from "../components/Icon.tsx";
import { useNow } from "../data/sources.ts";
import { useI18n } from "../i18n/index.tsx";
import { num, useKitchen } from "../state/kitchen.ts";
import { useUi } from "../state/ui.ts";
import { useBoard } from "./Board.tsx";
import { useKFmt } from "./fmt.ts";

export function Shelf() {
  const { t } = useI18n();
  const fmt = useKFmt();
  const now = useNow();
  const dark = useUi((s) => s.theme) === "dark";
  const ready = useBoard().filter((o) => o.order["status"] === "ready");
  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ margin: 0, fontSize: "clamp(19px,2.4vw,24px)", fontWeight: 800, letterSpacing: "-.03em" }}>{t("kitchen.shelf.title")}</h2>
      <p style={{ margin: "9px 0 0", maxWidth: "60ch", fontSize: 13.5, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("kitchen.shelf.intro")}</p>
      {ready.length === 0 && <div style={{ marginBlockStart: 20, padding: "44px 24px", border: "1px dashed var(--border-strong)", borderRadius: 18, textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("kitchen.shelf.empty")}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBlockStart: 20 }}>
        {ready.map((order) => {
          const o = order.order;
          const past = Math.floor((now - Date.parse(String(o["pickup_at"]))) / 60_000);
          const late = past >= 30;
          const onShelf = Math.max(0, Math.floor((now - Date.parse(String(o["ready_at"] ?? o["pickup_at"]))) / 60_000));
          const items = num(o["item_count"], order.lines.reduce((n, l) => n + num(l["qty"], 1), 0));
          return (
            <div key={o.id} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18, borderRadius: 17, background: "var(--surface)", border: `1px solid ${late ? "var(--warn)" : "var(--pos-soft)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span className="jk-mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>
                  {t("confirm.number", { number: String(o["number"]) })}
                </span>
                <span style={{ marginInlineStart: "auto", padding: late ? "4px 9px" : 0, borderRadius: 999, background: late ? "var(--warn-soft)" : "transparent", color: late ? "var(--warn)" : "var(--fg-subtle)", fontSize: 11.5, fontWeight: late ? 800 : 600 }}>
                  {late ? t("kitchen.shelf.late", { minutes: fmt.number(past) }) : t("kitchen.shelf.waiting", { minutes: fmt.number(onShelf) })}
                </span>
              </div>
              <div>
                <bdi style={{ display: "block", fontSize: 15, fontWeight: 800, letterSpacing: "-.022em" }}>{String(o["name"] ?? "")}</bdi>
                <span style={{ display: "block", marginBlockStart: 3, fontSize: 12.5, color: "var(--fg-muted)" }}>
                  {t("kitchen.shelf.items", { count: fmt.number(items) }, items)} · {t("kitchen.pickup").toLocaleLowerCase()}{" "}
                  <span className="jk-mono" style={{ fontWeight: 600 }}>
                    {fmt.time(String(o["pickup_at"]))}
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "10px 12px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>{t("kitchen.collect")}</span>
                <span className="jk-mono" style={{ marginInlineStart: "auto", fontSize: 17, fontWeight: 600 }}>
                  {fmt.money(o["total"])}
                </span>
              </div>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="jn-btn" onClick={() => useKitchen.setState({ handoff: { id: o.id, paid: null, busy: false } })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 12, border: "none", background: "var(--pos)", color: dark ? "#0f0f14" : "#ffffff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                  <Icon name="scan-line" size={16} />
                  {t("kitchen.btn.handOff")}
                </button>
                <button className="jn-gi jk-iconbtn" onClick={() => useKitchen.setState({ ticket: o.id })} aria-label={t("kitchen.openTicketShort", { number: String(o["number"]) })} title={t("kitchen.openTicketShort", { number: String(o["number"]) })} style={{ width: 46, height: 46, borderRadius: 12, borderColor: "var(--border-strong)" }}>
                  <Icon name="receipt-text" size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
