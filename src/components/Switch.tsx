/** An on/off switch, as the kitchen's and the hours' rows draw it. */
export function Switch({ on, label, onToggle, disabled }: { on: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button className="jk-switch jn-sw" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} disabled={disabled}>
      <span />
    </button>
  );
}
