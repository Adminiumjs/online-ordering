/**
 * The pieces that render one line of an order.
 *
 * Four screens show the same line in three densities — the cart drawer and
 * cart page show it editable, checkout and the tracker show it as a receipt
 * row, and the kitchen shows it as a ticket line. They share this module so a
 * modifier summary reads identically everywhere, which is the whole point: the
 * cook and the customer must be looking at the same pizza.
 */

import { MessageSquare, Pencil, Trash2 } from "lucide-react";

import type { CartLine, Item, Selection } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { label, money, number } from "../lib/format.ts";
import { optionNames, unitPrice, type CartTotals } from "../lib/order.ts";
import { FoodTile, Glyph, Mono, Stepper } from "./Primitives.tsx";

/**
 * "Farro · Herb chicken · Avocado" — the item's own group order, not the order
 * the reader happened to tap the options in.
 */
export function optionSummary(item: Item, selection: Selection): string {
  return optionNames(item, selection).map(label).join(" · ");
}

/** The tint for an item, resolved through its category. */
export function tintFor(item: Item, categories: { id: string; tint: string }[]): string {
  return categories.find((c) => c.id === item.cat)?.tint ?? "--ft-bowl";
}

/* ------------------------------------------------------------- editable row */

export function LineRow({
  line,
  item,
  tint,
  index,
  onQty,
  onEdit,
}: {
  line: CartLine;
  item: Item;
  tint: string;
  index: number;
  onQty: (qty: number) => void;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const unit = unitPrice(item, line.selection);
  const summary = optionSummary(item, line.selection);

  return (
    <div className="jk-line">
      <FoodTile
        tint={tint}
        index={index}
        icon={<Glyph name={item.icon} size={22} />}
        height={44}
        radius={12}
        className="jk-line__tile"
      />

      <div className="jk-line__body">
        <div className="jk-line__top">
          <span className="jk-line__name">{label(item.name)}</span>
          <Mono className="jk-line__price">{money(unit * line.qty)}</Mono>
        </div>

        {summary.length > 0 && <p className="jk-line__mods">{summary}</p>}

        {line.note.length > 0 && (
          <p className="jk-line__note">
            <MessageSquare size={11} aria-hidden="true" />“{line.note}”
          </p>
        )}

        <div className="jk-line__actions">
          <Stepper
            small
            value={line.qty}
            onDec={() => onQty(line.qty - 1)}
            onInc={() => onQty(line.qty + 1)}
            decLabel={t(line.qty === 1 ? "cart.remove" : "cart.fewer")}
            incLabel={t("cart.more")}
            decIcon={line.qty === 1 ? <Trash2 size={13} aria-hidden="true" /> : undefined}
          />
          <button type="button" className="jk-linkbtn jk-btn" onClick={onEdit}>
            <Pencil size={12} aria-hidden="true" />
            {t("cart.edit")}
          </button>
          <span className="jk-line__each jk-mono">{t("cart.each", { amount: money(unit) })}</span>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- recap row */

/** The read-only form: a quantity, what it is, and what it cost. */
export function RecapRow({ line, item }: { line: CartLine; item: Item }) {
  const summary = optionSummary(item, line.selection);
  return (
    <div className="jk-recap">
      <Mono className="jk-recap__qty">{line.qty}×</Mono>
      <span className="jk-recap__body">
        <span className="jk-recap__name">{label(item.name)}</span>
        {summary.length > 0 && <span className="jk-recap__mods">{summary}</span>}
        {line.note.length > 0 && <span className="jk-recap__note">“{line.note}”</span>}
      </span>
      <Mono className="jk-recap__price">
        {money(unitPrice(item, line.selection) * line.qty)}
      </Mono>
    </div>
  );
}

/* ------------------------------------------------------------------ totals */

/**
 * Subtotal, tax and total. The tax rate is stated rather than implied, because
 * a total that cannot be reconstructed from the numbers above it is the
 * fastest way to make a checkout feel untrustworthy.
 */
export function Totals({ totals, rate }: { totals: CartTotals; rate: number }) {
  const { t } = useI18n();
  return (
    <div className="jk-totals">
      <span className="jk-totals__row">
        {t("cart.subtotal")}
        <Mono>{money(totals.subtotal)}</Mono>
      </span>
      <span className="jk-totals__row">
        {t("cart.tax", { rate: number(rate) })}
        <Mono>{money(totals.tax)}</Mono>
      </span>
      <span className="jk-totals__row jk-totals__row--total">
        {t("cart.total")}
        <Mono className="jk-totals__big">{money(totals.total)}</Mono>
      </span>
    </div>
  );
}
