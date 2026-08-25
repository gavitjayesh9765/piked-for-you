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
  ('Amazon',   'amazon',   1, '?tag=sortedchoice-21'),
  ('Flipkart', 'flipkart', 2, '?affid=sortedchoice'),
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
          score, verdict, status, best_for, not_ideal_for, pros, cons) as (
  values
    ('WH-1000XM5', 'sony-wh-1000xm5', 'sony', 'headphones',
     'Class-leading noise cancellation with the best call quality in its price band.',
     24990, 22990, 29990, 9.4,
     'This is the headphone to buy if noise cancellation is the reason you are shopping. The ANC is a clear step ahead of everything else at this price, and the call quality — usually the first thing sacrificed — is the best we have tested. You are paying a premium for that, and the folding hinge of the previous generation is gone, so it travels less gracefully. If you spend more time on calls and commutes than in a bag, that trade is worth making.',
     'published',
     '["Frequent flyers and commuters","Open-plan office work","Long call-heavy days"]',
     '["Tight bag space — it no longer folds flat","Studio monitoring","Workouts — there is no IP rating"]',
     '["Best-in-class active noise cancellation","Exceptional microphone clarity on calls","Comfortable past the three-hour mark","30-hour battery with ANC engaged"]',
     '["No longer folds down compactly","Carrying case is bulky","Touch controls are inconsistent in cold weather"]'),

    ('Ear (a)', 'nothing-ear-a', 'nothing', 'earbuds',
     'The most interesting design under ₹10,000, and the ANC finally keeps up with it.',
     7499, 6999, 8999, 8.6,
     'Nothing has stopped trading substance for style. The ANC is genuinely competitive now, the transparent shell still looks like nothing else on a desk, and at this price the compromises are the right ones — a slightly plasticky case, and a fit that suits smaller ears better.',
     'published',
     '["Anyone shopping under ₹10,000","Commutes and open offices","People who want their kit to look like something"]',
     '["Larger ears — the fit favours smaller ones","Studio monitoring","Heavy call use"]',
     '["ANC that genuinely competes at this price","Distinctive transparent design","LDAC support at the price"]',
     '["Case feels plasticky","Microphone is only adequate","Fit suits smaller ears better"]'),

    ('MX Master 3S', 'logitech-mx-master-3s', 'logitech', 'mice',
     'Still the mouse to beat for long working days — quiet clicks, flawless scroll.',
     8495, 7995, 10995, 9.1,
     'Three generations in, this is a mature product with very little left to complain about. The quiet clicks are a real quality-of-life change in a shared room, and the electromagnetic scroll wheel remains unmatched for long documents. It is expensive, and it is worth it if you use a mouse for six hours a day.',
     'published',
     '["Eight-hour desk days","Shared rooms and offices","Long documents and spreadsheets","Working across two or three machines"]',
     '["Competitive gaming — the polling rate is 125 Hz","Left-handed users","Anyone wanting a light mouse"]',
     '["Quiet clicks that do not carry across a room","MagSpeed scroll wheel is still unmatched","Flow across three machines","70-day battery"]',
     '["Expensive for a mouse","Heavy at 141 g","Right-handed only"]'),

    ('MacBook Air M3', 'apple-macbook-air-m3', 'apple', 'laptops',
     'Silent, cool and genuinely all-day. The default laptop for most people.',
     114900, 104900, 134900, 9.3,
     'The fanless design is the whole argument: it never gets loud because it cannot. Battery genuinely lasts a working day, the display is excellent, and the base configuration is finally enough RAM to not regret. Buy more storage than you think you need — you cannot add it later.',
     'published',
     '["Most people, most of the time","All-day work away from a socket","Silent working environments"]',
     '["Sustained heavy renders — there is no fan","Upgrading storage later","Gaming"]',
     '["Fanless, so it never gets loud","Genuinely all-day battery","Excellent display for the class","16 GB base RAM at last"]',
     '["Storage cannot be upgraded later","Only two Thunderbolt ports","Throttles under sustained load"]'),

    ('ROG Swift OLED PG27', 'asus-rog-swift-oled-pg27', 'asus', 'gaming-monitors',
     'OLED response times at 240Hz — the clearest motion you can currently buy.',
     89990, 84990, 99990, 9.2,
     'Once you have seen OLED motion clarity at 240Hz it is difficult to go back. Text rendering is the known tradeoff of the subpixel layout, so if this doubles as your work monitor, look closely first. For gaming alone, nothing else is close at this size.',
     'published',
     '["Competitive shooters","Anyone chasing motion clarity","Dark-room gaming"]',
     '["Doubling as a work monitor — check the text rendering","Bright rooms","Tight budgets"]',
     '["OLED motion clarity at 240 Hz","0.03 ms response time","Perfect blacks and contrast","3-year burn-in warranty"]',
     '["Text fringing from the subpixel layout","Expensive","No USB-C power delivery"]'),

    ('Galaxy S24', 'samsung-galaxy-s24', 'samsung', 'smartphones',
     'The compact flagship that does not compromise the camera to stay small.',
     66999, 61999, 79999, 8.9,
     'Small phones usually mean a worse camera and worse battery. This one does not. Seven years of updates is the quiet headline — it changes what this costs per year of use.',
     'published',
     '["Anyone who wants a small flagship","Long ownership — seven years of updates","Everyday photography"]',
     '["Heavy camera users who want a periscope zoom","All-day screen time on one charge","Tight budgets"]',
     '["Compact without compromising the camera","Seven years of OS and security updates","Excellent 2,600-nit display","Strong performance"]',
     '["4,000 mAh is small for the class","25 W charging is slow","No microSD expansion"]'),

    ('QuietComfort Ultra', 'bose-quietcomfort-ultra', 'bose', 'headphones',
     'The most comfortable ANC headphone made — if you can live with shorter battery.',
     29900, 27900, 35900, 8.8,
     null,
     -- DRAFT on purpose: the fixture for the RLS and 404 verification steps.
     -- Note the null verdict, which also exercises the §62 publish block.
     'draft',
     '["Long-haul flights","All-day wear","Anyone who finds other headphones clamp too hard"]',
     '["Long trips away from a charger","Studio monitoring","Tight budgets"]',
     '["The most comfortable ANC headphone made","Excellent noise cancellation","Immersive Audio is genuinely useful","Folds flat and inward"]',
     '["24-hour battery trails rivals","Expensive","No LDAC or aptX HD"]')
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
  -- Per product, not one shared block. These were previously the same four
  -- headphone lines on every row, so a laptop was "not ideal for" studio
  -- monitoring and a mouse had "exceptional microphone clarity".
  s.best_for::jsonb,
  s.not_ideal_for::jsonb,
  s.pros::jsonb,
  s.cons::jsonb,
  s.status,
  case when s.status = 'published' then now() else null end,
  case when s.status = 'published' then 4.5 else null end,
  case when s.status = 'published' then 128 else 0 end
from seed s
join public.brands     b on b.slug = s.brand_slug
join public.categories c on c.slug = s.cat_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Scores (spec §24)
--
-- Per category, not one shared block. Every product used to be seeded with the
-- same six headphone criteria, so a mouse was scored on "Noise cancellation"
-- and a laptop on "Call quality" — the criteria keys must match the category's
-- template or `set_score` would reject the same payload from the admin panel.
-- ---------------------------------------------------------------------------
with score(slug, overall, criteria) as (
  values
    ('sony-wh-1000xm5', 9.4,
     '[{"key":"sound","label":"Sound","value":9.2},
       {"key":"anc","label":"Noise cancellation","value":9.6},
       {"key":"comfort","label":"Comfort","value":8.8},
       {"key":"battery","label":"Battery","value":9.0},
       {"key":"mic","label":"Call quality","value":9.1},
       {"key":"value","label":"Value","value":8.4}]'),

    ('bose-quietcomfort-ultra', 8.8,
     '[{"key":"sound","label":"Sound","value":8.9},
       {"key":"anc","label":"Noise cancellation","value":9.4},
       {"key":"comfort","label":"Comfort","value":9.7},
       {"key":"battery","label":"Battery","value":7.6},
       {"key":"mic","label":"Call quality","value":8.5},
       {"key":"value","label":"Value","value":7.9}]'),

    ('nothing-ear-a', 8.6,
     '[{"key":"sound","label":"Sound","value":8.7},
       {"key":"anc","label":"Noise cancellation","value":8.4},
       {"key":"fit","label":"Fit & seal","value":8.8},
       {"key":"battery","label":"Battery","value":8.9},
       {"key":"mic","label":"Call quality","value":8.0},
       {"key":"value","label":"Value","value":9.3}]'),

    ('logitech-mx-master-3s', 9.1,
     '[{"key":"ergonomics","label":"Ergonomics","value":9.4},
       {"key":"sensor","label":"Sensor accuracy","value":8.9},
       {"key":"buttons","label":"Buttons & scroll","value":9.5},
       {"key":"build","label":"Build","value":9.0},
       {"key":"software","label":"Software","value":8.6},
       {"key":"value","label":"Value","value":8.5}]'),

    ('apple-macbook-air-m3', 9.3,
     '[{"key":"performance","label":"Performance","value":9.0},
       {"key":"display","label":"Display","value":8.8},
       {"key":"battery","label":"Battery","value":9.7},
       {"key":"keyboard","label":"Keyboard & trackpad","value":9.3},
       {"key":"build","label":"Build","value":9.5},
       {"key":"thermals","label":"Thermals & noise","value":9.8},
       {"key":"value","label":"Value","value":8.6}]'),

    ('asus-rog-swift-oled-pg27', 9.2,
     '[{"key":"motion","label":"Motion clarity","value":9.8},
       {"key":"latency","label":"Input latency","value":9.6},
       {"key":"image","label":"Image quality","value":9.3},
       {"key":"colour","label":"Colour accuracy","value":9.0},
       {"key":"features","label":"Gaming features","value":8.9},
       {"key":"value","label":"Value","value":7.8}]'),

    ('samsung-galaxy-s24', 8.9,
     '[{"key":"camera","label":"Camera","value":9.0},
       {"key":"performance","label":"Performance","value":9.1},
       {"key":"battery","label":"Battery","value":8.3},
       {"key":"display","label":"Display","value":9.2},
       {"key":"software","label":"Software & updates","value":9.4},
       {"key":"build","label":"Build","value":8.8},
       {"key":"value","label":"Value","value":8.2}]')
)
insert into public.product_scores (product_id, overall, criteria)
select p.id, sc.overall, sc.criteria::jsonb
from public.products p
join score sc on sc.slug = p.slug
on conflict (product_id) do nothing;


-- ---------------------------------------------------------------------------
-- Specifications (spec §41)
--
-- Keys match each category's spec_template. The admin panel writes exactly
-- this shape, and the API rejects any key the template does not list.
-- ---------------------------------------------------------------------------
with spec(slug, specifications) as (
  values
    ('sony-wh-1000xm5',
     '[{"key":"audio","label":"Audio","items":[
         {"key":"driver","label":"Driver","value":"30mm carbon fibre composite"},
         {"key":"frequency_response","label":"Frequency response","value":"4 Hz - 40,000 Hz"},
         {"key":"codecs","label":"Codecs","value":"SBC, AAC, LDAC"},
         {"key":"anc","label":"Noise cancellation","value":"Adaptive, 8 microphones"}]},
       {"key":"power","label":"Battery & power","items":[
         {"key":"battery_anc_on","label":"Playback (ANC on)","value":"30 hours"},
         {"key":"quick_charge","label":"Quick charge","value":"3 min to 3 hours"},
         {"key":"charging","label":"Charging","value":"USB-C"}]},
       {"key":"physical","label":"Physical","items":[
         {"key":"weight","label":"Weight","value":"250 g"},
         {"key":"connectivity","label":"Connectivity","value":"Bluetooth 5.2, Multipoint"},
         {"key":"folding","label":"Folds flat","value":"Swivel only"},
         {"key":"water_resistance","label":"Water resistance","value":"None"}]}]'),

    ('bose-quietcomfort-ultra',
     '[{"key":"audio","label":"Audio","items":[
         {"key":"driver","label":"Driver","value":"35mm dynamic"},
         {"key":"frequency_response","label":"Frequency response","value":"20 Hz - 20,000 Hz"},
         {"key":"codecs","label":"Codecs","value":"SBC, AAC, aptX Adaptive"},
         {"key":"anc","label":"Noise cancellation","value":"Adaptive, with Immersive Audio"}]},
       {"key":"power","label":"Battery & power","items":[
         {"key":"battery_anc_on","label":"Playback (ANC on)","value":"24 hours"},
         {"key":"quick_charge","label":"Quick charge","value":"15 min to 2.5 hours"},
         {"key":"charging","label":"Charging","value":"USB-C"}]},
       {"key":"physical","label":"Physical","items":[
         {"key":"weight","label":"Weight","value":"254 g"},
         {"key":"connectivity","label":"Connectivity","value":"Bluetooth 5.3, Multipoint"},
         {"key":"folding","label":"Folds flat","value":"Folds flat and inward"},
         {"key":"water_resistance","label":"Water resistance","value":"None"}]}]'),

    ('nothing-ear-a',
     '[{"key":"audio","label":"Audio","items":[
         {"key":"driver","label":"Driver","value":"11mm dynamic"},
         {"key":"codecs","label":"Codecs","value":"SBC, AAC, LDAC"},
         {"key":"anc","label":"Noise cancellation","value":"Hybrid ANC, up to 45 dB"},
         {"key":"transparency","label":"Transparency mode","value":"Yes"}]},
       {"key":"power","label":"Battery & power","items":[
         {"key":"battery_buds","label":"Buds (ANC on)","value":"5.5 hours"},
         {"key":"battery_case","label":"With case","value":"24 hours"},
         {"key":"charging","label":"Charging","value":"USB-C"}]},
       {"key":"physical","label":"Physical","items":[
         {"key":"weight_bud","label":"Weight per bud","value":"4.8 g"},
         {"key":"tips","label":"Ear tips included","value":"S / M / L"},
         {"key":"water_resistance","label":"Water resistance","value":"IP54"},
         {"key":"connectivity","label":"Connectivity","value":"Bluetooth 5.3, Multipoint"}]}]'),

    ('logitech-mx-master-3s',
     '[{"key":"sensor","label":"Sensor & tracking","items":[
         {"key":"sensor","label":"Sensor","value":"Darkfield high precision"},
         {"key":"max_dpi","label":"Max DPI","value":"8,000 DPI"},
         {"key":"max_speed","label":"Max speed","value":"Tracks on glass, 4mm+"},
         {"key":"polling_rate","label":"Polling rate","value":"125 Hz"}]},
       {"key":"controls","label":"Buttons & scroll","items":[
         {"key":"buttons","label":"Buttons","value":"7 programmable"},
         {"key":"switches","label":"Switch rating","value":"Quiet, 90% less click noise"},
         {"key":"scroll","label":"Scroll wheel","value":"MagSpeed electromagnetic, 1,000 lines/sec"},
         {"key":"thumb_wheel","label":"Thumb wheel","value":"Yes, horizontal"}]},
       {"key":"connectivity","label":"Connectivity & power","items":[
         {"key":"connection","label":"Connection","value":"Bluetooth LE, Logi Bolt, USB-C"},
         {"key":"battery_life","label":"Battery life","value":"70 days"},
         {"key":"quick_charge","label":"Quick charge","value":"1 min to 3 hours"},
         {"key":"multi_device","label":"Multi-device","value":"Up to 3, Flow across machines"}]},
       {"key":"physical","label":"Physical","items":[
         {"key":"weight","label":"Weight","value":"141 g"},
         {"key":"dimensions","label":"Dimensions","value":"124.9 x 84.3 x 51 mm"},
         {"key":"hand","label":"Hand orientation","value":"Right-handed"},
         {"key":"grip","label":"Grip style","value":"Palm"}]}]'),

    ('apple-macbook-air-m3',
     '[{"key":"performance","label":"Performance","items":[
         {"key":"processor","label":"Processor","value":"Apple M3, 8-core CPU"},
         {"key":"graphics","label":"Graphics","value":"10-core integrated GPU"},
         {"key":"memory","label":"Memory","value":"16 GB unified"},
         {"key":"storage","label":"Storage","value":"512 GB SSD"}]},
       {"key":"display","label":"Display","items":[
         {"key":"size","label":"Size","value":"13.6-inch"},
         {"key":"resolution","label":"Resolution","value":"2560 x 1664"},
         {"key":"panel","label":"Panel","value":"IPS, 500 nits"},
         {"key":"refresh_rate","label":"Refresh rate","value":"60 Hz"}]},
       {"key":"power","label":"Battery & power","items":[
         {"key":"battery_capacity","label":"Battery","value":"52.6 Wh"},
         {"key":"battery_life","label":"Rated battery life","value":"18 hours"},
         {"key":"charger","label":"Charger","value":"35 W dual USB-C"}]},
       {"key":"connectivity","label":"Ports & wireless","items":[
         {"key":"ports","label":"Ports","value":"2 x Thunderbolt 4, MagSafe, 3.5mm"},
         {"key":"wireless","label":"Wireless","value":"Wi-Fi 6E, Bluetooth 5.3"},
         {"key":"webcam","label":"Webcam","value":"1080p"}]},
       {"key":"physical","label":"Physical","items":[
         {"key":"weight","label":"Weight","value":"1.24 kg"},
         {"key":"dimensions","label":"Dimensions","value":"304 x 215 x 11.3 mm"},
         {"key":"os","label":"Operating system","value":"macOS Sonoma"}]}]'),

    ('asus-rog-swift-oled-pg27',
     '[{"key":"panel","label":"Panel","items":[
         {"key":"size","label":"Size","value":"26.5-inch"},
         {"key":"resolution","label":"Resolution","value":"2560 x 1440"},
         {"key":"panel_type","label":"Panel type","value":"QD-OLED"},
         {"key":"refresh_rate","label":"Refresh rate","value":"240 Hz"},
         {"key":"response_time","label":"Response time","value":"0.03 ms GtG"},
         {"key":"curvature","label":"Curvature","value":"Flat"}]},
       {"key":"gaming","label":"Gaming features","items":[
         {"key":"adaptive_sync","label":"Adaptive sync","value":"G-SYNC Compatible, FreeSync Premium Pro"},
         {"key":"hdr","label":"HDR","value":"DisplayHDR True Black 400"},
         {"key":"input_lag","label":"Measured input lag","value":"1.2 ms"}]},
       {"key":"connectivity","label":"Connectivity","items":[
         {"key":"inputs","label":"Inputs","value":"2 x HDMI 2.1, DisplayPort 1.4 DSC"},
         {"key":"usb_hub","label":"USB hub","value":"2 x USB-A 3.2, 1 x USB-B"},
         {"key":"usb_c","label":"USB-C","value":"None"}]},
       {"key":"physical","label":"Stand & physical","items":[
         {"key":"adjustment","label":"Adjustment","value":"Height, tilt, swivel, pivot"},
         {"key":"vesa","label":"VESA mount","value":"100 x 100 mm"},
         {"key":"burn_in_cover","label":"Burn-in warranty","value":"3 years"}]}]'),

    ('samsung-galaxy-s24',
     '[{"key":"display","label":"Display","items":[
         {"key":"size","label":"Size","value":"6.2-inch"},
         {"key":"resolution","label":"Resolution","value":"2340 x 1080"},
         {"key":"panel","label":"Panel","value":"Dynamic AMOLED 2X"},
         {"key":"refresh_rate","label":"Refresh rate","value":"1-120 Hz adaptive"},
         {"key":"peak_brightness","label":"Peak brightness","value":"2,600 nits"}]},
       {"key":"performance","label":"Performance","items":[
         {"key":"processor","label":"Processor","value":"Snapdragon 8 Gen 3 for Galaxy"},
         {"key":"memory","label":"Memory","value":"8 GB"},
         {"key":"storage","label":"Storage","value":"256 GB, no microSD"}]},
       {"key":"camera","label":"Camera","items":[
         {"key":"main_camera","label":"Main","value":"50 MP, f/1.8, OIS"},
         {"key":"ultrawide","label":"Ultra-wide","value":"12 MP, f/2.2, 120 degrees"},
         {"key":"telephoto","label":"Telephoto","value":"10 MP, 3x optical, OIS"},
         {"key":"front_camera","label":"Front","value":"12 MP, f/2.2"},
         {"key":"video","label":"Video","value":"8K/30, 4K/60 all lenses"}]},
       {"key":"power","label":"Battery & charging","items":[
         {"key":"battery_capacity","label":"Battery","value":"4,000 mAh"},
         {"key":"wired_charging","label":"Wired charging","value":"25 W"},
         {"key":"wireless_charging","label":"Wireless charging","value":"15 W"}]},
       {"key":"physical","label":"Physical & software","items":[
         {"key":"weight","label":"Weight","value":"167 g"},
         {"key":"dimensions","label":"Dimensions","value":"147 x 70.6 x 7.6 mm"},
         {"key":"water_resistance","label":"Water resistance","value":"IP68"},
         {"key":"sim","label":"SIM","value":"Nano-SIM + eSIM"},
         {"key":"os","label":"Operating system","value":"Android 14, One UI 6.1"},
         {"key":"update_policy","label":"Update policy","value":"7 years OS and security"}]}]')
)
update public.products p
set specifications = sp.specifications::jsonb
from spec sp
where sp.slug = p.slug
  and jsonb_array_length(p.specifications) = 0;


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
