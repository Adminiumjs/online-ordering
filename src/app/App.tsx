/**
 * The app shell: the side a build carries (the diner's order page, the
 * kitchen's screens, or both in the demo), the screen the address names, and
 * what every screen shares — the overlays, the theme, the first reads.
 */
import { useEffect, type ComponentType } from "react";

import { SURFACE_SIDE } from "../surface.ts";
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
import Kitchen from "../screens/Kitchen.tsx";

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

/** An order's link or a sign-in link the page was opened with: `/o#<code>`, `/c#<code>`. */
export interface BootLink {
  kind: "track" | "signin";
  token: string;
}

function Diner({ link }: { link: BootLink | null }) {
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
    else void signedIn();
  }, [link]);

  // The kitchen's clock moved: what is free now, and where the followed order stands.
  useEffect(() => {
    if (!loaded) return;
    void refreshAvailability(now);
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

export default function App({ link }: { link: BootLink | null }) {
  const persona = useUi((s) => s.persona);
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);
  /*
   * A surface build carries ONE side. `SURFACE_SIDE` folds to a literal, so the
   * branch not taken is eliminated with every screen only it referenced: the
   * order page's bundle carries no kitchen screen, and the kitchen's no order page.
   */
  if (SURFACE_SIDE === "staff") return <Kitchen />;
  if (SURFACE_SIDE === "customer") return <Diner link={link} />;
  return persona === "kitchen" ? <Kitchen /> : <Diner link={link} />;
}
