/**
 * The one toast: a short line at the foot of the screen, with the kitchen's
 * Undo for ten seconds. It holds while the pointer or focus is on it.
 */
import { useT } from "../i18n/index.tsx";
import { dismissToast, holdToast, useUi } from "../state/ui.ts";
import { Icon } from "./Icon.tsx";
import { useNarrow } from "./Modal.tsx";
import { useDiner } from "../state/diner.ts";

export function Toaster() {
  const t = useT();
  const toast = useUi((s) => s.toast);
  const undoable = toast?.undo !== undefined;
  const phone = useNarrow(620);
  // A bottom sheet's action bar sits where the toast would: on a phone, the toast rises above it.
  const sheetUp = useDiner((s) => s.drawer || s.sheet !== null) && phone;
  return (
    <div role="status" aria-live="polite" style={{ position: "fixed", insetInline: 0, insetBlockEnd: sheetUp ? 196 : 26, zIndex: 900, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      {toast !== null && (
        <div
          key={toast.id}
          onMouseEnter={() => holdToast(true, undoable)}
          onMouseLeave={() => holdToast(false, undoable)}
          onFocus={() => holdToast(true, undoable)}
          onBlur={() => holdToast(false, undoable)}
          style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: "calc(100% - 32px)", padding: undoable ? "8px 8px 8px 18px" : "12px 20px", paddingInlineStart: undoable ? 18 : 20, borderRadius: 999, background: "var(--fg)", color: "var(--bg)", fontSize: 13, fontWeight: 700, boxShadow: "0 14px 36px rgba(10,10,20,.34)", pointerEvents: undoable ? "auto" : "none", animation: "jn-fade .24s cubic-bezier(.2,.8,.2,1)" }}
        >
          <Icon name={toast.kind === "warn" ? "alert-circle" : toast.kind === "bell" ? "bell-ring" : "check-circle-2"} size={15} />
          <span>{toast.message}</span>
          {toast.suffix !== undefined && <span style={{ marginInlineStart: -6 }}>{toast.suffix}</span>}
          {toast.undo !== undefined && (
            <button
              onClick={() => {
                toast.undo?.();
                dismissToast();
              }}
              style={{ marginInlineStart: 4, height: 28, paddingInline: 11, borderRadius: 999, border: "1px solid color-mix(in srgb, var(--bg) 40%, transparent)", background: "transparent", color: "var(--bg)", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
            >
              {toast.actionLabel ?? t("shell.toast.undo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
