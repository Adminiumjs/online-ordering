/**
 * The kitchen's emails, one template per outbox kind, in the languages the
 * app ships.
 *
 * Each email's words are a small record of sentences (`Words`), and the layout
 * that holds them is written once below, so a translation is only the words —
 * nobody re-builds a block list per language, and no language can lose a block
 * the others have.
 *
 * `{{…}}` are the outbox's variables, filled by Adminium when it sends:
 * `order.*` and `enquiry.*` through the message's links; `practice.*` the
 * kitchen's settings row; `recipient.first_name` the diner; `appName` the
 * kitchen's name; `manage_url` the diner's order page. A time reads in the
 * diner's language and the kitchen's clock (`.time`, `.day_month`,
 * `.relative_day`); money in the connection's currency.
 *
 * Only the online confirmation carries the order's own link: a code is sent
 * only to the person it opens the order for, and the ready, cancelled and
 * receipt emails have no need of it.
 */
import type { Tag } from "./labels.ts";
import type { Kind } from "./outbox.ts";

/** One email's sentences. */
export interface Words {
  name: string;
  subject: string;
  preheader: string;
  heading?: string;
  paras: string[];
  button?: string;
}

export type EmailWords = Record<Kind, Words> & {
  /** "Pay at pickup, cash or card." */
  payAtPickup: string;
  subtotal: string;
  tax: string;
  total: string;
  /** The footer of an email about an order, and of one about an enquiry. */
  orderFoot: string;
  enquiryFoot: string;
};

const NOTHING_CHARGED = "Nothing was charged — you pay at pickup, and nothing was picked up.";
const CALL_US = "Call us on {{practice.phone}} if you'd like to order again.";

export const EMAIL_EN: EmailWords = {
  payAtPickup: "Pay at pickup, cash or card.",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total",
  orderFoot: "{{appName}} · {{practice.address}} · {{practice.phone}}. You're getting this because you ordered from us.",
  enquiryFoot: "{{appName}} · {{practice.address}} · {{practice.phone}}. You're getting this because you sent us a large-order enquiry.",
  "order-confirmation": {
    name: "Order confirmation",
    subject: "Your order #{{order.number}} is in",
    preheader: "Pickup {{order.pickup_at.relative_day}} at {{order.pickup_at.time}} · {{order.total}} to pay at pickup",
    heading: "Thanks, {{recipient.first_name}}.",
    paras: ["We've got your order #{{order.number}} for {{order.pickup_at.relative_day}}, {{order.pickup_at.day_month}} at {{order.pickup_at.time}}."],
    button: "Follow your order",
  },
  "order-confirmation-phone": {
    name: "Order confirmation (phone)",
    subject: "Your order #{{order.number}} is in",
    preheader: "Pickup {{order.pickup_at.relative_day}} at {{order.pickup_at.time}} · {{order.total}} to pay at pickup",
    heading: "Thanks, {{recipient.first_name}}.",
    paras: [
      "Here is the order you placed by phone: #{{order.number}} for {{order.pickup_at.relative_day}}, {{order.pickup_at.day_month}} at {{order.pickup_at.time}}.",
      "Call us on {{practice.phone}} if anything changes.",
    ],
  },
  "order-ready": {
    name: "Order ready",
    subject: "#{{order.number}} is on the shelf",
    preheader: "On the shelf now · {{order.total}} to pay",
    heading: "#{{order.number}} is ready.",
    paras: ["Come on in — it's waiting for you, filed by number.", "{{practice.directions}}", "You'll pay {{order.total}} at the counter."],
  },
  "order-cancelled-ran-out": {
    name: "Cancelled: something ran out",
    subject: "We had to cancel #{{order.number}}",
    preheader: "Nothing was charged",
    heading: "Sorry, {{recipient.first_name}}.",
    paras: ["Something ran out: {{order.cancel_dish}}.", NOTHING_CHARGED, CALL_US],
  },
  "order-cancelled-too-busy": {
    name: "Cancelled: the kitchen was too busy",
    subject: "We had to cancel #{{order.number}}",
    preheader: "Nothing was charged",
    heading: "Sorry, {{recipient.first_name}}.",
    paras: ["The kitchen is too busy to make it in time.", NOTHING_CHARGED, CALL_US],
  },
  "order-cancelled-customer-asked": {
    name: "Cancelled: as the customer asked",
    subject: "We've cancelled #{{order.number}}",
    preheader: "Nothing was charged",
    paras: ["As you asked, we've cancelled #{{order.number}}.", NOTHING_CHARGED, CALL_US],
  },
  "order-cancelled-closed": {
    name: "Cancelled: not ready by closing",
    subject: "We had to cancel #{{order.number}}",
    preheader: "Nothing was charged",
    heading: "Sorry, {{recipient.first_name}}.",
    paras: ["We closed before your order was ready, so we've cancelled it.", NOTHING_CHARGED, CALL_US],
  },
  "order-cancelled-other": {
    name: "Cancelled: another reason",
    subject: "We had to cancel #{{order.number}}",
    preheader: "Nothing was charged",
    heading: "Sorry, {{recipient.first_name}}.",
    paras: ["{{order.cancel_note}}", NOTHING_CHARGED, CALL_US],
  },
  "order-cancelled-by-you": {
    name: "Cancelled by the customer",
    subject: "You cancelled #{{order.number}}",
    preheader: "Nothing was charged",
    paras: [
      "You cancelled #{{order.number}} at {{order.cancelled_at.time}}. Nothing was charged.",
      "If you didn't cancel it, call us on {{practice.phone}}.",
    ],
  },
  "order-receipt": {
    name: "Receipt",
    subject: "Your receipt from {{appName}}",
    preheader: "#{{order.number}} · {{order.total}}",
    heading: "Thanks for picking up #{{order.number}}.",
    paras: ["Your receipt is attached: {{order.total}}."],
  },
  "enquiry-received": {
    name: "Large order enquiry received",
    subject: "We got your enquiry, {{enquiry.ref}}",
    preheader: "{{enquiry.ref}} · {{enquiry.heads}} people",
    heading: "{{enquiry.heads}} people on {{enquiry.wanted_on}}.",
    paras: [
      "Your reference is {{enquiry.ref}}.",
      "Someone from the kitchen will call you to talk it through — the same day if we're open, or soon after we open.",
    ],
  },
};

