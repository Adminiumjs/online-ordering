/**
 * KITCHEN — the live ordering queue.
 *
 * Four columns, one per working status, and exactly one big button per card.
 * A cook with flour on their hands gets one target, not a menu of them, and
 * the button says what happens next ("Start", "Ready") rather than naming the
 * status the order is currently in.
 *
 * The elapsed chip counts from when the order was PLACED, not from when it
 * entered this column: how long a customer has been waiting is the number
 * that matters, and resetting it at every step would hide exactly the orders
 * that need attention.
 */

import { ChevronRight, ChefHat, HandPlatter, Info, MessageSquare, Timer } from "lucide-react";

import type { OrderStatus } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { clock, label, minutes } from "../lib/format.ts";
import { elapsed, ordersByStatus } from "../lib/order.ts";
import { LATE_AFTER, useStore } from "../state/store.ts";
import { optionSummary } from "../components/OrderLine.tsx";
import { Button, Honest, Mono, Pill } from "../components/Primitives.tsx";

/** The board's columns, in the order an order passes through them. */
const COLUMNS: { status: OrderStatus; labelKey: string; tint: string }[] = [
  { status: "placed", labelKey: "kitchen.status.placed", tint: "--accent" },
  { status: "confirmed", labelKey: "kitchen.status.confirmed", tint: "--info" },
  { status: "preparing", labelKey: "kitchen.status.preparing", tint: "--warn" },
  { status: "ready", labelKey: "kitchen.status.ready", tint: "--pos" },
];

/**
 * What the button DOES, keyed by where the order is now. Naming the next
 * action rather than the current state is the difference between a board a
 * cook can work and a board a cook has to decode.
 */
const VERB_KEY = {
  placed: "kitchen.verb.confirm",
  confirmed: "kitchen.verb.start",
  preparing: "kitchen.verb.ready",
  ready: "kitchen.verb.pickedUp",
  picked_up: "kitchen.verb.pickedUp",
} as const;

export default function Kitchen() {
  const { t } = useI18n();
  const orders = useStore((s) => s.orders);
  const items = useStore((s) => s.items);
  const now = useStore((s) => s.now);
  const advance = useStore((s) => s.advanceOrder);

  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="jk-screen">
      <div className="jk-kcols">
        {COLUMNS.map((column) => {
          const list = ordersByStatus(orders, column.status);
          return (
            <section key={column.status} className="jk-kcol">
              <header className="jk-kcol__head">
                <span
                  className="jk-kcol__dot"
                  style={{ background: `var(${column.tint})` }}
                  aria-hidden="true"
                />
                {label(column.labelKey)}
                <Mono className="jk-kcol__n">{list.length}</Mono>
              </header>

              {list.length === 0 && <p className="jk-kcol__empty">{t("kitchen.columnEmpty")}</p>}

              {list.map((order) => {
                const waited = elapsed(order, now);
                const late = waited > LATE_AFTER;
                return (
                  <article key={order.num} className="jk-kcard">
                    <div className="jk-kcard__head">
                      <Mono className="jk-ordernum">#{order.num}</Mono>
                      <span className="jk-kcard__who">{order.customer}</span>
                      <Pill tone={late ? "warn" : "muted"} title={t("kitchen.sincePlaced")}>
                        <Timer size={10} aria-hidden="true" />
                        <Mono>{minutes(waited)}</Mono>
                      </Pill>
                    </div>

                    <div className="jk-kcard__lines">
                      {order.lines.map((line) => {
                        const item = byId.get(line.item);
                        if (item === undefined) return null;
                        const summary = optionSummary(item, line.selection);
                        return (
                          <div key={line.key} className="jk-kline">
                            <Mono className="jk-kline__qty">{line.qty}×</Mono>
                            <span className="jk-kline__body">
                              <span className="jk-kline__name">{label(item.short)}</span>
                              {summary.length > 0 && (
                                <span className="jk-kline__mods">{summary}</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {order.note.length > 0 && (
                      <p className="jk-kcard__note">
                        <MessageSquare size={11} aria-hidden="true" />“{label(order.note)}”
                      </p>
                    )}

                    <div className="jk-kcard__foot">
                      <Mono className="jk-kcard__pickup">
                        {t("kitchen.pickup", { time: clock(order.pickupAt) })}
                      </Mono>
                      <span className="jk-shead__spacer" />
                      <Button
                        tone={order.status === "ready" ? "pos" : "accent"}
                        onClick={() => advance(order.num)}
                      >
                        {order.status === "ready" ? (
                          <HandPlatter size={14} aria-hidden="true" />
                        ) : (
                          <ChevronRight size={14} aria-hidden="true" />
                        )}
                        {t(VERB_KEY[order.status])}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="jk-kfoot">
        <Honest>
          <Info size={13} aria-hidden="true" />
          {t("kitchen.honest")}
        </Honest>
        <p className="jk-quiet">
          <ChefHat size={13} aria-hidden="true" />
          {t("kitchen.tip")}
        </p>
      </div>
    </div>
  );
}
