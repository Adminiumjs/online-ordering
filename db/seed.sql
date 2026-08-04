-- Online Ordering — seed data.
--
-- Mirrors src/data/demo.ts one-for-one: the same five categories, the same
-- eighteen items at the same prices, the same eight modifier groups with the
-- same min/max rules and the same deltas, and the same twelve orders — seven
-- picked up over the morning, five still live on the board. Run the site and
-- the generated dashboard side by side and they show the same restaurant.
--
-- The clock is pinned exactly where the SPA pins it: Tuesday 28 July 2026,
-- 11:40 local. The app carries those times as minutes since midnight; here they
-- are written out as wall-clock instants at -07:00, the restaurant's offset on
-- that date. Order #2106 is placed at minute 662 in demo.ts, which is 11:02.
--
-- Ids are explicit so the foreign keys below can be written by hand and mean
-- the same thing on every machine; the sequences are reset at the bottom so the
-- first order taken after this seed gets #2118 rather than colliding.
--
-- Money is written in dollars. The SPA holds cents (1150) and this holds the
-- same amount (11.50) — the grain bowl costs the same in both places.
--
-- Everything here is demo fiction: Juniper Kitchen, its menu and its lunch rush
-- are props for a fictional fast-casual shop on Alder Street.

BEGIN;

-- The menu -------------------------------------------------------------------

INSERT INTO menu_categories (id, slug, name, position, icon, tint) VALUES
  (1, 'bowls',  'Bowls',  1, 'salad',  '--ft-bowl'),
  (2, 'pizza',  'Pizza',  2, 'pizza',  '--ft-pizza'),
  (3, 'sides',  'Sides',  3, 'soup',   '--ft-side'),
  (4, 'drinks', 'Drinks', 4, 'cup-soda', '--ft-drink'),
  (5, 'sweets', 'Sweets', 5, 'cookie', '--ft-sweet');

-- Eighteen items. The White Pie is the sold-out one; the grain bowl, the
-- build-your-own pizza, the soppressata and the cheesecake are the four the
-- home page features. `image` holds the fictional filename the site's food
-- tiles print in their mono chip — there are no bitmaps in this product.
INSERT INTO menu_items
  (id, category_id, slug, name, short_name, description, price, image, available, featured, tags, position)
