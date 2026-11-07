/**
 * A browser-storage key of THIS install of the order page.
 *
 * One Adminium may install the app once per database: the first install's
 * pages at `/apps/ordering/customer/`, a later one's at
 * `/apps/ordering/<slug>/customer/` — the same origin. Keys written by both
 * under one name would hand a diner of one restaurant the other's cart, last
 * order link and claim session. So a later install's keys carry its slug
 * (`online-ordering-cart:<slug>`).
 *
 * The bare mount keeps the key it always had, so the carts people already
 * hold survive the update. A mapped domain is its own origin (its own
 * storage), and the demo and a standalone build are not mounts at all: all
 * three keep the bare key too.
 */

/** `:<slug>` for a later install's mount (`/apps/<key>/<slug>/<side>/`), else nothing. */
export function mountSuffix(base: string): string {
  const parts = base.split("/").filter((part) => part !== "");
  return parts.length === 4 && parts[0] === "apps" ? `:${parts[2]}` : "";
}

/**
 * The mount a page at `pathname` is on: `configBase` (`staffConnection.ts`)
 * for the one branch that yields a slug — a later install's
 * `/apps/<key>/<slug>/<side>/` — and the baked base for everything else
 * (which has no slug either way). `mountKey.test.ts` holds the two equal.
 *
 * Not imported from there: that module loads `surface.ts`, whose build-time
 * `import.meta.env` reads throw where nothing defines it. The cart and
 * last-order stores compute their keys at load, so the browser specs, which
 * import the demo presets under Playwright's loader (no Vite), died on import.
 */
export function mountBase(baked: string, pathname: string): string {
  const b = baked.split("/").filter((part) => part !== "");
  if (b.length !== 3 || b[0] !== "apps") return baked;
  const [, appKey, side] = b;
  const [root, app, slug, foundSide] = pathname.split("/").filter((part) => part !== "");
  const later =
    root === "apps" && app === appKey && foundSide === side && slug !== undefined && slug !== "staff" && slug !== "customer";
  return later ? `/apps/${appKey}/${slug}/${side}/` : baked;
}

/**
 * The base Vite baked in; `/` where nothing did. Outside Vite (Playwright's
 * loader, plain node) `import.meta.env` is undefined and reading it throws.
 * Kept as the literal `import.meta.env.BASE_URL` so a build still swaps in
 * the string.
 */
function bakedBase(): string {
  try {
    return import.meta.env.BASE_URL;
  } catch {
    return "/";
  }
}

/** The mount this page was opened at; the baked base where there is no page (a test, a worker). */
function currentBase(): string {
  const baked = bakedBase();
  return typeof location === "undefined" ? baked : mountBase(baked, location.pathname);
}

/** `name` for the bare mount, `name:<slug>` for a later install's. */
export function mountKey(name: string, base: string = currentBase()): string {
  return `${name}${mountSuffix(base)}`;
}
