/**
 * The app shell: the side a build carries (the diner's order page, the
 * kitchen's screens, or both in the demo), the screen the address names, and
 * what every screen shares — the overlays, the theme, the first reads.
 */
import { lazy, Suspense, useEffect } from "react";

import { SURFACE_SIDE } from "../surface.ts";
import { useUi } from "../state/ui.ts";

/** An order's link or a sign-in link the page was opened with: `/o#<code>`, `/c#<code>`. */
export interface BootLink {
  kind: "track" | "signin";
  token: string;
}

/*
 * A surface build carries ONE side. `SURFACE_SIDE` folds to a literal, so the
 * side not carried is `null` here and its `import()` is gone with it: the
 * order page's bundle carries no kitchen screen, store or door, and the
 * kitchen's no order page. (A static import would not do: a module that
 * starts a store when loaded is kept by the bundler even when nothing reads it.)
 */
const Kitchen = SURFACE_SIDE === "customer" ? null : lazy(() => import("../screens/Kitchen.tsx"));
const Diner = SURFACE_SIDE === "staff" ? null : lazy(() => import("./DinerApp.tsx"));

export default function App({ link }: { link: BootLink | null }) {
  const persona = useUi((s) => s.persona);
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);
  // The demo carries both sides, and draws the persona the card chose.
  const side = SURFACE_SIDE ?? (persona === "kitchen" ? "staff" : "customer");
  return <Suspense fallback={null}>{side === "staff" ? Kitchen !== null && <Kitchen /> : Diner !== null && <Diner link={link} />}</Suspense>;
}
