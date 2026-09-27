/**
 * "Order it again", as the page does it: rebuild, ask before replacing a cart
 * that has lines, land on the order page, and say what came back.
 */
import { ConfirmDialog } from "../components/Confirm.tsx";
import type { OrderWithLines } from "../data/ports.ts";
import { useI18n, type TFunction } from "../i18n/index.tsx";
import { applyRebuilt, rebuild, useReorderAsk } from "../state/reorder.ts";
import { useDiner } from "../state/diner.ts";
import { goDiner, toast } from "../state/ui.ts";

function land(order: OrderWithLines, mode: "replace" | "add", t: TFunction): void {
  const rebuilt = rebuild(order);
  useReorderAsk.setState({ order: null });
  if (rebuilt.lines.length === 0) {
    toast(t("reorder.nothing"), "warn");
    return;
  }
  applyRebuilt(rebuilt, mode);
  goDiner("cart");
  const number = String(order.order["number"] ?? "");
  if (rebuilt.gone.length === 0) toast(t("reorder.back", { number }));
  else toast(t("reorder.partly", { dishes: rebuilt.gone.join(", ") }, rebuilt.gone.length), "warn");
}

/** Starts "Order it again": asks first when the cart already has lines. */
export function useReorder(): (order: OrderWithLines) => void {
  const { t } = useI18n();
  return (order) => {
    if (useDiner.getState().cart.length > 0) useReorderAsk.setState({ order });
    else land(order, "replace", t);
  };
}

export function ReorderAsk() {
  const { t } = useI18n();
  const order = useReorderAsk((s) => s.order);
  if (order === null) return null;
  const close = () => useReorderAsk.setState({ order: null });
  return (
    <ConfirmDialog
      title={t("reorder.askTitle")}
      body={t("reorder.askBody", { number: String(order.order["number"] ?? "") })}
      onClose={close}
      buttons={[
        { id: "replace", label: t("reorder.replace"), kind: "primary", onClick: () => land(order, "replace", t) },
        { id: "add", label: t("reorder.add"), kind: "ghost", onClick: () => land(order, "add", t) },
        { id: "keep", label: t("reorder.keep"), kind: "ghost", onClick: close },
      ]}
    />
  );
}
