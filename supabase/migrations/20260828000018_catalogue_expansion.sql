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

-- ---------------------------------------------------------------------------
-- Brands
--
-- All of them land on display_order 100 and `is_pinned = false`. The list
-- endpoint orders by (display_order, name), so the ten curated rows keep the
-- front of the directory and everything added here files alphabetically behind
-- them. Pinning is an editorial act: the homepage strip should say "brands we
-- cover", and a brand with nothing published under it is not one we cover yet.
--
-- `website` is left null wherever the official domain is genuinely ambiguous
-- (regional sub-brands, licensees). A wrong outbound link is worse than a
-- missing one, and the admin can fill it in when a product is filed.
-- ---------------------------------------------------------------------------
insert into public.brands (name, slug, website, description, is_active, is_pinned, display_order) values
  -- Audio -------------------------------------------------------------------
  ('JBL',            'jbl',            'https://www.jbl.com',            'Harman''s mass-market arm: portable speakers, soundbars and headphones, tuned bass-first.', true, false, 100),
  ('boAt',           'boat',           'https://www.boat-lifestyle.com', 'India''s volume leader in earbuds and soundbars — aggressive pricing, very fast refresh cycles.', true, false, 100),
  ('Marshall',       'marshall',       'https://www.marshall.com',       'Amp-styled speakers and headphones built under licence by Zound Industries.', true, false, 100),
  ('Jabra',          'jabra',          'https://www.jabra.com',          'Comes from a headset and hearing business, and it shows in the call quality.', true, false, 100),
  ('Anker',          'anker',          'https://www.anker.com',          'Charging, cables and power banks, plus Soundcore audio — the safe default in accessories.', true, false, 100),
  ('Audio-Technica', 'audio-technica', 'https://www.audio-technica.com', 'Studio monitors, microphones and turntables; a reference point rather than a lifestyle brand.', true, false, 100),

  -- Phones and tablets ------------------------------------------------------
  ('OnePlus',    'oneplus',    'https://www.oneplus.com',  'Flagship hardware at a discount to the flagships, with a software record worth checking per model.', true, false, 100),
  ('Xiaomi',     'xiaomi',     'https://www.mi.com',       'Phones, TVs and a very wide accessory catalogue, usually the price leader in its segment.', true, false, 100),
  ('Poco',       'poco',       null,                       'Xiaomi''s performance-per-rupee sub-brand, sold almost entirely online.', true, false, 100),
  ('Realme',     'realme',     'https://www.realme.com',   'Fast-moving budget and mid-range phones with frequent, overlapping model refreshes.', true, false, 100),
  ('Vivo',       'vivo',       'https://www.vivo.com',     'Camera-led mid-rangers and a strong offline retail presence.', true, false, 100),
  ('Oppo',       'oppo',       'https://www.oppo.com',     'Sibling of Vivo and OnePlus under BBK; design and fast charging are the pitch.', true, false, 100),
  ('iQOO',       'iqoo',       null,                       'Vivo''s performance line — chipset and display first, cameras second.', true, false, 100),
  ('Motorola',   'motorola',   'https://www.motorola.com', 'Lenovo-owned; close-to-stock Android and a long habit of undercutting on price.', true, false, 100),
  ('Honor',      'honor',      'https://www.honor.com',    'Independent of Huawei since 2020, back to shipping with Google services.', true, false, 100),

  -- Computing and components ------------------------------------------------
  ('Dell',            'dell',            'https://www.dell.com',           'Laptops, monitors and desktops with the service network to match — plus Alienware for gaming.', true, false, 100),
  ('HP',              'hp',              'https://www.hp.com',             'Laptops, printers and monitors; the printing arm is where the running costs live.', true, false, 100),
  ('Lenovo',          'lenovo',          'https://www.lenovo.com',         'ThinkPad, IdeaPad and Legion — keyboards and repairability are the recurring strengths.', true, false, 100),
  ('Acer',            'acer',            'https://www.acer.com',           'Aggressive on price across laptops and monitors, with Predator and Nitro for gaming.', true, false, 100),
  ('MSI',             'msi',             'https://www.msi.com',            'Gaming laptops, motherboards and graphics cards, with strong thermals as the selling point.', true, false, 100),
  ('Gigabyte',        'gigabyte',        'https://www.gigabyte.com',       'Motherboards, graphics cards and Aorus gaming gear.', true, false, 100),
  ('Intel',           'intel',           'https://www.intel.com',          'Core processors and Arc graphics; the incumbent everything else is benchmarked against.', true, false, 100),
  ('AMD',             'amd',             'https://www.amd.com',            'Ryzen processors and Radeon graphics — usually the value argument in both.', true, false, 100),
  ('Nvidia',          'nvidia',          'https://www.nvidia.com',         'GeForce graphics cards, and the software stack that makes them hard to leave.', true, false, 100),
  ('Microsoft',       'microsoft',       'https://www.microsoft.com',      'Surface hardware and the Xbox consoles, controllers and Game Pass ecosystem.', true, false, 100),
  ('Seagate',         'seagate',         'https://www.seagate.com',        'Hard drives and external storage, including the console-certified expansion cards.', true, false, 100),
  ('Western Digital', 'western-digital', 'https://www.westerndigital.com', 'WD and Black-series drives and SSDs, from NAS duty to gaming builds.', true, false, 100),
  ('SanDisk',         'sandisk',         'https://www.sandisk.com',        'Memory cards, portable SSDs and flash drives — the default in a camera bag.', true, false, 100),
  ('Crucial',         'crucial',         'https://www.crucial.com',        'Micron''s consumer arm: memory and SSDs, priced close to the silicon.', true, false, 100),
  ('Kingston',        'kingston',        'https://www.kingston.com',       'Memory, SSDs and the FURY gaming line.', true, false, 100),

  -- Printing ----------------------------------------------------------------
  ('Epson',   'epson',   'https://www.epson.com',   'Ink-tank printers, where the cartridge economics stop being a trap.', true, false, 100),
  ('Brother', 'brother', 'https://www.brother.com', 'Mono lasers and label printers with a reputation for outlasting their warranty.', true, false, 100),

  -- Gaming ------------------------------------------------------------------
  ('Razer',        'razer',        'https://www.razer.com',         'Peripherals and laptops built around a very specific aesthetic, with the software to match.', true, false, 100),
  ('Corsair',      'corsair',      'https://www.corsair.com',       'Peripherals, memory, cases and power supplies — a whole build from one vendor.', true, false, 100),
  ('HyperX',       'hyperx',       'https://www.hyperx.com',        'HP-owned; headsets and keyboards that hold up better than their price suggests.', true, false, 100),
  ('SteelSeries',  'steelseries',  'https://steelseries.com',       'Esports-first mice and headsets, with a long history in competitive play.', true, false, 100),
  ('Nintendo',     'nintendo',     'https://www.nintendo.com',      'The Switch platform, its controllers, and a library nobody else can sell you.', true, false, 100),
  ('Valve',        'valve',        'https://www.valvesoftware.com', 'Steam Deck and the Index — PC gaming in handheld and headset form.', true, false, 100),
  ('Cooler Master','cooler-master','https://www.coolermaster.com',  'Cooling, cases and peripherals; the cooling is still the reason to look.', true, false, 100),
  ('Redragon',     'redragon',     null,                            'Budget mechanical keyboards and mice that undercut the name brands by a wide margin.', true, false, 100),
  ('Secretlab',    'secretlab',    'https://secretlab.co',          'Gaming chairs sold on foam density and adjustment range rather than racing-seat styling.', true, false, 100),
  ('Elgato',       'elgato',       'https://www.elgato.com',        'Capture cards, Stream Decks and lighting — the streaming half of a gaming desk.', true, false, 100),
  ('Turtle Beach', 'turtle-beach', 'https://www.turtlebeach.com',   'Console-first headsets, with the compatibility caveats that implies.', true, false, 100),
  ('Ant Esports',  'ant-esports',  null,                            'India-focused gaming peripherals, chairs and cases at entry prices.', true, false, 100),
  ('Zebronics',    'zebronics',    'https://zebronics.com',         'Indian peripheral and audio maker with very broad, very cheap coverage.', true, false, 100),

  -- Cameras and drones ------------------------------------------------------
  ('Canon',     'canon',     'https://www.canon.com',        'The RF mirrorless system and its lenses, plus a large share of the home printer market.', true, false, 100),
  ('Nikon',     'nikon',     'https://www.nikon.com',        'Z-series mirrorless bodies and glass, with a deep back catalogue behind them.', true, false, 100),
  ('Fujifilm',  'fujifilm',  'https://www.fujifilm.com',     'X and GFX cameras, and the colour science people buy them for.', true, false, 100),
  ('Panasonic', 'panasonic', 'https://www.panasonic.com',    'Lumix cameras for video, plus a wide home-appliance catalogue.', true, false, 100),
  ('GoPro',     'gopro',     'https://www.gopro.com',        'Action cameras — stabilisation and durability over sensor size.', true, false, 100),
  ('DJI',       'dji',       'https://www.dji.com',          'Drones, gimbals and increasingly the cameras on them.', true, false, 100),
  ('Insta360',  'insta360',  'https://www.insta360.com',     '360 and action cameras, and the reframing software that makes them worth it.', true, false, 100),
  ('Sigma',     'sigma',     'https://www.sigma-global.com', 'Third-party lenses that regularly out-spec the first-party option at the price.', true, false, 100),

  -- Television and home entertainment ---------------------------------------
  ('LG',      'lg',      'https://www.lg.com',      'OLED televisions, monitors and a full major-appliance line.', true, false, 100),
  ('TCL',     'tcl',     'https://www.tcl.com',     'Mini-LED and QLED sets that keep resetting what a large screen costs.', true, false, 100),
  ('Hisense', 'hisense', 'https://www.hisense.com', 'Televisions and appliances competing hard on brightness per rupee.', true, false, 100),

  -- Networking --------------------------------------------------------------
  ('TP-Link', 'tp-link', 'https://www.tp-link.com', 'Routers, mesh systems and the Tapo smart-home line.', true, false, 100),
  ('Netgear', 'netgear', 'https://www.netgear.com', 'Nighthawk and Orbi — the expensive end of home networking, and often the fastest.', true, false, 100),
  ('D-Link',  'd-link',  'https://www.dlink.com',   'Routers and extenders across the budget and small-office range.', true, false, 100),

  -- Smart home and wearables ------------------------------------------------
  ('Philips',    'philips',    'https://www.philips.com',   'Hue lighting, grooming, and a large kitchen-appliance catalogue including air fryers.', true, false, 100),
  ('Amazon',     'amazon',     'https://www.amazon.com',    'Echo speakers, Fire TV and Ring — a smart home that assumes one account.', true, false, 100),
  ('Garmin',     'garmin',     'https://www.garmin.com',    'Sports watches with the best battery life in the category and no subscription for the basics.', true, false, 100),
  ('Amazfit',    'amazfit',    'https://www.amazfit.com',   'Zepp Health''s watch line — long battery life at a fraction of the flagship price.', true, false, 100),
  ('Noise',      'noise',      null,                        'Indian wearables brand with very high volume in budget smartwatches and earbuds.', true, false, 100),
  ('Fire-Boltt', 'fire-boltt', null,                        'Budget smartwatches sold on feature counts; tracking accuracy is the thing to check.', true, false, 100),
  ('Syska',      'syska',      null,                        'Indian lighting and smart-lighting brand, widely stocked offline.', true, false, 100),
  ('Roborock',   'roborock',   'https://www.roborock.com',  'Robot vacuums with the mapping and mopping most rivals are chasing.', true, false, 100),
  ('Ecovacs',    'ecovacs',    'https://www.ecovacs.com',   'Deebot robot vacuums, usually the value pick against Roborock.', true, false, 100),

  -- Charging and accessories ------------------------------------------------
  ('Belkin',     'belkin',     'https://www.belkin.com',     'Chargers, docks and cables, with the certifications actually printed on the box.', true, false, 100),
  ('UGREEN',     'ugreen',     'https://www.ugreen.com',     'Docks, hubs and GaN chargers at a consistent discount to the first-party option.', true, false, 100),
  ('Portronics', 'portronics', 'https://www.portronics.com', 'Indian accessory brand covering power banks, chargers and desk gear.', true, false, 100),
  ('Ambrane',    'ambrane',    null,                         'High-volume Indian power banks and cables at entry prices.', true, false, 100),
  ('Baseus',     'baseus',     'https://www.baseus.com',     'Chargers, cables and car accessories; broad catalogue, variable quality by line.', true, false, 100),

  -- Kitchen: everyday --------------------------------------------------------
  ('Prestige',        'prestige',        'https://www.ttkprestige.com',    'TTK Prestige — pressure cookers and cookware, and the service network to go with them.', true, false, 100),
  ('Hawkins',         'hawkins',         'https://www.hawkinscookers.com', 'Pressure cookers with spare gaskets and parts available for decades.', true, false, 100),
  ('Butterfly',       'butterfly',       null,                             'Mixer grinders and gas stoves built for South Indian kitchens first.', true, false, 100),
  ('Preethi',         'preethi',         null,                             'Mixer grinders with a strong reputation for motor life on wet grinding.', true, false, 100),
  ('Bajaj',           'bajaj',           'https://www.bajajelectricals.com','Bajaj Electricals — kitchen appliances, fans and lighting across every price band.', true, false, 100),
  ('Havells',         'havells',         'https://www.havells.com',        'Fans, water heaters and kitchen appliances, with Lloyd for cooling.', true, false, 100),
  ('Usha',            'usha',            'https://www.usha.com',           'Fans, sewing machines and kitchen appliances — an old name with wide reach.', true, false, 100),
  ('Morphy Richards','morphy-richards',  null,                             'British-origin small appliances, licensed and widely sold in India.', true, false, 100),
  ('Wonderchef',      'wonderchef',      'https://www.wonderchef.com',     'Cookware and small appliances aimed squarely at the home cook.', true, false, 100),
  ('Borosil',         'borosil',         'https://www.borosil.com',        'Glassware, ovenware and kitchen appliances; the glass is the reason to buy.', true, false, 100),
  ('Pigeon',          'pigeon',          null,                             'Stovekraft''s value brand — cookware and appliances at the entry price.', true, false, 100),
  ('Milton',          'milton',          null,                             'Flasks, bottles and food storage that survive being carried every day.', true, false, 100),
  ('Cello',           'cello',           null,                             'Storage, bottles and plastic kitchenware, stocked almost everywhere.', true, false, 100),
  ('Tefal',           'tefal',           'https://www.tefal.com',          'Groupe SEB''s non-stick line, including the thermo-spot pans it is known for.', true, false, 100),

  -- Kitchen: premium and coffee ---------------------------------------------
  ('KitchenAid', 'kitchenaid', 'https://www.kitchenaid.com',  'Stand mixers built to be inherited, and priced accordingly.', true, false, 100),
  ('De''Longhi', 'delonghi',   'https://www.delonghi.com',    'Espresso and bean-to-cup machines, plus coffee grinders and kitchen appliances.', true, false, 100),
  ('Nespresso',  'nespresso',  'https://www.nespresso.com',   'Pod espresso — convenience bought with a permanent capsule commitment.', true, false, 100),
  ('Breville',   'breville',   'https://www.breville.com',    'Prosumer espresso machines and ovens; sold as Sage in parts of Europe.', true, false, 100),
  ('Ninja',      'ninja',      'https://www.ninjakitchen.com','Blenders, air fryers and multi-cookers from SharkNinja.', true, false, 100),
  ('Cuisinart',  'cuisinart',  'https://www.cuisinart.com',   'Food processors and countertop appliances, the category it largely created.', true, false, 100),
  ('Lodge',      'lodge',      'https://www.lodgecastiron.com','Pre-seasoned cast iron that outlives everything else in the cupboard.', true, false, 100),

  -- Large appliances and home ------------------------------------------------
  ('Whirlpool',     'whirlpool',     'https://www.whirlpool.com',      'Refrigerators and washing machines across the mainstream range.', true, false, 100),
  ('Godrej',        'godrej',        'https://www.godrejappliances.com','Indian appliance maker with deep service coverage outside the metros.', true, false, 100),
  ('IFB',           'ifb',           'https://www.ifbappliances.com',  'Front-load washing machines and dishwashers sized for Indian homes.', true, false, 100),
  ('Bosch',         'bosch',         'https://www.bosch-home.com',     'Washing machines and dishwashers with a build-quality premium you can hear.', true, false, 100),
  ('Haier',         'haier',         'https://www.haier.com',          'Refrigerators, washing machines and air conditioners, usually undercutting on price.', true, false, 100),
  ('Voltas',        'voltas',        'https://www.voltas.com',         'Tata-owned; the volume leader in Indian air conditioning.', true, false, 100),
  ('Blue Star',     'blue-star',     'https://www.bluestarindia.com',  'Air conditioning and cooling, with a commercial engineering background.', true, false, 100),
  ('Daikin',        'daikin',        'https://www.daikin.com',         'Air conditioners rated on efficiency and how quietly they hold a temperature.', true, false, 100),
  ('Crompton',      'crompton',      'https://www.crompton.co.in',     'Fans, water heaters and pumps — the fittings half of an Indian home.', true, false, 100),
  ('Kent',          'kent',          'https://www.kent.co.in',         'RO water purifiers, and the annual service contract that comes with them.', true, false, 100),
  ('Eureka Forbes', 'eureka-forbes', 'https://www.eurekaforbes.com',   'Aquaguard purifiers and vacuum cleaners, sold on service reach.', true, false, 100),
  ('AO Smith',      'ao-smith',      'https://www.aosmith.com',        'Water heaters and purifiers; the tank and element quality is the argument.', true, false, 100),
  ('Dyson',         'dyson',         'https://www.dyson.com',          'Cordless vacuums, purifiers and hair care at the top of every price band.', true, false, 100),
  ('Honeywell',     'honeywell',     'https://www.honeywell.com',      'Air purifiers and filters, licensed into consumer lines in several markets.', true, false, 100)
on conflict (slug) do nothing;
