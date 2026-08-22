-- ============================================================================
-- Category templates: per-device scoring criteria and specification schemas.
--
-- The bug this fixes: a mouse was being scored on "Noise cancellation" and
-- listing a "Frequency response", because scoring criteria existed only on the
-- eight second-level categories and specifications had no schema at all. A
-- product filed under Mice inherited nothing and the authoring UI had nothing
-- to offer, so whatever shape the first product happened to use became the
-- shape every product used.
--
-- Two changes:
--
--  1. `spec_template` — the counterpart to `score_criteria`. It declares which
--     specification groups and fields a category's products may carry, so the
--     admin renders the right fields and the API can refuse the wrong ones.
--
--  2. Templates for every category in the tree. Both columns resolve by
--     walking UP the tree at read time (see modules/admin/templates.py), so a
--     category that defines nothing inherits its parent's template rather than
--     falling back to whatever the last editor happened to type.
--
-- Shapes
-- ------
--   score_criteria: [{"key","label","weight"?}]
--   spec_template:  [{"key","label","fields":[{"key","label","unit"?,
--                                              "placeholder"?}]}]
-- ============================================================================

alter table public.categories
  add column if not exists spec_template jsonb not null default '[]'::jsonb;

comment on column public.categories.spec_template is
  'Specification schema for this category''s products. Resolved by walking up '
  'the tree, so an empty array means "inherit from the parent".';

comment on column public.categories.score_criteria is
  'PickD Score criteria for this category''s products. Resolved by walking up '
  'the tree, so an empty array means "inherit from the parent".';

-- Both columns must be arrays — a bare string or a JSON object would satisfy
-- the jsonb type and then break every consumer at read time.
alter table public.categories
  drop constraint if exists categories_spec_template_is_array;
alter table public.categories
  add constraint categories_spec_template_is_array
  check (jsonb_typeof(spec_template) = 'array');

alter table public.categories
  drop constraint if exists categories_score_criteria_is_array;
alter table public.categories
  add constraint categories_score_criteria_is_array
  check (jsonb_typeof(score_criteria) = 'array');


