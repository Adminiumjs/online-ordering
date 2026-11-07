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
import { configBase } from "../staffConnection.ts";

/** `:<slug>` for a later install's mount (`/apps/<key>/<slug>/<side>/`), else nothing. */
export function mountSuffix(base: string): string {
  const parts = base.split("/").filter((part) => part !== "");
  return parts.length === 4 && parts[0] === "apps" ? `:${parts[2]}` : "";
}

/** The mount this page was opened at; the baked base where there is no page (a test, a worker). */
function currentBase(): string {
  const baked = import.meta.env.BASE_URL;
  try {
    return typeof location === "undefined" ? baked : configBase(baked, location.pathname);
  } catch {
    return baked;
  }
}

/** `name` for the bare mount, `name:<slug>` for a later install's. */
export function mountKey(name: string, base: string = currentBase()): string {
  return `${name}${mountSuffix(base)}`;
}
