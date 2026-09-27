/**
 * The real Adminium, for a hosted or connected build: the order page's door
 * over the public API and the kitchen's over the staff session. Until this
 * build carries them, a real build stops at a plain explanation rather than
 * showing anything that is not the kitchen's own data.
 */
import type { Sources } from "./sources.ts";

export async function liveSources(): Promise<Sources | Error> {
  return new Error("This build does not reach Adminium yet: it carries the order page and the kitchen screens, and the connection to your database comes with the next release.");
}
