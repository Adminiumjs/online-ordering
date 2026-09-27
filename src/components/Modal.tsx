/**
 * A dialog over the page: a scrim that closes it, Escape that closes it,
 * focus held inside while it is open and returned where it was after. On a
 * narrow screen it rises from the bottom as a sheet.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps focus inside `box` while mounted; Escape calls `onClose`; focus goes back after. */
export function useDialogFocus(box: React.RefObject<HTMLElement | null>, onClose: () => void, first?: string): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const el = box.current;
    const start = (first !== undefined ? el?.querySelector<HTMLElement>(first) : null) ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    start?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || el === null) return;
      const all = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (all.length === 0) return;
      const head = all[0]!;
      const tail = all[all.length - 1]!;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (back !== null && document.contains(back)) back.focus();
    };
  }, [box, first]);
}

export function useNarrow(below = 900): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < below);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < below);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [below]);
  return narrow;
}

export function Modal({ label, labelledBy, width, z, tall, onClose, first, children, style }: { label?: string; labelledBy?: string; width: number; z: number; tall?: boolean; onClose: () => void; first?: string; children: ReactNode; style?: CSSProperties }) {
  const narrow = useNarrow();
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onClose, first);
  const shape: CSSProperties = narrow
    ? { width: "100%", maxHeight: "94%", height: tall ? "94%" : "auto", borderStartStartRadius: 22, borderStartEndRadius: 22, animation: "jn-bottom .26s cubic-bezier(.2,.8,.2,1)" }
    : { width: `min(${String(width)}px,100%)`, maxHeight: "calc(100% - 40px)", height: tall ? "min(780px, calc(100% - 40px))" : "auto", border: "1px solid var(--border-strong)", borderRadius: 22, boxShadow: "0 40px 90px -30px rgba(10,10,25,.5)", animation: "jn-sheet .22s cubic-bezier(.2,.8,.2,1)" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: z, background: "var(--scrim)", backdropFilter: "blur(3px)", display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 20, animation: "jn-scrim .18s ease" }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", background: "var(--surface)", overflow: "hidden", ...shape, ...style }}>
        {children}
      </div>
    </div>
  );
}
