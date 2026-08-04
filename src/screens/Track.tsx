/**
 * TRACK — where an order is, and when each step happened.
 *
 * The timeline uses the shared `jk-tl-*` rows, whose marker column is a
 * RESERVED GRID TRACK (house layout rule 4): the dot lives in its own column
 * rather than floating over the text, so it cannot collide with a long status
 * name at any width or in either writing direction.
 *
 * Nothing here polls. The order moves when the dock's "+10 min" chip says it
 * does, and the tip at the foot of the timeline says exactly that rather than
 * leaving a reader watching a screen that will never change on its own.
 */

import { BellRing, CheckCheck, ChefHat, Circle, Check, Inbox, ReceiptText, Sparkles, Timer, Utensils } from "lucide-react";

import { TAX_RATE } from "../data/demo.ts";
import type { OrderStatus } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock } from "../lib/format.ts";
import { STATUS_CHAIN, cartTotals, statusIndex } from "../lib/order.ts";
import { useStore } from "../state/store.ts";
import { RecapRow, Totals } from "../components/OrderLine.tsx";
import { Button, CardHead, Chip, Empty, Mono, Pill } from "../components/Primitives.tsx";

/** The glyph each step shows while it is the current one. */
const STEP_ICON: Record<OrderStatus, typeof Inbox> = {
  placed: Inbox,
  confirmed: Check,
  preparing: ChefHat,
  ready: BellRing,
  picked_up: CheckCheck,
};

const STEP_KEY = {
  placed: "track.step.placed",
  confirmed: "track.step.confirmed",
  preparing: "track.step.preparing",
  ready: "track.step.ready",
  picked_up: "track.step.pickedUp",
} as const;

const HINT_KEY = {
  placed: "track.hint.placed",
  confirmed: "track.hint.confirmed",
  preparing: "track.hint.preparing",
  ready: "track.hint.ready",
  picked_up: "track.hint.pickedUp",
} as const;

export default function Track() {
  const { t } = useI18n();
  const orders = useStore((s) => s.orders);
  const items = useStore((s) => s.items);
  const myNums = useStore((s) => s.myNums);
  const trackNum = useStore((s) => s.trackNum);
  const trackOrder = useStore((s) => s.trackOrder);
  const history = useStore((s) => s.history);
  const now = useStore((s) => s.now);
  const go = useStore((s) => s.go);

  if (myNums.length === 0) {
    return (
      <div className="jk-site jk-site--narrow jk-screen">
        <div className="jk-panel">
          <Empty
            icon={<Timer size={24} aria-hidden="true" />}
            title={t("track.none.title")}
            body={t("track.none.body")}
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

  const num =
    trackNum !== null && myNums.includes(trackNum) ? trackNum : myNums[myNums.length - 1];
  const order = orders.find((o) => o.num === num);
  if (order === undefined) return null;

  const reached = statusIndex(order.status);
  const stamps = history[order.num] ?? {};
  const totals = cartTotals(order.lines, items, TAX_RATE);
  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="jk-site jk-site--narrow jk-screen">
      <header className="jk-head jk-head--row">
        <h1 className="jk-head__title">{t("track.title")}</h1>
        <span className="jk-shead__spacer" />
        <Mono className="jk-quiet">{t("track.clock", { time: clock(now) })}</Mono>
      </header>

      {myNums.length > 1 && (
        <div className="jk-catbar jk-scroll" role="group" aria-label={t("track.pickOrder")}>
          {myNums.map((n) => (
            <Chip key={n} onClick={() => trackOrder(n)} pressed={n === num}>
              <Mono>#{n}</Mono>
            </Chip>
          ))}
        </div>
      )}

      {order.status === "ready" && (
        <div className="jk-banner jk-banner--pos">
          <span className="jk-banner__icon" aria-hidden="true">
            <BellRing size={18} />
          </span>
          <span>
            <span className="jk-banner__title">{t("track.ready.title")}</span>
            <span className="jk-banner__sub">
              {t("track.ready.sub")} <Mono>#{order.num}</Mono>
            </span>
          </span>
        </div>
      )}

      {order.status === "picked_up" && (
        <div className="jk-banner">
          <span className="jk-banner__icon" aria-hidden="true">
            <CheckCheck size={18} />
          </span>
          <span>
            <span className="jk-banner__title">{t("track.done.title")}</span>
            <span className="jk-banner__sub">{t("track.done.sub")}</span>
          </span>
        </div>
      )}

      <div className="jk-cols">
        <section className="jk-panel">
          <CardHead
            icon={<Mono className="jk-ordernum">#{order.num}</Mono>}
            title={t("track.for", { name: order.customer })}
            meta={<Pill tone="accent">{t("track.pickup", { time: clock(order.pickupAt) })}</Pill>}
          />

          <div className="jk-timeline jk-tlpad">
            {STATUS_CHAIN.map((status, i) => {
              const done = i < reached;
              const current = i === reached;
              const Icon = STEP_ICON[status];
              const at = stamps[status];
              return (
                <div
                  key={status}
                  className={`jk-tl-row${current ? " jk-tl-row--now" : ""}`}
                >
                  <span
                    className={`jk-tl-dot${done ? " jk-tl-dot--done" : ""}${
                      current ? " jk-tl-dot--now" : ""
                    }${current && (status === "ready" || status === "picked_up") ? " jk-tl-dot--pos" : ""}`}
                  >
                    {done ? (
                      <Check size={11} aria-hidden="true" />
                    ) : current ? (
                      <Icon size={11} aria-hidden="true" />
                    ) : (
                      <Circle size={9} aria-hidden="true" />
                    )}
                  </span>
                  <div className="jk-tl-body">
                    <div className="jk-tl-head">
                      <span className={`jk-tl-type${done || current ? "" : " jk-tl-type--todo"}`}>
                        {t(STEP_KEY[status])}
                      </span>
                      {at !== undefined && (done || current) && (
                        <Mono className="jk-tl-when">{clock(at)}</Mono>
                      )}
                      {current && status !== "picked_up" && (
                        <Pill tone="accent">{t("track.now")}</Pill>
                      )}
                    </div>
                    {current && <p className="jk-tl-text">{t(HINT_KEY[status])}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="jk-panel__foot">
            <Sparkles size={13} aria-hidden="true" />
            {t("track.tip")}
          </p>
        </section>

        <section className="jk-panel">
          <CardHead
            icon={<ReceiptText size={15} aria-hidden="true" />}
            title={t("track.whatYouOrdered")}
          />
          {order.lines.map((line) => {
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
