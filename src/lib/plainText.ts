/**
 * What a stranger may type into a field the manifest holds to plain text, as
 * Adminium judges it (`public-api/anonymous-caps.ts`, 0.3.8): letters, marks,
 * spaces and the punctuation a sentence is written with in the diner's own
 * script — the Latin `. , ' ’ ( ) & - ! ? : ; "` and `¿ ¡ « » „ “ ”`, the CJK
 * `，。、！？：；「」『』・` and the Arabic `، ؛ ؟` — and no link. A name holds
 * no digits and 80 characters; a note, the few digits and the length its rule
 * gives ("2 without onions", "table 12"). The same rules, the same words, so
 * the demo refuses what a kitchen would.
 */

export const PLAIN_TEXT_MAX = 80;

/** How many digits a column may hold, and how long it may run. */
export interface PlainTextRule {
  digits: number;
  max: number;
}

/** A name's rule: no digits, 80 characters. */
export const NAME_RULE: PlainTextRule = { digits: 0, max: PLAIN_TEXT_MAX };

/** A line's note, as the manifest holds it (`order_items.note`): a few digits, the 80 characters it holds. */
export const LINE_NOTE_RULE: PlainTextRule = { digits: 4, max: 80 };

/** A `plainText` entry of the manifest: a column (a name's rule), or `{ column, digits?, max? }`. */
export type PlainTextColumn = string | { column: string; digits?: number; max?: number };

export const columnOf = (entry: PlainTextColumn): string => (typeof entry === "string" ? entry : entry.column);
export const ruleOf = (entry: PlainTextColumn): PlainTextRule =>
  typeof entry === "string" ? NAME_RULE : { digits: entry.digits ?? 0, max: entry.max ?? PLAIN_TEXT_MAX };

const PLAIN = /^[\p{L}\p{M}\p{Nd} .,'’()&\-!?:;"¿¡«»„“”，。、！？：；「」『』・،؛؟]*$/u;
const DIGIT = /\p{Nd}/gu;

export function plainText(value: unknown, rule: PlainTextRule = NAME_RULE): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  if (value.length > rule.max || !PLAIN.test(value)) return false;
  if ((value.match(DIGIT)?.length ?? 0) > rule.digits) return false;
  const lower = asShown(value).toLowerCase();
  return !lower.includes("://") && !lower.includes("www.");
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
  // what a venue, a shop or a clinic is called online
  "cafe", "restaurant", "pub", "hotel", "clinic", "dental", "health", "care", "company", "menu", "pizza", "food", "kitchen",
  "delivery", "booking", "travel", "ticket", "services", "center", "agency", "group", "solutions", "network", "express",
  "digital", "market", "shopping", "global", "plus", "zone", "one", "best", "free", "new", "studio", "design", "media",
  "art", "chat", "cash", "credit", "loans", "tax", "legal", "law", "exchange", "zip", "mov",
  // countries a link is usually made with
  "uk", "de", "fr", "nl", "eu", "us", "ca", "au", "in", "br", "jp", "cn", "ru", "it", "es", "pl", "ch", "se", "dk", "fi",
  "at", "cz", "pt", "ie", "nz", "za", "mx", "tr", "ua", "kr", "hk", "sg", "tw", "vn", "ng", "ke", "gr", "ro", "hu", "su",
  "be", "to", "li", "im", "nu", "ee", "lv", "lt", "sk", "si", "hr", "bg", "rs", "il", "ae", "sa", "qa", "ph", "th", "pk",
  "eg", "kz", "lu", "cl", "tk", "ga", "ml", "cf", "gy", "ac", "st", "vc",
  // other scripts
  "рф", "срб", "укр", "бел", "қаз", "москва", "онлайн", "сайт", "中国", "中國", "网址", "公司", "网络",
]);

/** The endings read as an address even after one capital letter: `X.Com` is one, `W.Hu` a name. */
const ALWAYS_ADDRESS: ReadonlySet<string> = new Set(["com", "net", "org", "info", "biz", "io", "co", "app", "dev", "shop", "online", "site"]);

/** A name with dots between its parts (and digits, where a note may hold them); the last part is read as an ending. */
const DOTTED = /[\p{L}\p{M}\p{Nd}-]+(?:\.[\p{L}\p{M}\p{Nd}-]+)+/gu;

/** The text as a reader takes it in: fullwidth letters as plain ones, marks and invisible characters out, `。` a dot. */
function asShown(value: string): string {
  return value.normalize("NFKD").replace(/[\p{M}\p{Default_Ignorable_Code_Point}]/gu, "").replace(/\u3002/g, ".");
}

const trimmed = (part: string): string => part.replace(/^[-\p{P}]+|[-\p{P}]+$/gu, "");

/** Initials before a surname (`W.Hu`, `K.Y.Ng`): single capitals, then one capitalised word. */
function initialsName(parts: readonly string[]): boolean {
  const last = parts[parts.length - 1]!;
  return parts.slice(0, -1).every((part) => /^\p{Lu}$/u.test(part)) && /^\p{Lu}\p{Ll}+$/u.test(last);
}

export function linkFreeText(value: unknown, rule: PlainTextRule = NAME_RULE): boolean {
  if (!plainText(value, rule)) return false;
  if (typeof value !== "string") return true;
  if (value.includes("@") || value.includes("/")) return false;
  for (const [dotted] of asShown(value).matchAll(DOTTED)) {
    const parts = dotted.split(".").map(trimmed).filter((part) => part !== "");
    if (parts.length < 2) continue;
    const ending = parts[parts.length - 1]!.toLowerCase();
    if (!KNOWN_TLDS.has(ending)) continue;
    if (initialsName(parts) && !ALWAYS_ADDRESS.has(ending)) continue;
    return false;
  }
  return true;
}

/**
 * Whether Adminium would send to an address at all. It never mails a domain
 * reserved for examples and tests (`example.com`, `mail.example`, `.test`,
 * `.invalid`, `.localhost`) — which is what every sample order carries — so a
 * screen must not say "we've emailed them" about one.
 */
export function mailable(address: unknown): boolean {
  if (typeof address !== "string") return false;
  const at = address.trim().lastIndexOf("@");
  if (at <= 0) return false;
  const domain = address.trim().slice(at + 1).toLowerCase().replace(/\.$/, "");
  if (domain === "") return false;
  // The same rule as Adminium's sender: `example.<anything>`, or a `.test`, `.invalid`, `.localhost` or `.example` name.
  const labels = domain.split(".");
  const top = labels[labels.length - 1] ?? "";
  return !(labels[0] === "example" || ["test", "invalid", "localhost", "example"].includes(top));
}
