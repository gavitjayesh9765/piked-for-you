-- ============================================================================
-- Repair: products carrying another category's scoring criteria.
--
-- WHY THIS EXISTS
-- ---------------
-- Every row in `product_scores` was seeded with one hardcoded block of six
-- headphone criteria (see the old "Scores" section of supabase/seed.sql), so
-- the live catalogue reads:
--
--   MX Master 3S (a mouse)  Sound · Noise cancellation · Comfort · Battery ·
--                           Call quality · Value
--   MacBook Air M3          the same six
--   ROG Swift OLED PG27     the same six
--   Galaxy S24              the same six
--
-- 20260822000013 gave every category a real template, but that only governs
-- what may be written *from now on*. `product_scores.criteria` is a snapshot
-- stored on the product, and the product page renders that snapshot — so the
-- wrong labels survive the template migration until these rows are rewritten.
--
-- Specifications were empty on every product, so there is nothing to correct
-- there; this fills them in for the seeded catalogue.
--
-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ SECTION 2 CHANGES PUBLIC URLS. Product URLs are /p/{category}/{slug}   │
-- │ and the API matches the category slug exactly, so re-filing a product  │
-- │ makes its old URL 404. Run section 1 alone if you would rather keep    │
-- │ the current URLs — the templates still resolve, just to the broader    │
-- │ second-level category (a mouse scores as an Accessory, not as a Mouse).│
-- └────────────────────────────────────────────────────────────────────────┘
--
-- Both sections only touch the seeded catalogue, matched by slug, and both are
-- safe to run twice.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- SECTION 1 — Re-file the seeded products onto their real leaf categories.
--
-- This is what selects the template. Comment this section out to keep the
-- existing URLs.
-- ---------------------------------------------------------------------------
with target(product_slug, category_slug) as (
  values
    ('sony-wh-1000xm5',          'headphones'),
    ('bose-quietcomfort-ultra',  'headphones'),
    ('nothing-ear-a',            'earbuds'),
    ('logitech-mx-master-3s',    'mice'),
    ('apple-macbook-air-m3',     'laptops'),
    ('asus-rog-swift-oled-pg27', 'gaming-monitors'),
    ('samsung-galaxy-s24',       'smartphones')
)
update public.products p
set category_id = c.id
from target t
join public.categories c on c.slug = t.category_slug
where p.slug = t.product_slug
  and p.category_id <> c.id;


-- ---------------------------------------------------------------------------
-- SECTION 2 — Replace the borrowed headphone criteria with each product's own.
--
-- Overwrites unconditionally: the criteria currently stored are wrong for
-- every product except the two headphones, and leaving a "correct" row alone
-- would mean checking six labels per product to find out which those are.
-- ---------------------------------------------------------------------------
with score(slug, criteria) as (
  values
    ('sony-wh-1000xm5',
     '[{"key":"sound","label":"Sound","value":9.2},
       {"key":"anc","label":"Noise cancellation","value":9.6},
       {"key":"comfort","label":"Comfort","value":8.8},
       {"key":"battery","label":"Battery","value":9.0},
       {"key":"mic","label":"Call quality","value":9.1},
       {"key":"value","label":"Value","value":8.4}]'),

    ('bose-quietcomfort-ultra',
     '[{"key":"sound","label":"Sound","value":8.9},
       {"key":"anc","label":"Noise cancellation","value":9.4},
       {"key":"comfort","label":"Comfort","value":9.7},
       {"key":"battery","label":"Battery","value":7.6},
       {"key":"mic","label":"Call quality","value":8.5},
       {"key":"value","label":"Value","value":7.9}]'),

    ('nothing-ear-a',
     '[{"key":"sound","label":"Sound","value":8.7},
       {"key":"anc","label":"Noise cancellation","value":8.4},
       {"key":"fit","label":"Fit & seal","value":8.8},
       {"key":"battery","label":"Battery","value":8.9},
       {"key":"mic","label":"Call quality","value":8.0},
       {"key":"value","label":"Value","value":9.3}]'),

    ('logitech-mx-master-3s',
     '[{"key":"ergonomics","label":"Ergonomics","value":9.4},
       {"key":"sensor","label":"Sensor accuracy","value":8.9},
       {"key":"buttons","label":"Buttons & scroll","value":9.5},
       {"key":"build","label":"Build","value":9.0},
       {"key":"software","label":"Software","value":8.6},
       {"key":"value","label":"Value","value":8.5}]'),

    ('apple-macbook-air-m3',
     '[{"key":"performance","label":"Performance","value":9.0},
       {"key":"display","label":"Display","value":8.8},
       {"key":"battery","label":"Battery","value":9.7},
       {"key":"keyboard","label":"Keyboard & trackpad","value":9.3},
       {"key":"build","label":"Build","value":9.5},
       {"key":"thermals","label":"Thermals & noise","value":9.8},
       {"key":"value","label":"Value","value":8.6}]'),

    ('asus-rog-swift-oled-pg27',
     '[{"key":"motion","label":"Motion clarity","value":9.8},
       {"key":"latency","label":"Input latency","value":9.6},
       {"key":"image","label":"Image quality","value":9.3},
       {"key":"colour","label":"Colour accuracy","value":9.0},
       {"key":"features","label":"Gaming features","value":8.9},
       {"key":"value","label":"Value","value":7.8}]'),

    ('samsung-galaxy-s24',
     '[{"key":"camera","label":"Camera","value":9.0},
       {"key":"performance","label":"Performance","value":9.1},
       {"key":"battery","label":"Battery","value":8.3},
       {"key":"display","label":"Display","value":9.2},
       {"key":"software","label":"Software & updates","value":9.4},
       {"key":"build","label":"Build","value":8.8},
       {"key":"value","label":"Value","value":8.2}]')
)
update public.product_scores ps
set criteria = sc.criteria::jsonb
from score sc
join public.products p on p.slug = sc.slug
where ps.product_id = p.id;


-- Any product NOT in the list above still holds the seeded headphone block.
-- There is no honest way to translate "Noise cancellation: 9.6" into a score
-- for a device that has no noise cancellation, so those are emptied rather
-- than guessed: the overall score survives, the fabricated breakdown does not,
-- and an editor re-scores it in the admin panel against the right criteria.
update public.product_scores ps
set criteria = '[]'::jsonb
from public.products p
join public.categories c on c.id = p.category_id
where ps.product_id = p.id
  and p.slug not in (
    'sony-wh-1000xm5', 'bose-quietcomfort-ultra', 'nothing-ear-a',
    'logitech-mx-master-3s', 'apple-macbook-air-m3',
    'asus-rog-swift-oled-pg27', 'samsung-galaxy-s24'
  )
  -- Only where a stored criterion is not one the category actually allows.
  and exists (
    select 1
    from jsonb_array_elements(ps.criteria) stored
    where not exists (
      select 1
      from jsonb_array_elements(
        case when jsonb_array_length(c.score_criteria) > 0
             then c.score_criteria
             else coalesce(
               (select parent.score_criteria
                from public.categories parent
                where parent.id = c.parent_id),
               '[]'::jsonb)
        end
      ) allowed
      where allowed->>'key' = stored->>'key'
    )
  );


-- ---------------------------------------------------------------------------
-- SECTION 3 — Fill in specifications, which were empty on every product.
--
-- Only where the product has none, so an editor who has already written specs
-- through the admin panel keeps them.
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
