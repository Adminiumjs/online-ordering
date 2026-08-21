# Online Ordering

A complete, production-shaped order-ahead site — built with Vite + React +
TypeScript, no CSS framework, no backend required. It's an example app that
ships with [Adminium](https://adminium.dev): build a pizza with real modifier
rules, pick a slot, check out, then switch to the kitchen and work the same
order across the board.

**Pickup only.** There is no delivery in this product and no delivery language
anywhere in it — no couriers, no tracking a driver, no address at checkout. The
order is handed over a counter.

It is **not** an admin database UI. Menu records, sales reports and staff
administration live in the dashboard Adminium generates from your schema; this
is the customer's order and the kitchen's queue. The kitchen board says so in
as many words rather than pretending to be a full display system.

The demo is dressed as **Juniper Kitchen**, a fictional fast-casual shop on
Alder Street serving bowls and pizza, so the menu, the notes and the board read
like a Tuesday lunch rush already in progress rather than lorem ipsum.

**Live demo → [adminium.dev/demo/online-ordering](https://adminium.dev/demo/online-ordering)**

## What it does

- **Two personas in one build.** The demo dock switches between the Diner and
  the Kitchen. The loop closes across the switch: check out as a diner, switch
  to the Kitchen, and your order is the newest card in the New column — advance
  it there and the diner's tracker has already moved.

- **A real ordering engine.** [`src/lib/order.ts`](src/lib/order.ts) is a pure,
  React-free module: the composite line key, per-unit pricing from modifier
  deltas, min/max group validation, cap-aware option toggling, cart merge and
  edit-in-place, tax on the rounded subtotal, pickup-slot generation with a
  lead time, the status chain, elapsed time and the all-day aggregate. 50 tests
  and 75 assertions in [`order.test.ts`](src/lib/order.test.ts) run against the
  shipped seed.

  The load-bearing idea is the line's identity: `item | options | note`. Two
  lines merge into one only when all three match. That is what stops "no
  onions" being folded into somebody else's pizza — and it is asserted from
  several directions, because it is easy to get subtly wrong and impossible to
  notice until a customer is handed the wrong box.

- **Modifier rules that actually enforce.** The build-your-own pizza has a
  required size, a required crust and up to five toppings; the grain bowl has
  a required base, a required protein and up to three extras. At the cap the
  remaining options disable while the chosen ones stay removable, a live
  "5 of 5" counter turns amber, and the add button stays disabled carrying a
  plain-language reason — "Choose a base." — rather than silently ignoring the
  tap.

- **Eight languages, including a right-to-left one.** English, German, French,
  Czech, Danish, Simplified and Traditional Chinese, and Egyptian Arabic. The
  menu itself is translated too, not just the chrome, so a locale switch does
  not leave an English island inside a translated screen. Plurals go through
  `Intl.PluralRules` in each locale's own CLDR order — Czech gets its three
  forms, Arabic its six.

- **RTL by construction.** Every positional rule in the stylesheets is a CSS
  logical property, so stamping `dir="rtl"` on `<html>` mirrors the header, the
  cart drawer, the timeline gutter and the demo dock with no second stylesheet.
  Prices, times and order numbers are isolated so the bidi algorithm cannot
  reorder their digits.

- **Light / dark themes** via CSS custom properties. The app follows your
  operating system on first load; the header's sun/moon toggle latches it.

- **A pinned clock.** Nothing user-visible reads `Date.now()`. "Now" is Tuesday
  28 July 2026, 11:40, so every machine shows the same five orders on the
  board, the same first pickup slot at 12:00 and the same elapsed chips. The
  dock's **+10 min** chip is the only thing that moves time: each tap steps
  every in-flight order one status forward and stops at Ready, because only a
  person handing over a bag knows an order was collected.

- **No bitmaps, no external requests.** Food photography is layered gradients
  tinted per category, carrying an oversized Lucide glyph and a mono filename
  chip. Fonts are self-hosted woff2. The app works offline and behind a
  firewall.

## Local development

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

### Driving the demo

The dock in the corner is the demo. Everything else is the product.

| Control | What it does |
| --- | --- |
| **Diner / Kitchen** | Switches persona. The loop closes across it — this is the thing to show. |
| **+10 min** | Advances the pinned clock and steps every in-flight order forward one status. |
| **Language** | Eight locales, including Arabic, which flips the whole layout to RTL. |
| **Theme** | Latches light or dark over the OS preference. |
| **Reset** | Puts the service back to 11:40 the way it started. |

A ninety-second tour: Menu → open **Build-Your-Own Pizza** → pick a size and a
crust, then add five toppings and watch the sixth disable → add a note → Add to
order → open the cart and pick a pickup slot → Checkout → **Pay** → the card
sheet says out loud that nothing is charged → confirmation shows **#2118**,
because the seeded morning ends at #2117 → **Track your order** → tap **+10
min** twice and watch it reach Ready → switch to **Kitchen** and hand it over.

## Deploy

- **Vercel** — import the repo. Build command `npm run build`, output `dist`.
- **DigitalOcean App Platform** — import the repo; it builds with the same
  command.
- **Host anywhere** — `npm run build` produces a fully static `dist/` you can
  drop on any static host (Netlify, Cloudflare Pages, S3, GitHub Pages…). Or
  build the container:

  ```bash
  docker build -t online-ordering .
  ```

### Build scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check + build to `dist/` at base `/` (root deploys). |
| `npm run build:demo` | Build to `dist/` at base `/demo/online-ordering/` (Adminium demo). |
| `npm run preview` | Preview a production build locally. |
| `npm test` | Run the ordering engine suite. |

## Full implementation (self-host)

There are two tiers to running this restaurant.

**Tier 1 — the frontend, one click.** The Vercel / DigitalOcean options above
deploy the ordering site on its own, running on the bundled demo service. No
database, no dashboard — a fully static preview.

**Tier 2 — the whole stack, one command.**
[`docker-compose.yml`](docker-compose.yml) stands up Postgres (seeded by
default with the *same* menu, the *same* modifier rules and the *same* twelve
orders), an auto-generated Adminium dashboard that runs that real database, and
the ordering site:

```bash
cp .env.example .env      # then set ADMINIUM_SECRET — e.g. openssl rand -hex 32
docker compose up
```

- **Ordering site** → http://localhost:8080
- **Adminium dashboard** → http://localhost:4600

On first boot, `ordering-db` applies [`db/schema.sql`](db/schema.sql), installs
the demo bookkeeping, and then runs a hook that loads
[`db/seed.sql`](db/seed.sql) — see **Demo data** below for opting out of that
last step. Adminium imports the restaurant database as its first source
connection, introspects the schema, and generates the back office. Finish the
~1-minute first-run wizard at `:4600` — it's pre-pointed at the `juniper`
database. The install spec Adminium reads to configure itself is
[`manifest.json`](manifest.json).

The seed is the same Tuesday the app is pinned to. Open the dashboard and
you'll find Tamar B.'s **#2117** still sitting in Placed, Marisol G.'s two grain
bowls at $37.26, and the White Pie marked unavailable — the service you just
worked through on :8080, as records.

The manifest scaffolds 9 tables, 4 dashboard pages, 1 access preset
(`kitchen-staff`) and 5 settings into your connected database.

### Demo data

Juniper Kitchen arrives already trading: the stack comes up seeded, exactly as
it always has. If you would rather start with your own menu — the same schema,
no rows — set `DEMO_DATA=0` in `.env` before the first `docker compose up`.

Neither choice is permanent. The demo service can be loaded and taken back out
whenever you like:

| Command | What it does |
| --- | --- |
| `npm run demo:status` | What is loaded right now, table by table |
| `npm run demo:import` | Load `db/seed.sql` |
| `npm run demo:wipe` | Remove the demo rows — the schema and your own rows stay |
| `npm run demo:reset` | Wipe, then import a fresh copy |

`wipe` and `reset` ask before they do anything. Pass `--yes` to skip the
question (`npm run demo:wipe -- --yes`), which is also what a script needs:
with no terminal to ask, the command stops instead of guessing.

A wipe removes only the rows the seed put there, and it will not delete a demo
row your own data depends on — that one is left where it is and reported under
`kept`. `ON DELETE CASCADE` still applies, though: `db/schema.sql` hangs
`order_items` off `orders` that way, so a line you added to a demo order goes
when the order does, and rows removed like that are counted separately as
`cascaded`. [`db/README.md`](db/README.md) covers the rest: how the wipe knows
which rows are which, what it does to id sequences, and how to point these
commands at a Postgres somewhere else with `DATABASE_URL`.

## The split: the storefront and the back office

The app you deploy is **the storefront and the queue**. The dashboard Adminium
generates from your schema is **the back office**. That is the product story,
not a limitation:

| In this app | In the generated dashboard |
| --- | --- |
| Browsing the menu and building an order | Every table as records, with full CRUD |
| Checking out and tracking a pickup | Editing the menu, prices and modifier groups |
| The kitchen's live queue | Sales reports, day parts and item mix |
| Advancing an order to Ready | Opening hours, tax rates and staff accounts |

## Connecting to Adminium

All data access goes through a thin `DataSource` interface
([`src/data/source.ts`](src/data/source.ts)) with a single `demoSource`
implementation backed by the bundled menu and order book. **Today the deployed
demo is demo data only — nothing is persisted, no card is charged and no text
message is sent.** Once Adminium's browser-safe publishable key (`adm_pub_…`)
ships, the frontend will read and write live data through the Adminium records
API via a second `DataSource` implementation, without touching any of the
screens or the store. The seam is already in place; the key is the only missing
piece.

### What is deliberately out of scope

- **Taking payment.** The card sheet is a mock with prefilled read-only fields
  and a callout saying so. Real card handling needs a payment processor and a
  server this version does not have.
- **Texting the customer.** Checkout says a text goes out when the order is
  ready; the demo does not send one. Outbound messaging needs a job runner.
- **Delivery.** Not "not yet" — this product is pickup only, and there is no
  type in the codebase that could carry a delivery.
- **The full kitchen display.** Bump bars, prep stations and course firing ship
  with the Point of Sale. This is the ordering queue, and the board says so.
- **Menu administration.** Editing items, prices and modifier groups belongs in
  the generated dashboard, on purpose.

## Project structure

```
src/
  app/         App shell + the exhaustive 8-view switch
  state/       Zustand store (persona, clock, cart, orders, overlays, toasts)
  data/        demo.ts (the seeded menu + order book), types.ts,
               source.ts (DataSource seam, venue facts)
  i18n/        8-locale runtime, locale registry, ambient bridge,
               strings/ (chrome, screens, seeded prose)
  lib/         order.ts (the engine) + tests, format.ts (locale-aware output)
  screens/     home, menu, cart, checkout, confirmation, track, kitchen, 404
  components/  two shells, demo dock, overlays (item sheet, cart drawer,
               card sheet, toasts), order-line pieces, primitives
  styles/      tokens.css (canonical design tokens + food tints), base.css,
               components.css, screens.css
public/fonts/  self-hosted Manrope + JetBrains Mono (woff2)
db/            schema.sql, seed.sql and the demo-data toolkit (see db/README.md)
```

## License

[AGPL-3.0](LICENSE) © 2026 Online Ordering. A demo shipped with Adminium.
