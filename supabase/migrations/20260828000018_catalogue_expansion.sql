-- ============================================================================
-- Catalogue expansion: a second department, a wider Electronics tree, and a
-- brand directory that is actually a directory.
--
-- What was wrong
-- --------------
-- The tree stopped at 36 categories, all of them under Electronics, and the
-- brand table held ten rows. That is enough to demo a homepage and not enough
-- to file a real catalogue against: there was nowhere to put a television, a
-- Wi-Fi router, a graphics card, an air fryer or a washing machine, and no
-- brand row for any of the companies that make them. Every one of those is an
-- admin dead end — you cannot publish a product into a category that does not
-- exist.
--
-- What this does
-- --------------
--   1. Two new second-level branches under Electronics — Televisions and
--      Networking — plus depth beneath the branches that were thin (Gaming had
--      four leaves and no gaming laptop, chair, handheld or headset-adjacent
--      peripheral; Computers had no desktop, GPU or printer).
--
--   2. A second ROOT, Home & Kitchen, with six branches and twenty-six leaves.
--      A root rather than a branch of Electronics because a pressure cooker is
--      not an electronic: it shares no filters, no scoring criteria and no
--      specification vocabulary with anything under the existing root, and
--      forcing it under one would make every inherited template wrong.
--
--   3. 108 brands, unpinned. `is_pinned` drives the homepage strip and the
--      strip is editorial — it should stay the ten that have research behind
--      them, not become a wall of names with "0 products" under each. The
--      admin pins them as coverage arrives.
--
-- Scoring criteria and specification schemas for every new category live in
-- the migration that follows this one, for the same reason they were split out
-- last time: the tree is one idea and the authoring vocabulary is another.
--
-- Idempotent throughout — `on conflict (slug) do nothing`. Nothing here
-- updates an existing row, because these columns are admin-editable and a
-- migration that overwrote an editor's work would be a data-loss bug wearing
-- a schema hat.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roots
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, description, icon, parent_id, display_order, is_active, show_on_homepage)
values (
  'Home & Kitchen', 'home-kitchen',
  'Appliances and cookware judged on the ten-year view — what survives daily use, and what the service network looks like when it does not.',
  'chef-hat', null, 2, true, false
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Second level
--
-- `display_order` is the sort key the homepage tile grid uses, and it sorts
-- across the whole result rather than within a parent — so the Home & Kitchen
-- branches continue the Electronics numbering (1-10) at 11 instead of
-- restarting at 1. Restarting would interleave "Kitchen Appliances" with
-- "Audio" in an order nobody chose.
-- ---------------------------------------------------------------------------
with parent as (
  select id, slug from public.categories
),
branch(name, slug, parent_slug, icon, ord, homepage, description) as (
  values
    -- Electronics
    ('Televisions',        'televisions',        'electronics',  'tv',      9,  true,
     'Panels rated on how they look in your actual living room — in daylight, with the lamps on.'),
    ('Networking',         'networking',         'electronics',  'wifi',    10, false,
     'The box everything else in the house depends on, and nobody thinks about until it fails.'),
    -- Home & Kitchen
    ('Kitchen Appliances', 'kitchen-appliances', 'home-kitchen', 'oven',    11, true,
     'Countertop machines that earn their footprint, and the ones that end up in a cupboard.'),
    ('Coffee & Beverage',  'coffee-beverage',    'home-kitchen', 'coffee',  12, false,
     'What is actually in the cup, and how much of your morning it costs to get there.'),
    ('Food Prep',          'food-prep',          'home-kitchen', 'blender', 13, false,
     'Motors rated on what they do to dry spices and wet batter, not on the wattage printed on the box.'),
    ('Cookware',           'cookware',           'home-kitchen', 'pot',     14, true,
     'Pans and pots chosen for how they age — coatings, bases, and whether the handle stays put.'),
    ('Large Appliances',   'large-appliances',   'home-kitchen', 'fridge',  15, true,
     'The ten-year purchases. Running cost and service network matter more than the feature list.'),
    ('Home Essentials',    'home-essentials',    'home-kitchen', 'fan',     16, false,
     'Air, water and floors — the quiet infrastructure of a home that works.')
)
insert into public.categories
  (name, slug, description, icon, parent_id, display_order, is_active, show_on_homepage)
select b.name, b.slug, b.description, b.icon, p.id, b.ord, true, b.homepage
from branch b
join parent p on p.slug = b.parent_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Third level
--
-- A separate statement because the level-2 rows above do not exist yet inside
-- the statement that inserts them — a CTE cannot see its own siblings' output.
--
-- Leaves continue their parent's existing numbering rather than restarting, so
-- "Headphones" stays first under Audio and the new arrivals queue behind it.
-- ---------------------------------------------------------------------------
with parent as (
  select id, slug from public.categories
),
leaf(name, slug, parent_slug, icon, ord, description) as (
  values
    -- Audio
    ('Home Theatre',        'home-theatre',        'audio',       'speaker',    5, 'Full systems, for when a soundbar has stopped being enough.'),
    ('Microphones',         'microphones',         'audio',       'mic',        6, 'For streaming, calls and recording — judged on how you sound to everyone else.'),
    -- Computers
    ('Desktops & Mini PCs', 'desktops',            'computers',   'cpu',        5, 'More machine per rupee than a laptop, and repairable years later.'),
    ('Graphics Cards',      'graphics-cards',      'computers',   'cpu',        6, 'Frame rates at the resolution you actually run, plus what it does to your power bill.'),
    ('Printers',            'printers',            'computers',   'printer',    7, 'Cost per page is the specification. Everything else is marketing.'),
    ('Webcams',             'webcams',             'computers',   'camera',     8, 'How you look in poor office light, which is the only light that matters.'),
    -- Gaming
    ('Gaming Laptops',      'gaming-laptops',      'gaming',      'laptop',     5, 'Sustained performance and thermals, not the number the box quotes for the first ten minutes.'),
    ('Gaming Keyboards',    'gaming-keyboards',    'gaming',      'keyboard',   6, 'Switches, latency, and whether it is still pleasant to write an email on.'),
    ('Gaming Mice',         'gaming-mice',         'gaming',      'mouse',      7, 'Weight, sensor and shape — in that order, and shape decides it.'),
    ('Gaming Chairs',       'gaming-chairs',       'gaming',      'chair',      8, 'Eight hours is the test. Foam density and adjustment range are what pass it.'),
    ('Handheld Consoles',   'handheld-consoles',   'gaming',      'gamepad',    9, 'Battery life against the games you already own — the only benchmark that travels.'),
    ('VR Headsets',         'vr-headsets',         'gaming',      'vr',        10, 'Comfort and clarity decide whether it comes out of the box twice.'),
    -- Cameras
    ('Drones',              'drones',              'cameras',     'drone',      4, 'Flight time, wind resistance, and what the law lets you do with it.'),
    ('Gimbals & Tripods',   'gimbals-tripods',     'cameras',     'camera',     5, 'The support gear that quietly does more for the shot than the body did.'),
    -- Wearables
    ('Smart Rings',         'smart-rings',         'wearables',   'watch',      3, 'Sleep and recovery tracking without a screen on your wrist — and the subscription question.'),
    -- Smart Home
    ('Robot Vacuums',       'robot-vacuums',       'smart-home',  'home',       4, 'Mapping, suction, and the part nobody mentions: how often you empty it.'),
    ('Smart Locks',         'smart-locks',         'smart-home',  'lock',       5, 'What happens when the battery dies matters more than what the app can do.'),
    ('Video Doorbells',     'video-doorbells',     'smart-home',  'camera',     6, 'Where the footage goes, and what it costs to keep it.'),
    -- Accessories
    ('Docking Stations',    'docking-stations',    'accessories', 'cable',      4, 'One cable to the desk, if the bandwidth actually stretches to your monitors.'),
    ('Laptop Bags',         'laptop-bags',         'accessories', 'laptop',     5, 'Protection, weight, and whether the zip survives a year of commuting.'),
    -- Televisions
    ('Smart TVs',           'smart-tvs',           'televisions', 'tv',         1, 'Mainstream LED and QLED sets, rated on brightness, motion and the software you are stuck with.'),
    ('OLED TVs',            'oled-tvs',            'televisions', 'tv',         2, 'Perfect blacks, real burn-in trade-offs, and which panel generation you are actually buying.'),
    ('Projectors',          'projectors',          'televisions', 'tv',         3, 'Lumens in a room with windows, not in a blacked-out demo hall.'),
    ('Streaming Devices',   'streaming-devices',   'televisions', 'tv',         4, 'The cheapest way to make a slow television fast again.'),
    -- Networking
    ('Wi-Fi Routers',       'wifi-routers',        'networking',  'wifi',       1, 'Coverage through real walls, and how it holds up with forty devices attached.'),
    ('Mesh Systems',        'mesh-systems',        'networking',  'wifi',       2, 'For homes where one router was never going to be enough.'),
    ('Range Extenders',     'range-extenders',     'networking',  'wifi',       3, 'The cheap fix — and honest about when it is the wrong one.'),

    -- ========================= HOME & KITCHEN =========================
    -- Kitchen Appliances
    ('Air Fryers',                 'air-fryers',               'kitchen-appliances', 'oven',    1, 'Usable basket capacity, not the litre count printed on the box.'),
    ('Microwave Ovens',            'microwave-ovens',          'kitchen-appliances', 'oven',    2, 'Solo, grill or convection — the choice that decides what you can actually cook.'),
    ('OTG Ovens',                  'otg-ovens',                'kitchen-appliances', 'oven',    3, 'For baking that a microwave convection mode will never quite manage.'),
    ('Induction Cooktops',         'induction-cooktops',       'kitchen-appliances', 'oven',    4, 'Fast and controllable, and only as good as the pans you already own.'),
    ('Kitchen Chimneys',           'kitchen-chimneys',         'kitchen-appliances', 'fan',     5, 'Suction against your kitchen size, and how loud that suction is at dinner time.'),
    ('Toasters & Sandwich Makers', 'toasters-sandwich-makers', 'kitchen-appliances', 'oven',    6, 'Even browning and plates that come apart for cleaning. That is the whole review.'),
    -- Coffee & Beverage
    ('Coffee Machines',     'coffee-machines',     'coffee-beverage', 'coffee',  1, 'Drip, pod and bean-to-cup, priced against what the same cup costs you outside.'),
    ('Espresso Machines',   'espresso-machines',   'coffee-beverage', 'coffee',  2, 'Pressure, temperature stability, and how much learning the machine expects of you.'),
    ('Electric Kettles',    'electric-kettles',    'coffee-beverage', 'coffee',  3, 'Speed, and whether anything plastic touches the water on the way.'),
    ('Juicers',             'juicers',             'coffee-beverage', 'blender', 4, 'Yield and pulp control against how long the thing takes to wash.'),
    -- Food Prep
    ('Mixer Grinders',      'mixer-grinders',      'food-prep', 'blender', 1, 'Dry spice and wet batter are different tests. Wattage predicts neither.'),
    ('Blenders',            'blenders',            'food-prep', 'blender', 2, 'Blade geometry and jar shape do more than the motor rating suggests.'),
    ('Food Processors',     'food-processors',     'food-prep', 'blender', 3, 'The attachments you will use, and the six in the drawer you will not.'),
    ('Stand Mixers',        'stand-mixers',        'food-prep', 'blender', 4, 'Bowl capacity, and how the motor sounds under a stiff dough.'),
    -- Cookware
    ('Non-stick Cookware',  'nonstick-cookware',   'cookware', 'pot',      1, 'Coating type, and how many years it realistically lasts before it stops being non-stick.'),
    ('Pressure Cookers',    'pressure-cookers',    'cookware', 'pot',      2, 'Safety mechanism, gasket availability, and whether it works on induction.'),
    ('Cast Iron & Steel',   'cast-iron-cookware',  'cookware', 'pot',      3, 'Heavier, slower, and the last pan you will ever have to buy.'),
    ('Kitchen Knives',      'kitchen-knives',      'cookware', 'chef-hat', 4, 'Steel hardness against how often you are willing to sharpen it.'),
    -- Large Appliances
    ('Refrigerators',       'refrigerators',       'large-appliances', 'fridge', 1, 'Usable capacity, running cost, and the service network in your city.'),
    ('Washing Machines',    'washing-machines',    'large-appliances', 'washer', 2, 'Wash quality, water use, and how the drum treats what you put in it.'),
    ('Dishwashers',         'dishwashers',         'large-appliances', 'washer', 3, 'Sized and programmed for the cookware you own, or not worth the plumbing.'),
    ('Air Conditioners',    'air-conditioners',    'large-appliances', 'fan',    4, 'The ISEER rating against your actual tariff — that is the real price.'),
    -- Home Essentials
    ('Vacuum Cleaners',     'vacuum-cleaners',     'home-essentials', 'home',    1, 'Suction that lasts the whole run, and a bin you do not dread emptying.'),
    ('Air Purifiers',       'air-purifiers',       'home-essentials', 'fan',     2, 'CADR against your room size, and what the filters cost every year.'),
    ('Water Purifiers',     'water-purifiers',     'home-essentials', 'droplet', 3, 'RO, UV or UF depends on your water. The annual service contract decides the rest.'),
    ('Water Heaters',       'water-heaters',       'home-essentials', 'droplet', 4, 'Tank size for your household, and how hard your water is on the element.')
)
insert into public.categories
  (name, slug, description, icon, parent_id, display_order, is_active, show_on_homepage)
select l.name, l.slug, l.description, l.icon, p.id, l.ord, true, false
from leaf l
join parent p on p.slug = l.parent_slug
on conflict (slug) do nothing;

-- Paths and depths are recomputed now that there is a second root and two more
-- branches of Electronics.
select public.rebuild_category_paths();
