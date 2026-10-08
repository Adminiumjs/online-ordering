# Online Ordering

A pickup kitchen's order page and its kitchen screens, installed into
[Adminium](https://adminium.dev). Diners order from the menu, pick a pickup
time and pay at the counter; the kitchen confirms, cooks, shelves and hands
over each order on a tablet. Adminium decides every price, total, order
number, pickup slot and status — the pages only ask.

**Pickup only, and pay at pickup.** There is no delivery, no card form and no
text message anywhere in it. An order is handed over a counter, and paid for
there.

The demo is dressed as **Juniper Kitchen**, a fictional pickup kitchen on
Junction Ave serving bowls and pizza, at 11:40 on a Tuesday lunch rush.

**Live demo → [adminium.dev/demo/online-ordering](https://adminium.dev/demo/online-ordering)**

## What it needs

- Adminium **0.3.20** or later, on SQLite, Postgres or MySQL.
- Nothing else. Four add-ons are offered at install, and the app is whole
  without any of them:
  - **Offers & gift cards** — diners type a code at checkout, automatic offers
    reduce the order by themselves, and a gift card pays for all or part of an
    order, online or at the counter.
  - **Inventory** — a dish linked to a stock item is held when it is ordered,
    taken when the kitchen starts cooking, and runs out with its ingredient.
  - **Invoices & Receipts** — a diner is emailed a receipt when they pick up
    and the dashboard prints one.
  - **Holiday calendars** — the kitchen's Hours tab lists the coming public
    holidays, each a closure in a tap.

## What it does

**For diners** (the app's customer side):
- The menu, with each dish's options — a size to choose, up to five toppings —
  and its allergens. A dish with few portions left says so; a sold-out one
  says so and cannot be ordered.
- A pickup time from the kitchen's own slots: inside the opening hours, far
  enough ahead, never in a full or paused slot, today or tomorrow.
- Checkout with a name, an email and an optional phone. The prices, tax and
  total come from Adminium before the order is placed, and again as it is
  placed: a price that changed in between is shown, never charged blind.
- With Offers & gift cards: a code and a gift card at checkout, each priced by
  Adminium and shown as it answered; and a page to check what a gift card
  still holds. A card is taken when the kitchen confirms the order, and what
  it took is put back when an order it paid for is cancelled.
- A confirmation email with a link to follow the order, and a page that follows
  it from "waiting for the kitchen" to "ready". While the kitchen has not taken
  it, the diner can cancel it there.
- Signing in with a link emailed to them, to see and reorder past orders.
- A large-order enquiry the kitchen calls back about.

**For the kitchen** (the app's staff side, on a tablet):
- The board: new, confirmed, preparing and ready orders, each one tap from the
  next, with a chime for a new order.
- The shelf and the hand-off: the amount to collect, and cash or card — and,
  with Offers & gift cards, a gift card for all of it or for a part.
- Slots: how full each pickup slot is, pausing one, or stopping online orders
  for the rest of the day.
- Today's menu: switching a dish or an option off, setting today's portions,
  marking a dish sold out.
- Phone orders, taken on the same menu and the same slots.

**In the dashboard** (the Online ordering section): the Overview, the orders
and enquiries, the menu, the hours, closures and paused slots, the customers,
the emails sent, and the settings — the kitchen's name, words and photos, its
tax rate, its slot size and whether it takes online orders.

With Point of Sale installed, the two apps can share one menu.

## Installing it

Install Online Ordering from Adminium's app catalog and pick the database it
should use. Adminium creates the app's tables, the dashboard pages, the
`kitchen` and `manager` roles, the diners' browser key and the emails. Tick
sample data at the install step to start with Juniper Kitchen's Tuesday, or
add it later from the app's settings.

Once installed, the kitchen's screens are served at `/apps/ordering/staff/`
and the diners' side at `/apps/ordering/customer/`. A kitchen can also give
the diners' side a domain of its own.

**Moving from 0.2.x.** 0.3.0 updates a 0.2.x install in place: update
Adminium to 0.3.20 first, then the app. Every order, dish, slot and customer
is kept as it is. Orders gain what was taken off, what was paid and what is
still owed; an order placed before the update owes its whole total, as it did.
Nothing changes for diners or the kitchen until an add-on is switched on: tick
Offers & gift cards or Inventory in the app's settings whenever you like, and
untick it again to go back.

**Coming from 0.1.x?** 0.2.0 is a different app on new tables, and it cannot
update a 0.1.x install in place. Uninstall 0.1.x first (its tables stay unless
you choose to drop them), then install 0.2.0. Nothing is carried over from the
old tables.

## Local development

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check and build to `dist/`. With no Adminium configured (no `VITE_ADMINIUM_*`), this build runs on the built-in sample kitchen, as the website's card does. |
| `npm run build:demo` | Build the website's card, at base `/demo/online-ordering/app/`. |
| `npm run build:surface` | Build the two sides Adminium serves (`dist-surface/`). |
| `npm run manifest` | Write `manifest.json` from `src/manifest/`. |
| `npm run sample` | Write the sample bundle (`seeds/ordering.sample.json`) from `src/sample/`. |
| `npm run demo-rules` | Write the rules the built-in sample kitchen plays, from `manifest.json`. |
| `npm test` | Run the suite. |
| `npm run contract` | Run the contract against a built Adminium checkout (`ADMINIUM_REPO`, and `ADD_ONS_REPO` for the add-ons), on SQLite and, with `TEST_POSTGRES_URL` / `TEST_MYSQL_URL`, Postgres and MySQL. |
| `npm run e2e` | Walk the order page and the kitchen in a browser (Playwright). |

`manifest.json` is written from the typed modules in `src/manifest/`; edit
those and run `npm run manifest`. A test fails when the two disagree.

## Project structure

```
manifest.json  what Adminium installs (written from src/manifest/)
seeds/         the sample bundle Adminium adds on request (written from src/sample/)
src/
  manifest/    the tables and their rules, the pages and the Overview, the roles,
               the diners' doors, the emails, the add-ons it works better with
  app/         the shell each side boots into
  data/        the two doors the screens go through: the order page's (the
               public API) and the kitchen's (the staff session)
  diner/       the order page's screens
  kitchen/     the kitchen's screens
  state/       what each screen holds, and the writes it makes
  demo/        the built-in sample kitchen: the manifest's rules played in the
               browser, for the website's card (never in a hosted build)
  sample/      Juniper Kitchen's Tuesday, the sample both the bundle and the
               card are made from
  contract/    the contract with a built Adminium (`npm run contract`)
  i18n/        the 8-locale runtime and the keyed strings
  lib/         formatting, the kitchen's clock, the order helpers
  components/  overlays, toasts, icons, primitives
  styles/      design tokens and stylesheets
  testing/     the product's manifest validator, vendored for the tests
public/fonts/  self-hosted Manrope + JetBrains Mono (woff2)
```

## License

[AGPL-3.0](LICENSE) © 2026 Online Ordering. An example app for Adminium.

## Building on this app with a coding agent

The Adminium skills teach Claude Code, Codex and other agents to build and change an app:
`npx skills add Adminiumjs/skills` — https://github.com/Adminiumjs/skills
