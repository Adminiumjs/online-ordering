/**
 * The Online ordering section in the dashboard: its pages, their forms and
 * the groups they sit in.
 *
 * The Overview first, with no heading of its own; then Orders, Menu, Kitchen
 * and People, as the Ordering Overview design draws them, and the emails and
 * the settings last. The kitchen's own screens are the app's staff side, on
 * their own address; the sidebar links to them.
 *
 * Forms are v2 documents. A value Adminium works out — a total, a number, a
 * stamp — shows in a form and cannot be typed over.
 */
import { l, titles } from "./labels.ts";
import { OVERVIEW_LAYOUT } from "./overview.ts";

export const NAV_GROUPS = [
  { key: "orders", label: l("Orders"), order: 1 },
  { key: "menu", label: l("Menu"), order: 2 },
  { key: "kitchen", label: l("Kitchen"), order: 3 },
  { key: "people", label: l("People"), order: 4 },
  { key: "manage", label: l("Manage"), order: 5 },
];

type Field = Record<string, unknown>;
const f = (column: string, more: Field = {}): Field => ({ column, ...more });
const title = (column: string): Field => ({ column, control: "title", span: 2 });
const wide = (column: string, control = "textarea"): Field => ({ column, control, span: 2 });
const toggle = (column: string): Field => ({ column, control: "toggle-row" });
const rows = (relation: string, columns: Field[]): Field => ({ relation, control: "child-rows", span: 2, columns });
const form = (...sections: Field[][]) => ({
  form: { v: 2, sections: sections.map((fields, i) => ({ id: `s${String(i + 1)}`, fields })) },
});

interface PageSpec {
  ref: string;
  template: string;
  title: string;
  group: string;
  icon: string;
  order: number;
  table?: string;
  config: Record<string, unknown>;
}

