/**
 * `npm run manifest`: re-write `manifest.json` from `src/manifest/`.
 *
 * It says how many labels are still English only; the drift test holds that
 * number to what `src/manifest/untranslated-labels.json` records.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { manifestText } from "../src/manifest/build.ts";
import { untranslated } from "../src/manifest/labels.ts";

const file = join(import.meta.dirname, "..", "manifest.json");
writeFileSync(file, manifestText());
console.info(`[manifest] wrote manifest.json (${String(untranslated().length)} labels in English only)`);
