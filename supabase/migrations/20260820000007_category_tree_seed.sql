-- ============================================================================
-- Proper hierarchical categories (spec §23).
--
-- The original seed was flat — eight siblings pretending to be a tree. Real
-- browsing needs depth: someone shopping for headphones wants
-- Electronics > Audio > Headphones, not a single "Audio" bucket holding
-- earbuds, soundbars and turntables together.
--
-- Three levels, which is where the spec's own example stops:
--
--   Electronics
--     Audio
--       Headphones · Earbuds · Speakers · Soundbars
--     Computers
--       Laptops · Monitors · Keyboards · Mice
--     Mobiles
--       Smartphones · Tablets · Cases & Covers · Chargers
--     Gaming
--       Consoles · Gaming Monitors · Controllers · Gaming Headsets
--     Cameras
--       Mirrorless · Action Cameras · Lenses
--     Wearables
--       Smartwatches · Fitness Bands
--     Smart Home
--       Smart Speakers · Smart Lighting · Security Cameras
--     Accessories
--       Power Banks · Cables & Adapters · Storage
--
-- `show_on_homepage` is set only on the second level. The root is too broad to
-- be a useful tile and the leaves are too many.
-- ============================================================================

-- Existing top-level rows become children of Electronics rather than being
-- deleted — products already reference them, and a delete would cascade.
insert into public.categories (name, slug, description, icon, parent_id, display_order, is_active, show_on_homepage)
values (
  'Electronics', 'electronics',
  'Everything with a plug or a battery — researched, scored, and ranked.',
  'monitor', null, 1, true, false
)
on conflict (slug) do nothing;

-- Re-parent the eight existing categories under Electronics.
update public.categories
set parent_id = (select id from public.categories where slug = 'electronics')
where slug in (
  'audio', 'computers', 'mobiles', 'gaming',
  'cameras', 'wearables', 'smart-home', 'accessories'
)
and parent_id is null;

-- ---------------------------------------------------------------------------
-- Third level
-- ---------------------------------------------------------------------------
with parent as (
  select id, slug from public.categories
),
leaf(name, slug, parent_slug, icon, ord, description) as (
  values
    -- Audio
    ('Headphones',      'headphones',       'audio',       'headphones', 1, 'Over-ear and on-ear, ranked on sound, comfort and noise cancellation.'),
    ('Earbuds',         'earbuds',          'audio',       'headphones', 2, 'True wireless, judged on fit, battery and what they actually sound like.'),
    ('Speakers',        'speakers',         'audio',       'speaker',    3, 'Portable and bookshelf speakers worth the shelf space.'),
    ('Soundbars',       'soundbars',        'audio',       'speaker',    4, 'Because your TV''s built-in speakers are the weakest part of it.'),
    -- Computers
    ('Laptops',         'laptops',          'computers',   'laptop',     1, 'Chosen for how they hold up over years, not benchmark scores.'),
    ('Monitors',        'monitors',         'computers',   'monitor',    2, 'Panels rated on colour, motion and how they treat your eyes.'),
    ('Keyboards',       'keyboards',        'computers',   'cable',      3, 'Mechanical and low-profile boards you can type on all day.'),
    ('Mice',            'mice',             'computers',   'cable',      4, 'Ergonomics first — you hold this for eight hours.'),
    -- Mobiles
    ('Smartphones',     'smartphones',      'mobiles',     'smartphone', 1, 'Phones worth your money at every price we track.'),
    ('Tablets',         'tablets',          'mobiles',     'smartphone', 2, 'For reading, drawing, or replacing a laptop — they are not the same tablet.'),
    ('Cases & Covers',  'cases-covers',     'mobiles',     'smartphone', 3, 'Protection that does not add a centimetre to your pocket.'),
    ('Chargers',        'chargers',         'mobiles',     'cable',      4, 'Fast charging that will not cook your battery.'),
    -- Gaming
    ('Consoles',        'consoles',         'gaming',      'gamepad',    1, 'The machines, and which one suits how you actually play.'),
    ('Gaming Monitors', 'gaming-monitors',  'gaming',      'monitor',    2, 'High refresh rates and the response times to match.'),
    ('Controllers',     'controllers',      'gaming',      'gamepad',    3, 'Pads and sticks that survive competitive play.'),
    ('Gaming Headsets', 'gaming-headsets',  'gaming',      'headphones', 4, 'Positional audio and a microphone people can hear.'),
    -- Cameras
    ('Mirrorless',      'mirrorless',       'cameras',     'camera',     1, 'Bodies judged on autofocus and what you will actually carry.'),
    ('Action Cameras',  'action-cameras',   'cameras',     'camera',     2, 'Stabilisation and durability over megapixels.'),
    ('Lenses',          'lenses',           'cameras',     'camera',     3, 'The glass matters more than the body.'),
    -- Wearables
    ('Smartwatches',    'smartwatches',     'wearables',   'watch',      1, 'Watches that earn their place on your wrist.'),
    ('Fitness Bands',   'fitness-bands',    'wearables',   'watch',      2, 'Tracking accuracy first, everything else second.'),
    -- Smart Home
    ('Smart Speakers',  'smart-speakers',   'smart-home',  'speaker',    1, 'Assistants that are useful rather than one more thing to manage.'),
    ('Smart Lighting',  'smart-lighting',   'smart-home',  'home',       2, 'Bulbs and strips that work without a hub full of apps.'),
    ('Security Cameras','security-cameras', 'smart-home',  'camera',     3, 'What happens to the footage matters as much as the picture.'),
    -- Accessories
    ('Power Banks',     'power-banks',      'accessories', 'cable',      1, 'Real capacity, not the number on the box.'),
    ('Cables & Adapters','cables-adapters', 'accessories', 'cable',      2, 'The small things that quietly make everything else work.'),
    ('Storage',         'storage',          'accessories', 'cable',      3, 'SSDs and cards rated on sustained speed, not peak.')
)
insert into public.categories
  (name, slug, description, icon, parent_id, display_order, is_active, show_on_homepage)
select l.name, l.slug, l.description, l.icon, p.id, l.ord, true, false
from leaf l
join parent p on p.slug = l.parent_slug
on conflict (slug) do nothing;

-- Second level are the homepage tiles: broad enough to be a useful entry
-- point, narrow enough to mean something.
update public.categories
set show_on_homepage = true
where slug in ('audio', 'computers', 'mobiles', 'gaming', 'cameras', 'wearables', 'smart-home', 'accessories');

update public.categories
set show_on_homepage = false
where slug = 'electronics';

-- Recompute every path and depth now that the tree has real shape.
select public.rebuild_category_paths();
