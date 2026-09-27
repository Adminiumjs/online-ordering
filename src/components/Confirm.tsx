/** A question before something that cannot be taken back: a title, a line, and its answers. */
import { useId, type ReactNode } from "react";

import { Modal } from "./Modal.tsx";

export interface ConfirmButton {
  id: string;
  label: string;
  kind: "primary" | "ghost" | "danger";
  onClick: () => void;
  busy?: boolean;
}

export function ConfirmDialog({ title, body, buttons, onClose, children }: { title: string; body?: ReactNode; buttons: ConfirmButton[]; onClose: () => void; children?: ReactNode }) {
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} width={440} z={600} onClose={onClose}>
      <div style={{ padding: "24px 24px 8px" }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", textWrap: "pretty" }}>
          {title}
        </h2>
        {body !== undefined && <p style={{ margin: "9px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{body}</p>}
        {children}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9, padding: "16px 24px 22px" }}>
        {buttons.map((b) => (
          <button
            key={b.id}
            className={b.kind === "ghost" ? "jn-gi" : "jn-btn"}
            onClick={b.onClick}
            disabled={b.busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, paddingInline: 17, borderRadius: 12, border: b.kind === "ghost" ? "1px solid var(--border-strong)" : "none", background: b.kind === "danger" ? "var(--danger)" : b.kind === "ghost" ? "var(--surface)" : "var(--accent)", color: b.kind === "danger" ? "var(--on-danger)" : b.kind === "ghost" ? "var(--fg)" : "var(--accent-fg)", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
          >
            {b.busy === true && <span aria-hidden="true" style={{ flex: "none", width: 14, height: 14, borderRadius: 999, border: "2px solid currentColor", borderInlineEndColor: "transparent", animation: "jn-spin .75s linear infinite" }} />}
            {b.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