VALUES
  (1,  1, 'grain',   'Harvest Grain Bowl',     'Grain bowl',    'Farro, roasted squash, kale and tahini-lemon.',     11.50, 'grain-bowl.jpg',      true,  true,  'V',       1),
  (2,  1, 'goddess', 'Green Goddess Bowl',     'Goddess bowl',  'Baby greens, cucumber, avocado ranch, herbs.',      10.75, 'green-goddess.jpg',   true,  false, 'V',       2),
  (3,  1, 'sesame',  'Sesame Noodle Bowl',     'Sesame noodles','Cold noodles, chili crisp, scallion, sesame.',      11.25, 'sesame-noodle.jpg',   true,  false, 'Spicy',   3),
  (4,  1, 'citrus',  'Chili Citrus Bowl',      'Citrus bowl',   'Quinoa, charred corn, orange, chili oil.',          12.00, 'chili-citrus.jpg',    true,  false, 'V,Spicy', 4),

  (5,  2, 'byo',     'Build-Your-Own Pizza',   'Custom pizza',  'Pick a size, a crust and up to five toppings.',      9.00, 'build-your-own.jpg',  true,  true,  '',        5),
  (6,  2, 'marg',    'Margherita',             'Margherita',    'Tomato, fior di latte, basil, olive oil.',          10.50, 'margherita.jpg',      true,  false, 'V',       6),
  (7,  2, 'sopp',    'Hot Soppressata',        'Soppressata',   'Spicy soppressata, hot honey, mozzarella.',         12.50, 'hot-soppressata.jpg', true,  true,  'Spicy',   7),
  (8,  2, 'mush',    'Mushroom and Thyme',     'Mushroom pie',  'Roasted mushrooms, thyme, taleggio, garlic cream.', 11.75, 'mushroom-thyme.jpg',  true,  false, 'V',       8),
  (9,  2, 'white',   'White Pie',              'White pie',     'Ricotta, mozzarella, lemon zest, no red sauce.',    11.25, 'white-pie.jpg',       false, false, 'V',       9),

  (10, 3, 'knots',   'Garlic Knots',           'Garlic knots',  'Six knots, parmesan butter, warm marinara.',         4.50, 'garlic-knots.jpg',    true,  false, '',       10),
  (11, 3, 'brocc',   'Charred Broccolini',     'Broccolini',    'Lemon, chili flake, toasted almond.',                5.00, 'broccolini.jpg',      true,  false, 'V',      11),
  (12, 3, 'fries',   'Rosemary Fries',         'Fries',         'Crispy, salted, tossed with rosemary.',              4.25, 'rosemary-fries.jpg',  true,  false, 'V',      12),
  (13, 3, 'caesar',  'Little Gem Caesar',      'Caesar',        'Little gems, sourdough crumble, grana.',             6.00, 'gem-caesar.jpg',      true,  false, '',       13),

  (14, 4, 'lemon',   'House Lemonade',         'Lemonade',      'Squeezed daily, not too sweet.',                     3.50, 'lemonade.jpg',        true,  false, 'V',      14),
  (15, 4, 'tea',     'Hibiscus Iced Tea',      'Hibiscus tea',  'Brewed hibiscus, mint, lightly sweetened.',          3.50, 'hibiscus-tea.jpg',    true,  false, 'V',      15),
  (16, 4, 'spark',   'Sparkling Water',        'Sparkling',     'Chilled bottle, lemon on the side.',                 2.75, 'sparkling.jpg',       true,  false, '',       16),

  (17, 5, 'cheese',  'Basque Cheesecake',      'Cheesecake',    'Burnt top, soft middle. The classic.',               5.50, 'cheesecake.jpg',      true,  true,  'V',      17),
  (18, 5, 'cookie',  'Chocolate Chunk Cookie', 'Cookie',        'Baked all day, sea salt on top.',                    3.25, 'chunk-cookie.jpg',    true,  false, 'V',      18);

-- Modifier groups. The SPA declares eight groups and shares them across items;
-- here each item owns its own copy, which is what `modifier_groups.item_id`
-- means. Sixteen rows: the grain bowl's three, one protein group each for the
-- other three bowls (plus heat on the noodles), the pizza's size and crust and
-- toppings, a size group on each of the four fixed pies, and dips on the fries.
INSERT INTO modifier_groups (id, item_id, slug, name, kind, min, max, hint, position) VALUES
  (1,  1,  'base',    'Base',       'radio', 1, 1, 'Pick one',                  1),
  (2,  1,  'protein', 'Protein',    'radio', 1, 1, 'Pick one',                  2),
  (3,  1,  'extras',  'Extras',     'check', 0, 3, 'Up to 3',                   3),

  (4,  2,  'protein', 'Protein',    'radio', 1, 1, 'Pick one',                  1),

  (5,  3,  'protein', 'Protein',    'radio', 1, 1, 'Pick one',                  1),
  (6,  3,  'heat',    'Heat level', 'radio', 1, 1, 'Pick one',                  2),

  (7,  4,  'protein', 'Protein',    'radio', 1, 1, 'Pick one',                  1),

  (8,  5,  'size',    'Size',       'radio', 1, 1, 'Pick one',                  1),
  (9,  5,  'crust',   'Crust',      'radio', 1, 1, 'Pick one',                  2),
  (10, 5,  'tops',    'Toppings',   'check', 0, 5, 'Up to 5 · +$1.50 each',     3),

  (11, 6,  'size',    'Size',       'radio', 1, 1, 'Pick one',                  1),
  (12, 6,  'crust',   'Crust',      'radio', 1, 1, 'Pick one',                  2),

  (13, 7,  'size',    'Size',       'radio', 1, 1, 'Pick one',                  1),
  (14, 8,  'size',    'Size',       'radio', 1, 1, 'Pick one',                  1),
  (15, 9,  'size',    'Size',       'radio', 1, 1, 'Pick one',                  1),

  (16, 12, 'dip',     'Dips',       'check', 0, 2, 'Up to 2',                   1);

