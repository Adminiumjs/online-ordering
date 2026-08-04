/**
 * The small shared pieces: buttons, chips, pills, panels, fields, gradient
 * food tiles, quantity steppers and empty states.
 *
 * They are grouped in one module rather than one file each because none of
 * them is more than a handful of lines and they are always imported together.
 * Anything with real behaviour — the dock, the shells, the overlay layer —
 * lives in its own file.
 */

import type { CSSProperties, ReactNode } from "react";
import {
  CakeSlice,
  Citrus,
  Cookie,
  Croissant,
  CupSoda,
  Flame,
  GlassWater,
  LeafyGreen,
  Minus,
  Pizza,
  Plus,
  Salad,
  Soup,
  Sprout,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { foodTile } from "../lib/format.ts";

/* ------------------------------------------------------------------ glyphs */

/**
 * The seed stores a Lucide icon NAME, because `data/demo.ts` is a description
 * of the fiction and importing React components into it would make it a
 * rendering concern. This table is the one place those names become elements.
 */
const GLYPHS: Record<string, LucideIcon> = {
  "cake-slice": CakeSlice,
  citrus: Citrus,
  cookie: Cookie,
  croissant: Croissant,
  "cup-soda": CupSoda,
  flame: Flame,
  "glass-water": GlassWater,
  "leafy-green": LeafyGreen,
  pizza: Pizza,
  salad: Salad,
  soup: Soup,
  sprout: Sprout,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
};

export function Glyph({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = GLYPHS[name] ?? Utensils;
  return <Icon size={size} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ button */

type Tone = "accent" | "ghost" | "pos" | "danger";

export function Button({
  children,
  onClick,
  tone = "accent",
  size,
  disabled,
  type = "button",
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Tone;
  size?: "sm";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  className?: string;
}) {
  const toneClass = tone === "accent" ? "" : ` jk-button--${tone}`;
  const sizeClass = size === "sm" ? " jk-button--sm" : "";
  return (
    <button
      type={type}
      className={`jk-button jk-btn${toneClass}${sizeClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- chip */

export function Chip({
  children,
  tone,
  onClick,
  pressed,
  title,
  disabled,
  style,
}: {
  children: ReactNode;
  tone?: "pos" | "warn" | "danger" | "info" | "accent";
  onClick?: () => void;
  pressed?: boolean;
  title?: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const cls = `jk-chip${tone ? ` jk-chip--${tone}` : ""}${onClick ? " jk-chipbtn" : ""}`;
  if (!onClick) {
    return (
      <span className={cls} title={title} style={style}>
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-pressed={pressed}
      title={title}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

/**
 * A status pill. Smaller and quieter than a chip: it states a fact rather
 * than offering a filter, so it is never a button.
 */
export function Pill({
  children,
  tone = "muted",
  title,
}: {
  children: ReactNode;
  tone?: "pos" | "warn" | "danger" | "info" | "accent" | "muted";
  title?: string;
}) {
  return (
    <span className={`jk-pill jk-pill--${tone}`} title={title}>
      {children}
    </span>
  );
}

/** An amount, a time, an order number — anything bidi must not re-order. */
export function Mono({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`jk-mono ${className}`.trim()}>{children}</span>;
}

/* ------------------------------------------------------------------- panel */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`jk-panel ${className}`.trim()}>
      {title !== undefined && (
        <header className="jk-panel__head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="jk-panel__title">{title}</h2>
              {subtitle !== undefined && <p className="jk-panel__sub">{subtitle}</p>}
            </div>
            {actions !== undefined && (
              <div style={{ marginInlineStart: "auto", display: "flex", gap: 7 }}>
                {actions}
              </div>
            )}
          </div>
        </header>
      )}
      <div className="jk-panel__body">{children}</div>
    </section>
  );
}

/** A card's own heading row — an icon, a title, and whatever sits at the end. */
export function CardHead({
  icon,
  title,
  meta,
}: {
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <div className="jk-cardhead">
      {icon}
      <span className="jk-cardhead__title">{title}</span>
      {meta !== undefined && <span className="jk-cardhead__meta">{meta}</span>}
    </div>
  );
}

/* --------------------------------------------------------------- food tile */

/**
 * The stand-in for a food photograph: a layered gradient tinted by the item's
 * category, an oversized Lucide glyph, and the seed's fictional filename in a
 * mono chip.
 *
 * `badge` renders in the corner OPPOSITE that filename chip (house layout
 * rule 2), so a floating badge can never land on top of it in either writing
 * direction.
 */
export function FoodTile({
  tint,
  index = 0,
  icon,
  file,
  height,
  radius,
  badge,
  className = "",
}: {
  tint: string;
  index?: number;
  icon: ReactNode;
  file?: string;
  height?: number | string;
  radius?: number;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`jk-foodtile ${className}`.trim()}
      style={{
        background: foodTile(tint, index),
        height,
        borderRadius: radius,
      }}
    >
      <span className="jk-foodtile__icon" style={{ color: `var(${tint})` }} aria-hidden="true">
        {icon}
      </span>
      {/*
       * The mono run is an INNER span. `.jk-mono` sets `direction: ltr`, and an
       * absolutely positioned box resolves `inset-inline-*` against its OWN
       * direction — putting the class on the chip itself would pin it to the
       * physical left in Arabic, on top of the badge.
       */}
      {file !== undefined && (
        <span className="jk-foodtile__file">
          <span className="jk-mono">{file}</span>
        </span>
      )}
      {badge !== undefined && <span className="jk-foodtile__badge">{badge}</span>}
    </span>
  );
}

/* ----------------------------------------------------------------- stepper */

/**
 * The quantity control. The decrement button carries its own icon so a cart
 * row can show a bin at one — dropping to zero removes the line, and the
 * control should say so before it is pressed.
 */
export function Stepper({
  value,
  onDec,
  onInc,
  decLabel,
  incLabel,
  decIcon,
  small,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  decIcon?: ReactNode;
  small?: boolean;
}) {
  return (
    <span className={`jk-qty${small ? " jk-qty--sm" : ""}`}>
      <button type="button" className="jk-qty__btn jk-btn" onClick={onDec} aria-label={decLabel}>
        {decIcon ?? <Minus size={small ? 13 : 14} aria-hidden="true" />}
      </button>
      <span className="jk-qty__n jk-mono">{value}</span>
      <button type="button" className="jk-qty__btn jk-btn" onClick={onInc} aria-label={incLabel}>
        <Plus size={small ? 13 : 14} aria-hidden="true" />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ fields */

export function Field({
  label: text,
  children,
  hint,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <label className="jk-field" htmlFor={htmlFor}>
      <span className="jk-label">{text}</span>
      {children}
      {hint !== undefined && <span className="jk-field__hint">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------ empty state */

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="jk-empty">
      {icon !== undefined && <div className="jk-empty__icon">{icon}</div>}
      <div className="jk-empty__title">{title}</div>
      {body !== undefined && <p className="jk-empty__body">{body}</p>}
      {action !== undefined && <div style={{ marginBlockStart: 14 }}>{action}</div>}
    </div>
  );
}

/** The line that tells a reader what this demo deliberately is not. */
export function Honest({ children }: { children: ReactNode }) {
  return <p className="jk-honest">{children}</p>;
}

/* --------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  full,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  full?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`jk-seg${full ? " jk-seg--full" : ""}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="jk-seg__btn"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A small all-caps section label, used above every band on the site. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="jk-seclab">{children}</span>;
}
