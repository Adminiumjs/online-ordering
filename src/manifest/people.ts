/**
 * The kitchen's diners, as Adminium is told of them (`people`), and the tick
 * a diner gives at checkout ("Email me news and offers").
 *
 * A diner account (`customers`) is a person: made by their first order from
 * the address they type, and signed in to by a link emailed to it. Their
 * address is the one the outbox writes to and the one they sign in with;
 * their name is the one their first order gave; their language is the one
 * that order was placed in. `opt_in` ("News from us") is the newsletter's
 * consent, kept in step with Adminium's consent log: the tick at checkout
 * writes a row in the log and sets it, an unsubscribe clears it, and
 * "Delete my details" records the withdrawal before it empties it.
 *
 * A diner is also copied onto every order of theirs (the name for the pickup
 * shelf, the address the confirmation went to, the mobile the kitchen calls)
 * and onto a large-order enquiry, which is linked to nobody. Each copy is
 * declared, so that finding, exporting and erasing a person reaches it; an
 * order and its money are the kitchen's record of a sale, which the law
 * keeps (`keep` on their tables), so an erasure leaves those as they are.
 *
 * A diner's mobile (`phone`) is the one their first order gave: where a text
 * they asked for goes. "Text me when my order is ready" is a box of its own
 * at checkout (`TEXT_BOX`), kept in Adminium's text consent log for that
 * number, apart from the newsletter's tick.
 */
import { diner } from "../i18n/strings/diner.ts";
import { LOCALES, type Tag } from "./labels.ts";

/** The tick, and the line under it: what a diner is shown at checkout, by the order page's own keys. */
export const TICK_KEYS = ["co.optIn", "co.optIn.note"] as const;

/** The box for texts, its line and its note: what a diner is shown under the mobile field at checkout. */
export const TEXT_BOX_KEYS = ["co.texts", "co.texts.note", "co.texts.optional"] as const;

/** The sentences in one language, one a line, from the order page's own words. */
function shown(tag: Tag, keys: readonly string[] = TICK_KEYS): string {
  const words = diner[tag] as Partial<Record<string, string>>;
  return keys.map((key) => {
    const said = words[key];
    if (said === undefined) throw new Error(`the checkout's tick has no ${tag} words for "${key}"`);
    return said;
  }).join("\n");
}

/**
 * The checkout's tick, as the consent log keeps it: the order's `opt_in`,
 * for the newsletter, with the sentences shown beside the box. `{venue}`
 * stands for the kitchen's name, which the box shows in its place. A new
 * wording is a new version.
 */
export const NEWS_TICK = {
  column: "opt_in",
  purpose: "newsletter",
  wording: { version: 1, text: Object.fromEntries(LOCALES.map((tag) => [tag, shown(tag)])) },
};

/**
 * The checkout's box for texts, as the text consent log keeps it: the order's
 * `texts_ok`, a yes to service texts about this order for the mobile typed
 * beside it, with the three lines shown with the box. It is never the
 * newsletter's tick, and the newsletter's yes never ticks it. A new wording
 * is a new version.
 */
export const TEXT_BOX = {
  column: "texts_ok",
  phone: "phone",
  class: "service",
  wording: { version: 1, text: Object.fromEntries(LOCALES.map((tag) => [tag, shown(tag, TEXT_BOX_KEYS)])) },
};

export const PEOPLE = [
  {
    table: "customers",
    kind: "people",
    email: "email",
    // The mobile a text goes to (the outbox's `recipient.phone`): the one their first order gave.
    phone: "phone",
    name: "name",
    firstName: "firstWordOfName",
    language: "language",
    consent: { column: "opt_in", purpose: "newsletter" },
    copies: [
      // Every order keeps its diner's own details: the account's, or the ones a caller gave the kitchen.
      { table: "orders", column: "name", holds: "name", via: "customer_id" },
      { table: "orders", column: "email", holds: "email", via: "customer_id" },
      { table: "orders", column: "phone", holds: "phone", via: "customer_id" },
      // A large-order enquiry is nobody's account: found by the address it holds.
      { table: "enquiries", column: "name", holds: "name" },
      { table: "enquiries", column: "email", holds: "email" },
      { table: "enquiries", column: "phone", holds: "phone" },
    ],
  },
];