-- Fifty-eight options. Deltas are the SPA's, to the cent: a protein is $3.00
-- except the pulled pork at $3.50, every pizza topping is $1.50, and a bigger
-- pie is $4.00 or $7.00 over the 10".
INSERT INTO modifiers (id, group_id, slug, name, price_delta, available, position) VALUES
  -- Harvest Grain Bowl: base, protein, extras
  (1,  1,  'farro',  'Farro',            0.00, true, 1),
  (2,  1,  'rice',   'Brown rice',       0.00, true, 2),
  (3,  1,  'greens', 'Baby greens',      0.00, true, 3),
  (4,  2,  'none',   'No protein',       0.00, true, 1),
  (5,  2,  'chick',  'Herb chicken',     3.00, true, 2),
  (6,  2,  'tofu',   'Chili-lime tofu',  3.00, true, 3),
  (7,  2,  'pork',   'Pulled pork',      3.50, true, 4),
  (8,  3,  'avo',    'Avocado',          2.00, true, 1),
  (9,  3,  'feta',   'Whipped feta',     1.50, true, 2),
  (10, 3,  'pkon',   'Pickled onions',   0.75, true, 3),
  (11, 3,  'seeds',  'Toasted seeds',    1.00, true, 4),
  (12, 3,  'tah',    'Extra tahini',     0.50, true, 5),

  -- Green Goddess Bowl: protein
  (13, 4,  'none',   'No protein',       0.00, true, 1),
  (14, 4,  'chick',  'Herb chicken',     3.00, true, 2),
  (15, 4,  'tofu',   'Chili-lime tofu',  3.00, true, 3),
  (16, 4,  'pork',   'Pulled pork',      3.50, true, 4),

  -- Sesame Noodle Bowl: protein, heat
  (17, 5,  'none',   'No protein',       0.00, true, 1),
  (18, 5,  'chick',  'Herb chicken',     3.00, true, 2),
  (19, 5,  'tofu',   'Chili-lime tofu',  3.00, true, 3),
  (20, 5,  'pork',   'Pulled pork',      3.50, true, 4),
  (21, 6,  'mild',   'Mild',             0.00, true, 1),
  (22, 6,  'med',    'Medium',           0.00, true, 2),
  (23, 6,  'hot',    'Extra hot',        0.00, true, 3),

  -- Chili Citrus Bowl: protein
  (24, 7,  'none',   'No protein',       0.00, true, 1),
  (25, 7,  'chick',  'Herb chicken',     3.00, true, 2),
  (26, 7,  'tofu',   'Chili-lime tofu',  3.00, true, 3),
  (27, 7,  'pork',   'Pulled pork',      3.50, true, 4),

  -- Build-Your-Own Pizza: size, crust, toppings
  (28, 8,  's10',    '10″ Personal',     0.00, true, 1),
  (29, 8,  's13',    '13″ Classic',      4.00, true, 2),
  (30, 8,  's16',    '16″ Family',       7.00, true, 3),
  (31, 9,  'hand',   'Hand-tossed',      0.00, true, 1),
  (32, 9,  'thin',   'Thin and crispy',  0.00, true, 2),
  (33, 9,  'gf',     'Gluten-free',      2.00, true, 3),
  (34, 10, 'pep',    'Pepperoni',        1.50, true, 1),
  (35, 10, 'saus',   'Fennel sausage',   1.50, true, 2),
  (36, 10, 'mush',   'Mushrooms',        1.50, true, 3),
  (37, 10, 'onion',  'Red onion',        1.50, true, 4),
  (38, 10, 'oliv',   'Kalamata olives',  1.50, true, 5),
  (39, 10, 'pepr',   'Roasted peppers',  1.50, true, 6),
  (40, 10, 'basil',  'Fresh basil',      1.50, true, 7),
  (41, 10, 'honey',  'Hot honey',        1.50, true, 8),

  -- Margherita: size, crust
  (42, 11, 's10',    '10″ Personal',     0.00, true, 1),
  (43, 11, 's13',    '13″ Classic',      4.00, true, 2),
  (44, 11, 's16',    '16″ Family',       7.00, true, 3),
  (45, 12, 'hand',   'Hand-tossed',      0.00, true, 1),
  (46, 12, 'thin',   'Thin and crispy',  0.00, true, 2),
  (47, 12, 'gf',     'Gluten-free',      2.00, true, 3),

  -- Hot Soppressata: size
  (48, 13, 's10',    '10″ Personal',     0.00, true, 1),
  (49, 13, 's13',    '13″ Classic',      4.00, true, 2),
  (50, 13, 's16',    '16″ Family',       7.00, true, 3),

  -- Mushroom and Thyme: size
  (51, 14, 's10',    '10″ Personal',     0.00, true, 1),
  (52, 14, 's13',    '13″ Classic',      4.00, true, 2),
  (53, 14, 's16',    '16″ Family',       7.00, true, 3),

  -- White Pie: size (the item is sold out, the options are not)
  (54, 15, 's10',    '10″ Personal',     0.00, true, 1),
  (55, 15, 's13',    '13″ Classic',      4.00, true, 2),
  (56, 15, 's16',    '16″ Family',       7.00, true, 3),

  -- Rosemary Fries: dips
  (57, 16, 'aioli',  'Garlic aioli',     0.50, true, 1),
  (58, 16, 'cket',   'Calabrian ketchup',0.50, true, 2);

