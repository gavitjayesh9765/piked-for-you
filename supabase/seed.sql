-- ============================================================================
-- Seed data — development and staging only.
--
-- Contains NO users and NO admins. Admin accounts are created manually and
-- deliberately: see docs/05-admin-setup.md. A seeded admin with a known
-- password is exactly the kind of thing that survives into production.
--
-- Run: supabase db reset   (applies migrations, then this file)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Retailers (spec §26)
-- ---------------------------------------------------------------------------
-- 'Official' is the brand's own store. It carries no affiliate template on
-- purpose: there is usually no programme to join, and inventing a tracking
-- parameter for a link that does not pay one would be noise in someone else's
-- analytics.
insert into public.retailers (name, slug, display_order, affiliate_template) values
  ('Amazon',   'amazon',   1, '?tag=pickdforyou-21'),
  ('Flipkart', 'flipkart', 2, '?affid=pickdforyou'),
  ('Official', 'official', 3, null)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Categories (spec §23)
-- ---------------------------------------------------------------------------
insert into public.categories
  (name, slug, path, depth, icon, description, display_order, show_on_homepage, score_criteria)
values
  ('Audio', 'audio', '["electronics","audio"]'::jsonb, 1, 'headphones',
   'Headphones, earbuds and speakers — ranked by how they actually sound, not by spec sheet.',
   1, true,
   '[{"key":"sound","label":"Sound"},{"key":"anc","label":"Noise cancellation"},
     {"key":"comfort","label":"Comfort"},{"key":"battery","label":"Battery"},
     {"key":"mic","label":"Call quality"},{"key":"value","label":"Value"}]'::jsonb),

  ('Computers', 'computers', '["electronics","computers"]'::jsonb, 1, 'laptop',
   'Laptops and desktops chosen for how they hold up over years, not benchmarks.',
   2, true,
   '[{"key":"performance","label":"Performance"},{"key":"display","label":"Display"},
     {"key":"battery","label":"Battery"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]'::jsonb),

  ('Mobiles', 'mobiles', '["electronics","mobiles"]'::jsonb, 1, 'smartphone',
   'Phones worth your money at every price point we track.',
   3, true,
   '[{"key":"camera","label":"Camera"},{"key":"performance","label":"Performance"},
     {"key":"battery","label":"Battery"},{"key":"display","label":"Display"},
     {"key":"software","label":"Software"},{"key":"value","label":"Value"}]'::jsonb),

  ('Gaming', 'gaming', '["electronics","gaming"]'::jsonb, 1, 'gamepad',
   'Monitors, mice and headsets that hold up under competitive play.',
   4, true,
   '[{"key":"latency","label":"Latency"},{"key":"build","label":"Build"},
     {"key":"comfort","label":"Comfort"},{"key":"value","label":"Value"}]'::jsonb),

  ('Cameras', 'cameras', '["electronics","cameras"]'::jsonb, 1, 'camera',
   'Cameras judged on what you actually shoot, not sensor size alone.',
   5, true,
   '[{"key":"image","label":"Image quality"},{"key":"autofocus","label":"Autofocus"},
     {"key":"handling","label":"Handling"},{"key":"value","label":"Value"}]'::jsonb),

  ('Wearables', 'wearables', '["electronics","wearables"]'::jsonb, 1, 'watch',
   'Watches and trackers that earn their place on your wrist.',
   6, true,
   '[{"key":"tracking","label":"Tracking accuracy"},{"key":"battery","label":"Battery"},
     {"key":"comfort","label":"Comfort"},{"key":"value","label":"Value"}]'::jsonb),

  ('Smart Home', 'smart-home', '["electronics","smart-home"]'::jsonb, 1, 'home',
   'Devices that make a home simpler, not one more thing to maintain.',
   7, true, '[]'::jsonb),

  ('Accessories', 'accessories', '["electronics","accessories"]'::jsonb, 1, 'cable',
   'The small things that quietly make everything else better.',
   8, true, '[]'::jsonb)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Brands (spec §22)
-- ---------------------------------------------------------------------------
insert into public.brands (name, slug, is_pinned, display_order) values
  ('Sony',       'sony',       true, 1),
  ('Samsung',    'samsung',    true, 2),
  ('Logitech',   'logitech',   true, 3),
  ('Nothing',    'nothing',    true, 4),
  ('Apple',      'apple',      true, 5),
  ('Bose',       'bose',       true, 6),
  ('Sennheiser', 'sennheiser', true, 7),
  ('Asus',       'asus',       true, 8)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Badges (spec §21) — style is a design token, never a colour
-- ---------------------------------------------------------------------------
insert into public.badges (name, slug, style, display_order) values
  ('Top Recommendation', 'top-recommendation', 'editorial', 1),
  ('Editor''s Choice',   'editors-choice',     'editorial', 2),
  ('Best Value',         'best-value',         'value',     3),
  ('Worth It',           'worth-it',           'value',     4),
  ('Best for Gaming',    'best-for-gaming',    'brand',     5),
  ('Premium Pick',       'premium-pick',       'brand',     6),
  ('New',                'new',                'neutral',   7)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Products
--
-- Seeded as PUBLISHED so the public site has something to render immediately.
-- One is left as a draft on purpose — it is the fixture for verification
-- step 8 (RLS must hide it from the anon key) and step 14 (404 publicly).
-- ---------------------------------------------------------------------------
with seed(title, slug, brand_slug, cat_slug, tagline, price_current, price_min, price_max,
          score, verdict, status) as (
  values
    ('WH-1000XM5', 'sony-wh-1000xm5', 'sony', 'audio',
     'Class-leading noise cancellation with the best call quality in its price band.',
     24990, 22990, 29990, 9.4,
     'This is the headphone to buy if noise cancellation is the reason you are shopping. The ANC is a clear step ahead of everything else at this price, and the call quality — usually the first thing sacrificed — is the best we have tested. You are paying a premium for that, and the folding hinge of the previous generation is gone, so it travels less gracefully. If you spend more time on calls and commutes than in a bag, that trade is worth making.',
     'published'),

    ('Ear (a)', 'nothing-ear-a', 'nothing', 'audio',
     'The most interesting design under ₹10,000, and the ANC finally keeps up with it.',
     7499, 6999, 8999, 8.6,
     'Nothing has stopped trading substance for style. The ANC is genuinely competitive now, the transparent shell still looks like nothing else on a desk, and at this price the compromises are the right ones — a slightly plasticky case, and a fit that suits smaller ears better.',
     'published'),

    ('MX Master 3S', 'logitech-mx-master-3s', 'logitech', 'accessories',
     'Still the mouse to beat for long working days — quiet clicks, flawless scroll.',
     8495, 7995, 10995, 9.1,
     'Three generations in, this is a mature product with very little left to complain about. The quiet clicks are a real quality-of-life change in a shared room, and the electromagnetic scroll wheel remains unmatched for long documents. It is expensive, and it is worth it if you use a mouse for six hours a day.',
     'published'),

    ('MacBook Air M3', 'apple-macbook-air-m3', 'apple', 'computers',
     'Silent, cool and genuinely all-day. The default laptop for most people.',
     114900, 104900, 134900, 9.3,
     'The fanless design is the whole argument: it never gets loud because it cannot. Battery genuinely lasts a working day, the display is excellent, and the base configuration is finally enough RAM to not regret. Buy more storage than you think you need — you cannot add it later.',
     'published'),

    ('ROG Swift OLED PG27', 'asus-rog-swift-oled-pg27', 'asus', 'gaming',
     'OLED response times at 240Hz — the clearest motion you can currently buy.',
     89990, 84990, 99990, 9.2,
     'Once you have seen OLED motion clarity at 240Hz it is difficult to go back. Text rendering is the known tradeoff of the subpixel layout, so if this doubles as your work monitor, look closely first. For gaming alone, nothing else is close at this size.',
     'published'),

    ('Galaxy S24', 'samsung-galaxy-s24', 'samsung', 'mobiles',
     'The compact flagship that does not compromise the camera to stay small.',
     66999, 61999, 79999, 8.9,
     'Small phones usually mean a worse camera and worse battery. This one does not. Seven years of updates is the quiet headline — it changes what this costs per year of use.',
     'published'),

    ('QuietComfort Ultra', 'bose-quietcomfort-ultra', 'bose', 'audio',
     'The most comfortable ANC headphone made — if you can live with shorter battery.',
     29900, 27900, 35900, 8.8,
     null,
     -- DRAFT on purpose: the fixture for the RLS and 404 verification steps.
     -- Note the null verdict, which also exercises the §62 publish block.
     'draft')
)
insert into public.products
  (title, slug, brand_id, category_id, tagline, currency,
   price_current, price_min, price_max, price_updated_at,
   verdict, best_for, not_ideal_for, pros, cons,
   status, published_at, rating_average, rating_count)
select
  s.title, s.slug, b.id, c.id, s.tagline, 'INR',
  s.price_current, s.price_min, s.price_max, now(),
  s.verdict,
  '["Frequent travellers","Open-plan office work","Long call-heavy days"]'::jsonb,
  '["Tight bag space","Studio monitoring","Workouts — no IP rating"]'::jsonb,
  '["Best-in-class noise cancellation","Exceptional microphone clarity","Comfortable past three hours"]'::jsonb,
  '["Bulky carrying case","Touch controls falter in cold weather"]'::jsonb,
  s.status,
  case when s.status = 'published' then now() else null end,
  case when s.status = 'published' then 4.5 else null end,
  case when s.status = 'published' then 128 else 0 end
from seed s
join public.brands     b on b.slug = s.brand_slug
join public.categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;

-- Scores
insert into public.product_scores (product_id, overall, criteria)
select p.id,
       case p.slug
         when 'sony-wh-1000xm5'          then 9.4
         when 'nothing-ear-a'            then 8.6
         when 'logitech-mx-master-3s'    then 9.1
         when 'apple-macbook-air-m3'     then 9.3
         when 'asus-rog-swift-oled-pg27' then 9.2
         when 'samsung-galaxy-s24'       then 8.9
         else 8.8
       end,
       '[{"key":"sound","label":"Sound","value":9.2},
         {"key":"anc","label":"Noise cancellation","value":9.6},
         {"key":"comfort","label":"Comfort","value":8.8},
         {"key":"battery","label":"Battery","value":9.0},
         {"key":"mic","label":"Call quality","value":9.1},
         {"key":"value","label":"Value","value":8.4}]'::jsonb