type Block = { block: string; id: string; data: Record<string, unknown> };
const para = (id: string, ...paras: string[]): Block => ({ block: "email.text", id, data: { paras } });

/** An order's lines, each with its options gathered into one line. */
const LINES: Block = {
  block: "email.rows",
  id: "lines",
  data: {
    from: { link: "order", table: "order_items", via: "order_id", orderBy: "position", limit: 50 },
    joins: { options: { table: "order_item_modifiers", via: "order_item_id", column: "name", orderBy: "id", separator: ", " } },
    row: { title: "{{row.name}} × {{row.qty}}", meta: "{{row.options}}", amount: "{{row.line_total}}", note: "{{row.note}}" },
  },
};

/** The emails that list what was ordered and what it costs. */
const WITH_LINES: ReadonlySet<Kind> = new Set(["order-confirmation", "order-confirmation-phone"]);

function layout(kind: Kind, all: EmailWords) {
  const w = all[kind];
  const blocks: Block[] = [];
  if (w.heading !== undefined) blocks.push({ block: "email.heading", id: "heading", data: { text: w.heading } });
  blocks.push(para("body", ...w.paras));
  if (WITH_LINES.has(kind)) {
    blocks.push(LINES);
    blocks.push({
      block: "email.tax-breakdown",
      id: "totals",
      data: {
        lines: [
          { label: all.subtotal, amount: "{{order.subtotal}}" },
          { label: all.tax, amount: "{{order.tax}}" },
          { label: all.total, amount: "{{order.total}}" },
        ],
      },
    });
    blocks.push({ block: "email.box", id: "pay", data: { label: all.payAtPickup } });
    blocks.push({ block: "email.contact", id: "where", data: { name: "{{practice.address}}" } });
    blocks.push(para("directions", "{{practice.directions}}"));
  }
  if (kind === "order-confirmation" && w.button !== undefined) {
    blocks.push({ block: "email.button", id: "follow", data: { label: w.button, url: "{{manage_url}}#{{order.link_token}}" } });
  }
  return {
    subject: w.subject,
    preheader: w.preheader,
    blocks,
    footer: kind === "enquiry-received" ? all.enquiryFoot : all.orderFoot,
  };
}

/** Every language's words: English here, the others as they are translated. */
export function emailWords(): Partial<Record<Tag, EmailWords>> & { "en-US": EmailWords } {
  return { "en-US": EMAIL_EN };
}

/** The variables each template reads, for the template editor's list. */
function varsOf(kind: Kind): string[] {
  const text = JSON.stringify(layout(kind, EMAIL_EN));
  const found = new Set<string>();
  for (const [, name] of text.matchAll(/\{\{([A-Za-z_.]+)\}\}/g)) found.add(name!);
  return [...found].filter((name) => /^[a-z_]+(\.[a-z_]+)*$/.test(name) && !name.startsWith("row.")).sort();
}

/** The manifest's `emailTemplates`: one per kind, in every language the words are in. */
export function emailTemplates(kinds: readonly Kind[]): unknown[] {
  const words = emailWords();
  return kinds.map((kind) => ({
    key: `ordering-${kind}`,
    name: Object.fromEntries(Object.entries(words).map(([tag, w]) => [tag, w[kind].name])),
    vars: varsOf(kind),
    ...(kind === "order-receipt" ? { attach: { kind: "receipt", link: "order" } } : {}),
    locales: Object.fromEntries(Object.entries(words).map(([tag, w]) => [tag, layout(kind, w)])),
  }));
}
