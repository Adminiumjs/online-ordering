-- Online Ordering — PostgreSQL schema (manifest §requiredSchema contract).
--
-- This is the real database behind the full self-host stack: the ordering site
-- reads it (through Adminium's records API) and the auto-generated Adminium
-- dashboard is the back office that runs it. Applied automatically on first
-- boot of the `ordering-db` container via
-- /docker-entrypoint-initdb.d/01-schema.sql, then seeded by 02-seed.sql. The
-- seed mirrors src/data/demo.ts one-for-one — the same eighteen items, the same
-- modifier rules, the same twelve orders on the same Tuesday — so the site and
-- the dashboard show the same restaurant.
--
-- Eight tables. The split is deliberate: the site owns the order and the queue,
-- the generated dashboard owns the menu, the hours and the reporting.
--
-- Two conversions from the app's types are worth stating once, up front:
--
--   * The SPA carries money as INTEGER CENTS. Here it is numeric(12, 2) —
--     exact decimal, never float, because a till that drifts is not a till.
--   * The SPA carries clock times as MINUTES SINCE MIDNIGHT, which is what
--     makes its pinned clock one integer. Here an instant is timestamptz and a
--     posted opening time is "HH:MM" text, because posted hours are a sign in a
--     window, not a moment.

DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS hours CASCADE;
DROP TABLE IF EXISTS order_item_modifiers CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS modifiers CASCADE;
DROP TABLE IF EXISTS modifier_groups CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;

-- The menu -------------------------------------------------------------------

-- `slug` is the id the SPA uses ('bowls', 'pizza'), kept as a stable handle so
-- a category can be renamed on the dashboard without breaking anything that
-- referred to it. `tint` names the CSS custom property the food tiles use.
CREATE TABLE menu_categories (
  id       serial PRIMARY KEY,
  slug     text    NOT NULL UNIQUE,
  name     text    NOT NULL,
  position integer NOT NULL DEFAULT 0,
  icon     text    NOT NULL DEFAULT '',
  tint     text    NOT NULL DEFAULT ''
);

-- `available` false is the sold-out state: the item stays on the menu, priced
-- and described, and the site renders it dimmed rather than hiding it. Hiding
-- a sold-out dish makes customers think it was never there.
--
-- `short_name` is the kitchen's name for the dish — what fits on a queue card
-- and in the all-day strip. `image` holds a filename, never a blob; Adminium
-- does not host media.
--
-- `tags` are the dietary chips, comma separated, and the CHECK keeps the set
-- closed: a tag nobody can render is worse than no tag.
CREATE TABLE menu_items (
  id          serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES menu_categories (id) ON DELETE RESTRICT,
  slug        text    NOT NULL UNIQUE,
  name        text    NOT NULL,
  short_name  text    NOT NULL DEFAULT '',
  description text    NOT NULL DEFAULT '',
  price       numeric(12, 2) NOT NULL CHECK (price >= 0),
  image       text    NOT NULL DEFAULT '',
  available   boolean NOT NULL DEFAULT true,
  featured    boolean NOT NULL DEFAULT false,
  tags        text    NOT NULL DEFAULT ''
                      CHECK (tags = '' OR tags ~ '^(V|Spicy)(,(V|Spicy))*$'),
  position    integer NOT NULL DEFAULT 0
);

-- A group belongs to ONE item. Two items that offer the same choices carry a
-- group each — five pizzas, five size groups — because the day one of them
-- stops offering the 16" is the day a shared group would have to be forked
-- anyway, and forking it later means reprinting every historical order.
--
-- `kind` is the whole of the selection rule: `radio` replaces the choice,
-- `check` accumulates up to `max`. `min` is what makes a group required — the
-- site refuses to add the line until it is satisfied, and says which group is
-- blocking it in words.
CREATE TABLE modifier_groups (
  id       serial PRIMARY KEY,
  item_id  integer NOT NULL REFERENCES menu_items (id) ON DELETE CASCADE,
  slug     text    NOT NULL,
  name     text    NOT NULL,
  kind     text    NOT NULL DEFAULT 'radio' CHECK (kind IN ('radio', 'check')),
  min      integer NOT NULL DEFAULT 0 CHECK (min >= 0),
  max      integer NOT NULL DEFAULT 1,
  hint     text    NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  UNIQUE (item_id, slug),
  -- A group that cannot be satisfied would lock the add button forever.
  CONSTRAINT modifier_groups_range CHECK (max >= min AND max >= 1)
);

-- `price_delta` may be zero (a crust choice) or negative in principle (nobody
-- charges less for less, but the column does not pretend to know that).
CREATE TABLE modifiers (
  id          serial PRIMARY KEY,
  group_id    integer NOT NULL REFERENCES modifier_groups (id) ON DELETE CASCADE,
  slug        text    NOT NULL,
  name        text    NOT NULL,
  price_delta numeric(12, 2) NOT NULL DEFAULT 0,
  available   boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0,
  UNIQUE (group_id, slug)
);

-- Orders ---------------------------------------------------------------------

-- `number` is the bare counter the customer is called by; the `order_prefix`
-- setting supplies the '#'. It is unique because it is what somebody says out
-- loud at the window.
--
-- `status_at` is when the order last moved, which is what the queue card's
-- elapsed chip counts from — `placed_at` would make every card look late.
--
-- `total` is stored, not derived. A price change tomorrow must not rewrite what
-- somebody was charged today, so the line prices and this total are both
-- snapshots taken at checkout.
CREATE TABLE orders (
  id            serial PRIMARY KEY,
  number        text        NOT NULL UNIQUE,
  customer_name text        NOT NULL,
  phone         text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'placed'
                            CHECK (status IN ('placed', 'confirmed', 'preparing',
                                              'ready', 'picked_up', 'cancelled')),
  pickup_at     timestamptz NOT NULL,
  total         numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  note          text        NOT NULL DEFAULT '',
  status_at     timestamptz,
  placed_at     timestamptz NOT NULL DEFAULT now()
);

-- One row per cart line. `unit_price` is the ITEM's price at the moment of
-- ordering, WITHOUT the modifier deltas — those live one table down, so the
-- receipt can show what each choice cost. A line's money is therefore
--
--     (unit_price + sum(order_item_modifiers.price_delta)) * qty
--
-- which is exactly what src/lib/order.ts computes per unit and then multiplies.
--
-- `note` is the customer's own words and is part of the line's identity in the
-- app: two lines merge only when item, options AND note all match. That is what
-- stops "no onions" being folded into somebody else's pizza.
CREATE TABLE order_items (
  id         serial PRIMARY KEY,
  order_id   integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  item_id    integer NOT NULL REFERENCES menu_items (id) ON DELETE RESTRICT,
  qty        integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  note       text    NOT NULL DEFAULT '',
  position   integer NOT NULL DEFAULT 0
);

-- The chosen options, one row each, with the delta charged at the time. The
-- delta is copied rather than joined because `modifiers.price_delta` is
-- tomorrow's price and this is yesterday's receipt.
CREATE TABLE order_item_modifiers (
  id            serial PRIMARY KEY,
  order_item_id integer NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
  modifier_id   integer NOT NULL REFERENCES modifiers (id) ON DELETE RESTRICT,
  price_delta   numeric(12, 2) NOT NULL DEFAULT 0,
  UNIQUE (order_item_id, modifier_id)
);

-- The counter ----------------------------------------------------------------

-- The posted week. `opens` and `closes` are "HH:MM" strings rather than time
-- values on purpose: these are the hours on the sign, read against the
-- restaurant's one configured time zone, and they never need a date.
--
-- `position` carries the posted order (Monday first), because sorting the
-- weekday text alphabetically puts Friday at the top of the card.
CREATE TABLE hours (
  id       serial PRIMARY KEY,
  weekday  text    NOT NULL UNIQUE
                   CHECK (weekday IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  opens    text    NOT NULL CHECK (opens  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closes   text    NOT NULL CHECK (closes ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  position integer NOT NULL DEFAULT 0
);

-- The zones a future delivery mode would serve.
--
-- Nothing in the ordering site reads this table, and nothing should: v1 is
-- PICKUP ONLY, and the word does not appear anywhere a diner can see it. The
-- table is here because the generated dashboard is a different surface from
-- the storefront — it is where an operator would draw the map before any of it
-- is switched on, and a schema that omits it forces a migration on the day
-- that happens. Every seeded row is `active = false` for the same reason: the
-- shape is real, the service is not running.
--
-- 21 §7 and §11.4 both put this table in the contract deliberately.
CREATE TABLE delivery_zones (
  id     serial  PRIMARY KEY,
  name   text    NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT false
);

-- Indexes the dashboard's pages lean on --------------------------------------

CREATE INDEX ON menu_categories (position);
CREATE INDEX ON menu_items (category_id, position);
-- The menu the site actually renders: what is on today.
CREATE INDEX ON menu_items (available, category_id) WHERE available;
CREATE INDEX ON modifier_groups (item_id, position);
CREATE INDEX ON modifiers (group_id, position);
-- The live board: everything not yet handed over, oldest first.
CREATE INDEX ON orders (status, placed_at)
  WHERE status IN ('placed', 'confirmed', 'preparing', 'ready');
-- The day's takings and the orders-by-hour chart.
CREATE INDEX ON orders (placed_at DESC);
CREATE INDEX ON orders (pickup_at);
-- Only ever queried for the handful that are switched on.
CREATE INDEX ON delivery_zones (active) WHERE active;
CREATE INDEX ON order_items (order_id, position);
-- Item mix: which dishes actually sold.
CREATE INDEX ON order_items (item_id);
CREATE INDEX ON order_item_modifiers (order_item_id);
CREATE INDEX ON order_item_modifiers (modifier_id);
CREATE INDEX ON hours (position);
