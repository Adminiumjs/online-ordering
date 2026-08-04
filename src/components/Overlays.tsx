/**
 * The overlay layer: toasts, the item sheet, the cart drawer and the demo card
 * sheet.
 *
 * All four are mounted once at the root, outside the view switch, so a view
 * change never remounts them and a toast raised by an action survives the
 * navigation that action triggered.
 *
 * The item sheet is the one screen in this app with real rules in it. Every
 * decision it makes — which options are still available, whether the add
 * button is allowed, what the total is — comes from `lib/order.ts`, so the
 * kitchen and the customer are enforcing exactly the same menu.
 */

import { ArrowRight, Check, CreditCard, Hand, Info, Lock, Plus, ShieldCheck, ShoppingBag, Utensils, X } from "lucide-react";

import { TAX_RATE } from "../data/demo.ts";
import type { ModifierGroup } from "../data/types.ts";
import { tOr } from "../i18n/ambient.ts";
import { useI18n } from "../i18n/index.tsx";
import { delta, label, money } from "../lib/format.ts";
import { atCap, cartTotals, isComplete, problems, unitPrice } from "../lib/order.ts";
import { NOTE_MAX, useStore } from "../state/store.ts";
import { LineRow, Totals, tintFor } from "./OrderLine.tsx";
import { Button, Empty, FoodTile, Glyph, Mono, Pill, Stepper } from "./Primitives.tsx";

/* ------------------------------------------------------------------ toasts */