-- The counter ----------------------------------------------------------------

-- The posted week. Tuesday matches the pinned day's open and close exactly —
-- an hours card that disagrees with the open pill is the kind of small lie that
-- makes a demo feel fake.
INSERT INTO hours (id, weekday, opens, closes, position) VALUES
  (1, 'mon', '11:00', '21:00', 1),
  (2, 'tue', '11:00', '21:00', 2),
  (3, 'wed', '11:00', '21:00', 3),
  (4, 'thu', '11:00', '21:00', 4),
  (5, 'fri', '11:00', '22:00', 5),
  (6, 'sat', '11:00', '22:00', 6),
  (7, 'sun', '12:00', '20:00', 7);

-- Tuesday's service ----------------------------------------------------------

-- Seven picked-up morning orders and five live ones, exactly as demo.ts seeds
-- them. `status_at` is when each order last moved; at 11:40 the live five sit
-- across placed / confirmed / preparing / ready, so every column of the queue
-- has something in it the moment the board loads.
--
-- No phone numbers: the seeded orders in the app carry a name and nothing else,
-- and inventing numbers would put fiction in the database the site never shows.
INSERT INTO orders (id, number, customer_name, phone, status, pickup_at, total, note, status_at, placed_at) VALUES
  (1,  '2106', 'Alba R.',    '', 'picked_up', '2026-07-28 11:30-07', 19.44, '', '2026-07-28 11:26-07', '2026-07-28 11:02-07'),
  (2,  '2107', 'Theo M.',    '', 'picked_up', '2026-07-28 11:45-07', 22.14, '', '2026-07-28 11:30-07', '2026-07-28 11:05-07'),
  (3,  '2108', 'June P.',    '', 'picked_up', '2026-07-28 11:45-07', 19.44, '', '2026-07-28 11:34-07', '2026-07-28 11:08-07'),
  (4,  '2109', 'Omar D.',    '', 'picked_up', '2026-07-28 11:45-07', 29.70, '', '2026-07-28 11:37-07', '2026-07-28 11:11-07'),
  (5,  '2110', 'Isa K.',     '', 'picked_up', '2026-07-28 12:00-07', 22.14, '', '2026-07-28 11:40-07', '2026-07-28 11:14-07'),
  (6,  '2111', 'Ren S.',     '', 'picked_up', '2026-07-28 12:00-07', 20.79, '', '2026-07-28 11:42-07', '2026-07-28 11:18-07'),
  (7,  '2112', 'Mia T.',     '', 'picked_up', '2026-07-28 12:00-07', 21.06, '', '2026-07-28 11:46-07', '2026-07-28 11:22-07'),

  -- The live board at 11:40.
  (8,  '2113', 'Nora W.',    '', 'ready',     '2026-07-28 11:45-07', 20.52, '', '2026-07-28 11:34-07', '2026-07-28 11:08-07'),
  (9,  '2114', 'Dev P.',     '', 'preparing', '2026-07-28 12:00-07', 29.70, 'Cut in squares, please.', '2026-07-28 11:31-07', '2026-07-28 11:22-07'),
  (10, '2115', 'Marisol G.', '', 'preparing', '2026-07-28 12:00-07', 37.26, '', '2026-07-28 11:35-07', '2026-07-28 11:28-07'),
  (11, '2116', 'Kenji T.',   '', 'confirmed', '2026-07-28 12:15-07', 30.24, '', '2026-07-28 11:33-07', '2026-07-28 11:31-07'),
  (12, '2117', 'Tamar B.',   '', 'placed',    '2026-07-28 12:15-07', 26.73, '', '2026-07-28 11:36-07', '2026-07-28 11:36-07');

