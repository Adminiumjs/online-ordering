/**
 * CHECKOUT and CONFIRMATION.
 *
 * Two views, one file, because they are two halves of the same minute: the
 * form and the receipt for it. Validation is live and specific — a blank name
 * and a six-digit number get different messages, and the pay button stays
 * disabled with a visible reason rather than silently ignoring the tap.
 */

import { ArrowLeft, CheckCheck, Clock, CreditCard, Lock, MapPin, ReceiptText, Sparkles, Timer, UserRound, Utensils } from "lucide-react";

import { TAX_RATE } from "../data/demo.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock, money } from "../lib/format.ts";
import { cartTotals, isNameish, isPhoneish } from "../lib/order.ts";
import { chosenPickup, useStore } from "../state/store.ts";
import { RecapRow, Totals } from "../components/OrderLine.tsx";
import { Button, CardHead, Empty, Field, Mono } from "../components/Primitives.tsx";

export default function Checkout() {
  const { t } = useI18n();
  const cart = useStore((s) => s.cart);
  const items = useStore((s) => s.items);
  const now = useStore((s) => s.now);
  const pickupAt = useStore((s) => s.pickupAt);
  const coName = useStore((s) => s.coName);
  const coPhone = useStore((s) => s.coPhone);
  const setCoName = useStore((s) => s.setCoName);
  const setCoPhone = useStore((s) => s.setCoPhone);
  const setPaySheetOpen = useStore((s) => s.setPaySheetOpen);
  const go = useStore((s) => s.go);

  const totals = cartTotals(cart, items, TAX_RATE);
  const byId = new Map(items.map((i) => [i.id, i]));
  const picked = chosenPickup(pickupAt, now);

  const nameOk = isNameish(coName);
  const phoneOk = isPhoneish(coPhone);
  /* Untouched fields stay silent; only a field someone has typed in complains. */
  const nameError = coName.length > 0 && !nameOk;
  const phoneError = coPhone.length > 0 && !phoneOk;
  const ready = cart.length > 0 && nameOk && phoneOk;

  if (cart.length === 0) {
    return (
      <div className="jk-site jk-site--narrow jk-screen">
        <div className="jk-panel">
          <Empty
            icon={<ReceiptText size={24} aria-hidden="true" />}
            title={t("checkout.empty.title")}
            body={t("checkout.empty.body")}
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
    <div className="jk-site jk-screen">
      <button type="button" className="jk-backlink jk-btn" onClick={() => go("cart")}>
        <ArrowLeft size={14} aria-hidden="true" />
        {t("checkout.back")}
      </button>

      <header className="jk-head">
        <h1 className="jk-head__title">{t("checkout.title")}</h1>
      </header>

      <div className="jk-cols">
        <section className="jk-panel">
          <CardHead icon={<UserRound size={15} aria-hidden="true" />} title={t("checkout.who")} />
          <div className="jk-formbody">
            <Field label={t("checkout.name")} htmlFor="jk-name">
              <input
                id="jk-name"
                className="jk-input jk-fld"
                value={coName}
                autoComplete="off"
                placeholder={t("checkout.name.placeholder")}
                aria-invalid={nameError}
                onChange={(e) => setCoName(e.target.value)}
              />
            </Field>
            {nameError && <p className="jk-fielderr">{t("checkout.name.error")}</p>}

            <Field
              label={t("checkout.mobile")}
              htmlFor="jk-phone"
              hint={t("checkout.mobile.hint")}
            >
              <input
                id="jk-phone"
                className="jk-input jk-fld jk-mono"
                value={coPhone}
                inputMode="tel"
                autoComplete="off"
                placeholder="(555) 010-0117"
                aria-invalid={phoneError}
                onChange={(e) => setCoPhone(e.target.value)}
              />
            </Field>
            {phoneError && <p className="jk-fielderr">{t("checkout.mobile.error")}</p>}

            <div className="jk-pickupline">
              <span className="jk-infocard__tile jk-infocard__tile--pos" aria-hidden="true">
                <Clock size={15} />
              </span>
              <span className="jk-pickupline__text">
                {t("checkout.pickupAt")} <Mono>{picked === null ? "—" : clock(picked)}</Mono>
              </span>
              <button type="button" className="jk-linkbtn jk-btn" onClick={() => go("cart")}>
                {t("checkout.change")}
              </button>
            </div>

            <Button className="jk-wide" disabled={!ready} onClick={() => setPaySheetOpen(true)}>
              <CreditCard size={16} aria-hidden="true" />
              {t("checkout.pay", { amount: money(totals.total) })}
            </Button>
            <p className="jk-fineprint">
              <Lock size={12} aria-hidden="true" />
              {t("checkout.demoNote")}
            </p>
          </div>
        </section>

        <section className="jk-panel">
          <CardHead
            icon={<ReceiptText size={15} aria-hidden="true" />}
            title={t("checkout.summary")}
            meta={<Mono>{t("chrome.itemCount", { count: totals.count }, totals.count)}</Mono>}
          />
          {cart.map((line) => {
            const item = byId.get(line.item);
            if (item === undefined) return null;
            return <RecapRow key={line.key} line={line} item={item} />;
          })}
          <Totals totals={totals} rate={TAX_RATE} />
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ confirmation */

export function Confirm() {
  const { t } = useI18n();
  const orders = useStore((s) => s.orders);
  const myNums = useStore((s) => s.myNums);
  const venue = useStore((s) => s.venue);
  const go = useStore((s) => s.go);
  const trackOrder = useStore((s) => s.trackOrder);

  const num = myNums[myNums.length - 1];
  const order = orders.find((o) => o.num === num);

  if (order === undefined) {
    return (
      <div className="jk-site jk-site--narrow jk-screen">
        <div className="jk-panel">
          <Empty
            icon={<ReceiptText size={24} aria-hidden="true" />}
            title={t("confirm.none.title")}
            body={t("confirm.none.body")}
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
    <div className="jk-site jk-site--narrow jk-screen jk-confirmwrap">
      <div className="jk-panel jk-confirm">
        <span className="jk-confirm__check" aria-hidden="true">
          <CheckCheck size={28} />
        </span>
        <h1 className="jk-confirm__title">{t("confirm.title")}</h1>
        <span className="jk-mchip jk-mono jk-confirm__num">#{order.num}</span>
        <p className="jk-confirm__body">
          {t("confirm.pickupAt")} <Mono>{clock(order.pickupAt)}</Mono>
          {" · "}
          <span className="jk-confirm__addr">
            <MapPin size={12} aria-hidden="true" />
            {venue.line1}
          </span>
          <br />
          {t("confirm.sayNumber")}
        </p>

        <div className="jk-confirm__foot">
          <p className="jk-fineprint">
            <Sparkles size={13} aria-hidden="true" />
            {t("confirm.tip")}
          </p>
          <div className="jk-confirm__actions">
            <Button tone="ghost" className="jk-flex1" onClick={() => go("menu")}>
              <Utensils size={15} aria-hidden="true" />
              {t("confirm.orderMore")}
            </Button>
            <Button className="jk-flex1" onClick={() => trackOrder(order.num)}>
              <Timer size={15} aria-hidden="true" />
              {t("confirm.track")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
