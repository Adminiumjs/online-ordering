/** The kitchen's formatter: the reader's language, the kitchen's clock and money. */
import { useI18n } from "../i18n/index.tsx";
import { formatter, type Formatter } from "../lib/format.ts";
import { useKitchen } from "../state/kitchen.ts";

export function useKFmt(): Formatter {
  const { locale } = useI18n();
  const zone = useKitchen((s) => s.zone);
  const currency = useKitchen((s) => s.currency);
  return formatter(locale, zone, currency);
}