-- The lines. `unit_price` is the item's base price; the options below add to
-- it, so #2106's Margherita reads 10.50 here and 14.50 on the receipt once the
-- 13" is counted.
INSERT INTO order_items (id, order_id, item_id, qty, unit_price, note, position) VALUES
  (1,  1,  6,  1, 10.50, '', 1),   -- Margherita, 13" hand-tossed
  (2,  1,  14, 1,  3.50, '', 2),   -- House Lemonade

  (3,  2,  5,  1,  9.00, '', 1),   -- Build-Your-Own, 13" thin, pepperoni + mushrooms
  (4,  2,  10, 1,  4.50, '', 2),   -- Garlic Knots

  (5,  3,  1,  1, 11.50, '', 1),   -- Harvest Grain Bowl, farro + tofu
  (6,  3,  15, 1,  3.50, '', 2),   -- Hibiscus Iced Tea

  (7,  4,  6,  2, 10.50, '', 1),   -- Two 10" Margheritas
  (8,  4,  18, 2,  3.25, '', 2),   -- Two cookies

  (9,  5,  5,  1,  9.00, '', 1),   -- Build-Your-Own, 16" hand-tossed, three toppings

  (10, 6,  1,  1, 11.50, '', 1),   -- Harvest Grain Bowl, brown rice + chicken
  (11, 6,  12, 1,  4.25, '', 2),   -- Rosemary Fries with aioli

  (12, 7,  6,  1, 10.50, '', 1),   -- Margherita, 13" thin
  (13, 7,  11, 1,  5.00, '', 2),   -- Charred Broccolini

  (14, 8,  6,  1, 10.50, '', 1),   -- Margherita, 13" hand-tossed
  (15, 8,  10, 1,  4.50, '', 2),   -- Garlic Knots

  (16, 9,  5,  1,  9.00, 'Cut in squares, please.', 1),  -- the note is part of this line's identity
  (17, 9,  14, 2,  3.50, '', 2),   -- Two lemonades

  (18, 10, 1,  2, 11.50, '', 1),   -- Two grain bowls, farro + chicken + avocado + pickled onions

  (19, 11, 6,  1, 10.50, '', 1),   -- Margherita, 10" hand-tossed
  (20, 11, 3,  1, 11.25, '', 2),   -- Sesame Noodle Bowl, tofu, medium
  (21, 11, 18, 1,  3.25, '', 3),   -- Cookie

  (22, 12, 7,  1, 12.50, '', 1),   -- Hot Soppressata, 13"
  (23, 12, 12, 1,  4.25, '', 2),   -- Rosemary Fries with aioli
  (24, 12, 15, 1,  3.50, '', 3);   -- Hibiscus Iced Tea