from public.products p
on conflict (product_id) do nothing;

-- Badges
insert into public.product_badges (product_id, badge_id, display_order)
select p.id, bd.id, 0
from public.products p
join public.badges bd on bd.slug = 'top-recommendation'
where p.slug in ('sony-wh-1000xm5', 'apple-macbook-air-m3')
on conflict do nothing;

insert into public.product_badges (product_id, badge_id, display_order)
select p.id, bd.id, 1
from public.products p
join public.badges bd on bd.slug = 'worth-it'
where p.slug in ('sony-wh-1000xm5', 'logitech-mx-master-3s')
on conflict do nothing;

insert into public.product_badges (product_id, badge_id, display_order)
select p.id, bd.id, 0
from public.products p
join public.badges bd on bd.slug = 'best-value'
where p.slug in ('nothing-ear-a', 'samsung-galaxy-s24')
on conflict do nothing;

-- Retailer links (spec §26)
--
-- Every published product gets all three, including Official — the point of
-- the seed is that the product page has something to render for each, so the
-- three-link layout is exercised rather than assumed.
insert into public.product_retailers
  (product_id, retailer_id, url, display_price, price_checked_at, currency)
select p.id, r.id,
       case r.slug
         when 'official' then 'https://www.' || b.slug || '.com/products/' || p.slug
         else 'https://www.' || r.slug || '.in/dp/' || p.slug
       end,
       p.price_current + case r.slug
         when 'flipkart' then 509
         when 'official' then 1500   -- the brand's own store rarely undercuts
         else 0
       end,
       now(),
       p.currency