const SPECS: PageSpec[] = [
  {
    ref: "ordering-overview",
    template: "page-dashboard",
    title: "Overview",
    group: "overview",
    icon: "layout-dashboard",
    order: 0,
    config: { layout: OVERVIEW_LAYOUT },
  },

  // ── orders ─────────────────────────────────────────────────────────────────
  {
    ref: "ordering-orders",
    template: "page-queue-inbox",
    title: "Orders",
    group: "orders",
    icon: "receipt",
    order: 1,
    table: "orders",
    config: form(
      [title("number"), f("status", { control: "segmented" }), f("pickup_at", { control: "datetime" }), f("channel", { control: "segmented" })],
      [f("name"), f("phone", { control: "phone" }), f("email", { control: "email" }), f("language"), wide("note", "text")],
      [
        rows("order_items", [
          { column: "menu_item_id", control: "reference", width: "2fr" },
          { column: "qty", width: "80px" },
          { column: "note", width: "1fr" },
          { column: "unit_total", control: "currency", width: "110px" },
          { column: "line_total", control: "currency", width: "110px" },
        ]),
      ],
      [f("subtotal", { control: "currency" }), f("tax_rate", { control: "number" }), f("tax", { control: "currency" }), f("total", { control: "currency" }), f("paid_method", { control: "segmented" })],
      [f("cancel_code", { control: "select" }), f("cancel_dish"), wide("cancel_note", "text")],
      [
        f("placed_at", { control: "datetime" }),
        f("confirmed_at", { control: "datetime" }),
        f("confirmed_by"),
        f("preparing_at", { control: "datetime" }),
        f("ready_at", { control: "datetime" }),
        f("ready_by"),
        f("picked_up_at", { control: "datetime" }),
        f("picked_up_by"),
        f("cancelled_at", { control: "datetime" }),
        f("cancelled_by"),
        f("not_collected_at", { control: "datetime" }),
      ],
      [f("customer_id", { control: "reference" }), f("link_expires", { control: "datetime" }), toggle("link_stopped")],
    ),
  },
  {
    ref: "ordering-enquiries",
    template: "page-queue-inbox",
    title: "Enquiries",
    group: "orders",
    icon: "inbox",
    order: 2,
    table: "enquiries",
    config: form(
      [title("ref"), f("status", { control: "segmented" }), f("heads", { control: "stepper" }), f("wanted_on", { control: "date" })],
      [f("name"), f("phone", { control: "phone" }), f("email", { control: "email" }), f("language"), wide("notes")],
      [wide("staff_note"), f("handled_by"), f("created_at", { control: "datetime" })],
    ),
  },

  // ── the menu ─────────────────────────────────────────────────────────────────
  {
    ref: "ordering-dishes",
    template: "page-crud",
    title: "Dishes",
    group: "menu",
    icon: "utensils",
    order: 1,
    table: "menu_items",
    config: form(
      [title("name"), f("category_id", { control: "reference" }), f("price", { control: "currency" }), wide("description")],
      [f("tags"), f("allergens"), f("image", { control: "image" }), f("hue")],
      [toggle("available"), toggle("online"), toggle("featured"), f("stock_today", { control: "stepper" }), f("stock_on", { control: "date" }), f("position", { control: "stepper" })],
    ),
  },
  {
    ref: "ordering-categories",
    template: "page-crud",
    title: "Categories",
    group: "menu",
    icon: "folder-tree",
    order: 2,
    table: "menu_categories",
    config: form([title("name"), f("icon"), f("tint"), f("position", { control: "stepper" })]),
  },
  {
    ref: "ordering-option-groups",
    template: "page-crud",
    title: "Option groups",
    group: "menu",
    icon: "layers",
    order: 3,
    table: "modifier_groups",
    config: form(
      [title("name"), f("item_id", { control: "reference" }), f("kind", { control: "segmented" }), wide("hint", "text")],
      [f("min", { control: "stepper" }), f("max", { control: "stepper" }), f("position", { control: "stepper" })],
    ),
  },
  {
    ref: "ordering-options",
    template: "page-crud",
    title: "Options",
    group: "menu",
    icon: "list-checks",
    order: 4,
    table: "modifiers",
    config: form([title("name"), f("group_id", { control: "reference" }), f("price_delta", { control: "currency" }), f("allergens"), toggle("available"), f("position", { control: "stepper" })]),
  },

  // ── the kitchen's calendar ────────────────────────────────────────────────────
  {
    ref: "ordering-hours",
    template: "page-crud",
    title: "Hours",
    group: "kitchen",
    icon: "clock",
    order: 1,
    table: "hours",
    config: form([f("weekday", { control: "select" }), toggle("open"), f("opens"), f("closes")]),
  },
  {
    ref: "ordering-closures",
    template: "page-crud",
    title: "Closures",
    group: "kitchen",
    icon: "calendar-x",
    order: 2,
    table: "closures",
    config: form([f("from_date", { control: "date" }), f("to_date", { control: "date" }), wide("reason", "text"), toggle("active")]),
  },
  {
    ref: "ordering-paused-slots",
    template: "page-crud",
    title: "Paused slots",
    group: "kitchen",
    icon: "circle-pause",
    order: 3,
    table: "slot_pauses",
    config: form([f("slot_at", { control: "datetime" }), toggle("active"), f("paused_by"), f("paused_at", { control: "datetime" })]),
  },

  // ── people ───────────────────────────────────────────────────────────────────
  {
    ref: "ordering-customers",
    template: "page-crud",
    title: "Customers",
    group: "people",
    icon: "contact",
    order: 1,
    table: "customers",
    config: form([title("name"), f("email", { control: "email" }), f("created_at", { control: "datetime" }), f("forgotten_at", { control: "datetime" })]),
  },

  // ── the emails and the settings ─────────────────────────────────────────────
  {
    ref: "ordering-messages",
    template: "page-crud",
    title: "Messages",
    group: "manage",
    icon: "message-square",
    order: 1,
    table: "messages",
    config: form([
      f("kind"),
      f("status", { control: "select" }),
      f("to_address", { control: "email" }),
      f("language"),
      f("order_id", { control: "reference" }),
      f("enquiry_id", { control: "reference" }),
      f("customer_id", { control: "reference" }),
      f("due", { control: "datetime" }),
      f("sent_at", { control: "datetime" }),
      f("skip_reason", { control: "select" }),
      wide("error", "text"),
    ]),
  },
  {
    ref: "ordering-settings",
    template: "page-crud",
    title: "Settings",
    group: "manage",
    icon: "settings",
    order: 2,
    table: "settings",
    config: form(
      [title("venue_name"), f("phone", { control: "phone" }), wide("address", "text"), f("area"), wide("directions")],
      [f("headline"), wide("intro"), f("about")],
      [f("photo_hero", { control: "image" }), f("photo_street", { control: "image" }), f("photo_closed", { control: "image" }), f("photo_store", { control: "image" })],
      [
        f("tax_rate", { control: "number" }),
        f("slot_minutes", { control: "stepper" }),
        f("slot_capacity", { control: "stepper" }),
        f("lead_minutes", { control: "stepper" }),
        f("preorder_days", { control: "stepper" }),
        f("prep_minutes", { control: "stepper" }),
        f("max_items", { control: "stepper" }),
        f("first_order_number", { control: "number" }),
      ],
      [toggle("online_on"), toggle("ready_email_on"), toggle("receipt_email_on")],
    ),
  },
];

/** A page as the manifest carries it. */
const pageOf = (spec: PageSpec) => ({
  ref: spec.ref,
  template: spec.template,
  title: { key: `mft.${spec.ref.replaceAll("-", ".")}`, fallback: spec.title },
  titles: titles(spec.title),
  nav: { group: spec.group, icon: spec.icon, order: spec.order },
  ...(spec.table === undefined ? {} : { bindings: { rows: spec.table } }),
  config: spec.config,
});

export function pages(): unknown[] {
  return SPECS.map(pageOf);
}

/** Every page's ref, in order (the manager's role grants them by name). */
export const PAGE_REFS = SPECS.map((spec) => spec.ref);
