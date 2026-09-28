/**
 * The real Adminium, for a hosted or standalone build: the kitchen's door
 * over the staff session (the staff surface), or the order page's over the
 * public API (the customer surface, or a standalone build's baked address
 * and key). Each build loads only its own side's door — the branch not taken
 * folds away with its imports — and the other side answers nothing.
 *
 * The screens' clock is the server's: the difference its config says is
 * kept, and "today" is never the device's. Nothing here falls back to
 * invented rows: a build with no Adminium to reach says so and stops.
 */
import { HOSTED, SURFACE_SIDE } from "../surface.ts";
import type { DinerPort, KitchenPort } from "./ports.ts";
import { deviceClock, type Sources } from "./sources.ts";
import { ApiError } from "./wire.ts";

/** A failure the startup screen names by its kind. */
function failure(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/** The side this build does not carry: every call answers that it is not offered here. */
function absent<T extends object>(side: string): T {
  return new Proxy({} as T, {
    get: () => () => Promise.reject(new ApiError(404, "NOT_OFFERED", `This build does not carry the ${side}.`)),
  });
}

/**
 * The staff config read again, for the minute's check that the kitchen is still signed in: a
 * config that says nobody is signed in is a sign-out, but no answer at all (the Wi-Fi, a restart,
 * a 5xx) is not — it throws, and the next check tries again.
 */
function reloadStaffConfig<T>(load: (options: { fetchImpl: typeof fetch }) => Promise<T | null>): () => Promise<T | null> {
  return async () => {
    let unanswered = false;
    const watched: typeof fetch = async (input, init) => {
      try {
        const res = await fetch(input, init);
        if (res.status >= 500) unanswered = true;
        return res;
      } catch (error) {
        unanswered = true;
        throw error;
      }
    };
    const cfg = await load({ fetchImpl: watched });
    if (cfg === null && unanswered) throw new ApiError(503, "UNREACHABLE", "Adminium did not answer.");
    return cfg;
  };
}

/** The server's clock, from the moment it said and the device's then. */
function skewOf(said: string | null | undefined): number {
  const at = typeof said === "string" ? Date.parse(said) : Number.NaN;
  return Number.isNaN(at) ? 0 : at - Date.now();
}

export async function liveSources(): Promise<Sources | Error> {
  if (HOSTED && SURFACE_SIDE === "staff") {
    const [{ loadStaffConfig }, { createSessionTransport }, { AdminiumKitchen }] = await Promise.all([
      import("../staffConnection.ts"),
      import("./sessionSource.ts"),
      import("./adminiumKitchen.ts"),
    ]);
    const staff = await loadStaffConfig();
    if (staff === null) {
      return failure("This Adminium did not answer the kitchen's configuration. It may be older than this app, or the app is not installed.", "NO_BACKEND");
    }
    if (staff.user === null || staff.csrfToken === null) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return failure("Signing in…", "SIGNING_IN");
    }
    const transport = createSessionTransport({
      tableOfRef: staff.tables,
      connectionId: staff.connectionId ?? undefined,
      staff: { csrfToken: staff.csrfToken, timezone: staff.timezone, timezoneSource: staff.timezoneSource, serverTimezone: staff.serverTimezone, currency: staff.currency },
      refreshToken: async () => (await loadStaffConfig())?.csrfToken ?? null,
    });
    const kitchen = new AdminiumKitchen(transport, staff, { reload: reloadStaffConfig(loadStaffConfig) });
    return {
      diner: absent<DinerPort>("order page"),
      kitchen,
      clock: deviceClock(skewOf(staff.now)),
      zone: staff.timezone ?? "UTC",
      currency: staff.currency ?? "USD",
    };
  }

  const [{ resolveSurfaceConfig }, { AdminiumDiner }] = await Promise.all([import("../publicConfig.ts"), import("./adminiumDiner.ts")]);
  const served = await resolveSurfaceConfig();
  if (served === null) {
    return failure(
      "This build has no backend configured. A hosted order page needs a key bound to it in Studio (or VITE_ADMINIUM_PUBLISHABLE_KEY baked at build time); a standalone build needs that and VITE_ADMINIUM_API_BASE_URL.",
      "NO_BACKEND",
    );
  }
  // A standalone build may bake the order's own link key beside the page's.
  const linkKey = served.publicKeys?.["link"] ?? (import.meta.env as { VITE_ADMINIUM_LINK_KEY?: string }).VITE_ADMINIUM_LINK_KEY;
  const diner = new AdminiumDiner({ ...served, ...(linkKey === undefined || linkKey === "" ? {} : { publicKeys: { ...served.publicKeys, link: linkKey } }) });
  try {
    const config = await diner.config();
    return {
      diner,
      kitchen: absent<KitchenPort>("kitchen"),
      clock: deviceClock(skewOf(config.now)),
      zone: config.timezone,
      currency: config.currency ?? "USD",
    };
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "NO_BACKEND";
    return failure(error instanceof Error ? error.message : "The kitchen's page could not be reached.", code);
  }
}