from public.products p
join public.brands b on b.id = p.brand_id
cross join public.retailers r
where p.status = 'published'
on conflict (product_id, retailer_id) do nothing;

-- A little price history, so the chart on a product page has a shape to draw
-- rather than a single point. Six fortnightly observations trending down,
-- which is what consumer electronics actually do after launch.
insert into public.price_history
  (product_id, retailer_id, product_retailer_id, price, currency, in_stock, source, captured_at)
select pr.product_id,
       pr.retailer_id,
       pr.id,
       round(pr.display_price * (1 + (n * 0.035)), 2),
       coalesce(pr.currency, 'INR'),
       true,
       'import',
       now() - (n * interval '14 days')
from public.product_retailers pr
cross join generate_series(1, 6) as n
where pr.display_price is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Top Picks (spec §15)
-- ---------------------------------------------------------------------------
insert into public.top_picks (product_id, display_order)
select p.id, row_number() over (order by p.title)
from public.products p
where p.status = 'published'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Homepage composition (spec §39) — the homepage is data, not a template
-- ---------------------------------------------------------------------------
insert into public.homepage_sections (kind, title, subtitle, display_order, config) values
  ('hero', null, null, 1, '{}'::jsonb),
  ('category_tiles', 'What are you looking for?', null, 2, '{}'::jsonb),
  ('top_picks', 'Top Picks right now',
   'The highest-scoring products across every category we cover.', 3,
   '{"limit": 8}'::jsonb),
  ('category_rail', 'Audio',
   'Headphones, earbuds and speakers, ranked on how they actually sound.', 4,
   '{"categorySlug": "audio", "limit": 8}'::jsonb),
  ('category_rail', 'Gaming',
   'Monitors, mice and headsets that hold up under competitive play.', 5,
   '{"categorySlug": "gaming", "limit": 8}'::jsonb),
  ('category_rail', 'Mobiles',
   'Phones worth your money at every price point we track.', 6,
   '{"categorySlug": "mobiles", "limit": 8}'::jsonb),
  ('featured_brands', 'Brands we cover', null, 7, '{}'::jsonb),
  ('newsletter', null, null, 8, '{}'::jsonb)
on conflict do nothing;
