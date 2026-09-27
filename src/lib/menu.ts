/**
 * The menu as the screens draw it, from the rows Adminium lets out: each
 * dish with its category's icon, its tile colour, its tags and allergens, and
 * its option groups in order.
 *
 * Prices here are for DISPLAY only — "from $15.50" on a card, a line's sum in
 * the cart while the dry run is on its way. What an order costs is always
 * Adminium's answer (the dry run, then the order itself).
 */
import type { Menu } from "../data/ports.ts";
import type { DishState, Id, Row } from "../data/wire.ts";
import type { IconName } from "../components/Icon.tsx";

export interface Option {
  id: Id;
  groupId: Id;
  name: string;
  delta: number;
  allergens: string | null;
  available: boolean;
}

export interface Group {
  id: Id;
  dishId: Id;
  name: string;
  /** Pick one (a radio) or pick any (checks). */
  one: boolean;
  min: number;
  max: number;
  hint: string | null;
  options: Option[];
}

export interface Dish {
  id: Id;
  name: string;
  description: string;
  price: number;
  categoryId: Id | null;
  image: string | null;
  hue: number;
  icon: IconName;
  tags: string[];
  featured: boolean;
  allergens: string | null;
  available: boolean;
  online: boolean;
  groups: Group[];
  position: number;
}

export interface Category {
  id: Id;
  name: string;
  icon: IconName;
  hue: number;
  position: number;
}

const ICONS: readonly IconName[] = ["pizza", "salad", "soup", "cup-soda", "cookie", "utensils"];
const iconOf = (value: unknown, fallback: IconName = "utensils"): IconName => (ICONS.includes(value as IconName) ? (value as IconName) : fallback);
const num = (value: unknown, fallback = 0) => (value === null || value === undefined || value === "" ? fallback : Number(value));

/** A category's tile colour when it names none: its dishes' first. */
const CATEGORY_HUES: Record<string, number> = { salad: 128, pizza: 20, soup: 96, "cup-soda": 200, cookie: 32 };

export interface MenuModel {
  categories: Category[];
  dishes: Dish[];
  dish(id: Id): Dish | undefined;
  option(id: Id): Option | undefined;
}

/** The menu's rows, joined: categories, dishes with their groups and options. */
export function menuModel(menu: Menu): MenuModel {
  const categories: Category[] = menu.categories
    .map((c) => {
      const icon = iconOf(c["icon"]);
      return { id: c.id, name: String(c["name"]), icon, hue: c["tint"] ? num(c["tint"], CATEGORY_HUES[icon] ?? 20) : (CATEGORY_HUES[icon] ?? 20), position: num(c["position"]) };
    })
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const options = menu.options.map(
    (o): Option => ({ id: o.id, groupId: Number(o["group_id"]), name: String(o["name"]), delta: num(o["price_delta"]), allergens: (o["allergens"] as string | null) ?? null, available: o["available"] !== false }),
  );
  const groups = menu.groups
    .map(
      (g): Group => ({
        id: g.id,
        dishId: Number(g["item_id"]),
        name: String(g["name"]),
        one: g["kind"] !== "check",
        min: num(g["min"]),
        max: num(g["max"], 1),
        hint: (g["hint"] as string | null) ?? null,
        options: options.filter((o) => o.groupId === g.id),
      }),
    )
    .sort((a, b) => num(menu.groups.find((g) => g.id === a.id)?.["position"]) - num(menu.groups.find((g) => g.id === b.id)?.["position"]));
  const dishes: Dish[] = menu.items
    .map((d) => {
      const category = categories.find((c) => c.id === d["category_id"]);
      return {
        id: d.id,
        name: String(d["name"]),
        description: String(d["description"] ?? ""),
        price: num(d["price"]),
        categoryId: (d["category_id"] as Id | null) ?? null,
        image: (d["image"] as string | null) ?? null,
        hue: num(d["hue"], category?.hue ?? 20),
        icon: category?.icon ?? "utensils",
        tags: String(d["tags"] ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
        featured: d["featured"] === true,
        allergens: (d["allergens"] as string | null) ?? null,
        available: d["available"] !== false,
        online: d["online"] !== false,
        groups: groups.filter((g) => g.dishId === d.id),
        position: num(d["position"]),
      };
    })
    .sort((a, b) => a.position - b.position || a.id - b.id);
  return {
    categories,
    dishes,
    dish: (id) => dishes.find((d) => d.id === id),
    option: (id) => options.find((o) => o.id === id),
  };
}

/** What a dish costs at least, with the cheapest choice of each group it must have: "from $15.50". */
export function fromPrice(dish: Dish): { value: number; from: boolean } {
  let value = dish.price;
  for (const group of dish.groups) {
    if (group.min < 1) continue;
    const cheapest = group.options.filter((o) => o.available).map((o) => o.delta).sort((a, b) => a - b);
    value += cheapest.slice(0, group.min).reduce((sum, d) => sum + d, 0);
  }
  return { value, from: dish.groups.length > 0 };
}

/** A dish's price with these options, for display: the dish and each option's extra. */
export function unitPrice(dish: Dish, optionIds: readonly Id[]): number {
  let value = dish.price;
  for (const group of dish.groups) for (const option of group.options) if (optionIds.includes(option.id)) value += option.delta;
  return Math.round(value * 100) / 100;
}

/** The options of a line, group by group: "Farro · Grilled chicken · Avocado, Soft egg". */
export function optionsText(dish: Dish, optionIds: readonly Id[]): string {
  return dish.groups
    .map((g) => g.options.filter((o) => optionIds.includes(o.id)).map((o) => o.name).join(", "))
    .filter((part) => part !== "")
    .join(" · ");
}

/** The option names an order kept, grouped as the menu groups them when it still can. */
export function storedOptionsText(model: MenuModel | null, options: readonly Row[]): string {
  if (options.length === 0) return "";
  const byGroup = new Map<string, string[]>();
  for (const option of options) {
    const live = model?.option(Number(option["modifier_id"]));
    const key = live === undefined ? `x${String(option.id)}` : String(live.groupId);
    byGroup.set(key, [...(byGroup.get(key) ?? []), String(option["name"])]);
  }
  return [...byGroup.values()].map((names) => names.join(", ")).join(" · ");
}

/** Why a dish's options cannot go in yet: the first required group left empty. */
export function missingGroup(dish: Dish, optionIds: readonly Id[]): Group | null {
  return dish.groups.find((g) => g.options.filter((o) => optionIds.includes(o.id)).length < g.min) ?? null;
}

/** The allergens a dish and the options chosen carry, one list. */
export function allergensOf(dish: Dish, optionIds: readonly Id[] = []): string[] {
  const all = new Set<string>();
  for (const part of String(dish.allergens ?? "").split(",")) if (part.trim() !== "") all.add(part.trim());
  for (const group of dish.groups) {
    for (const option of group.options) {
      if (!optionIds.includes(option.id)) continue;
      for (const part of String(option.allergens ?? "").split(",")) if (part.trim() !== "") all.add(part.trim());
    }
  }
  return [...all];
}

/** Whether any option of a dish adds an allergen of its own. */
export const optionsAddAllergens = (dish: Dish): boolean => dish.groups.some((g) => g.options.some((o) => (o.allergens ?? "") !== ""));

/** A dish's portions on a day, from Adminium's answer: on sale, with "N left" when few are. */
export function portionsOf(states: readonly DishState[] | null, id: Id): { soldOut: boolean; left: number | null } {
  const state = states?.find((s) => s.id === String(id));
  if (state === undefined) return { soldOut: false, left: null };
  return { soldOut: state.state !== "on", left: state.left ?? null };
}