-- The options chosen on each line, with the delta charged at the time.
INSERT INTO order_item_modifiers (id, order_item_id, modifier_id, price_delta) VALUES
  (1,  1,  43, 4.00), (2,  1,  45, 0.00),                                                     -- 13" Classic, hand-tossed
  (3,  3,  29, 4.00), (4,  3,  32, 0.00), (5,  3,  34, 1.50), (6,  3,  36, 1.50),             -- 13" thin, pepperoni, mushrooms
  (7,  5,  1,  0.00), (8,  5,  6,  3.00),                                                     -- farro, chili-lime tofu
  (9,  7,  42, 0.00), (10, 7,  45, 0.00),                                                     -- 10" Personal, hand-tossed
  (11, 9,  30, 7.00), (12, 9,  31, 0.00), (13, 9,  35, 1.50), (14, 9,  37, 1.50), (15, 9, 41, 1.50), -- 16", sausage, red onion, hot honey
  (16, 10, 2,  0.00), (17, 10, 5,  3.00),                                                     -- brown rice, herb chicken
  (18, 11, 57, 0.50),                                                                         -- garlic aioli
  (19, 12, 43, 4.00), (20, 12, 46, 0.00),                                                     -- 13" Classic, thin and crispy
  (21, 14, 43, 4.00), (22, 14, 45, 0.00),                                                     -- 13" Classic, hand-tossed
  (23, 16, 30, 7.00), (24, 16, 32, 0.00), (25, 16, 34, 1.50), (26, 16, 36, 1.50), (27, 16, 41, 1.50), -- 16" thin, pepperoni, mushrooms, hot honey
  (28, 18, 1,  0.00), (29, 18, 5,  3.00), (30, 18, 8,  2.00), (31, 18, 10, 0.75),             -- farro, chicken, avocado, pickled onions
  (32, 19, 42, 0.00), (33, 19, 45, 0.00),                                                     -- 10" Personal, hand-tossed
  (34, 20, 19, 3.00), (35, 20, 22, 0.00),                                                     -- chili-lime tofu, medium
  (36, 22, 49, 4.00),                                                                         -- 13" Classic
  (37, 23, 57, 0.50);                                                                         -- garlic aioli

-- Hand the sequences back. The seeded morning ends at #2117, so the next order
-- taken through the site is #2118 — the same number the SPA's first checkout
-- shows, which is the whole point of seeding the history rather than starting
-- from an empty book.
SELECT setval(pg_get_serial_sequence('menu_categories',      'id'), (SELECT max(id) FROM menu_categories));
SELECT setval(pg_get_serial_sequence('menu_items',           'id'), (SELECT max(id) FROM menu_items));
SELECT setval(pg_get_serial_sequence('modifier_groups',      'id'), (SELECT max(id) FROM modifier_groups));
SELECT setval(pg_get_serial_sequence('modifiers',            'id'), (SELECT max(id) FROM modifiers));
SELECT setval(pg_get_serial_sequence('orders',               'id'), (SELECT max(id) FROM orders));
SELECT setval(pg_get_serial_sequence('order_items',          'id'), (SELECT max(id) FROM order_items));
SELECT setval(pg_get_serial_sequence('order_item_modifiers', 'id'), (SELECT coalesce(max(id), 1) FROM order_item_modifiers));
SELECT setval(pg_get_serial_sequence('hours',                'id'), (SELECT max(id) FROM hours));

COMMIT;
