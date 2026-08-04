/**
 * CART — the full page version of the drawer.
 *
 * Same lines, same engine, more room: this is where the pickup slot gets
 * chosen, because a time picker crammed into a 380px drawer is a time picker
 * people get wrong.
 */

import { ArrowRight, Clock, Plus, ShoppingBag, Utensils } from "lucide-react";

import { SLOT_STEP, TAX_RATE } from "../data/demo.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock } from "../lib/format.ts";
import { cartTotals } from "../lib/order.ts";
import { chosenPickup, slotsAt, useStore } from "../state/store.ts";
import { LineRow, Totals, tintFor } from "../components/OrderLine.tsx";
import { Button, CardHead, Chip, Empty, Mono } from "../components/Primitives.tsx";

export default function Cart() {
  const { t } = useI18n();
  const cart = useStore((s) => s.cart);
  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const venue = useStore((s) => s.venue);
  const now = useStore((s) => s.now);
  const pickupAt = useStore((s) => s.pickupAt);
  const setPickup = useStore((s) => s.setPickup);
  const setLineQty = useStore((s) => s.setLineQty);
  const editLine = useStore((s) => s.editLine);
  const go = useStore((s) => s.go);

  const totals = cartTotals(cart, items, TAX_RATE);
  const byId = new Map(items.map((i) => [i.id, i]));
  const slots = slotsAt(now);
  const picked = chosenPickup(pickupAt, now);

  if (cart.length === 0) {
    return (
      <div className="jk-site jk-site--narrow jk-screen">
        <header className="jk-head">
          <h1 className="jk-head__title">{t("cart.title")}</h1>
        </header>
        <div className="jk-panel">
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
        </div>
      </div>
    );
  }

  return (
    <div className="jk-site jk-site--narrow jk-screen">
      <header className="jk-head">
        <h1 className="jk-head__title">{t("cart.title")}</h1>
      </header>

      <div className="jk-panel jk-stack">
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
        <div className="jk-addmore">
          <Plus size={14} aria-hidden="true" />
          <button type="button" className="jk-linkbtn jk-btn" onClick={() => go("menu")}>
            {t("cart.addMore")}
          </button>
        </div>
      </div>

      <div className="jk-panel jk-stack">
        <CardHead
          icon={<Clock size={15} aria-hidden="true" />}
          title={t("cart.pickupTime")}
          meta={<Mono>{t("cart.slotStep", { step: SLOT_STEP })}</Mono>}
        />
        <div className="jk-slotwrap">
          <div className="jk-slotrow jk-scroll" role="group" aria-label={t("cart.pickupTime")}>
            {slots.map((slot, i) => (
              <Chip key={slot} onClick={() => setPickup(slot)} pressed={slot === picked}>
                <Mono>{clock(slot)}</Mono>
                {i === 0 && <span className="jk-slot__soonest">{t("cart.soonest")}</span>}
              </Chip>
            ))}
            {slots.length === 0 && <span className="jk-quiet">{t("cart.noSlots")}</span>}
          </div>
          <p className="jk-quiet">{t("cart.counterPickup", { place: venue.line1 })}</p>
        </div>
      </div>

      <div className="jk-panel jk-stack">
        <Totals totals={totals} rate={TAX_RATE} />
        <div className="jk-stack__action">
          <Button className="jk-wide" onClick={() => go("checkout")}>
            <ArrowRight size={16} aria-hidden="true" />
            {t("cart.goToCheckout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