-- ---------------------------------------------------------------------------
-- Templates
--
-- Written as one values list so the whole authoring vocabulary of the site is
-- legible in a single place. Applied only where the category has not defined
-- its own — these columns are editable in the admin panel, and a migration
-- that overwrote an editor's work would be a data-loss bug wearing a schema
-- hat.
--
-- Second-level categories get a deliberately broad template: they exist as a
-- fallback for products filed directly against them, and anything sharper
-- would be wrong for half the tree beneath.
-- ---------------------------------------------------------------------------
with tpl(slug, criteria, specs) as (
  values

  -- ============================== AUDIO ==============================
  ('audio',
   '[{"key":"sound","label":"Sound"},{"key":"comfort","label":"Comfort"},
     {"key":"build","label":"Build"},{"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"driver","label":"Driver","placeholder":"40mm dynamic"},
       {"key":"frequency_response","label":"Frequency response","placeholder":"20 Hz - 20,000 Hz"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Bluetooth 5.3"}]},
     {"key":"power","label":"Power","fields":[
       {"key":"battery_life","label":"Battery life","unit":"hours","placeholder":"30 hours"},
       {"key":"charging","label":"Charging","placeholder":"USB-C"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"250 g"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"IPX4"}]}]'),

  ('headphones',
   '[{"key":"sound","label":"Sound"},{"key":"anc","label":"Noise cancellation"},
     {"key":"comfort","label":"Comfort"},{"key":"battery","label":"Battery"},
     {"key":"mic","label":"Call quality"},{"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"driver","label":"Driver","placeholder":"30mm carbon fibre composite"},
       {"key":"frequency_response","label":"Frequency response","placeholder":"4 Hz - 40,000 Hz"},
       {"key":"codecs","label":"Codecs","placeholder":"SBC, AAC, LDAC"},
       {"key":"anc","label":"Noise cancellation","placeholder":"Adaptive, 8 microphones"}]},
     {"key":"power","label":"Battery & power","fields":[
       {"key":"battery_anc_on","label":"Playback (ANC on)","unit":"hours","placeholder":"30 hours"},
       {"key":"quick_charge","label":"Quick charge","placeholder":"3 min to 3 hours"},
       {"key":"charging","label":"Charging","placeholder":"USB-C"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"250 g"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Bluetooth 5.2, Multipoint"},
       {"key":"folding","label":"Folds flat","placeholder":"Swivel only"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"None"}]}]'),

  ('earbuds',
   '[{"key":"sound","label":"Sound"},{"key":"anc","label":"Noise cancellation"},
     {"key":"fit","label":"Fit & seal"},{"key":"battery","label":"Battery"},
     {"key":"mic","label":"Call quality"},{"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"driver","label":"Driver","placeholder":"11mm dynamic"},
       {"key":"codecs","label":"Codecs","placeholder":"SBC, AAC, LDAC"},
       {"key":"anc","label":"Noise cancellation","placeholder":"Hybrid ANC, up to 45 dB"},
       {"key":"transparency","label":"Transparency mode","placeholder":"Yes"}]},
     {"key":"power","label":"Battery & power","fields":[
       {"key":"battery_buds","label":"Buds (ANC on)","unit":"hours","placeholder":"5.5 hours"},
       {"key":"battery_case","label":"With case","unit":"hours","placeholder":"24 hours"},
       {"key":"charging","label":"Charging","placeholder":"USB-C, Qi wireless"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight_bud","label":"Weight per bud","unit":"g","placeholder":"4.8 g"},
       {"key":"tips","label":"Ear tips included","placeholder":"S / M / L"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"IP54"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Bluetooth 5.3, Multipoint"}]}]'),

  ('speakers',
   '[{"key":"sound","label":"Sound"},{"key":"bass","label":"Bass"},
     {"key":"battery","label":"Portability & battery"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"drivers","label":"Drivers","placeholder":"2 x 20mm tweeter, 1 x 70mm woofer"},
       {"key":"output_power","label":"Output power","unit":"W","placeholder":"30 W RMS"},
       {"key":"frequency_response","label":"Frequency response","placeholder":"55 Hz - 20,000 Hz"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"wireless","label":"Wireless","placeholder":"Bluetooth 5.3, Wi-Fi"},
       {"key":"inputs","label":"Inputs","placeholder":"3.5mm aux, USB-C"},
       {"key":"stereo_pairing","label":"Stereo pairing","placeholder":"Yes, two units"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"battery_life","label":"Battery life","unit":"hours","placeholder":"20 hours"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.2 kg"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"IP67"}]}]'),

  ('soundbars',
   '[{"key":"sound","label":"Sound"},{"key":"dialogue","label":"Dialogue clarity"},
     {"key":"bass","label":"Bass"},{"key":"features","label":"Features"},
     {"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"channels","label":"Channels","placeholder":"5.1.2"},
       {"key":"output_power","label":"Output power","unit":"W","placeholder":"400 W"},
       {"key":"formats","label":"Audio formats","placeholder":"Dolby Atmos, DTS:X"},
       {"key":"subwoofer","label":"Subwoofer","placeholder":"Wireless, 8-inch"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"hdmi","label":"HDMI","placeholder":"1 x eARC, 2 x in"},
       {"key":"optical","label":"Optical","placeholder":"Yes"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi, Bluetooth 5.0, AirPlay 2"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"dimensions","label":"Bar dimensions","placeholder":"1210 x 60 x 115 mm"},
       {"key":"mounting","label":"Wall mounting","placeholder":"Bracket included"}]}]'),

  -- ============================ COMPUTERS ============================
  ('computers',
   '[{"key":"performance","label":"Performance"},{"key":"display","label":"Display"},
     {"key":"battery","label":"Battery"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"core","label":"Core hardware","fields":[
       {"key":"processor","label":"Processor","placeholder":"Apple M3, 8-core"},
       {"key":"memory","label":"Memory","unit":"GB","placeholder":"16 GB unified"},
       {"key":"storage","label":"Storage","placeholder":"512 GB SSD"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"ports","label":"Ports","placeholder":"2 x Thunderbolt 4, 3.5mm"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6E, Bluetooth 5.3"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.24 kg"},
       {"key":"dimensions","label":"Dimensions","placeholder":"304 x 215 x 11.3 mm"}]}]'),

  ('laptops',
   '[{"key":"performance","label":"Performance"},{"key":"display","label":"Display"},
     {"key":"battery","label":"Battery"},{"key":"keyboard","label":"Keyboard & trackpad"},
     {"key":"build","label":"Build"},{"key":"thermals","label":"Thermals & noise"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"Apple M3, 8-core CPU"},
       {"key":"graphics","label":"Graphics","placeholder":"10-core integrated GPU"},
       {"key":"memory","label":"Memory","unit":"GB","placeholder":"16 GB unified"},
       {"key":"storage","label":"Storage","placeholder":"512 GB SSD"}]},
     {"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"13.6-inch"},
       {"key":"resolution","label":"Resolution","placeholder":"2560 x 1664"},
       {"key":"panel","label":"Panel","placeholder":"IPS, 500 nits"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"60 Hz"}]},
     {"key":"power","label":"Battery & power","fields":[
       {"key":"battery_capacity","label":"Battery","unit":"Wh","placeholder":"52.6 Wh"},
       {"key":"battery_life","label":"Rated battery life","unit":"hours","placeholder":"18 hours"},
       {"key":"charger","label":"Charger","placeholder":"35 W dual USB-C"}]},
     {"key":"connectivity","label":"Ports & wireless","fields":[
       {"key":"ports","label":"Ports","placeholder":"2 x Thunderbolt 4, MagSafe, 3.5mm"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6E, Bluetooth 5.3"},
       {"key":"webcam","label":"Webcam","placeholder":"1080p"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.24 kg"},
       {"key":"dimensions","label":"Dimensions","placeholder":"304 x 215 x 11.3 mm"},
       {"key":"os","label":"Operating system","placeholder":"macOS Sonoma"}]}]'),

  ('monitors',
   '[{"key":"image","label":"Image quality"},{"key":"colour","label":"Colour accuracy"},
     {"key":"motion","label":"Motion handling"},{"key":"ergonomics","label":"Ergonomics"},
     {"key":"connectivity","label":"Connectivity"},{"key":"value","label":"Value"}]',
   '[{"key":"panel","label":"Panel","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"27-inch"},
       {"key":"resolution","label":"Resolution","placeholder":"3840 x 2160"},
       {"key":"panel_type","label":"Panel type","placeholder":"IPS Black"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"144 Hz"},
       {"key":"response_time","label":"Response time","unit":"ms","placeholder":"1 ms GtG"}]},
     {"key":"colour","label":"Colour & brightness","fields":[
       {"key":"brightness","label":"Brightness","unit":"nits","placeholder":"400 nits"},
       {"key":"colour_gamut","label":"Colour gamut","placeholder":"98% DCI-P3"},
       {"key":"hdr","label":"HDR","placeholder":"DisplayHDR 400"},
       {"key":"bit_depth","label":"Bit depth","placeholder":"10-bit"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"inputs","label":"Inputs","placeholder":"2 x HDMI 2.1, DisplayPort 1.4"},
       {"key":"usb_c","label":"USB-C","placeholder":"90 W power delivery"},
       {"key":"usb_hub","label":"USB hub","placeholder":"4 x USB-A 3.2"}]},
     {"key":"physical","label":"Stand & physical","fields":[
       {"key":"adjustment","label":"Adjustment","placeholder":"Height, tilt, swivel, pivot"},
       {"key":"vesa","label":"VESA mount","placeholder":"100 x 100 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"6.4 kg"}]}]'),

  ('keyboards',
   '[{"key":"typing","label":"Typing feel"},{"key":"build","label":"Build"},
     {"key":"sound","label":"Sound profile"},{"key":"software","label":"Software & remapping"},
     {"key":"connectivity","label":"Connectivity"},{"key":"value","label":"Value"}]',
   '[{"key":"switches","label":"Switches & keys","fields":[
       {"key":"switch_type","label":"Switch type","placeholder":"Linear, hot-swappable"},
       {"key":"actuation","label":"Actuation force","unit":"g","placeholder":"45 g"},
       {"key":"keycaps","label":"Keycaps","placeholder":"PBT double-shot"},
       {"key":"hot_swap","label":"Hot-swappable","placeholder":"Yes, 3 and 5-pin"}]},
     {"key":"layout","label":"Layout","fields":[
       {"key":"form_factor","label":"Form factor","placeholder":"75% (84 keys)"},
       {"key":"n_key_rollover","label":"N-key rollover","placeholder":"Full NKRO"},
       {"key":"backlight","label":"Backlight","placeholder":"Per-key RGB"}]},
     {"key":"connectivity","label":"Connectivity & power","fields":[
       {"key":"connection","label":"Connection","placeholder":"USB-C, 2.4 GHz, Bluetooth"},
       {"key":"polling_rate","label":"Polling rate","unit":"Hz","placeholder":"1,000 Hz"},
       {"key":"battery_life","label":"Battery life","unit":"hours","placeholder":"200 hours"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"890 g"},
       {"key":"case","label":"Case material","placeholder":"CNC aluminium"},
       {"key":"typing_angle","label":"Typing angle","placeholder":"Adjustable, 4 or 8 degrees"}]}]'),

  ('mice',
   '[{"key":"ergonomics","label":"Ergonomics"},{"key":"sensor","label":"Sensor accuracy"},
     {"key":"buttons","label":"Buttons & scroll"},{"key":"build","label":"Build"},
     {"key":"software","label":"Software"},{"key":"value","label":"Value"}]',
   '[{"key":"sensor","label":"Sensor & tracking","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"HERO 25K"},
       {"key":"max_dpi","label":"Max DPI","unit":"DPI","placeholder":"25,600"},
       {"key":"max_speed","label":"Max speed","placeholder":"400 IPS"},
       {"key":"polling_rate","label":"Polling rate","unit":"Hz","placeholder":"1,000 Hz"}]},
     {"key":"controls","label":"Buttons & scroll","fields":[
       {"key":"buttons","label":"Buttons","placeholder":"7 programmable"},
       {"key":"switches","label":"Switch rating","placeholder":"Optical, 90M clicks"},
       {"key":"scroll","label":"Scroll wheel","placeholder":"MagSpeed electromagnetic"},
       {"key":"thumb_wheel","label":"Thumb wheel","placeholder":"Yes"}]},
     {"key":"connectivity","label":"Connectivity & power","fields":[
       {"key":"connection","label":"Connection","placeholder":"Bluetooth, Logi Bolt, USB-C"},
       {"key":"battery_life","label":"Battery life","unit":"days","placeholder":"70 days"},
       {"key":"quick_charge","label":"Quick charge","placeholder":"1 min to 3 hours"},
       {"key":"multi_device","label":"Multi-device","placeholder":"Up to 3, Flow"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"141 g"},
       {"key":"dimensions","label":"Dimensions","placeholder":"124.9 x 84.3 x 51 mm"},
       {"key":"hand","label":"Hand orientation","placeholder":"Right-handed"},
       {"key":"grip","label":"Grip style","placeholder":"Palm, claw"}]}]'),

  -- ============================= MOBILES =============================
  ('mobiles',
   '[{"key":"camera","label":"Camera"},{"key":"performance","label":"Performance"},
     {"key":"battery","label":"Battery"},{"key":"display","label":"Display"},
     {"key":"software","label":"Software"},{"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"6.2-inch"},
       {"key":"resolution","label":"Resolution","placeholder":"2340 x 1080"},
       {"key":"panel","label":"Panel","placeholder":"Dynamic AMOLED 2X"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"120 Hz adaptive"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"Snapdragon 8 Gen 3"},
       {"key":"memory","label":"Memory","unit":"GB","placeholder":"8 GB"},
       {"key":"storage","label":"Storage","placeholder":"256 GB"}]},
     {"key":"power","label":"Battery & charging","fields":[
       {"key":"battery_capacity","label":"Battery","unit":"mAh","placeholder":"4,000 mAh"},
       {"key":"wired_charging","label":"Wired charging","unit":"W","placeholder":"25 W"},
       {"key":"wireless_charging","label":"Wireless charging","unit":"W","placeholder":"15 W"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"167 g"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"IP68"},
       {"key":"os","label":"Operating system","placeholder":"Android 14, One UI 6.1"}]}]'),

  ('smartphones',
   '[{"key":"camera","label":"Camera"},{"key":"performance","label":"Performance"},
     {"key":"battery","label":"Battery"},{"key":"display","label":"Display"},
     {"key":"software","label":"Software & updates"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"6.2-inch"},
       {"key":"resolution","label":"Resolution","placeholder":"2340 x 1080"},
       {"key":"panel","label":"Panel","placeholder":"Dynamic AMOLED 2X"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"1-120 Hz adaptive"},
       {"key":"peak_brightness","label":"Peak brightness","unit":"nits","placeholder":"2,600 nits"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"Snapdragon 8 Gen 3 for Galaxy"},
       {"key":"memory","label":"Memory","unit":"GB","placeholder":"8 GB"},
       {"key":"storage","label":"Storage","placeholder":"256 GB, no microSD"}]},
     {"key":"camera","label":"Camera","fields":[
       {"key":"main_camera","label":"Main","placeholder":"50 MP, f/1.8, OIS"},
       {"key":"ultrawide","label":"Ultra-wide","placeholder":"12 MP, f/2.2, 120 degrees"},
       {"key":"telephoto","label":"Telephoto","placeholder":"10 MP, 3x optical, OIS"},
       {"key":"front_camera","label":"Front","placeholder":"12 MP, f/2.2"},
       {"key":"video","label":"Video","placeholder":"8K/30, 4K/60 all lenses"}]},
     {"key":"power","label":"Battery & charging","fields":[
       {"key":"battery_capacity","label":"Battery","unit":"mAh","placeholder":"4,000 mAh"},
       {"key":"wired_charging","label":"Wired charging","unit":"W","placeholder":"25 W"},
       {"key":"wireless_charging","label":"Wireless charging","unit":"W","placeholder":"15 W Qi2"}]},
     {"key":"physical","label":"Physical & software","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"167 g"},
       {"key":"dimensions","label":"Dimensions","placeholder":"147 x 70.6 x 7.6 mm"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"IP68"},
       {"key":"sim","label":"SIM","placeholder":"Nano-SIM + eSIM"},
       {"key":"os","label":"Operating system","placeholder":"Android 14, One UI 6.1"},
       {"key":"update_policy","label":"Update policy","placeholder":"7 years OS and security"}]}]'),

  ('tablets',
   '[{"key":"display","label":"Display"},{"key":"performance","label":"Performance"},
     {"key":"battery","label":"Battery"},{"key":"software","label":"Software & apps"},
     {"key":"accessories","label":"Pen & keyboard"},{"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"11-inch"},
       {"key":"resolution","label":"Resolution","placeholder":"2420 x 1668"},
       {"key":"panel","label":"Panel","placeholder":"Liquid Retina IPS"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"120 Hz ProMotion"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"Apple M2"},
       {"key":"memory","label":"Memory","unit":"GB","placeholder":"8 GB"},
       {"key":"storage","label":"Storage","placeholder":"256 GB"}]},
     {"key":"input","label":"Pen & keyboard","fields":[
       {"key":"stylus","label":"Stylus support","placeholder":"Apple Pencil Pro (sold separately)"},
       {"key":"keyboard","label":"Keyboard","placeholder":"Magic Keyboard, Smart Connector"}]},
     {"key":"physical","label":"Battery & physical","fields":[
       {"key":"battery_life","label":"Rated battery life","unit":"hours","placeholder":"10 hours"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"466 g"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Wi-Fi 6E, optional 5G"},
       {"key":"os","label":"Operating system","placeholder":"iPadOS 17"}]}]'),

  ('cases-covers',
   '[{"key":"protection","label":"Protection"},{"key":"grip","label":"Grip & feel"},
     {"key":"bulk","label":"Bulk"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"protection","label":"Protection","fields":[
       {"key":"drop_rating","label":"Drop rating","placeholder":"MIL-STD-810H, 3 m"},
       {"key":"screen_lip","label":"Screen lip","unit":"mm","placeholder":"1.2 mm raised"},
       {"key":"camera_lip","label":"Camera lip","unit":"mm","placeholder":"1.5 mm raised"}]},
     {"key":"materials","label":"Materials","fields":[
       {"key":"material","label":"Material","placeholder":"Polycarbonate back, TPU bumper"},
       {"key":"finish","label":"Finish","placeholder":"Soft-touch matte"},
       {"key":"thickness","label":"Added thickness","unit":"mm","placeholder":"2.1 mm"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"38 g"}]},
     {"key":"compatibility","label":"Compatibility","fields":[
       {"key":"fits","label":"Fits","placeholder":"iPhone 15 Pro"},
       {"key":"magsafe","label":"MagSafe","placeholder":"Yes, N52 magnets"},
       {"key":"wireless_charging","label":"Wireless charging","placeholder":"Works through case"}]}]'),

  ('chargers',
   '[{"key":"speed","label":"Charging speed"},{"key":"safety","label":"Safety & thermals"},
     {"key":"size","label":"Size & portability"},{"key":"compatibility","label":"Compatibility"},
     {"key":"value","label":"Value"}]',
   '[{"key":"output","label":"Output","fields":[
       {"key":"total_output","label":"Total output","unit":"W","placeholder":"65 W"},
       {"key":"ports","label":"Ports","placeholder":"2 x USB-C, 1 x USB-A"},
       {"key":"per_port","label":"Per-port maximum","placeholder":"45 W + 20 W"},
       {"key":"protocols","label":"Protocols","placeholder":"USB PD 3.1, PPS, QC 4+"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"technology","label":"Technology","placeholder":"GaN III"},
       {"key":"size","label":"Size","placeholder":"51 x 51 x 30 mm"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"112 g"},
       {"key":"plug","label":"Plug","placeholder":"Foldable, Type-C Indian pin"}]},
     {"key":"safety","label":"Safety","fields":[
       {"key":"protections","label":"Protections","placeholder":"Over-current, over-voltage, thermal"},
       {"key":"certifications","label":"Certifications","placeholder":"BIS, CE"},
       {"key":"cable_included","label":"Cable included","placeholder":"1 m 100 W USB-C"}]}]'),

  -- ============================== GAMING =============================
  ('gaming',
   '[{"key":"latency","label":"Latency"},{"key":"build","label":"Build"},
     {"key":"comfort","label":"Comfort"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"connection","label":"Connection","placeholder":"2.4 GHz wireless, USB-C"},
       {"key":"polling_rate","label":"Polling rate","unit":"Hz","placeholder":"1,000 Hz"},
       {"key":"latency","label":"Measured latency","unit":"ms","placeholder":"1 ms"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"60 g"},
       {"key":"battery_life","label":"Battery life","unit":"hours","placeholder":"95 hours"},
       {"key":"compatibility","label":"Compatibility","placeholder":"PC, PlayStation, Xbox"}]}]'),

  ('consoles',
   '[{"key":"performance","label":"Performance"},{"key":"library","label":"Game library"},
     {"key":"controller","label":"Controller"},{"key":"noise","label":"Noise & thermals"},
     {"key":"value","label":"Value"}]',
   '[{"key":"hardware","label":"Hardware","fields":[
       {"key":"processor","label":"Processor","placeholder":"Custom 8-core Zen 2, 3.5 GHz"},
       {"key":"graphics","label":"Graphics","placeholder":"10.28 TFLOPS RDNA 2"},
       {"key":"memory","label":"Memory","unit":"GB","placeholder":"16 GB GDDR6"},
       {"key":"storage","label":"Storage","placeholder":"1 TB NVMe SSD, expandable"}]},
     {"key":"output","label":"Output","fields":[
       {"key":"max_resolution","label":"Max resolution","placeholder":"4K at 120 Hz"},
       {"key":"hdr","label":"HDR","placeholder":"HDR10"},
       {"key":"vrr","label":"Variable refresh rate","placeholder":"Yes, HDMI 2.1 VRR"},
       {"key":"optical_drive","label":"Optical drive","placeholder":"4K UHD Blu-ray"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"dimensions","label":"Dimensions","placeholder":"358 x 96 x 216 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"3.2 kg"},
       {"key":"power_draw","label":"Power draw","unit":"W","placeholder":"200 W in game"}]}]'),

  ('gaming-monitors',
   '[{"key":"motion","label":"Motion clarity"},{"key":"latency","label":"Input latency"},
     {"key":"image","label":"Image quality"},{"key":"colour","label":"Colour accuracy"},
     {"key":"features","label":"Gaming features"},{"key":"value","label":"Value"}]',
   '[{"key":"panel","label":"Panel","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"26.5-inch"},
       {"key":"resolution","label":"Resolution","placeholder":"2560 x 1440"},
       {"key":"panel_type","label":"Panel type","placeholder":"QD-OLED"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"240 Hz"},
       {"key":"response_time","label":"Response time","unit":"ms","placeholder":"0.03 ms GtG"},
       {"key":"curvature","label":"Curvature","placeholder":"Flat"}]},
     {"key":"gaming","label":"Gaming features","fields":[
       {"key":"adaptive_sync","label":"Adaptive sync","placeholder":"G-SYNC Compatible, FreeSync Premium Pro"},
       {"key":"hdr","label":"HDR","placeholder":"DisplayHDR True Black 400"},
       {"key":"black_frame","label":"Backlight strobing","placeholder":"Not available on OLED"},
       {"key":"input_lag","label":"Measured input lag","unit":"ms","placeholder":"1.2 ms"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"inputs","label":"Inputs","placeholder":"2 x HDMI 2.1, DisplayPort 1.4 DSC"},
       {"key":"usb_hub","label":"USB hub","placeholder":"2 x USB-A 3.2, 1 x USB-B"},
       {"key":"usb_c","label":"USB-C","placeholder":"None"}]},
     {"key":"physical","label":"Stand & physical","fields":[
       {"key":"adjustment","label":"Adjustment","placeholder":"Height, tilt, swivel, pivot"},
       {"key":"vesa","label":"VESA mount","placeholder":"100 x 100 mm"},
       {"key":"burn_in_cover","label":"Burn-in warranty","placeholder":"3 years"}]}]'),

  ('controllers',
   '[{"key":"ergonomics","label":"Ergonomics"},{"key":"sticks","label":"Sticks & triggers"},
     {"key":"build","label":"Build"},{"key":"latency","label":"Latency"},
     {"key":"customisation","label":"Customisation"},{"key":"value","label":"Value"}]',
   '[{"key":"inputs","label":"Inputs","fields":[
       {"key":"stick_type","label":"Stick type","placeholder":"Hall effect, drift-resistant"},
       {"key":"triggers","label":"Triggers","placeholder":"Analogue with hair-trigger stops"},
       {"key":"dpad","label":"D-pad","placeholder":"8-way faceted"},
       {"key":"back_buttons","label":"Back buttons","placeholder":"4 remappable paddles"}]},
     {"key":"connectivity","label":"Connectivity & power","fields":[
       {"key":"connection","label":"Connection","placeholder":"2.4 GHz, Bluetooth, USB-C"},
       {"key":"polling_rate","label":"Polling rate","unit":"Hz","placeholder":"1,000 Hz"},
       {"key":"battery_life","label":"Battery life","unit":"hours","placeholder":"40 hours"},
       {"key":"compatibility","label":"Compatibility","placeholder":"PC, Xbox Series X|S"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"345 g"},
       {"key":"grips","label":"Grips","placeholder":"Rubberised, swappable"},
       {"key":"haptics","label":"Haptics","placeholder":"Dual rumble motors"}]}]'),

  ('gaming-headsets',
   '[{"key":"sound","label":"Sound"},{"key":"positional","label":"Positional accuracy"},
     {"key":"mic","label":"Microphone"},{"key":"comfort","label":"Comfort"},
     {"key":"latency","label":"Latency"},{"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"driver","label":"Driver","placeholder":"50mm neodymium"},
       {"key":"frequency_response","label":"Frequency response","placeholder":"20 Hz - 20,000 Hz"},
       {"key":"spatial_audio","label":"Spatial audio","placeholder":"DTS Headphone:X 2.0"}]},
     {"key":"microphone","label":"Microphone","fields":[
       {"key":"mic_type","label":"Microphone","placeholder":"Detachable cardioid, 6mm"},
       {"key":"mic_response","label":"Mic frequency response","placeholder":"100 Hz - 10,000 Hz"},
       {"key":"sidetone","label":"Sidetone","placeholder":"Adjustable"}]},
     {"key":"connectivity","label":"Connectivity & power","fields":[
       {"key":"connection","label":"Connection","placeholder":"2.4 GHz, Bluetooth, 3.5mm"},
       {"key":"battery_life","label":"Battery life","unit":"hours","placeholder":"70 hours"},
       {"key":"compatibility","label":"Compatibility","placeholder":"PC, PlayStation, Switch"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"300 g"},
       {"key":"earpads","label":"Ear pads","placeholder":"Memory foam, replaceable"},
       {"key":"clamp","label":"Clamping force","placeholder":"Light"}]}]'),

  -- ============================= CAMERAS =============================
  ('cameras',
   '[{"key":"image","label":"Image quality"},{"key":"autofocus","label":"Autofocus"},
     {"key":"handling","label":"Handling"},{"key":"value","label":"Value"}]',
   '[{"key":"imaging","label":"Imaging","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"26 MP APS-C CMOS"},
       {"key":"iso_range","label":"ISO range","placeholder":"100 - 32,000"},
       {"key":"stabilisation","label":"Stabilisation","placeholder":"5-axis IBIS, 5 stops"}]},
     {"key":"video","label":"Video","fields":[
       {"key":"max_video","label":"Max video","placeholder":"4K/120, 10-bit"},
       {"key":"log_profile","label":"Log profile","placeholder":"S-Log3"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"493 g with battery"},
       {"key":"weather_sealing","label":"Weather sealing","placeholder":"Dust and moisture resistant"},
       {"key":"battery_life","label":"Battery life","placeholder":"570 shots CIPA"}]}]'),

  ('mirrorless',
   '[{"key":"image","label":"Image quality"},{"key":"autofocus","label":"Autofocus"},
     {"key":"video","label":"Video"},{"key":"handling","label":"Handling & controls"},
     {"key":"lenses","label":"Lens ecosystem"},{"key":"value","label":"Value"}]',
   '[{"key":"sensor","label":"Sensor & processing","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"26 MP Exmor R APS-C BSI CMOS"},
       {"key":"processor","label":"Processor","placeholder":"BIONZ XR with AI unit"},
       {"key":"iso_range","label":"ISO range","placeholder":"100 - 32,000 (expandable 50 - 102,400)"},
       {"key":"stabilisation","label":"Stabilisation","placeholder":"5-axis IBIS, 5.0 stops"}]},
     {"key":"autofocus","label":"Autofocus & speed","fields":[
       {"key":"af_points","label":"AF points","placeholder":"759 phase-detect"},
       {"key":"subject_detection","label":"Subject detection","placeholder":"Human, animal, bird, insect, vehicle"},
       {"key":"burst_rate","label":"Burst rate","placeholder":"11 fps mechanical"},
       {"key":"shutter_speed","label":"Shutter speed","placeholder":"1/4000 - 30 s"}]},
     {"key":"video","label":"Video","fields":[
       {"key":"max_video","label":"Max video","placeholder":"4K/120 (1.58x crop), 10-bit 4:2:2"},
       {"key":"log_profile","label":"Log profile","placeholder":"S-Log3, S-Cinetone"},
       {"key":"recording_limit","label":"Recording limit","placeholder":"None"}]},
     {"key":"body","label":"Body","fields":[
       {"key":"mount","label":"Lens mount","placeholder":"Sony E"},
       {"key":"viewfinder","label":"Viewfinder","placeholder":"2.36M-dot OLED EVF"},
       {"key":"screen","label":"Screen","placeholder":"3-inch vari-angle touchscreen"},
       {"key":"card_slots","label":"Card slots","placeholder":"1 x SD UHS-II / CFexpress Type A"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"493 g with battery"},
       {"key":"battery_life","label":"Battery life","placeholder":"570 shots CIPA"},
       {"key":"weather_sealing","label":"Weather sealing","placeholder":"Dust and moisture resistant"}]}]'),

  ('action-cameras',
   '[{"key":"stabilisation","label":"Stabilisation"},{"key":"image","label":"Image quality"},
     {"key":"durability","label":"Durability"},{"key":"battery","label":"Battery"},
     {"key":"mounts","label":"Mounting ecosystem"},{"key":"value","label":"Value"}]',
   '[{"key":"imaging","label":"Imaging","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"1/1.9-inch CMOS"},
       {"key":"max_video","label":"Max video","placeholder":"5.3K/60, 4K/120"},
       {"key":"photo_resolution","label":"Photo resolution","unit":"MP","placeholder":"27 MP"},
       {"key":"field_of_view","label":"Field of view","placeholder":"156 degrees HyperView"}]},
     {"key":"stabilisation","label":"Stabilisation","fields":[
       {"key":"stabilisation","label":"Stabilisation","placeholder":"HyperSmooth 6.0"},
       {"key":"horizon_lock","label":"Horizon lock","placeholder":"360 degree lock"}]},
     {"key":"durability","label":"Durability & power","fields":[
       {"key":"waterproof","label":"Waterproof","unit":"m","placeholder":"10 m without housing"},
       {"key":"operating_temp","label":"Operating temperature","placeholder":"-10 C to 35 C"},
       {"key":"battery_capacity","label":"Battery","unit":"mAh","placeholder":"1,720 mAh Enduro"},
       {"key":"battery_life","label":"Recording time","placeholder":"70 min at 5.3K/60"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"154 g"}]}]'),

  ('lenses',
   '[{"key":"sharpness","label":"Sharpness"},{"key":"autofocus","label":"Autofocus"},
     {"key":"rendering","label":"Bokeh & rendering"},{"key":"build","label":"Build"},
     {"key":"size","label":"Size & weight"},{"key":"value","label":"Value"}]',
   '[{"key":"optics","label":"Optics","fields":[
       {"key":"focal_length","label":"Focal length","unit":"mm","placeholder":"24-70 mm"},
       {"key":"max_aperture","label":"Maximum aperture","placeholder":"f/2.8 constant"},
       {"key":"min_aperture","label":"Minimum aperture","placeholder":"f/22"},
       {"key":"elements","label":"Optical construction","placeholder":"20 elements in 15 groups"},
       {"key":"aperture_blades","label":"Aperture blades","placeholder":"11, rounded"}]},
     {"key":"focus","label":"Focus & stabilisation","fields":[
       {"key":"af_motor","label":"AF motor","placeholder":"2 x XD linear"},
       {"key":"min_focus","label":"Minimum focus distance","unit":"m","placeholder":"0.21 m"},
       {"key":"magnification","label":"Maximum magnification","placeholder":"0.32x"},
       {"key":"stabilisation","label":"Stabilisation","placeholder":"None - relies on IBIS"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"mount","label":"Mount","placeholder":"Sony E, full-frame"},
       {"key":"filter_thread","label":"Filter thread","unit":"mm","placeholder":"82 mm"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"695 g"},
       {"key":"dimensions","label":"Dimensions","placeholder":"87.8 x 119.9 mm"},
       {"key":"weather_sealing","label":"Weather sealing","placeholder":"Dust and moisture resistant"}]}]'),

  -- ============================ WEARABLES ============================
  ('wearables',
   '[{"key":"tracking","label":"Tracking accuracy"},{"key":"battery","label":"Battery"},
     {"key":"comfort","label":"Comfort"},{"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","placeholder":"1.4-inch"},
       {"key":"panel","label":"Panel","placeholder":"AMOLED, always-on"},
       {"key":"resolution","label":"Resolution","placeholder":"450 x 450"}]},
     {"key":"sensors","label":"Sensors","fields":[
       {"key":"heart_rate","label":"Heart rate","placeholder":"Optical, continuous"},
       {"key":"gps","label":"GPS","placeholder":"Dual-band GNSS"},
       {"key":"other_sensors","label":"Other sensors","placeholder":"SpO2, skin temperature, ECG"}]},
     {"key":"physical","label":"Battery & physical","fields":[
       {"key":"battery_life","label":"Battery life","unit":"days","placeholder":"2 days"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"5 ATM, IP68"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"33 g"},
       {"key":"os","label":"Platform","placeholder":"Wear OS 4"}]}]'),

  ('smartwatches',
   '[{"key":"tracking","label":"Tracking accuracy"},{"key":"battery","label":"Battery"},
     {"key":"comfort","label":"Comfort"},{"key":"software","label":"Software & apps"},
     {"key":"health","label":"Health features"},{"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"size","label":"Case size","unit":"mm","placeholder":"44 mm"},
       {"key":"panel","label":"Panel","placeholder":"Super AMOLED, always-on"},
       {"key":"resolution","label":"Resolution","placeholder":"480 x 480"},
       {"key":"brightness","label":"Peak brightness","unit":"nits","placeholder":"2,000 nits"},
       {"key":"glass","label":"Glass","placeholder":"Sapphire crystal"}]},
     {"key":"health","label":"Health & sensors","fields":[
       {"key":"heart_rate","label":"Heart rate","placeholder":"Optical, continuous"},
       {"key":"ecg","label":"ECG","placeholder":"Yes, single-lead"},
       {"key":"spo2","label":"Blood oxygen","placeholder":"Yes, on demand and overnight"},
       {"key":"sleep","label":"Sleep tracking","placeholder":"Stages, apnoea detection"},
       {"key":"gps","label":"GPS","placeholder":"Dual-band L1 + L5"}]},
     {"key":"platform","label":"Platform","fields":[
       {"key":"os","label":"Operating system","placeholder":"Wear OS 4, One UI Watch 5"},
       {"key":"processor","label":"Processor","placeholder":"Exynos W930, dual-core"},
       {"key":"storage","label":"Storage","unit":"GB","placeholder":"16 GB"},
       {"key":"phone_support","label":"Phone support","placeholder":"Android 11+ only"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Bluetooth 5.3, Wi-Fi, optional LTE"}]},
     {"key":"physical","label":"Battery & physical","fields":[
       {"key":"battery_capacity","label":"Battery","unit":"mAh","placeholder":"425 mAh"},
       {"key":"battery_life","label":"Battery life","placeholder":"40 hours with always-on"},
       {"key":"charging","label":"Charging","placeholder":"Wireless, 0-45% in 30 min"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"33.3 g without strap"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"5 ATM + IP68, MIL-STD-810H"},
       {"key":"strap","label":"Strap width","unit":"mm","placeholder":"20 mm, quick-release"}]}]'),

  ('fitness-bands',
   '[{"key":"tracking","label":"Tracking accuracy"},{"key":"battery","label":"Battery"},
     {"key":"comfort","label":"Comfort"},{"key":"app","label":"App experience"},
     {"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","unit":"in","placeholder":"1.47-inch"},
       {"key":"panel","label":"Panel","placeholder":"AMOLED"},
       {"key":"brightness","label":"Peak brightness","unit":"nits","placeholder":"450 nits"}]},
     {"key":"sensors","label":"Sensors & tracking","fields":[
       {"key":"heart_rate","label":"Heart rate","placeholder":"Optical, 24/7"},
       {"key":"spo2","label":"Blood oxygen","placeholder":"Yes"},
       {"key":"sleep","label":"Sleep tracking","placeholder":"Stages and nap detection"},
       {"key":"gps","label":"GPS","placeholder":"Connected GPS (uses phone)"},
       {"key":"modes","label":"Sport modes","placeholder":"150+"}]},
     {"key":"physical","label":"Battery & physical","fields":[
       {"key":"battery_life","label":"Battery life","unit":"days","placeholder":"14 days typical"},
       {"key":"charging","label":"Charging","placeholder":"Magnetic pogo, 1 hour"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"27 g with strap"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"5 ATM"},
       {"key":"app","label":"Companion app","placeholder":"Android and iOS"}]}]'),

  -- =========================== SMART HOME ============================
  ('smart-home',
   '[{"key":"reliability","label":"Reliability"},{"key":"setup","label":"Setup"},
     {"key":"privacy","label":"Privacy"},{"key":"integration","label":"Integration"},
     {"key":"value","label":"Value"}]',
   '[{"key":"connectivity","label":"Connectivity","fields":[
       {"key":"protocols","label":"Protocols","placeholder":"Wi-Fi 6, Matter, Thread"},
       {"key":"hub_required","label":"Hub required","placeholder":"No"},
       {"key":"assistants","label":"Works with","placeholder":"Alexa, Google Home, Apple Home"}]},
     {"key":"privacy","label":"Privacy & data","fields":[
       {"key":"local_control","label":"Local control","placeholder":"Yes, works offline"},
       {"key":"data_storage","label":"Data storage","placeholder":"On-device"},
       {"key":"subscription","label":"Subscription","placeholder":"None required"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"power","label":"Power","placeholder":"Mains, USB-C"},
       {"key":"dimensions","label":"Dimensions","placeholder":"104 x 104 x 104 mm"}]}]'),

  ('smart-speakers',
   '[{"key":"sound","label":"Sound"},{"key":"assistant","label":"Assistant quality"},
     {"key":"mics","label":"Far-field microphones"},{"key":"privacy","label":"Privacy"},
     {"key":"integration","label":"Integration"},{"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"drivers","label":"Drivers","placeholder":"1 x 76mm woofer, 2 x 20mm tweeters"},
       {"key":"room_correction","label":"Room correction","placeholder":"Automatic, on every move"},
       {"key":"stereo_pairing","label":"Stereo pairing","placeholder":"Yes, two units"}]},
     {"key":"voice","label":"Voice & assistant","fields":[
       {"key":"microphones","label":"Microphones","placeholder":"4 far-field with beamforming"},
       {"key":"assistant","label":"Assistant","placeholder":"Google Assistant"},
       {"key":"mic_mute","label":"Microphone mute","placeholder":"Physical switch"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"protocols","label":"Protocols","placeholder":"Wi-Fi 6, Bluetooth 5.2, Matter, Thread border router"},
       {"key":"casting","label":"Casting","placeholder":"Chromecast built-in, AirPlay 2"},
       {"key":"hub","label":"Smart home hub","placeholder":"Yes"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"dimensions","label":"Dimensions","placeholder":"170 x 122 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.2 kg"},
       {"key":"power","label":"Power","placeholder":"Mains, 30 W adapter"}]}]'),

  ('smart-lighting',
   '[{"key":"colour","label":"Colour accuracy"},{"key":"brightness","label":"Brightness"},
     {"key":"reliability","label":"Reliability"},{"key":"setup","label":"Setup"},
     {"key":"value","label":"Value"}]',
   '[{"key":"light","label":"Light output","fields":[
       {"key":"brightness","label":"Brightness","unit":"lm","placeholder":"1,100 lumens"},
       {"key":"colour_temperature","label":"Colour temperature","placeholder":"2,000 - 6,500 K"},
       {"key":"colours","label":"Colour range","placeholder":"16 million, RGBWW"},
       {"key":"cri","label":"Colour rendering (CRI)","placeholder":"90+"},
       {"key":"dimming","label":"Dimming","placeholder":"0.2% - 100%, flicker-free"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"protocols","label":"Protocols","placeholder":"Zigbee 3.0, Bluetooth, Matter"},
       {"key":"hub_required","label":"Hub required","placeholder":"Optional - a bridge adds scenes and away mode"},
       {"key":"assistants","label":"Works with","placeholder":"Alexa, Google Home, Apple Home"}]},
     {"key":"physical","label":"Fitting & life","fields":[
       {"key":"fitting","label":"Fitting","placeholder":"B22 bayonet"},
       {"key":"power_draw","label":"Power draw","unit":"W","placeholder":"9.5 W"},
       {"key":"rated_life","label":"Rated life","placeholder":"25,000 hours"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('security-cameras',
   '[{"key":"image","label":"Image quality"},{"key":"night","label":"Night vision"},
     {"key":"detection","label":"Detection accuracy"},{"key":"privacy","label":"Privacy & storage"},
     {"key":"reliability","label":"Reliability"},{"key":"value","label":"Value"}]',
   '[{"key":"imaging","label":"Imaging","fields":[
       {"key":"resolution","label":"Resolution","placeholder":"2K (2560 x 1440)"},
       {"key":"field_of_view","label":"Field of view","placeholder":"130 degrees diagonal"},
       {"key":"night_vision","label":"Night vision","placeholder":"Colour, spotlight-assisted to 10 m"},
       {"key":"hdr","label":"HDR","placeholder":"Yes"}]},
     {"key":"detection","label":"Detection","fields":[
       {"key":"detection_types","label":"Detects","placeholder":"Person, vehicle, animal, package"},
       {"key":"processing","label":"Processing","placeholder":"On-device"},
       {"key":"zones","label":"Activity zones","placeholder":"Custom polygons"},
       {"key":"siren","label":"Siren","placeholder":"100 dB built-in"}]},
     {"key":"storage","label":"Storage & privacy","fields":[
       {"key":"local_storage","label":"Local storage","placeholder":"microSD up to 256 GB"},
       {"key":"cloud_storage","label":"Cloud storage","placeholder":"Optional subscription, 30 days"},
       {"key":"encryption","label":"Encryption","placeholder":"End-to-end available"},
       {"key":"subscription","label":"Subscription required","placeholder":"No, for local recording"}]},
     {"key":"physical","label":"Power & physical","fields":[
       {"key":"power","label":"Power","placeholder":"Rechargeable battery or wired USB-C"},
       {"key":"battery_life","label":"Battery life","unit":"months","placeholder":"6 months typical"},
       {"key":"weather_rating","label":"Weather rating","placeholder":"IP65"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Wi-Fi 6, 2.4/5 GHz"}]}]'),

  -- =========================== ACCESSORIES ===========================
  ('accessories',
   '[{"key":"build","label":"Build"},{"key":"performance","label":"Performance"},
     {"key":"compatibility","label":"Compatibility"},{"key":"value","label":"Value"}]',
   '[{"key":"specification","label":"Specification","fields":[
       {"key":"material","label":"Material","placeholder":"Braided nylon"},
       {"key":"compatibility","label":"Compatibility","placeholder":"USB-C devices"},
       {"key":"warranty","label":"Warranty","placeholder":"18 months"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"dimensions","label":"Dimensions","placeholder":"104 x 52 x 26 mm"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"212 g"}]}]'),

  ('power-banks',
   '[{"key":"capacity","label":"Real capacity"},{"key":"speed","label":"Charging speed"},
     {"key":"portability","label":"Portability"},{"key":"safety","label":"Safety & thermals"},
     {"key":"value","label":"Value"}]',
   '[{"key":"capacity","label":"Capacity","fields":[
       {"key":"rated_capacity","label":"Rated capacity","unit":"mAh","placeholder":"20,000 mAh"},
       {"key":"energy","label":"Energy","unit":"Wh","placeholder":"74 Wh"},
       {"key":"usable_capacity","label":"Measured usable output","placeholder":"13,400 mAh at 5 V"},
       {"key":"cell_type","label":"Cell type","placeholder":"Li-polymer"}]},
     {"key":"output","label":"Input & output","fields":[
       {"key":"total_output","label":"Total output","unit":"W","placeholder":"100 W"},
       {"key":"ports","label":"Ports","placeholder":"2 x USB-C, 1 x USB-A"},
       {"key":"per_port","label":"Per-port maximum","placeholder":"100 W + 30 W + 22.5 W"},
       {"key":"input","label":"Recharge input","unit":"W","placeholder":"100 W USB-C, 55 min to 80%"},
       {"key":"passthrough","label":"Pass-through charging","placeholder":"Yes"}]},
     {"key":"physical","label":"Physical & safety","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"440 g"},
       {"key":"dimensions","label":"Dimensions","placeholder":"158 x 55 x 49 mm"},
       {"key":"display","label":"Display","placeholder":"Digital percentage readout"},
       {"key":"airline_safe","label":"Airline safe","placeholder":"Yes, under 100 Wh"},
       {"key":"certifications","label":"Certifications","placeholder":"BIS, CE, FCC"}]}]'),

  ('cables-adapters',
   '[{"key":"build","label":"Build"},{"key":"speed","label":"Data & power throughput"},
     {"key":"compatibility","label":"Compatibility"},{"key":"durability","label":"Durability"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"standard","label":"Standard","placeholder":"USB4 / Thunderbolt 4"},
       {"key":"data_rate","label":"Data rate","placeholder":"40 Gbps"},
       {"key":"power_delivery","label":"Power delivery","unit":"W","placeholder":"240 W (EPR)"},
       {"key":"video_support","label":"Video support","placeholder":"Single 8K/60 or dual 4K/60"},
       {"key":"e_marker","label":"E-marker chip","placeholder":"Yes"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"length","label":"Length","unit":"m","placeholder":"1 m"},
       {"key":"connectors","label":"Connectors","placeholder":"USB-C to USB-C"},
       {"key":"jacket","label":"Jacket","placeholder":"Braided nylon"},
       {"key":"bend_rating","label":"Bend rating","placeholder":"25,000 bends"},
       {"key":"warranty","label":"Warranty","placeholder":"Lifetime"}]}]'),

  ('storage',
   '[{"key":"sustained","label":"Sustained speed"},{"key":"endurance","label":"Endurance"},
     {"key":"thermals","label":"Thermals"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"interface","label":"Interface","placeholder":"PCIe 4.0 x4, NVMe 2.0"},
       {"key":"sequential_read","label":"Sequential read","placeholder":"7,300 MB/s"},
       {"key":"sequential_write","label":"Sequential write","placeholder":"6,900 MB/s"},
       {"key":"sustained_write","label":"Measured sustained write","placeholder":"1,600 MB/s after cache"},
       {"key":"random_iops","label":"Random IOPS","placeholder":"1,200K read / 1,550K write"}]},
     {"key":"endurance","label":"Capacity & endurance","fields":[
       {"key":"capacity","label":"Capacity","placeholder":"2 TB"},
       {"key":"nand","label":"NAND type","placeholder":"176-layer TLC"},
       {"key":"dram_cache","label":"DRAM cache","placeholder":"2 GB LPDDR4"},
       {"key":"endurance_rating","label":"Endurance","placeholder":"1,200 TBW"},
       {"key":"warranty","label":"Warranty","placeholder":"5 years"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"form_factor","label":"Form factor","placeholder":"M.2 2280"},
       {"key":"heatsink","label":"Heatsink","placeholder":"Included, PS5 compatible"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"32 g with heatsink"}]}]')
)
update public.categories c
set
  score_criteria = case
    when jsonb_array_length(c.score_criteria) = 0 then t.criteria::jsonb
    else c.score_criteria
  end,
  spec_template = case
    when jsonb_array_length(c.spec_template) = 0 then t.specs::jsonb
    else c.spec_template
  end
from tpl t
where c.slug = t.slug;
