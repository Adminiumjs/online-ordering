/**
 * The order page: the screen the address names, and what every screen of it
 * shares — the overlays, the first reads, the clock's refreshes. Loaded only
 * by a build that carries the diner's side.
 */
import { useEffect, type ComponentType } from "react";

import type { BootLink } from "./App.tsx";
import { useI18n } from "../i18n/index.tsx";
import { useNow } from "../data/sources.ts";
import { loadDiner, refreshAvailability, useDiner } from "../state/diner.ts";
import { openSignInLink, resumeDelete, signedIn } from "../state/account.ts";
import { openTrack, readTrack, useTrack } from "../state/track.ts";
import { goDiner, useUi, type DinerView } from "../state/ui.ts";
import { DinerShell } from "../diner/Shell.tsx";
import { Home } from "../diner/Home.tsx";
import { MenuPage } from "../diner/Menu.tsx";
import { CartDrawer, CartPage } from "../diner/Cart.tsx";
import { DishSheet } from "../diner/Sheet.tsx";
import { Checkout } from "../diner/Checkout.tsx";
import { NotFound, TrackPage } from "../diner/Track.tsx";
import { FindPage, OrdersPage } from "../diner/Account.tsx";
import { LargePage } from "../diner/Large.tsx";
import { ReorderAsk } from "../diner/Reorder.tsx";

const DINER_SCREENS: Record<DinerView, ComponentType> = {
  home: Home,
  menu: MenuPage,
  cart: CartPage,
  checkout: Checkout,
  track: TrackPage,
  find: FindPage,
  orders: OrdersPage,
  large: LargePage,
  notfound: NotFound,
};

export default function DinerApp({ link }: { link: BootLink | null }) {
  const { t } = useI18n();
  const view = useUi((s) => s.dinerView);
  const token = useTrack((s) => s.token);
  const loaded = useDiner((s) => s.load === "ok");
  const now = useNow();
  const minute = Math.floor(now / 60_000);

  useEffect(() => {
    void loadDiner();
    if (link?.kind === "track") void openTrack(link.token);
    else if (link?.kind === "signin")
      void openSignInLink(link.token).then((ok) => {
        goDiner(ok ? "orders" : "find");
        if (ok) resumeDelete();
      });
    else signedIn().catch(() => undefined);
  }, [link]);

  // The kitchen's clock moved: what is free now, and where the followed order stands.
  useEffect(() => {
    if (!loaded) return;
    // A read the network drops is read again at the next minute: the page keeps what it showed.
    refreshAvailability(now).catch(() => undefined);
    if (useUi.getState().dinerView === "track" && useTrack.getState().state === "ok") void readTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, loaded]);

  // An order's page keeps its code in the fragment, where a reload finds it.
  useEffect(() => {
    if (view !== "track" || token === null) return;
    if (window.location.hash !== `#${token}`) window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${token}`);
  }, [view, token]);

  const Screen = DINER_SCREENS[view] ?? NotFound;
  return (
    <>
      <a className="jn-sr jk-skip" href="#main">
        {t("shell.skip")}
      </a>
      <DinerShell>
        <Screen key={view} />
      </DinerShell>
      <DishSheet />
      <CartDrawer />
      <ReorderAsk />
    </>
  );
}
