/**
 * The kitchen's one text: "your order is ready", in the languages the app
 * ships, sent from the business's own Twilio or Telnyx account.
 *
 * A text is short and public: it shows on a locked phone. So it says the
 * kitchen's name first (Taiwan's carriers want the brand to open every text),
 * the order's number and that it is ready, and nothing else: no link, no
 * code, no total, no offer, and never "reply YES". The opt-out line is not
 * written here: Adminium adds it after the placeholders are filled, the one
 * that works for the sender ("Reply STOP to opt out." from a number, the
 * kitchen's phone from a sender name).
 *
 * `{{appName}}` is the kitchen's name (Settings), `{{order.number}}` the
 * order's own number. With the opt-out line added, a text in English,
 * German, French or Danish stays one GSM-7 segment, and every language stays
 * within two even under a long kitchen name (`texts.test.ts`).
 */
import { l, type Tag } from "./labels.ts";
import type { TextKind } from "./outbox.ts";

export const READY_TEXT: Record<Tag, string> = {
  "en-US": "{{appName}}: your order #{{order.number}} is ready to collect.",
  "de-DE": "{{appName}}: Deine Bestellung #{{order.number}} ist abholbereit.",
  "fr-FR": "{{appName}} : votre commande #{{order.number}} vous attend au comptoir.",
  "da-DK": "{{appName}}: Din bestilling #{{order.number}} er klar til afhentning.",
  "cs-CZ": "{{appName}}: objednávka #{{order.number}} je připravena k vyzvednutí.",
  "ar-EG": "{{appName}}: طلبك رقم {{order.number}} جاهز للاستلام.",
  "zh-CN": "{{appName}}：您的订单 #{{order.number}} 已备好，可以取餐了。",
  "zh-TW": "{{appName}}：您的餐點 #{{order.number}} 已備妥，可以取餐了。",
};

const BODIES: Record<TextKind, Record<Tag, string>> = { "order-ready-text": READY_TEXT };
const NAMES: Record<TextKind, string> = { "order-ready-text": "Order ready (text)" };

/** One text template per text kind, keyed as the outbox names it. */
export function textTemplates(kinds: readonly TextKind[]): Record<string, unknown>[] {
  return kinds.map((kind) => ({
    key: `ordering-${kind}`,
    name: l(NAMES[kind]),
    locales: Object.fromEntries(Object.entries(BODIES[kind]).map(([tag, body]) => [tag, { body }])),
  }));
}