export function ToastLayer() {
  const { t } = useI18n();
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="jk-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`jk-toast jk-toast--${toast.tone}`}>
          {toast.tone === "pos" && <Check size={15} aria-hidden="true" />}
          <span>{toast.text}</span>
          <button
            type="button"
            className="jk-toast__x"
            onClick={() => dismiss(toast.id)}
            aria-label={t("chrome.toast.dismiss")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- item sheet */

/**
 * One modifier group. A `radio` group replaces its selection; a `check` group
 * accumulates to its cap and then disables the options NOT already chosen —
 * a reader at five toppings must still be able to swap one out without
 * clearing the group first.
 */
function ModGroup({ group }: { group: ModifierGroup }) {
  const { t } = useI18n();
  const sheet = useStore((s) => s.sheet);
  const toggle = useStore((s) => s.sheetToggle);
  if (sheet === null) return null;

  const picked = sheet.selection[group.id] ?? [];
  const full = group.type === "check" && atCap(group, sheet.selection);

  return (
    <div className="jk-modgroup">
      <div className="jk-modgroup__head">
        <span className="jk-modgroup__name">{label(group.name)}</span>
        {group.min > 0 && <Pill tone="accent">{t("sheet.required")}</Pill>}
        <span className="jk-shead__spacer" />
        <span className={`jk-modgroup__rule jk-mono${full ? " jk-modgroup__rule--full" : ""}`}>
          {group.type === "check"
            ? t("sheet.ofMax", { n: picked.length, max: group.max })
            : label(group.hint)}
        </span>
      </div>

      <div className="jk-optgrid">
        {group.options.map((option) => {
          const on = picked.includes(option.id);
          const locked = group.type === "check" && !on && full;
          return (
            <button
              key={option.id}
              type="button"
              className="jk-optrow jk-btn"
              aria-pressed={on}
              disabled={locked}
              title={locked ? t("sheet.capped", { max: group.max }) : undefined}
              onClick={() => toggle(group.id, option.id)}
            >
              <span className={`jk-optmark${group.type === "check" ? " jk-optmark--sq" : ""}`}>
                {on && <Check size={12} aria-hidden="true" />}
              </span>
              <span className="jk-optrow__name">{label(option.name)}</span>
              {option.delta !== 0 && (
                <Mono className="jk-optrow__delta">{delta(option.delta)}</Mono>
              )}
            </button>
          );
        })}
      </div>

      {full && (
        <p className="jk-modgroup__cap">
          <Hand size={13} aria-hidden="true" />
          {t("sheet.capHint", { group: label(group.name) })}
        </p>
      )}
    </div>
  );
}

export function ItemSheet() {
  const { t } = useI18n();
  const sheet = useStore((s) => s.sheet);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const close = useStore((s) => s.closeSheet);
  const setNote = useStore((s) => s.setSheetNote);
  const setQty = useStore((s) => s.setSheetQty);
  const submit = useStore((s) => s.submitSheet);

  if (sheet === null) return null;
  const item = items.find((i) => i.id === sheet.itemId);
  if (item === undefined) return null;

  const blockers = problems(item, sheet.selection);
  const ok = isComplete(item, sheet.selection);
  const total = unitPrice(item, sheet.selection) * sheet.qty;

  /*
   * A disabled button that says why is kinder than a missing one, so the first
   * unsatisfied group names itself in plain language ("Choose a base.") rather
   * than the sheet simply refusing to respond.
   */
  const reason =
    blockers.length === 0
      ? null
      : tOr(`data.need.${blockers[0].group.id}`, t("sheet.reason.generic"));

  return (
    <>
      <button type="button" className="jk-scrim" aria-label={t("chrome.action.close")} onClick={close} />
      <div className="jk-isheet">
        <div className="jk-ipanel" role="dialog" aria-modal="true" aria-label={label(item.name)}>
          <div className="jk-ipanel__head">
            <FoodTile
              tint={tintFor(item, categories)}
              icon={<Glyph name={item.icon} size={26} />}
              height={52}
              radius={14}
              className="jk-ipanel__tile"
            />
            <div className="jk-ipanel__id">
              <h2 className="jk-ipanel__name">{label(item.name)}</h2>
              <p className="jk-ipanel__desc">
                {label(item.desc)} ·{" "}
                {t("sheet.from", { amount: money(item.price) })}
              </p>
            </div>
            <button
              type="button"
              className="jk-iconbtn jk-btn"
              onClick={close}
              aria-label={t("chrome.action.close")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="jk-ibody jk-scroll">
            {item.mods.map((group) => (
              <ModGroup key={group.id} group={group} />
            ))}

            <div className="jk-modgroup">
              <label htmlFor="jk-note" className="jk-modgroup__head">
                <span className="jk-modgroup__name">{t("sheet.note")}</span>
                <span className="jk-modgroup__optional">{t("sheet.optional")}</span>
                <span className="jk-shead__spacer" />
                <span className="jk-modgroup__rule jk-mono">
                  {sheet.note.length}/{NOTE_MAX}
                </span>
              </label>
              <textarea
                id="jk-note"
                className="jk-textarea jk-fld"
                maxLength={NOTE_MAX}
                placeholder={t("sheet.note.placeholder")}
                value={sheet.note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="jk-ifoot">
            <Stepper
              value={sheet.qty}
              onDec={() => setQty(sheet.qty - 1)}
              onInc={() => setQty(sheet.qty + 1)}
              decLabel={t("cart.fewer")}
              incLabel={t("cart.more")}
            />
            <span className="jk-ifoot__money">
              {reason !== null && <span className="jk-ifoot__reason">{reason}</span>}
              <Mono className="jk-ifoot__total">{money(total)}</Mono>
            </span>
            <Button onClick={submit} disabled={!ok}>
              {sheet.editKey === null ? (
                <Plus size={16} aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {t(sheet.editKey === null ? "sheet.add" : "sheet.update")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- cart drawer */

export function CartDrawer() {
  const { t } = useI18n();
  const open = useStore((s) => s.drawerOpen);
  const setOpen = useStore((s) => s.setDrawerOpen);
  const cart = useStore((s) => s.cart);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const setLineQty = useStore((s) => s.setLineQty);
  const editLine = useStore((s) => s.editLine);
  const go = useStore((s) => s.go);

  if (!open) return null;

  const totals = cartTotals(cart, items, TAX_RATE);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <>
      <button
        type="button"
        className="jk-scrim"
        aria-label={t("cart.close")}
        onClick={() => setOpen(false)}
      />
      <aside className="jk-drawer" role="dialog" aria-modal="true" aria-label={t("cart.title")}>
        <div className="jk-drawer__head">
          <ShoppingBag size={18} aria-hidden="true" />
          <span className="jk-drawer__title">{t("cart.title")}</span>
          <Mono className="jk-drawer__count">
            {t("chrome.itemCount", { count: totals.count }, totals.count)}
          </Mono>
          <span className="jk-shead__spacer" />
          <button
            type="button"
            className="jk-iconbtn jk-btn"
            onClick={() => setOpen(false)}
            aria-label={t("cart.close")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {cart.length === 0 ? (
          <Empty
            icon={<ShoppingBag size={24} aria-hidden="true" />}
            title={t("cart.empty.title")}
            body={t("cart.empty.body")}
            action={
              <Button onClick={() => go("menu")}>
                <Utensils size={15} aria-hidden="true" />
                {t("cart.empty.action")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="jk-drawer__body jk-scroll">
              {cart.map((line, i) => {
                const item = byId.get(line.item);
                if (item === undefined) return null;
                return (
                  <LineRow
                    key={line.key}
                    line={line}
                    item={item}
                    index={i}
                    tint={tintFor(item, categories)}
                    onQty={(qty) => setLineQty(line.key, qty)}
                    onEdit={() => editLine(line.key)}
                  />
                );
              })}
            </div>

            <div className="jk-drawer__foot">
              <Totals totals={totals} rate={TAX_RATE} />
              <div className="jk-drawer__actions">
                <Button tone="ghost" className="jk-flex1" onClick={() => go("cart")}>
                  {t("cart.review")}
                </Button>
                {/*
                 * This button is why the dock shifts: it sits in the same
                 * bottom inline-end corner the dock otherwise occupies.
                 */}
                <Button className="jk-flex1" onClick={() => go("checkout")}>
                  <ArrowRight size={15} aria-hidden="true" />
                  {t("cart.checkout")}
                </Button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* --------------------------------------------------------- demo card sheet */

/**
 * The card sheet. Every field is prefilled and read-only, and the callout says
 * so in as many words — a demo that looks like it is taking card numbers is a
 * demo nobody should trust.
 */
export function PaySheet() {
  const { t } = useI18n();
  const open = useStore((s) => s.paySheetOpen);
  const setOpen = useStore((s) => s.setPaySheetOpen);
  const cart = useStore((s) => s.cart);
  const items = useStore((s) => s.items);
  const placeOrder = useStore((s) => s.placeOrder);

  if (!open) return null;
  const totals = cartTotals(cart, items, TAX_RATE);

  return (
    <>
      <button
        type="button"
        className="jk-scrim jk-scrim--top"
        aria-label={t("chrome.action.close")}
        onClick={() => setOpen(false)}
      />
      <div className="jk-isheet jk-isheet--top">
        <div
          className="jk-ipanel jk-ipanel--narrow"
          role="dialog"
          aria-modal="true"
          aria-label={t("pay.title")}
        >
          <div className="jk-ipanel__head">
            <CreditCard size={17} aria-hidden="true" />
            <h2 className="jk-ipanel__name">{t("pay.title")}</h2>
            <span className="jk-shead__spacer" />
            <button
              type="button"
              className="jk-iconbtn jk-btn"
              onClick={() => setOpen(false)}
              aria-label={t("chrome.action.close")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="jk-ibody">
            <p className="jk-callout">
              <Info size={15} aria-hidden="true" />
              {t("pay.demoCallout")}
            </p>

            <div className="jk-field">
              <span className="jk-label">{t("pay.cardNumber")}</span>
              <span className="jk-lockfield">
                <input className="jk-input jk-mono" value="4242 4242 4242 4242" readOnly />
                <Lock size={14} aria-hidden="true" />
              </span>
            </div>

            <div className="jk-paygrid">
              <div className="jk-field">
                <span className="jk-label">{t("pay.expiry")}</span>
                <input className="jk-input jk-mono" value="12 / 29" readOnly />
              </div>
              <div className="jk-field">
                <span className="jk-label">{t("pay.cvc")}</span>
                <input className="jk-input jk-mono" value="•••" readOnly />
              </div>
            </div>

            <p className="jk-fineprint">
              <ShieldCheck size={13} aria-hidden="true" />
              {t("pay.testCard")}
            </p>
          </div>

          <div className="jk-ifoot">
            <span className="jk-ifoot__money">
              <span className="jk-ifoot__reason jk-ifoot__reason--quiet">{t("pay.charging")}</span>
              <Mono className="jk-ifoot__total">{money(totals.total)}</Mono>
            </span>
            <Button onClick={placeOrder}>
              <Check size={16} aria-hidden="true" />
              {t("pay.confirm", { amount: money(totals.total) })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
