/**
 * The cart, twice: the drawer that opens from any page (a side panel, a
 * bottom sheet on a phone) and the full order page. Both show the lines, the
 * pickup time and Adminium's totals, and lead to checkout.
 */
import { useId, useRef } from "react";

import { Icon } from "../components/Icon.tsx";
import { useDialogFocus, useNarrow } from "../components/Modal.tsx";
import { useI18n } from "../i18n/index.tsx";
import { cartCount, setDrawer, useDiner } from "../state/diner.ts";
import { goDiner } from "../state/ui.ts";
import { useFmt } from "../app/venue.ts";
import { CartLineRow, EmptyCart, PickupPicker, Totals, useCheckoutBlock, useLineStates } from "./cartParts.tsx";

export function PickupCard({ compact }: { compact: boolean }) {
  const { t } = useI18n();
  return (
    <div style={compact ? { marginBlockStart: 16, padding: 15, borderRadius: 15, background: "var(--surface-2)", border: "1px solid var(--border)" } : { padding: 20, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="jk-cardlabel" style={compact ? { fontSize: 10.5, gap: 8 } : { gap: 8 }}>
        <Icon name="timer" size={compact ? 13 : 14} style={{ color: "var(--accent-ink)" }} />
        {t("pick.title")}
      </span>
      <PickupPicker compact={compact} />
    </div>
  );
}

function CheckoutButton({ height, onGo }: { height: number; onGo: () => void }) {
  const { t } = useI18n();
  const block = useCheckoutBlock();
  const reasonId = useId();
  return (
    <>
      <button className="jn-btn" onClick={onGo} disabled={block !== null} aria-describedby={block !== null ? reasonId : undefined} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, height, borderRadius: 13, border: "none", background: "var(--accent)", color: "var(--accent-fg)", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
        <Icon name="arrow-right" size={17} className="jk-flip" />
        {t("cart.checkout")}
      </button>
      {block !== null && (
        <span id={reasonId} style={{ display: "flex", alignItems: "center", gap: 7, marginBlockStart: 10, fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
          <Icon name="info" size={13} />
          {block}
        </span>
      )}
    </>
  );
}

export function CartDrawer() {
  const open = useDiner((s) => s.drawer);
  if (!open) return null;
  return <DrawerBody />;
}

function DrawerBody() {
  const { t, dir } = useI18n();
  const fmt = useFmt();
  const phone = useNarrow(620);
  const cart = useDiner((s) => s.cart);
  const { states } = useLineStates();
  const panel = useRef<HTMLElement>(null);
  const close = () => setDrawer(false);
  useDialogFocus(panel, close);
  const count = cartCount(cart);
  const panelStyle: React.CSSProperties = phone
    ? { position: "absolute", insetInline: 0, insetBlockEnd: 0, maxHeight: "92%", display: "flex", flexDirection: "column", background: "var(--surface)", borderStartStartRadius: 22, borderStartEndRadius: 22, borderBlockStart: "1px solid var(--border)", animation: "jn-bottom .26s cubic-bezier(.2,.8,.2,1)" }
    : { position: "absolute", insetBlock: 0, insetInlineEnd: 0, width: "min(420px,94%)", display: "flex", flexDirection: "column", background: "var(--surface)", borderInlineStart: "1px solid var(--border)", animation: `${dir === "rtl" ? "jn-drawer-rtl" : "jn-drawer"} .26s cubic-bezier(.2,.8,.2,1)` };
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 480, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "jn-scrim .18s ease" }}>
      <aside ref={panel} role="dialog" aria-modal="true" aria-label={t("cart.title")} onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "18px 20px", borderBlockEnd: "1px solid var(--border)" }}>
          <span style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-.03em" }}>{t("cart.title")}</span>
          {count > 0 && (
            <span className="jk-mono" style={{ minWidth: 22, height: 22, paddingInline: 7, borderRadius: 7, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {fmt.number(count)}
            </span>
          )}
          <button className="jn-gi jk-iconbtn is-sm" onClick={close} aria-label={t("cart.close")} style={{ marginInlineStart: "auto" }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {cart.length === 0 ? (
          <EmptyCart large={false} />
        ) : (
          <>
            <div className="jn-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {cart.map((line, i) => (
                  <CartLineRow key={line.key} line={line} index={i} state={states.get(line.key)!} size="sm" />
                ))}
              </div>
              <PickupCard compact />
            </div>
            <div style={{ flex: "none", padding: "16px 20px 20px", borderBlockStart: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <Totals gap={8} />
              <div style={{ marginBlockStart: 14 }}>
                <CheckoutButton
                  height={50}
                  onGo={() => {
                    close();
                    goDiner("checkout");
                  }}
                />
              </div>
              <button
                className="jn-nav"
                onClick={() => {
                  close();
                  goDiner("cart");
                }}
                style={{ width: "100%", marginBlockStart: 10, border: "none", background: "transparent", padding: 0, color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                {t("cart.fullPage")}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function CartPage() {
  const { t } = useI18n();
  const narrow = useNarrow(860);
  const cart = useDiner((s) => s.cart);
  const { states } = useLineStates();
  return (
    <div className="jn-view jk-shell">
      <div style={{ paddingBlock: "clamp(24px,4vw,42px) clamp(34px,5vw,62px)" }}>
        <h1 style={{ margin: "0 0 22px", fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, letterSpacing: "-.038em" }}>{t("cart.title")}</h1>
        {cart.length === 0 ? (
          <EmptyCart large />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 340px", gap: "clamp(16px,2.5vw,28px)", alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              {cart.map((line, i) => (
                <CartLineRow key={line.key} line={line} index={i} state={states.get(line.key)!} size="lg" />
              ))}
              <button className="jn-gi jk-btn-ghost" onClick={() => goDiner("menu")} style={{ alignSelf: "flex-start", padding: "12px 18px", borderRadius: 12, fontSize: 13.5 }}>
                <Icon name="plus" size={15} />
                {t("cart.addMore")}
              </button>
            </div>
            <aside style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <PickupCard compact={false} />
              <div style={{ padding: 20, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Totals gap={10} />
                <div style={{ marginBlockStart: 18 }}>
                  <CheckoutButton height={50} onGo={() => goDiner("checkout")} />
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
