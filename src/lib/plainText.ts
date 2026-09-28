/**
 * What a stranger may type into a field the manifest holds to plain text, as
 * Adminium judges it: letters, spaces and . , ' ’ ( ) & - only, at most 80
 * characters, no link (an order's name and note, an enquiry's name and notes);
 * and a line's note, which also names no place to go — no `@`, no `/`, no
 * dotted name ending in a known web ending ("Mary.Ann" is a name and passes).
 * The same rules, the same words, so the demo refuses what a kitchen would.
 */

export const PLAIN_TEXT_MAX = 80;

const PLAIN = /^[\p{L}\p{M} .,'’()&-]*$/u;

export function plainText(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const lower = value.toLowerCase();
  return value.length <= PLAIN_TEXT_MAX && PLAIN.test(value) && !lower.includes("://") && !lower.includes("www.");
}

/** The endings a web address a stranger could be sent to ends in. */
const KNOWN_TLDS: ReadonlySet<string> = new Set([
  // generic
  "com", "net", "org", "info", "biz", "edu", "gov", "mil", "int", "io", "co", "ai", "app", "dev", "xyz", "online", "site",
  "top", "shop", "store", "club", "live", "me", "tv", "cc", "ly", "gg", "sh", "fm", "ws", "link", "click", "help", "support",
  "page", "pro", "name", "mobi", "tech", "website", "space", "world", "today", "news", "blog", "cloud", "email", "host", "lol",
  "vip", "win", "bid", "loan", "work", "review", "download", "racing", "date", "trade", "science", "party", "stream", "fun",
  "icu", "buzz", "cam", "rest", "bar", "cyou", "monster", "sbs", "cfd", "ink", "wiki", "social", "events", "tickets",
  "finance", "money", "bank", "pay", "gift", "gifts", "deals", "sale", "promo", "claims", "refund",
  // countries a link is usually made with
  "uk", "de", "fr", "nl", "eu", "us", "ca", "au", "in", "br", "jp", "cn", "ru", "it", "es", "pl", "ch", "se", "dk", "fi",
  "at", "cz", "pt", "ie", "nz", "za", "mx", "tr", "ua", "kr", "hk", "sg", "tw", "vn", "ng", "ke", "gr", "ro", "hu", "su",
  "рф", "срб", "укр", "бел", "қаз",
]);

/** A name with dots between its parts; the last part is read as an ending. */
const DOTTED = /[\p{L}\p{M}-]+(?:\.[\p{L}\p{M}-]+)+/gu;

export function linkFreeText(value: unknown): boolean {
  if (!plainText(value)) return false;
  if (typeof value !== "string") return true;
  if (value.includes("@") || value.includes("/")) return false;
  for (const [dotted] of value.matchAll(DOTTED)) {
    const ending = dotted.slice(dotted.lastIndexOf(".") + 1).toLowerCase();
    if (KNOWN_TLDS.has(ending)) return false;
  }
  return true;
}
