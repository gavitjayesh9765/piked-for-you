-- ============================================================================
-- Templates for the categories added in 20260828000018_catalogue_expansion.
--
-- Same contract as 20260822000013_category_templates:
--
--   score_criteria: [{"key","label","weight"?}]
--   spec_template:  [{"key","label","fields":[{"key","label","unit"?,
--                                              "placeholder"?}]}]
--
-- Both resolve by walking UP the tree, so an empty array means "inherit from
-- the parent". Branches therefore get a deliberately broad template — it is
-- the fallback for anything filed directly against them — and leaves get the
-- sharp one. A washing machine should not be asked for a frequency response,
-- and an air fryer should not be scored on noise cancellation.
--
-- The two roots are included. Electronics has never had a template: a product
-- filed directly against the root inherited nothing, so the admin rendered an
-- empty specification form and whatever the first editor typed became the
-- shape. A generic root template is not a good schema, but it beats none.
--
-- Applied only where the category has not defined its own. These columns are
-- editable in the admin panel and a migration that overwrote an editor's work
-- would be a data-loss bug wearing a schema hat.
--
-- A note on the placeholders: they are examples of the SHAPE of an answer, not
-- claims about any product. "1,500 m3/hr" tells an editor that a chimney's
-- suction is written as a number and a unit. Several of them deliberately
-- encode the site's editorial line — usable capacity rather than box capacity,
-- measured sustained figures rather than peak, running cost as a specification
-- rather than a footnote.
-- ============================================================================

with tpl(slug, criteria, specs) as (
  values

  -- ============================ ROOTS ================================
  ('electronics',
   '[{"key":"performance","label":"Performance"},{"key":"build","label":"Build"},
     {"key":"features","label":"Features"},{"key":"value","label":"Value"}]',
   '[{"key":"key_specs","label":"Key specifications","fields":[
       {"key":"model_year","label":"Model year","placeholder":"2026"},
       {"key":"power","label":"Power","placeholder":"65 W"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Wi-Fi 6, Bluetooth 5.3"},
       {"key":"dimensions","label":"Dimensions","placeholder":"200 x 120 x 45 mm"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"480 g"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"in_the_box","label":"In the box","placeholder":"Unit, USB-C cable, manual"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year"}]}]'),

  ('home-kitchen',
   '[{"key":"performance","label":"Performance"},{"key":"build","label":"Build"},
     {"key":"ease","label":"Ease of use"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"essentials","label":"Key specifications","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"1,200 W"},
       {"key":"capacity","label":"Capacity","placeholder":"5 L"},
       {"key":"material","label":"Material","placeholder":"Stainless steel"},
       {"key":"dimensions","label":"Dimensions","placeholder":"340 x 300 x 320 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"4.2 kg"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"warranty","label":"Warranty","placeholder":"2 years"},
       {"key":"service","label":"Service network","placeholder":"Pan-India, 400+ centres"},
       {"key":"in_the_box","label":"In the box","placeholder":"Unit, accessories, manual"}]}]'),

  -- ========================= TELEVISIONS =============================
  ('televisions',
   '[{"key":"picture","label":"Picture"},{"key":"motion","label":"Motion"},
     {"key":"software","label":"Software"},{"key":"sound","label":"Sound"},
     {"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"panel_type","label":"Panel type","placeholder":"QLED"},
       {"key":"sizes","label":"Sizes available","placeholder":"43 / 50 / 55 / 65 inch"},
       {"key":"resolution","label":"Resolution","placeholder":"4K (3840 x 2160)"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"120 Hz"},
       {"key":"hdr","label":"HDR formats","placeholder":"Dolby Vision, HDR10+"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"hdmi","label":"HDMI","placeholder":"2 x HDMI 2.1, 2 x HDMI 2.0"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6, Bluetooth 5.2"},
       {"key":"os","label":"Platform","placeholder":"Google TV"}]},
     {"key":"audio","label":"Audio","fields":[
       {"key":"speakers","label":"Speakers","placeholder":"20 W, 2.0 channel"},
       {"key":"formats","label":"Formats","placeholder":"Dolby Atmos, eARC"}]}]'),

  ('smart-tvs',
   '[{"key":"picture","label":"Picture"},{"key":"brightness","label":"Brightness"},
     {"key":"motion","label":"Motion"},{"key":"software","label":"Software"},
     {"key":"sound","label":"Sound"},{"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"panel_type","label":"Panel type","placeholder":"QLED, VA, full-array local dimming"},
       {"key":"resolution","label":"Resolution","placeholder":"4K (3840 x 2160)"},
       {"key":"refresh_rate","label":"Native refresh rate","unit":"Hz","placeholder":"120 Hz"},
       {"key":"peak_brightness","label":"Measured peak brightness","unit":"nits","placeholder":"1,000 nits, 10% window"},
       {"key":"dimming_zones","label":"Local dimming zones","placeholder":"336"},
       {"key":"hdr","label":"HDR formats","placeholder":"Dolby Vision, HDR10+, HLG"}]},
     {"key":"gaming","label":"Gaming & connectivity","fields":[
       {"key":"hdmi","label":"HDMI","placeholder":"2 x HDMI 2.1 (48 Gbps), 2 x HDMI 2.0"},
       {"key":"vrr","label":"VRR","placeholder":"48-120 Hz, ALLM, FreeSync Premium"},
       {"key":"input_lag","label":"Measured input lag","placeholder":"10 ms at 120 Hz"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6, Bluetooth 5.2, AirPlay 2"}]},
     {"key":"platform","label":"Platform & audio","fields":[
       {"key":"os","label":"Operating system","placeholder":"Google TV"},
       {"key":"processor","label":"Processor and memory","placeholder":"Quad-core, 3 GB RAM, 32 GB storage"},
       {"key":"audio_output","label":"Audio output","placeholder":"30 W, 2.1 channel, Dolby Atmos"},
       {"key":"sizes","label":"Sizes available","placeholder":"43 / 50 / 55 / 65 / 75 inch"}]}]'),

  ('oled-tvs',
   '[{"key":"picture","label":"Picture"},{"key":"brightness","label":"Brightness"},
     {"key":"motion","label":"Motion"},{"key":"gaming","label":"Gaming"},
     {"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display","fields":[
       {"key":"panel","label":"Panel","placeholder":"WOLED with micro lens array"},
       {"key":"peak_brightness","label":"Measured peak brightness","unit":"nits","placeholder":"1,300 nits, 10% window"},
       {"key":"resolution","label":"Resolution","placeholder":"4K (3840 x 2160)"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"144 Hz"},
       {"key":"hdr","label":"HDR formats","placeholder":"Dolby Vision, HDR10, HLG"},
       {"key":"colour_gamut","label":"Colour gamut","placeholder":"98% DCI-P3"}]},
     {"key":"gaming","label":"Gaming","fields":[
       {"key":"hdmi_21","label":"HDMI 2.1 ports","placeholder":"4 x 48 Gbps"},
       {"key":"vrr","label":"VRR","placeholder":"G-Sync, FreeSync Premium, 20-144 Hz"},
       {"key":"input_lag","label":"Measured input lag","placeholder":"9.2 ms at 120 Hz"},
       {"key":"dolby_vision_gaming","label":"Dolby Vision gaming","placeholder":"4K at 120 Hz"}]},
     {"key":"care","label":"Longevity & audio","fields":[
       {"key":"burn_in_features","label":"Burn-in mitigation","placeholder":"Pixel refresher, logo dimming, screen shift"},
       {"key":"panel_warranty","label":"Panel warranty","placeholder":"1 year product, 3 on panel"},
       {"key":"audio_output","label":"Audio output","placeholder":"40 W, 2.2 channel"},
       {"key":"sizes","label":"Sizes available","placeholder":"42 / 48 / 55 / 65 / 77 inch"}]}]'),

  ('projectors',
   '[{"key":"brightness","label":"Brightness"},{"key":"picture","label":"Picture"},
     {"key":"noise","label":"Noise"},{"key":"setup","label":"Setup"},
     {"key":"value","label":"Value"}]',
   '[{"key":"projection","label":"Projection","fields":[
       {"key":"technology","label":"Technology","placeholder":"DLP with triple laser"},
       {"key":"brightness","label":"Brightness","placeholder":"2,200 ANSI lumens"},
       {"key":"resolution","label":"Native resolution","placeholder":"4K (3840 x 2160)"},
       {"key":"throw_ratio","label":"Throw ratio","placeholder":"0.25:1 ultra short throw"},
       {"key":"screen_size","label":"Screen size range","placeholder":"80-150 inch"},
       {"key":"contrast","label":"Contrast","placeholder":"3,000:1 native"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"light_source_life","label":"Light source life","placeholder":"25,000 hours"},
       {"key":"keystone","label":"Keystone and focus","placeholder":"Auto vertical, horizontal and obstacle avoidance"},
       {"key":"os","label":"Platform","placeholder":"Google TV, built in"},
       {"key":"hdr","label":"HDR formats","placeholder":"Dolby Vision, HDR10+"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"noise","label":"Fan noise","unit":"dB","placeholder":"26 dB"},
       {"key":"speakers","label":"Speakers","placeholder":"2 x 12 W, Dolby Atmos"},
       {"key":"connectivity","label":"Connectivity","placeholder":"3 x HDMI 2.1, Wi-Fi 6, Bluetooth"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"5.8 kg"}]}]'),

  ('streaming-devices',
   '[{"key":"picture","label":"Picture"},{"key":"speed","label":"Speed"},
     {"key":"software","label":"Software"},{"key":"remote","label":"Remote"},
     {"key":"value","label":"Value"}]',
   '[{"key":"video","label":"Video & audio","fields":[
       {"key":"max_resolution","label":"Maximum resolution","placeholder":"4K at 60 fps"},
       {"key":"hdr","label":"HDR formats","placeholder":"Dolby Vision, HDR10+"},
       {"key":"audio_formats","label":"Audio formats","placeholder":"Dolby Atmos passthrough"}]},
     {"key":"platform","label":"Platform","fields":[
       {"key":"os","label":"Operating system","placeholder":"Google TV"},
       {"key":"processor","label":"Processor","placeholder":"Quad-core 1.8 GHz"},
       {"key":"memory","label":"Memory and storage","placeholder":"2 GB RAM, 16 GB storage"},
       {"key":"app_support","label":"App availability","placeholder":"All major Indian and global services"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6, Bluetooth 5.2"},
       {"key":"ports","label":"Ports","placeholder":"HDMI 2.1, USB-C power"},
       {"key":"remote","label":"Remote","placeholder":"Voice remote with TV power and volume"},
       {"key":"ethernet","label":"Ethernet","placeholder":"Via optional adapter"}]}]'),

  -- ========================== NETWORKING =============================
  ('networking',
   '[{"key":"coverage","label":"Coverage"},{"key":"speed","label":"Speed"},
     {"key":"stability","label":"Stability"},{"key":"setup","label":"Setup"},
     {"key":"value","label":"Value"}]',
   '[{"key":"wireless","label":"Wireless","fields":[
       {"key":"standard","label":"Standard","placeholder":"Wi-Fi 6 (802.11ax)"},
       {"key":"bands","label":"Bands","placeholder":"Dual-band"},
       {"key":"rated_speed","label":"Rated speed","placeholder":"AX3000"},
       {"key":"coverage","label":"Rated coverage","placeholder":"Up to 1,500 sq ft"}]},
     {"key":"hardware","label":"Hardware","fields":[
       {"key":"processor","label":"Processor","placeholder":"1.5 GHz dual-core"},
       {"key":"ports","label":"Ports","placeholder":"1 x Gigabit WAN, 4 x Gigabit LAN"},
       {"key":"antennas","label":"Antennas","placeholder":"4 external"}]},
     {"key":"features","label":"Software","fields":[
       {"key":"security","label":"Security","placeholder":"WPA3, free lifetime protection"},
       {"key":"parental_controls","label":"Parental controls","placeholder":"Profiles, schedules, free tier"},
       {"key":"mesh_support","label":"Mesh support","placeholder":"Compatible with the same maker mesh"}]}]'),

  ('wifi-routers',
   '[{"key":"coverage","label":"Coverage"},{"key":"throughput","label":"Throughput"},
     {"key":"stability","label":"Stability"},{"key":"features","label":"Features"},
     {"key":"value","label":"Value"}]',
   '[{"key":"wireless","label":"Wireless","fields":[
       {"key":"standard","label":"Standard","placeholder":"Wi-Fi 6E (802.11ax)"},
       {"key":"bands","label":"Bands","placeholder":"Tri-band, 2.4 / 5 / 6 GHz"},
       {"key":"rated_speed","label":"Rated speed","placeholder":"AXE5400"},
       {"key":"measured_throughput","label":"Measured throughput","placeholder":"640 Mbps at 5 m, 210 Mbps through two walls"},
       {"key":"coverage","label":"Rated coverage","placeholder":"Up to 2,000 sq ft"},
       {"key":"client_capacity","label":"Tested client load","placeholder":"Stable with 40 devices"}]},
     {"key":"hardware","label":"Hardware","fields":[
       {"key":"processor","label":"Processor","placeholder":"1.7 GHz quad-core"},
       {"key":"memory","label":"Memory","placeholder":"512 MB RAM, 128 MB flash"},
       {"key":"wan_port","label":"WAN port","placeholder":"2.5 Gbps"},
       {"key":"lan_ports","label":"LAN ports","placeholder":"4 x Gigabit"},
       {"key":"antennas","label":"Antennas","placeholder":"6 external, non-removable"},
       {"key":"usb","label":"USB","placeholder":"1 x USB 3.0"}]},
     {"key":"software","label":"Software","fields":[
       {"key":"security","label":"Security","placeholder":"WPA3, free lifetime protection"},
       {"key":"vpn","label":"VPN","placeholder":"OpenVPN and WireGuard server"},
       {"key":"parental_controls","label":"Parental controls","placeholder":"Profiles and schedules, free tier"},
       {"key":"qos","label":"QoS","placeholder":"Per-device prioritisation"}]}]'),

  ('mesh-systems',
   '[{"key":"coverage","label":"Coverage"},{"key":"roaming","label":"Roaming"},
     {"key":"throughput","label":"Throughput"},{"key":"setup","label":"Setup"},
     {"key":"value","label":"Value"}]',
   '[{"key":"wireless","label":"Wireless","fields":[
       {"key":"standard","label":"Standard","placeholder":"Wi-Fi 6E (802.11ax)"},
       {"key":"bands","label":"Bands","placeholder":"Tri-band"},
       {"key":"backhaul","label":"Backhaul","placeholder":"Dedicated 6 GHz, 2,400 Mbps"},
       {"key":"rated_speed","label":"Rated speed","placeholder":"AXE5400 per node"},
       {"key":"coverage_per_node","label":"Coverage per node","placeholder":"Up to 1,500 sq ft"}]},
     {"key":"system","label":"System","fields":[
       {"key":"nodes_included","label":"Nodes in the box","placeholder":"2"},
       {"key":"max_nodes","label":"Maximum nodes","placeholder":"Up to 6"},
       {"key":"ethernet_backhaul","label":"Wired backhaul","placeholder":"Supported, 2.5 Gbps"},
       {"key":"ports_per_node","label":"Ports per node","placeholder":"1 x 2.5 Gbps, 2 x Gigabit"},
       {"key":"roaming","label":"Roaming standards","placeholder":"802.11k / v / r"}]},
     {"key":"software","label":"Software","fields":[
       {"key":"app","label":"App","placeholder":"Setup and management, iOS and Android"},
       {"key":"security","label":"Security","placeholder":"WPA3, free lifetime protection"},
       {"key":"parental_controls","label":"Parental controls","placeholder":"Free tier, paid advanced"},
       {"key":"smart_home","label":"Smart home","placeholder":"Matter controller, Thread border router"}]}]'),

  ('range-extenders',
   '[{"key":"coverage","label":"Coverage gain"},{"key":"throughput","label":"Throughput"},
     {"key":"placement","label":"Placement tolerance"},{"key":"setup","label":"Setup"},
     {"key":"value","label":"Value"}]',
   '[{"key":"wireless","label":"Wireless","fields":[
       {"key":"standard","label":"Standard","placeholder":"Wi-Fi 6 (802.11ax)"},
       {"key":"bands","label":"Bands","placeholder":"Dual-band"},
       {"key":"rated_speed","label":"Rated speed","placeholder":"AX1800"},
       {"key":"coverage_added","label":"Coverage added","placeholder":"Up to 1,500 sq ft"},
       {"key":"measured_loss","label":"Measured throughput loss","placeholder":"45% of the router figure at the extender"}]},
     {"key":"hardware","label":"Hardware","fields":[
       {"key":"form_factor","label":"Form factor","placeholder":"Wall plug, no trailing cable"},
       {"key":"ethernet","label":"Ethernet port","placeholder":"1 x Gigabit"},
       {"key":"antennas","label":"Antennas","placeholder":"2 external"},
       {"key":"signal_indicator","label":"Placement indicator","placeholder":"LED signal strength ring"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"mesh_mode","label":"Mesh mode","placeholder":"OneMesh, single network name"},
       {"key":"setup","label":"Setup","placeholder":"WPS button or app, under 3 minutes"},
       {"key":"access_point","label":"Access point mode","placeholder":"Yes, via Ethernet"}]}]'),

  -- ===================== AUDIO ADDITIONS =============================
  ('home-theatre',
   '[{"key":"sound","label":"Sound"},{"key":"dialogue","label":"Dialogue clarity"},
     {"key":"bass","label":"Bass"},{"key":"setup","label":"Setup"},
     {"key":"value","label":"Value"}]',
   '[{"key":"audio","label":"Audio","fields":[
       {"key":"channels","label":"Channels","placeholder":"5.1.4"},
       {"key":"output_power","label":"Output power","unit":"W","placeholder":"1,000 W total"},
       {"key":"formats","label":"Audio formats","placeholder":"Dolby Atmos, DTS:X, IMAX Enhanced"},
       {"key":"subwoofer","label":"Subwoofer","placeholder":"Wireless, 10-inch driver"},
       {"key":"room_correction","label":"Room correction","placeholder":"Automatic, microphone included"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"hdmi","label":"HDMI","placeholder":"1 x eARC out, 3 x 4K/120 in"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6, Bluetooth 5.3, AirPlay 2"},
       {"key":"streaming","label":"Streaming","placeholder":"Spotify Connect, Chromecast built in"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"speaker_count","label":"Speakers included","placeholder":"Bar, subwoofer, 2 wireless rears"},
       {"key":"rear_power","label":"Rear speakers","placeholder":"Wireless receiver, mains powered"},
       {"key":"dimensions","label":"Bar dimensions","placeholder":"1,232 x 69 x 138 mm"},
       {"key":"mounting","label":"Wall mounting","placeholder":"Bracket included"}]}]'),

  ('microphones',
   '[{"key":"voice","label":"Voice quality"},{"key":"rejection","label":"Noise rejection"},
     {"key":"build","label":"Build"},{"key":"ease","label":"Ease of use"},
     {"key":"value","label":"Value"}]',
   '[{"key":"capsule","label":"Capsule","fields":[
       {"key":"type","label":"Type","placeholder":"Large-diaphragm condenser"},
       {"key":"polar_patterns","label":"Polar patterns","placeholder":"Cardioid, omni, bidirectional, stereo"},
       {"key":"frequency_response","label":"Frequency response","placeholder":"20 Hz - 20,000 Hz"},
       {"key":"sample_rate","label":"Sample rate","placeholder":"24-bit / 96 kHz"},
       {"key":"max_spl","label":"Maximum SPL","placeholder":"120 dB"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"connection","label":"Connection","placeholder":"USB-C and XLR"},
       {"key":"monitoring","label":"Monitoring","placeholder":"Zero-latency 3.5 mm headphone out"},
       {"key":"controls","label":"Onboard controls","placeholder":"Gain, mute, blend, headphone level"},
       {"key":"software","label":"Software","placeholder":"Included, with compression and gate"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"mount","label":"Mount","placeholder":"Desk stand, 5/8 inch thread with 3/8 adapter"},
       {"key":"shock_mount","label":"Shock mount","placeholder":"Internal"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"550 g without stand"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  -- ==================== COMPUTER ADDITIONS ===========================
  ('desktops',
   '[{"key":"performance","label":"Performance"},{"key":"thermals","label":"Thermals"},
     {"key":"upgradability","label":"Upgradability"},{"key":"noise","label":"Noise"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"8-core, 16-thread, 5.2 GHz boost"},
       {"key":"graphics","label":"Graphics","placeholder":"Discrete, 12 GB"},
       {"key":"memory","label":"Memory","placeholder":"32 GB DDR5-6000, 2 of 4 slots used"},
       {"key":"storage","label":"Storage","placeholder":"1 TB NVMe Gen4, 1 free M.2 slot"}]},
     {"key":"physical","label":"Chassis & cooling","fields":[
       {"key":"form_factor","label":"Form factor","placeholder":"Mid tower"},
       {"key":"psu","label":"Power supply","placeholder":"750 W, 80+ Gold, ATX"},
       {"key":"cooling","label":"Cooling","placeholder":"240 mm AIO, 3 intake fans"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"38 dB under load"},
       {"key":"dimensions","label":"Dimensions","placeholder":"450 x 210 x 480 mm"}]},
     {"key":"connectivity","label":"Connectivity","fields":[
       {"key":"front_ports","label":"Front ports","placeholder":"1 x USB-C 10 Gbps, 2 x USB-A, audio"},
       {"key":"rear_ports","label":"Rear ports","placeholder":"6 x USB-A, 2 x USB-C, 2.5 GbE"},
       {"key":"display_outputs","label":"Display outputs","placeholder":"3 x DisplayPort 2.1, 1 x HDMI 2.1"},
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi 6E, Bluetooth 5.3"}]}]'),

  ('graphics-cards',
   '[{"key":"raster","label":"Rasterised performance"},{"key":"ray_tracing","label":"Ray tracing"},
     {"key":"thermals","label":"Thermals"},{"key":"power","label":"Power draw"},
     {"key":"value","label":"Value"}]',
   '[{"key":"gpu","label":"GPU","fields":[
       {"key":"chip","label":"Chip","placeholder":"GeForce RTX class, 6,144 shaders"},
       {"key":"boost_clock","label":"Boost clock","placeholder":"2,610 MHz"},
       {"key":"memory","label":"Memory","placeholder":"12 GB GDDR7"},
       {"key":"memory_bus","label":"Memory bus","placeholder":"192-bit, 672 GB/s"},
       {"key":"process","label":"Process node","placeholder":"4 nm"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"target_resolution","label":"Comfortable resolution","placeholder":"1440p high, 100+ fps"},
       {"key":"upscaling","label":"Upscaling","placeholder":"DLSS with frame generation"},
       {"key":"ray_tracing","label":"Ray tracing hardware","placeholder":"48 RT cores, 4th generation"},
       {"key":"encoders","label":"Media engine","placeholder":"Dual AV1 encode, 2 x NVENC"}]},
     {"key":"power","label":"Power & fit","fields":[
       {"key":"tdp","label":"Board power","unit":"W","placeholder":"250 W"},
       {"key":"psu_recommended","label":"Recommended PSU","unit":"W","placeholder":"650 W"},
       {"key":"power_connector","label":"Power connector","placeholder":"1 x 12V-2x6"},
       {"key":"slots","label":"Slot width","placeholder":"2.5 slots"},
       {"key":"length","label":"Length","unit":"mm","placeholder":"304 mm"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"34 dB under load"}]}]'),

  ('printers',
   '[{"key":"print_quality","label":"Print quality"},{"key":"running_cost","label":"Running cost"},
     {"key":"speed","label":"Speed"},{"key":"connectivity","label":"Connectivity"},
     {"key":"value","label":"Value"}]',
   '[{"key":"printing","label":"Printing","fields":[
       {"key":"technology","label":"Technology","placeholder":"Ink tank, 4 colour"},
       {"key":"functions","label":"Functions","placeholder":"Print, scan, copy, fax"},
       {"key":"resolution","label":"Print resolution","placeholder":"4800 x 1200 dpi"},
       {"key":"speed_mono","label":"Speed, mono","placeholder":"15 ppm"},
       {"key":"speed_colour","label":"Speed, colour","placeholder":"8 ppm"},
       {"key":"duplex","label":"Duplex","placeholder":"Automatic, print only"}]},
     {"key":"running_cost","label":"Running cost","fields":[
       {"key":"cost_per_page_mono","label":"Cost per page, mono","placeholder":"About 10 paise"},
       {"key":"cost_per_page_colour","label":"Cost per page, colour","placeholder":"About 25 paise"},
       {"key":"yield","label":"Yield per refill","placeholder":"6,000 mono / 7,600 colour pages"},
       {"key":"consumable_price","label":"Consumable price","placeholder":"Ink bottle set, widely stocked"},
       {"key":"monthly_duty","label":"Recommended monthly volume","placeholder":"Up to 3,000 pages"}]},
     {"key":"connectivity","label":"Connectivity & handling","fields":[
       {"key":"wireless","label":"Wireless","placeholder":"Wi-Fi, Wi-Fi Direct, AirPrint, Mopria"},
       {"key":"wired","label":"Wired","placeholder":"USB 2.0, Ethernet"},
       {"key":"adf","label":"Document feeder","placeholder":"35-sheet ADF"},
       {"key":"paper_tray","label":"Paper capacity","placeholder":"250-sheet input tray"},
       {"key":"display","label":"Display","placeholder":"2.4-inch colour touchscreen"}]}]'),

  ('webcams',
   '[{"key":"image","label":"Image quality"},{"key":"low_light","label":"Low light"},
     {"key":"autofocus","label":"Autofocus"},{"key":"mic","label":"Microphone"},
     {"key":"value","label":"Value"}]',
   '[{"key":"imaging","label":"Imaging","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"1/2.8-inch CMOS, 8 MP"},
       {"key":"resolution","label":"Resolution and frame rate","placeholder":"1080p at 60 fps, 4K at 30"},
       {"key":"field_of_view","label":"Field of view","placeholder":"78 degrees, adjustable to 65 and 90"},
       {"key":"autofocus","label":"Autofocus","placeholder":"Phase detection"},
       {"key":"hdr","label":"HDR","placeholder":"Yes, at 30 fps only"},
       {"key":"aperture","label":"Aperture","placeholder":"f/1.8"}]},
     {"key":"audio","label":"Audio","fields":[
       {"key":"microphones","label":"Microphones","placeholder":"Dual omnidirectional with beamforming"},
       {"key":"noise_reduction","label":"Noise reduction","placeholder":"Onboard, always on"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"mount","label":"Mount","placeholder":"Monitor clip, adjustable tilt"},
       {"key":"tripod_thread","label":"Tripod thread","placeholder":"1/4 inch"},
       {"key":"privacy_shutter","label":"Privacy shutter","placeholder":"Integrated, mechanical"},
       {"key":"connection","label":"Connection","placeholder":"USB-C, 1.5 m cable"}]}]'),

  -- ======================= GAMING ADDITIONS ==========================
  ('gaming-laptops',
   '[{"key":"sustained","label":"Sustained performance"},{"key":"thermals","label":"Thermals"},
     {"key":"display","label":"Display"},{"key":"build","label":"Build"},
     {"key":"battery","label":"Battery"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"8-core, 16-thread mobile"},
       {"key":"graphics","label":"Graphics","placeholder":"Discrete, 8 GB GDDR7"},
       {"key":"tgp","label":"Total graphics power","unit":"W","placeholder":"115 W plus 25 W dynamic boost"},
       {"key":"memory","label":"Memory","placeholder":"16 GB DDR5-5600, 2 slots"},
       {"key":"storage","label":"Storage","placeholder":"1 TB Gen4 NVMe, 1 free slot"},
       {"key":"mux","label":"Graphics switching","placeholder":"MUX switch with Advanced Optimus"}]},
     {"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","placeholder":"16-inch, 16:10"},
       {"key":"resolution","label":"Resolution","placeholder":"2560 x 1600"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"240 Hz"},
       {"key":"panel_type","label":"Panel","placeholder":"IPS, 500 nits, 100% DCI-P3"},
       {"key":"response","label":"Response time","placeholder":"3 ms grey to grey"}]},
     {"key":"thermals","label":"Thermals, power & build","fields":[
       {"key":"cooling","label":"Cooling","placeholder":"Dual fan, vapour chamber, liquid metal"},
       {"key":"fan_noise","label":"Measured fan noise","unit":"dB","placeholder":"48 dB in performance mode"},
       {"key":"battery","label":"Battery","placeholder":"90 Wh"},
       {"key":"battery_life","label":"Measured battery life","placeholder":"6 hours mixed use, 1.5 hours gaming"},
       {"key":"charger","label":"Charger","placeholder":"280 W barrel, 100 W USB-C also supported"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"2.3 kg"}]}]'),

  ('gaming-keyboards',
   '[{"key":"switches","label":"Switches"},{"key":"latency","label":"Latency"},
     {"key":"build","label":"Build"},{"key":"software","label":"Software"},
     {"key":"value","label":"Value"}]',
   '[{"key":"switches","label":"Switches","fields":[
       {"key":"type","label":"Switch type","placeholder":"Magnetic Hall effect, linear"},
       {"key":"actuation","label":"Actuation","placeholder":"0.1 to 4.0 mm, adjustable per key"},
       {"key":"rapid_trigger","label":"Rapid trigger","placeholder":"Yes, 0.1 mm reset"},
       {"key":"hot_swappable","label":"Hot swappable","placeholder":"Yes, 3 and 5 pin"},
       {"key":"keycaps","label":"Keycaps","placeholder":"PBT doubleshot, 1.5 mm"},
       {"key":"lifespan","label":"Rated lifespan","placeholder":"100 million presses"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"polling_rate","label":"Polling rate","placeholder":"8,000 Hz wired"},
       {"key":"connection","label":"Connection","placeholder":"USB-C, 2.4 GHz, Bluetooth 5.2"},
       {"key":"battery","label":"Battery","placeholder":"200 hours with lighting off"},
       {"key":"nkro","label":"Key rollover","placeholder":"Full N-key rollover"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"layout","label":"Layout","placeholder":"75%, with knob"},
       {"key":"case","label":"Case","placeholder":"CNC aluminium, gasket mounted"},
       {"key":"sound_damping","label":"Sound damping","placeholder":"Three layers of foam"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"980 g"},
       {"key":"wrist_rest","label":"Wrist rest","placeholder":"Magnetic, leatherette"}]}]'),

  ('gaming-mice',
   '[{"key":"sensor","label":"Sensor"},{"key":"shape","label":"Shape & grip"},
     {"key":"weight","label":"Weight"},{"key":"buttons","label":"Buttons"},
     {"key":"battery","label":"Battery"},{"key":"value","label":"Value"}]',
   '[{"key":"sensor","label":"Sensor & switches","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"Optical, flagship class"},
       {"key":"dpi","label":"DPI range","placeholder":"100 to 42,000"},
       {"key":"max_speed","label":"Maximum speed","placeholder":"750 IPS"},
       {"key":"polling_rate","label":"Polling rate","placeholder":"8,000 Hz wireless"},
       {"key":"switches","label":"Main switches","placeholder":"Optical, rated 100 million clicks"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"49 g"},
       {"key":"dimensions","label":"Dimensions","placeholder":"125 x 63.5 x 39.7 mm"},
       {"key":"shape","label":"Shape","placeholder":"Symmetrical, medium, safe for claw and fingertip"},
       {"key":"buttons","label":"Buttons","placeholder":"6 programmable"},
       {"key":"feet","label":"Feet","placeholder":"100% PTFE, spare set included"},
       {"key":"coating","label":"Coating","placeholder":"Matte, no grip tape needed"}]},
     {"key":"power","label":"Power","fields":[
       {"key":"connection","label":"Connection","placeholder":"2.4 GHz dongle, Bluetooth, USB-C"},
       {"key":"battery","label":"Rated battery","placeholder":"150 hours at 1,000 Hz"},
       {"key":"measured_battery","label":"Measured battery","placeholder":"22 hours at 8,000 Hz"},
       {"key":"charging","label":"Charging","placeholder":"USB-C, wireless charging optional"}]}]'),

  ('gaming-chairs',
   '[{"key":"support","label":"Support"},{"key":"adjustability","label":"Adjustability"},
     {"key":"materials","label":"Materials"},{"key":"assembly","label":"Assembly"},
     {"key":"value","label":"Value"}]',
   '[{"key":"support","label":"Support","fields":[
       {"key":"backrest","label":"Backrest recline","placeholder":"85 to 165 degrees"},
       {"key":"lumbar","label":"Lumbar support","placeholder":"Internal, 4-way adjustable"},
       {"key":"headrest","label":"Headrest","placeholder":"Magnetic memory foam"},
       {"key":"seat_shape","label":"Seat shape","placeholder":"Flat, no pronounced bolsters"},
       {"key":"tilt","label":"Tilt","placeholder":"Multi-tilt lock, up to 20 degrees"}]},
     {"key":"materials","label":"Materials","fields":[
       {"key":"upholstery","label":"Upholstery","placeholder":"Hybrid leatherette, PU coated"},
       {"key":"foam","label":"Foam","placeholder":"High-density cold-cure, 55 kg/m3"},
       {"key":"frame","label":"Frame","placeholder":"Steel, powder coated"},
       {"key":"base","label":"Base","placeholder":"Aluminium, 5 star"},
       {"key":"casters","label":"Casters","placeholder":"65 mm PU, hard floor safe"},
       {"key":"gas_lift","label":"Gas lift","placeholder":"Class 4"}]},
     {"key":"fit","label":"Fit & ownership","fields":[
       {"key":"user_height","label":"Recommended height","placeholder":"170 to 189 cm"},
       {"key":"max_weight","label":"Maximum user weight","unit":"kg","placeholder":"130 kg"},
       {"key":"seat_dimensions","label":"Seat dimensions","placeholder":"510 x 500 mm"},
       {"key":"armrests","label":"Armrests","placeholder":"4D, magnetic pads"},
       {"key":"assembly_time","label":"Assembly time","placeholder":"25 minutes, two people easier"},
       {"key":"warranty","label":"Warranty","placeholder":"5 years, extendable"}]}]'),

  ('handheld-consoles',
   '[{"key":"performance","label":"Performance"},{"key":"display","label":"Display"},
     {"key":"battery","label":"Battery"},{"key":"ergonomics","label":"Ergonomics"},
     {"key":"library","label":"Library & compatibility"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"processor","label":"Processor","placeholder":"Custom 4-core, 8-thread APU"},
       {"key":"graphics","label":"Graphics","placeholder":"8 compute units, up to 1.6 GHz"},
       {"key":"memory","label":"Memory","placeholder":"16 GB LPDDR5-6400"},
       {"key":"storage","label":"Storage","placeholder":"512 GB NVMe, microSD expandable"},
       {"key":"os","label":"Operating system","placeholder":"Linux based, desktop mode available"}]},
     {"key":"display","label":"Display","fields":[
       {"key":"size","label":"Size","placeholder":"7.4-inch"},
       {"key":"panel","label":"Panel","placeholder":"HDR OLED"},
       {"key":"resolution","label":"Resolution","placeholder":"1280 x 800"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"90 Hz, VRR"},
       {"key":"brightness","label":"Brightness","unit":"nits","placeholder":"600 nits SDR, 1,000 HDR"}]},
     {"key":"power","label":"Power & handling","fields":[
       {"key":"battery","label":"Battery","placeholder":"50 Wh"},
       {"key":"measured_battery","label":"Measured battery life","placeholder":"2 hours demanding, 8 hours indie"},
       {"key":"charging","label":"Charging","placeholder":"45 W USB-C PD"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"640 g"},
       {"key":"controls","label":"Controls","placeholder":"Hall effect sticks, 4 back buttons, trackpads"},
       {"key":"docking","label":"Docking","placeholder":"USB-C, 4K/60 out via optional dock"}]}]'),

  ('vr-headsets',
   '[{"key":"clarity","label":"Clarity"},{"key":"comfort","label":"Comfort"},
     {"key":"tracking","label":"Tracking"},{"key":"content","label":"Content library"},
     {"key":"value","label":"Value"}]',
   '[{"key":"display","label":"Display & optics","fields":[
       {"key":"panel","label":"Panel","placeholder":"LCD, per eye"},
       {"key":"resolution","label":"Resolution per eye","placeholder":"2064 x 2208"},
       {"key":"refresh_rate","label":"Refresh rate","unit":"Hz","placeholder":"72, 90 and 120 Hz"},
       {"key":"fov","label":"Field of view","placeholder":"110 horizontal, 96 vertical"},
       {"key":"lenses","label":"Lenses","placeholder":"Pancake"},
       {"key":"ipd","label":"IPD adjustment","placeholder":"Continuous, 58 to 71 mm"}]},
     {"key":"tracking","label":"Tracking & compute","fields":[
       {"key":"tracking","label":"Tracking","placeholder":"Inside-out, 4 cameras, no base stations"},
       {"key":"processor","label":"Processor","placeholder":"Mobile XR chipset"},
       {"key":"memory","label":"Memory and storage","placeholder":"8 GB RAM, 128 GB storage"},
       {"key":"controllers","label":"Controllers","placeholder":"Ring free, haptics, AA or rechargeable"},
       {"key":"hand_tracking","label":"Hand tracking","placeholder":"Yes, camera based"},
       {"key":"passthrough","label":"Passthrough","placeholder":"Full colour"}]},
     {"key":"fit","label":"Fit & power","fields":[
       {"key":"weight","label":"Weight","unit":"g","placeholder":"515 g headset only"},
       {"key":"strap","label":"Strap","placeholder":"Soft strap in box, rigid strap sold separately"},
       {"key":"battery","label":"Battery life","placeholder":"2 to 3 hours"},
       {"key":"pc_link","label":"PC connection","placeholder":"USB-C cable or Wi-Fi 6E wireless"},
       {"key":"glasses","label":"Glasses fit","placeholder":"Spacer included"}]}]'),

  -- ====================== CAMERA ADDITIONS ===========================
  ('drones',
   '[{"key":"camera","label":"Camera"},{"key":"flight_time","label":"Flight time"},
     {"key":"wind","label":"Wind resistance"},{"key":"safety","label":"Safety & avoidance"},
     {"key":"value","label":"Value"}]',
   '[{"key":"camera","label":"Camera","fields":[
       {"key":"sensor","label":"Sensor","placeholder":"1/1.3-inch CMOS, 48 MP"},
       {"key":"video","label":"Video","placeholder":"4K at 60 fps HDR, 10-bit"},
       {"key":"stabilisation","label":"Stabilisation","placeholder":"3-axis mechanical gimbal"},
       {"key":"aperture","label":"Aperture","placeholder":"f/1.7 fixed"},
       {"key":"zoom","label":"Zoom","placeholder":"3x optical on the tele lens"},
       {"key":"formats","label":"Formats","placeholder":"D-Log M, 10-bit HLG, raw stills"}]},
     {"key":"flight","label":"Flight","fields":[
       {"key":"flight_time","label":"Rated flight time","placeholder":"34 minutes"},
       {"key":"measured_flight_time","label":"Measured flight time","placeholder":"27 minutes with a return reserve"},
       {"key":"range","label":"Transmission range","placeholder":"20 km, video 1080p/60"},
       {"key":"wind_resistance","label":"Wind resistance","placeholder":"Level 5, 10.7 m/s"},
       {"key":"max_speed","label":"Maximum speed","placeholder":"21 m/s in sport mode"},
       {"key":"obstacle_sensing","label":"Obstacle sensing","placeholder":"Omnidirectional, vision plus infrared"}]},
     {"key":"regulatory","label":"Weight, rules & storage","fields":[
       {"key":"weight","label":"Take-off weight","unit":"g","placeholder":"249 g"},
       {"key":"registration","label":"Registration","placeholder":"Under 250 g — check current local rules before flying"},
       {"key":"remote_id","label":"Remote ID","placeholder":"Built in"},
       {"key":"storage","label":"Storage","placeholder":"43 GB internal, microSD to 512 GB"},
       {"key":"charging","label":"Charging","placeholder":"80 minutes per battery, USB-C"}]}]'),

  ('gimbals-tripods',
   '[{"key":"stability","label":"Stability"},{"key":"payload","label":"Payload"},
     {"key":"build","label":"Build"},{"key":"ease","label":"Ease of use"},
     {"key":"value","label":"Value"}]',
   '[{"key":"support","label":"Support","fields":[
       {"key":"type","label":"Type","placeholder":"3-axis gimbal"},
       {"key":"payload","label":"Tested payload","unit":"kg","placeholder":"3.6 kg"},
       {"key":"head","label":"Head","placeholder":"Ball head, Arca-Swiss plate"},
       {"key":"sections","label":"Leg sections","placeholder":"5, twist lock"},
       {"key":"axis_range","label":"Axis range","placeholder":"Pan 360, tilt 320, roll 340 degrees"}]},
     {"key":"physical","label":"Physical","fields":[
       {"key":"material","label":"Material","placeholder":"Carbon fibre, 10 layer"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.2 kg"},
       {"key":"folded_length","label":"Folded length","unit":"cm","placeholder":"41 cm"},
       {"key":"max_height","label":"Maximum height","unit":"cm","placeholder":"164 cm"},
       {"key":"min_height","label":"Minimum height","unit":"cm","placeholder":"18 cm"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"battery","label":"Battery","placeholder":"13 hours, USB-C charging"},
       {"key":"modes","label":"Modes","placeholder":"Pan follow, FPV, sport, time-lapse"},
       {"key":"quick_release","label":"Quick release","placeholder":"Arca-Swiss and Manfrotto compatible"},
       {"key":"accessories","label":"In the box","placeholder":"Case, plate, hex key, strap"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  -- ===================== WEARABLE ADDITIONS ==========================
  ('smart-rings',
   '[{"key":"tracking","label":"Tracking accuracy"},{"key":"battery","label":"Battery"},
     {"key":"comfort","label":"Comfort"},{"key":"app","label":"App & insights"},
     {"key":"value","label":"Value"}]',
   '[{"key":"sensors","label":"Sensors & metrics","fields":[
       {"key":"sensors","label":"Sensors","placeholder":"PPG, SpO2, skin temperature, accelerometer"},
       {"key":"metrics","label":"Metrics","placeholder":"Sleep stages, HRV, resting heart rate, readiness"},
       {"key":"sleep_accuracy","label":"Sleep accuracy","placeholder":"Compared against a chest strap and a sleep log"},
       {"key":"workout_detection","label":"Workout detection","placeholder":"Automatic for walking and running only"}]},
     {"key":"power","label":"Power","fields":[
       {"key":"battery","label":"Rated battery","placeholder":"7 days"},
       {"key":"measured_battery","label":"Measured battery","placeholder":"5 days with SpO2 on every night"},
       {"key":"charging","label":"Charging","placeholder":"80 minutes on the dock"},
       {"key":"case","label":"Charging case","placeholder":"Not included"}]},
     {"key":"ownership","label":"Fit & ownership","fields":[
       {"key":"sizes","label":"Sizes","placeholder":"6 to 13, sizing kit sent first"},
       {"key":"material","label":"Material","placeholder":"Titanium, hypoallergenic inner"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"4 g"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"100 m"},
       {"key":"subscription","label":"Subscription","placeholder":"Required for full insights — state the monthly price"}]}]'),

  -- ==================== SMART HOME ADDITIONS =========================
  ('robot-vacuums',
   '[{"key":"cleaning","label":"Cleaning"},{"key":"mapping","label":"Mapping"},
     {"key":"mopping","label":"Mopping"},{"key":"maintenance","label":"Maintenance"},
     {"key":"noise","label":"Noise"},{"key":"value","label":"Value"}]',
   '[{"key":"cleaning","label":"Cleaning","fields":[
       {"key":"suction","label":"Suction","placeholder":"10,000 Pa"},
       {"key":"brush","label":"Main brush","placeholder":"Anti-tangle rubber, dual"},
       {"key":"mopping","label":"Mopping","placeholder":"Dual spinning pads, auto lift on carpet"},
       {"key":"carpet_detection","label":"Carpet detection","placeholder":"Ultrasonic, boosts suction"},
       {"key":"edge_cleaning","label":"Edge cleaning","placeholder":"Extending side brush and mop arm"}]},
     {"key":"navigation","label":"Navigation","fields":[
       {"key":"mapping","label":"Mapping","placeholder":"LiDAR, multi-floor, saved maps"},
       {"key":"obstacle_avoidance","label":"Obstacle avoidance","placeholder":"Structured light plus camera"},
       {"key":"zones","label":"Zones","placeholder":"No-go zones, virtual walls, room-by-room"},
       {"key":"threshold","label":"Threshold climbing","unit":"mm","placeholder":"22 mm"}]},
     {"key":"maintenance","label":"Dock & maintenance","fields":[
       {"key":"dock","label":"Dock","placeholder":"Self-empty, mop wash and hot air dry"},
       {"key":"dust_bag_life","label":"Dust bag life","placeholder":"Up to 7 weeks"},
       {"key":"consumables","label":"Annual consumables","placeholder":"Bags, filters, brushes — state the yearly cost"},
       {"key":"battery","label":"Battery","placeholder":"5,200 mAh, 180 minutes"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"62 dB on max"}]}]'),

  ('smart-locks',
   '[{"key":"security","label":"Security"},{"key":"reliability","label":"Reliability"},
     {"key":"battery","label":"Battery"},{"key":"install","label":"Installation"},
     {"key":"value","label":"Value"}]',
   '[{"key":"access","label":"Access","fields":[
       {"key":"methods","label":"Unlock methods","placeholder":"Fingerprint, PIN, card, app, mechanical key"},
       {"key":"capacity","label":"Stored credentials","placeholder":"100 fingerprints, 100 PINs"},
       {"key":"auto_lock","label":"Auto lock","placeholder":"Configurable, 5 to 300 seconds"},
       {"key":"guest_access","label":"Guest access","placeholder":"Time-limited and one-time codes"},
       {"key":"logs","label":"Access log","placeholder":"Last 1,000 events in the app"}]},
     {"key":"security","label":"Security","fields":[
       {"key":"grade","label":"Certification","placeholder":"BHMA Grade 1 or equivalent"},
       {"key":"encryption","label":"Encryption","placeholder":"AES-128, secure element"},
       {"key":"tamper_alarm","label":"Tamper alarm","placeholder":"Yes, 100 dB"},
       {"key":"override","label":"Mechanical override","placeholder":"Emergency key and 9 V external terminal"},
       {"key":"anti_peep","label":"Anti-peep PIN","placeholder":"Yes"}]},
     {"key":"fit","label":"Power & fit","fields":[
       {"key":"battery","label":"Battery","placeholder":"4 x AA, about 8 months"},
       {"key":"low_battery","label":"Low battery warning","placeholder":"App alert and keypad tone"},
       {"key":"door_thickness","label":"Door thickness","placeholder":"35 to 65 mm"},
       {"key":"connectivity","label":"Connectivity","placeholder":"Bluetooth, Wi-Fi bridge, Matter"},
       {"key":"install","label":"Installation","placeholder":"Drilling required, professional fitting recommended"}]}]'),

  ('video-doorbells',
   '[{"key":"video","label":"Video"},{"key":"night_vision","label":"Night vision"},
     {"key":"detection","label":"Detection"},{"key":"storage_cost","label":"Storage cost"},
     {"key":"value","label":"Value"}]',
   '[{"key":"camera","label":"Camera","fields":[
       {"key":"resolution","label":"Resolution","placeholder":"2K, 1:1 aspect ratio"},
       {"key":"field_of_view","label":"Field of view","placeholder":"180 degrees, head to toe"},
       {"key":"night_vision","label":"Night vision","placeholder":"Colour, with spotlight"},
       {"key":"hdr","label":"HDR","placeholder":"Yes, helps against backlit doorways"},
       {"key":"two_way_audio","label":"Two-way audio","placeholder":"Full duplex, noise cancelling"}]},
     {"key":"detection","label":"Detection","fields":[
       {"key":"motion_zones","label":"Motion zones","placeholder":"Custom, up to 4"},
       {"key":"person_detection","label":"Person detection","placeholder":"On device, no subscription"},
       {"key":"package_detection","label":"Package detection","placeholder":"Subscription only"},
       {"key":"pre_roll","label":"Pre-roll","placeholder":"4 seconds before the event"}]},
     {"key":"storage","label":"Storage & power","fields":[
       {"key":"local_storage","label":"Local storage","placeholder":"microSD up to 256 GB, or a base station"},
       {"key":"cloud_plan","label":"Cloud plan","placeholder":"Optional — state the monthly price and what it unlocks"},
       {"key":"power","label":"Power","placeholder":"Battery, or 8 to 24 VAC wired"},
       {"key":"battery_life","label":"Measured battery life","placeholder":"3 months at 20 events a day"},
       {"key":"chime","label":"Chime","placeholder":"Existing chime supported, plug-in chime sold separately"}]}]'),

  -- ==================== ACCESSORY ADDITIONS ==========================
  ('docking-stations',
   '[{"key":"bandwidth","label":"Bandwidth"},{"key":"displays","label":"Display support"},
     {"key":"power","label":"Power delivery"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"connectivity","label":"Connectivity","fields":[
       {"key":"standard","label":"Standard","placeholder":"Thunderbolt 4"},
       {"key":"host_bandwidth","label":"Host bandwidth","placeholder":"40 Gbps"},
       {"key":"usb_ports","label":"USB ports","placeholder":"3 x USB-A 10 Gbps, 2 x USB-C 10 Gbps"},
       {"key":"ethernet","label":"Ethernet","placeholder":"2.5 GbE"},
       {"key":"card_readers","label":"Card readers","placeholder":"SD 4.0 and microSD"},
       {"key":"audio","label":"Audio","placeholder":"3.5 mm combo jack"}]},
     {"key":"display","label":"Display","fields":[
       {"key":"max_displays","label":"Maximum displays","placeholder":"Dual 4K at 60 Hz"},
       {"key":"outputs","label":"Display outputs","placeholder":"2 x HDMI 2.1, 1 x DisplayPort 1.4"},
       {"key":"mac_support","label":"macOS display support","placeholder":"Single external on Apple silicon base chips"},
       {"key":"daisy_chain","label":"Daisy chain","placeholder":"Supported on the downstream Thunderbolt port"}]},
     {"key":"power","label":"Power & compatibility","fields":[
       {"key":"power_delivery","label":"Power to host","unit":"W","placeholder":"96 W"},
       {"key":"psu","label":"Power supply","placeholder":"180 W external brick"},
       {"key":"compatibility","label":"Compatibility","placeholder":"Thunderbolt 3/4/5 and USB4 hosts"},
       {"key":"firmware","label":"Firmware updates","placeholder":"Windows and macOS utility"}]}]'),

  ('laptop-bags',
   '[{"key":"protection","label":"Protection"},{"key":"capacity","label":"Capacity"},
     {"key":"comfort","label":"Carry comfort"},{"key":"materials","label":"Materials"},
     {"key":"value","label":"Value"}]',
   '[{"key":"fit","label":"Fit & capacity","fields":[
       {"key":"laptop_size","label":"Laptop size","placeholder":"Up to 16-inch"},
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"22 L"},
       {"key":"compartments","label":"Compartments","placeholder":"Laptop, tablet, admin panel, main"},
       {"key":"suspended_sleeve","label":"Suspended sleeve","placeholder":"Yes, lifted 25 mm off the base"},
       {"key":"expansion","label":"Expansion","placeholder":"Adds 6 L via a side zip"}]},
     {"key":"materials","label":"Materials","fields":[
       {"key":"exterior","label":"Exterior","placeholder":"900D recycled polyester"},
       {"key":"water_resistance","label":"Water resistance","placeholder":"DWR coating, rain cover included"},
       {"key":"zips","label":"Zips","placeholder":"YKK, lockable pulls"},
       {"key":"base","label":"Base","placeholder":"Reinforced, moulded feet"}]},
     {"key":"carry","label":"Carry & ownership","fields":[
       {"key":"straps","label":"Straps","placeholder":"Contoured, load lifters, sternum strap"},
       {"key":"back_panel","label":"Back panel","placeholder":"Ventilated foam channels"},
       {"key":"luggage_passthrough","label":"Luggage passthrough","placeholder":"Yes"},
       {"key":"weight","label":"Empty weight","unit":"kg","placeholder":"1.1 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"Lifetime on manufacturing defects"}]}]'),

  -- ==================== KITCHEN APPLIANCES ===========================
  ('kitchen-appliances',
   '[{"key":"cooking","label":"Cooking"},{"key":"ease","label":"Ease of use"},
     {"key":"cleaning","label":"Cleaning"},{"key":"build","label":"Build"},
     {"key":"noise","label":"Noise"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"1,700 W"},
       {"key":"capacity","label":"Capacity","placeholder":"6.5 L"},
       {"key":"temperature_range","label":"Temperature range","placeholder":"80 to 200 C"},
       {"key":"presets","label":"Presets","placeholder":"9"}]},
     {"key":"build","label":"Build","fields":[
       {"key":"body","label":"Body material","placeholder":"Stainless steel and ABS"},
       {"key":"coating","label":"Coating","placeholder":"Ceramic non-stick, PFOA free"},
       {"key":"controls","label":"Controls","placeholder":"Digital touch with dial"},
       {"key":"accessories","label":"Accessories","placeholder":"Rack, tray, tongs"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"dimensions","label":"Dimensions","placeholder":"380 x 340 x 320 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"5.8 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"},
       {"key":"cord_length","label":"Cord length","placeholder":"1.2 m"}]}]'),

  ('air-fryers',
   '[{"key":"cooking","label":"Cooking"},{"key":"capacity","label":"Usable capacity"},
     {"key":"ease","label":"Ease of use"},{"key":"cleaning","label":"Cleaning"},
     {"key":"noise","label":"Noise"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"1,700 W"},
       {"key":"stated_capacity","label":"Stated capacity","placeholder":"6.5 L"},
       {"key":"usable_capacity","label":"Usable capacity","placeholder":"4.2 L — measured with food in a single layer"},
       {"key":"temperature_range","label":"Temperature range","placeholder":"40 to 200 C"},
       {"key":"preheat_time","label":"Preheat time","placeholder":"3 minutes to 180 C"},
       {"key":"presets","label":"Presets","placeholder":"9, including reheat and dehydrate"}]},
     {"key":"basket","label":"Basket","fields":[
       {"key":"basket_type","label":"Basket type","placeholder":"Dual zone, independently controlled"},
       {"key":"coating","label":"Coating","placeholder":"Ceramic non-stick, PFOA free"},
       {"key":"dishwasher_safe","label":"Dishwasher safe","placeholder":"Basket and crisper plate"},
       {"key":"capacity_practical","label":"Practical serving","placeholder":"Chips for 3, or 6 drumsticks"},
       {"key":"window","label":"Viewing window","placeholder":"Yes, with interior light"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"dimensions","label":"Dimensions","placeholder":"380 x 340 x 320 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"5.8 kg"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"55 dB"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('microwave-ovens',
   '[{"key":"heating","label":"Heating"},{"key":"evenness","label":"Evenness"},
     {"key":"presets","label":"Presets"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"type","label":"Type","placeholder":"Convection"},
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"28 L"},
       {"key":"microwave_power","label":"Microwave power","unit":"W","placeholder":"900 W output"},
       {"key":"convection_power","label":"Convection power","unit":"W","placeholder":"2,500 W"},
       {"key":"power_levels","label":"Power levels","placeholder":"10"},
       {"key":"inverter","label":"Inverter","placeholder":"Yes, steady power at low settings"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"auto_menus","label":"Auto menus","placeholder":"251, including Indian recipes"},
       {"key":"turntable","label":"Turntable","placeholder":"315 mm glass, removable"},
       {"key":"accessories","label":"Accessories","placeholder":"Rotisserie, high and low racks, crusty plate"},
       {"key":"child_lock","label":"Child lock","placeholder":"Yes"},
       {"key":"deodoriser","label":"Deodoriser","placeholder":"Yes"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"cavity","label":"Cavity material","placeholder":"Stainless steel, easy to wipe"},
       {"key":"dimensions","label":"Dimensions","placeholder":"517 x 310 x 480 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"18 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year product, 5 years on the magnetron"}]}]'),

  ('otg-ovens',
   '[{"key":"baking","label":"Baking"},{"key":"stability","label":"Temperature stability"},
     {"key":"capacity","label":"Capacity"},{"key":"controls","label":"Controls"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"48 L"},
       {"key":"power","label":"Power","unit":"W","placeholder":"2,000 W"},
       {"key":"temperature_range","label":"Temperature range","placeholder":"60 to 250 C"},
       {"key":"heating_elements","label":"Heating elements","placeholder":"6, stainless steel"},
       {"key":"convection_fan","label":"Convection fan","placeholder":"Yes"},
       {"key":"measured_stability","label":"Measured stability","placeholder":"Plus or minus 8 C at 180 C"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"functions","label":"Functions","placeholder":"Bake, grill, toast, rotisserie"},
       {"key":"timer","label":"Timer","placeholder":"60 minutes with bell"},
       {"key":"accessories","label":"Accessories","placeholder":"2 trays, wire rack, rotisserie, tongs"},
       {"key":"interior_light","label":"Interior light","placeholder":"Yes"},
       {"key":"door","label":"Door","placeholder":"Double glass, drop down"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"body","label":"Body","placeholder":"Powder-coated steel"},
       {"key":"dimensions","label":"Dimensions","placeholder":"570 x 400 x 350 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"12 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('induction-cooktops',
   '[{"key":"heating","label":"Heating"},{"key":"control","label":"Control"},
     {"key":"safety","label":"Safety"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"2,100 W"},
       {"key":"power_levels","label":"Power levels","placeholder":"10"},
       {"key":"temperature_range","label":"Temperature range","placeholder":"60 to 240 C"},
       {"key":"coil_size","label":"Heating coil","placeholder":"200 mm, 100% copper"},
       {"key":"boil_test","label":"Measured boil time","placeholder":"1 L of water in 4 minutes 20 seconds"},
       {"key":"presets","label":"Preset menus","placeholder":"8, Indian cooking modes"}]},
     {"key":"safety","label":"Safety","fields":[
       {"key":"auto_shutoff","label":"Auto shut-off","placeholder":"After 2 hours of no input"},
       {"key":"pan_detection","label":"Pan detection","placeholder":"Yes, shuts down in 60 seconds"},
       {"key":"child_lock","label":"Child lock","placeholder":"Yes"},
       {"key":"voltage_protection","label":"Voltage protection","placeholder":"160 to 260 V"}]},
     {"key":"build","label":"Build","fields":[
       {"key":"surface","label":"Surface","placeholder":"Crystal glass, scratch resistant"},
       {"key":"controls","label":"Controls","placeholder":"Touch panel with dial"},
       {"key":"cookware","label":"Cookware needed","placeholder":"Flat, magnetic base, 120 to 260 mm"},
       {"key":"dimensions","label":"Dimensions","placeholder":"350 x 280 x 65 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year"}]}]'),

  ('kitchen-chimneys',
   '[{"key":"suction","label":"Suction"},{"key":"noise","label":"Noise"},
     {"key":"maintenance","label":"Filter maintenance"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"suction","label":"Suction","placeholder":"1,500 m3/hr"},
       {"key":"room_fit","label":"Suited to","placeholder":"Kitchens up to 200 sq ft with heavy frying"},
       {"key":"filter_type","label":"Filter type","placeholder":"Filterless, or baffle"},
       {"key":"motor","label":"Motor","placeholder":"Single, 200 W copper"},
       {"key":"speeds","label":"Speeds","placeholder":"3 plus turbo"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"controls","label":"Controls","placeholder":"Touch and motion sensor"},
       {"key":"auto_clean","label":"Auto clean","placeholder":"Thermal, oil collector cup"},
       {"key":"lighting","label":"Lighting","placeholder":"2 x LED"},
       {"key":"duct_size","label":"Duct size","placeholder":"150 mm"},
       {"key":"ducting","label":"Ducted or ductless","placeholder":"Ducted, with a charcoal filter option"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"width","label":"Width","placeholder":"60 cm and 90 cm variants"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"58 dB at full speed"},
       {"key":"installation","label":"Installation","placeholder":"Chargeable, duct pipe usually extra"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year product, 12 years on the motor"}]}]'),

  ('toasters-sandwich-makers',
   '[{"key":"browning","label":"Browning"},{"key":"evenness","label":"Evenness"},
     {"key":"cleaning","label":"Cleaning"},{"key":"build","label":"Build"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"750 W"},
       {"key":"slots_or_plates","label":"Slots or plates","placeholder":"4 slice, or grill plates"},
       {"key":"browning_levels","label":"Browning levels","placeholder":"7"},
       {"key":"preheat_time","label":"Preheat time","placeholder":"2 minutes"},
       {"key":"evenness","label":"Measured evenness","placeholder":"Even across both plates after the second batch"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"functions","label":"Functions","placeholder":"Toast, bagel, reheat, defrost"},
       {"key":"plates","label":"Plates","placeholder":"Non-stick, detachable, grill and waffle"},
       {"key":"crumb_tray","label":"Crumb tray","placeholder":"Removable"},
       {"key":"cord_storage","label":"Cord storage","placeholder":"Underside winder"},
       {"key":"lock","label":"Lid lock","placeholder":"Yes, for upright storage"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"body","label":"Body","placeholder":"Stainless steel"},
       {"key":"dimensions","label":"Dimensions","placeholder":"320 x 260 x 110 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"2.1 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  -- ===================== COFFEE & BEVERAGE ===========================
  ('coffee-beverage',
   '[{"key":"taste","label":"Taste"},{"key":"consistency","label":"Consistency"},
     {"key":"ease","label":"Ease of use"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"brewing","label":"Brewing","fields":[
       {"key":"type","label":"Type","placeholder":"Drip filter"},
       {"key":"power","label":"Power","unit":"W","placeholder":"1,450 W"},
       {"key":"capacity","label":"Capacity","placeholder":"1.25 L"},
       {"key":"temperature","label":"Brew temperature","placeholder":"92 to 96 C"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"controls","label":"Controls","placeholder":"Dial with LCD"},
       {"key":"milk_system","label":"Milk system","placeholder":"Manual steam wand"},
       {"key":"filter","label":"Water filter","placeholder":"Included, replace every 2 months"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"cost_per_cup","label":"Cost per cup","placeholder":"State the rupee figure with the beans you used"},
       {"key":"dimensions","label":"Dimensions","placeholder":"330 x 200 x 380 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('coffee-machines',
   '[{"key":"taste","label":"Taste"},{"key":"consistency","label":"Consistency"},
     {"key":"ease","label":"Ease of use"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"brewing","label":"Brewing","fields":[
       {"key":"type","label":"Type","placeholder":"Bean to cup, fully automatic"},
       {"key":"power","label":"Power","unit":"W","placeholder":"1,450 W"},
       {"key":"capacity","label":"Water tank","placeholder":"1.8 L"},
       {"key":"brew_temperature","label":"Brew temperature","placeholder":"92 to 96 C, adjustable"},
       {"key":"grinder","label":"Grinder","placeholder":"Conical burr, 13 settings"},
       {"key":"drinks","label":"Drinks","placeholder":"14 one-touch recipes"}]},
     {"key":"features","label":"Features","fields":[
       {"key":"milk_system","label":"Milk system","placeholder":"Automatic carafe, removable and fridge safe"},
       {"key":"programmable","label":"Programmable","placeholder":"Strength, volume and temperature per drink"},
       {"key":"carafe","label":"Carafe","placeholder":"Thermal, keeps heat 2 hours"},
       {"key":"water_filter","label":"Water filter","placeholder":"Included, hardness setting"},
       {"key":"profiles","label":"User profiles","placeholder":"4"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"cost_per_cup","label":"Cost per cup","placeholder":"State the rupee figure and the beans used"},
       {"key":"cleaning","label":"Cleaning","placeholder":"Auto rinse on start and stop, descale alert"},
       {"key":"dimensions","label":"Dimensions","placeholder":"240 x 440 x 360 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('espresso-machines',
   '[{"key":"extraction","label":"Extraction"},{"key":"steam","label":"Steam power"},
     {"key":"consistency","label":"Consistency"},{"key":"learning","label":"Learning curve"},
     {"key":"value","label":"Value"}]',
   '[{"key":"brewing","label":"Brewing","fields":[
       {"key":"boiler","label":"Boiler","placeholder":"Single boiler with thermocoil"},
       {"key":"pressure","label":"Brew pressure","placeholder":"9 bar regulated, 15 bar pump"},
       {"key":"pid","label":"Temperature control","placeholder":"PID, plus or minus 1 C"},
       {"key":"portafilter","label":"Portafilter","placeholder":"58 mm, commercial size"},
       {"key":"pre_infusion","label":"Pre-infusion","placeholder":"Low pressure, adjustable duration"},
       {"key":"baskets","label":"Baskets","placeholder":"Single and double, pressurised and not"}]},
     {"key":"steam","label":"Steam & water","fields":[
       {"key":"steam_wand","label":"Steam wand","placeholder":"Manual, 4-hole tip, full articulation"},
       {"key":"steam_time","label":"Measured steam time","placeholder":"35 seconds for 200 ml of microfoam"},
       {"key":"hot_water","label":"Hot water outlet","placeholder":"Separate"},
       {"key":"warm_up","label":"Warm-up time","placeholder":"3 seconds with thermocoil"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"grinder","label":"Grinder","placeholder":"Integrated conical burr, 30 settings"},
       {"key":"water_tank","label":"Water tank","placeholder":"2 L, front removable"},
       {"key":"dimensions","label":"Dimensions","placeholder":"330 x 330 x 400 mm"},
       {"key":"cleaning","label":"Cleaning","placeholder":"Backflush kit and descaler included"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('electric-kettles',
   '[{"key":"speed","label":"Speed"},{"key":"build","label":"Build"},
     {"key":"safety","label":"Safety"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"1,500 W"},
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"1.7 L"},
       {"key":"boil_time","label":"Measured boil time","placeholder":"4 minutes for 1 L from 25 C"},
       {"key":"temperature_control","label":"Temperature control","placeholder":"40 to 100 C, 5 presets"},
       {"key":"keep_warm","label":"Keep warm","placeholder":"30 minutes"}]},
     {"key":"build","label":"Build","fields":[
       {"key":"interior","label":"Interior","placeholder":"304 stainless steel, no plastic in the water path"},
       {"key":"exterior","label":"Exterior","placeholder":"Double wall, cool touch"},
       {"key":"lid","label":"Lid","placeholder":"One-touch, wide opening for cleaning"},
       {"key":"water_gauge","label":"Water gauge","placeholder":"Both sides, backlit"},
       {"key":"base","label":"Base","placeholder":"360 degree cordless, cord storage"}]},
     {"key":"safety","label":"Safety & ownership","fields":[
       {"key":"auto_shutoff","label":"Auto shut-off","placeholder":"Yes, on boil and lid open"},
       {"key":"boil_dry","label":"Boil dry protection","placeholder":"Yes"},
       {"key":"filter","label":"Limescale filter","placeholder":"Removable and washable"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('juicers',
   '[{"key":"yield","label":"Yield"},{"key":"pulp","label":"Pulp control"},
     {"key":"cleaning","label":"Cleaning"},{"key":"noise","label":"Noise"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"type","label":"Type","placeholder":"Slow masticating, vertical"},
       {"key":"motor","label":"Motor","unit":"W","placeholder":"200 W"},
       {"key":"speed","label":"Speed","placeholder":"60 RPM"},
       {"key":"yield","label":"Measured yield","placeholder":"Stated for carrot, orange and spinach"},
       {"key":"feed_chute","label":"Feed chute","placeholder":"75 mm, whole apple"},
       {"key":"continuous_run","label":"Continuous run time","placeholder":"20 minutes"}]},
     {"key":"design","label":"Design","fields":[
       {"key":"auger","label":"Auger","placeholder":"Ultem, BPA free"},
       {"key":"strainers","label":"Strainers","placeholder":"Fine and coarse, plus a smoothie strainer"},
       {"key":"juice_jug","label":"Juice jug","placeholder":"1 L with froth separator"},
       {"key":"pulp_container","label":"Pulp container","placeholder":"1.4 L"},
       {"key":"reverse","label":"Reverse function","placeholder":"Yes, clears jams"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"60 dB"},
       {"key":"cleaning","label":"Cleaning","placeholder":"5 parts, dishwasher safe, brush included"},
       {"key":"dimensions","label":"Dimensions","placeholder":"230 x 200 x 450 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years product, 10 on the motor"}]}]'),

  -- ========================== FOOD PREP ==============================
  ('food-prep',
   '[{"key":"motor","label":"Motor"},{"key":"blades","label":"Blades"},
     {"key":"capacity","label":"Capacity"},{"key":"cleaning","label":"Cleaning"},
     {"key":"noise","label":"Noise"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"750 W"},
       {"key":"motor","label":"Motor","placeholder":"100% copper winding"},
       {"key":"speeds","label":"Speeds","placeholder":"3 plus pulse"},
       {"key":"capacity","label":"Capacity","placeholder":"1.5 L main jar"}]},
     {"key":"attachments","label":"Jars & attachments","fields":[
       {"key":"jars","label":"Jars","placeholder":"3 stainless steel"},
       {"key":"blades","label":"Blades","placeholder":"Hardened stainless steel"},
       {"key":"accessories","label":"Accessories","placeholder":"Spatula, recipe book"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"85 dB"},
       {"key":"dimensions","label":"Dimensions","placeholder":"200 x 250 x 300 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years product, 5 on the motor"}]}]'),

  ('mixer-grinders',
   '[{"key":"dry_grinding","label":"Dry grinding"},{"key":"wet_grinding","label":"Wet grinding"},
     {"key":"motor_life","label":"Motor life"},{"key":"noise","label":"Noise"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"750 W"},
       {"key":"motor","label":"Motor","placeholder":"100% copper, ball bearing, 20,000 RPM"},
       {"key":"speeds","label":"Speeds","placeholder":"3 plus pulse"},
       {"key":"overload_protection","label":"Overload protection","placeholder":"Manual reset button"},
       {"key":"dry_test","label":"Dry grinding test","placeholder":"Turmeric and coriander to a fine powder in 90 seconds"},
       {"key":"wet_test","label":"Wet grinding test","placeholder":"Idli batter, 500 g, without the jar heating"}]},
     {"key":"jars","label":"Jars & blades","fields":[
       {"key":"jars","label":"Jars","placeholder":"4 — 1.5 L wet, 1 L dry, 0.4 L chutney, juicer"},
       {"key":"jar_material","label":"Jar material","placeholder":"Stainless steel with polycarbonate lids"},
       {"key":"blades","label":"Blades","placeholder":"Hardened stainless steel, detachable"},
       {"key":"lids","label":"Lids","placeholder":"Flow breaker, leak resistant"},
       {"key":"couplers","label":"Couplers","placeholder":"Nylon, spares widely stocked"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"85 dB"},
       {"key":"body","label":"Body","placeholder":"ABS with rubber feet"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years product, 5 on the motor"},
       {"key":"service","label":"Service network","placeholder":"Pan-India, jars and couplers stocked"}]}]'),

  ('blenders',
   '[{"key":"blending","label":"Blending"},{"key":"ice","label":"Ice crushing"},
     {"key":"jar","label":"Jar design"},{"key":"cleaning","label":"Cleaning"},
     {"key":"noise","label":"Noise"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"1,200 W peak"},
       {"key":"speeds","label":"Speeds","placeholder":"Variable dial plus pulse"},
       {"key":"programs","label":"Programs","placeholder":"Smoothie, ice crush, self clean"},
       {"key":"blade","label":"Blade","placeholder":"6 prong, stainless steel, laser cut"},
       {"key":"smoothie_test","label":"Smoothie test","placeholder":"Frozen berries and spinach, smooth in 45 seconds"}]},
     {"key":"jar","label":"Jar","fields":[
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"1.5 L"},
       {"key":"material","label":"Material","placeholder":"Tritan, BPA free"},
       {"key":"design","label":"Jar design","placeholder":"Square profile for vortex disruption"},
       {"key":"tamper","label":"Tamper","placeholder":"Included"},
       {"key":"personal_cups","label":"Personal cups","placeholder":"2 x 600 ml with travel lids"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"88 dB on maximum"},
       {"key":"cleaning","label":"Cleaning","placeholder":"Self clean cycle, jar dishwasher safe"},
       {"key":"dimensions","label":"Dimensions","placeholder":"200 x 230 x 430 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"5 years"}]}]'),

  ('food-processors',
   '[{"key":"chopping","label":"Chopping"},{"key":"dough","label":"Dough"},
     {"key":"attachments","label":"Attachments"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"800 W"},
       {"key":"speeds","label":"Speeds","placeholder":"2 plus pulse"},
       {"key":"bowl_capacity","label":"Bowl capacity","unit":"L","placeholder":"3.5 L"},
       {"key":"dough_capacity","label":"Dough capacity","placeholder":"500 g of flour"},
       {"key":"feed_tube","label":"Feed tube","placeholder":"Wide, whole tomato"}]},
     {"key":"attachments","label":"Attachments","fields":[
       {"key":"discs","label":"Discs","placeholder":"Slicing, shredding, julienne, chipping"},
       {"key":"blades","label":"Blades","placeholder":"S-blade, dough blade, whisk"},
       {"key":"extras","label":"Extras","placeholder":"Citrus press, juicer jar, blender jar"},
       {"key":"storage","label":"Accessory storage","placeholder":"Box included"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"base","label":"Base","placeholder":"Non slip suction feet"},
       {"key":"dishwasher_safe","label":"Dishwasher safe","placeholder":"Bowl, lid and discs"},
       {"key":"dimensions","label":"Dimensions","placeholder":"250 x 300 x 420 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years product, 5 on the motor"}]}]'),

  ('stand-mixers',
   '[{"key":"dough","label":"Dough"},{"key":"mixing","label":"Mixing"},
     {"key":"stability","label":"Stability"},{"key":"attachments","label":"Attachments"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"300 W"},
       {"key":"motor_type","label":"Motor type","placeholder":"Direct drive, all-metal gearbox"},
       {"key":"speeds","label":"Speeds","placeholder":"10 plus fold"},
       {"key":"bowl_capacity","label":"Bowl capacity","unit":"L","placeholder":"4.8 L"},
       {"key":"flour_capacity","label":"Flour capacity","placeholder":"1.2 kg, or 9 dozen cookies"},
       {"key":"dough_test","label":"Dough test","placeholder":"Whether the head flexes on a stiff 65% hydration dough"}]},
     {"key":"attachments","label":"Attachments","fields":[
       {"key":"included","label":"Included","placeholder":"Flat beater, dough hook, wire whip"},
       {"key":"bowl_material","label":"Bowl material","placeholder":"Stainless steel with handle"},
       {"key":"head_type","label":"Head type","placeholder":"Tilt head"},
       {"key":"hub","label":"Attachment hub","placeholder":"Yes, 15 plus optional attachments"},
       {"key":"pouring_shield","label":"Pouring shield","placeholder":"Included"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"10.6 kg"},
       {"key":"dimensions","label":"Dimensions","placeholder":"370 x 240 x 360 mm"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"70 dB on speed 6"},
       {"key":"warranty","label":"Warranty","placeholder":"5 years"}]}]'),

  -- =========================== COOKWARE ==============================
  ('cookware',
   '[{"key":"heat","label":"Heat distribution"},{"key":"durability","label":"Durability"},
     {"key":"handling","label":"Handling"},{"key":"cleaning","label":"Cleaning"},
     {"key":"value","label":"Value"}]',
   '[{"key":"construction","label":"Construction","fields":[
       {"key":"material","label":"Material","placeholder":"Hard-anodised aluminium"},
       {"key":"coating","label":"Coating","placeholder":"3-layer non-stick, PFOA free"},
       {"key":"base","label":"Base","placeholder":"Induction base, 5 mm"},
       {"key":"thickness","label":"Thickness","unit":"mm","placeholder":"3.5 mm"}]},
     {"key":"fit","label":"Fit","fields":[
       {"key":"compatibility","label":"Compatibility","placeholder":"Gas and induction"},
       {"key":"oven_safe","label":"Oven safe","placeholder":"Up to 200 C, lid off"},
       {"key":"sizes","label":"Sizes","placeholder":"24 / 26 / 28 cm"},
       {"key":"capacity","label":"Capacity","placeholder":"2.5 L"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"handle","label":"Handle","placeholder":"Riveted bakelite, stay cool"},
       {"key":"dishwasher_safe","label":"Dishwasher safe","placeholder":"Hand wash recommended"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.1 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('nonstick-cookware',
   '[{"key":"release","label":"Food release"},{"key":"durability","label":"Coating durability"},
     {"key":"heat","label":"Heat distribution"},{"key":"handling","label":"Handling"},
     {"key":"value","label":"Value"}]',
   '[{"key":"construction","label":"Construction","fields":[
       {"key":"coating","label":"Coating","placeholder":"3-layer, PFOA free, granite finish"},
       {"key":"coating_life","label":"Expected coating life","placeholder":"3 to 4 years with wooden utensils"},
       {"key":"body","label":"Body","placeholder":"Hard-anodised aluminium"},
       {"key":"thickness","label":"Thickness","unit":"mm","placeholder":"3.5 mm"},
       {"key":"base","label":"Base","placeholder":"Induction plate, 5 mm, magnetic"}]},
     {"key":"fit","label":"Fit","fields":[
       {"key":"induction","label":"Induction compatible","placeholder":"Yes"},
       {"key":"oven_safe","label":"Oven safe","placeholder":"Up to 200 C, lid off"},
       {"key":"sizes","label":"Sizes","placeholder":"24 / 26 / 28 cm"},
       {"key":"capacity","label":"Capacity","placeholder":"2.5 L"},
       {"key":"lid","label":"Lid","placeholder":"Toughened glass with steam vent"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"handle","label":"Handle","placeholder":"Riveted bakelite, stay cool"},
       {"key":"utensil_safe","label":"Utensil safe","placeholder":"Wooden and silicone only"},
       {"key":"dishwasher_safe","label":"Dishwasher safe","placeholder":"Hand wash recommended"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"1.1 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years on the coating"}]}]'),

  ('pressure-cookers',
   '[{"key":"safety","label":"Safety"},{"key":"cook_time","label":"Cook time"},
     {"key":"build","label":"Build"},{"key":"spares","label":"Spares availability"},
     {"key":"value","label":"Value"}]',
   '[{"key":"construction","label":"Construction","fields":[
       {"key":"material","label":"Material","placeholder":"Hard-anodised aluminium"},
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"5 L"},
       {"key":"lid_type","label":"Lid type","placeholder":"Inner lid"},
       {"key":"base","label":"Base","placeholder":"Induction base, 4 mm"},
       {"key":"thickness","label":"Thickness","unit":"mm","placeholder":"3.25 mm"}]},
     {"key":"safety","label":"Safety","fields":[
       {"key":"safety_valve","label":"Safety valve","placeholder":"Metallic safety plug"},
       {"key":"gasket_release","label":"Gasket release system","placeholder":"Yes"},
       {"key":"pressure_indicator","label":"Pressure indicator","placeholder":"Yes"},
       {"key":"certification","label":"Certification","placeholder":"ISI marked"},
       {"key":"working_pressure","label":"Working pressure","placeholder":"1 bar, 15 psi"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"induction","label":"Induction compatible","placeholder":"Yes"},
       {"key":"cook_times","label":"Typical cook times","placeholder":"Rice 2 whistles, toor dal 4, rajma 8"},
       {"key":"spares","label":"Spares","placeholder":"Gasket and safety valve stocked nationally"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"2.3 kg"},
       {"key":"warranty","label":"Warranty","placeholder":"5 years"}]}]'),

  ('cast-iron-cookware',
   '[{"key":"heat_retention","label":"Heat retention"},{"key":"seasoning","label":"Seasoning"},
     {"key":"finish","label":"Surface finish"},{"key":"handling","label":"Handling"},
     {"key":"value","label":"Value"}]',
   '[{"key":"construction","label":"Construction","fields":[
       {"key":"material","label":"Material","placeholder":"Cast iron"},
       {"key":"seasoning","label":"Seasoning","placeholder":"Pre-seasoned with vegetable oil"},
       {"key":"surface","label":"Surface finish","placeholder":"Machine polished, smooth"},
       {"key":"thickness","label":"Thickness","unit":"mm","placeholder":"4 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"2.3 kg"}]},
     {"key":"fit","label":"Fit","fields":[
       {"key":"compatibility","label":"Compatibility","placeholder":"Gas, induction, oven, open flame"},
       {"key":"oven_safe","label":"Oven safe","placeholder":"Up to 250 C"},
       {"key":"sizes","label":"Sizes","placeholder":"26 cm"},
       {"key":"capacity","label":"Capacity","placeholder":"1.9 L"}]},
     {"key":"care","label":"Care & ownership","fields":[
       {"key":"care","label":"Care","placeholder":"Hand wash, dry on heat, wipe with oil"},
       {"key":"handle","label":"Handle","placeholder":"Integral cast, with a helper handle"},
       {"key":"included","label":"In the box","placeholder":"Pan and a silicone handle sleeve"},
       {"key":"warranty","label":"Warranty","placeholder":"Lifetime"}]}]'),

  ('kitchen-knives',
   '[{"key":"sharpness","label":"Out of box sharpness"},{"key":"edge_retention","label":"Edge retention"},
     {"key":"balance","label":"Balance"},{"key":"handle","label":"Handle"},
     {"key":"value","label":"Value"}]',
   '[{"key":"blade","label":"Blade","fields":[
       {"key":"steel","label":"Steel","placeholder":"VG-10 core, 67-layer damascus cladding"},
       {"key":"hardness","label":"Hardness","placeholder":"60 to 61 HRC"},
       {"key":"edge_angle","label":"Edge angle","placeholder":"15 degrees per side"},
       {"key":"length","label":"Blade length","unit":"cm","placeholder":"20 cm"},
       {"key":"profile","label":"Profile","placeholder":"Gyuto, gentle belly"},
       {"key":"finish","label":"Finish","placeholder":"Hand polished, hammered"}]},
     {"key":"handle","label":"Handle","fields":[
       {"key":"material","label":"Material","placeholder":"Stabilised pakkawood"},
       {"key":"tang","label":"Tang","placeholder":"Full tang, three rivets"},
       {"key":"balance_point","label":"Balance point","placeholder":"At the bolster"},
       {"key":"weight","label":"Weight","unit":"g","placeholder":"195 g"}]},
     {"key":"care","label":"Care & ownership","fields":[
       {"key":"sharpening","label":"Sharpening","placeholder":"Whetstone, 1000 and 6000 grit"},
       {"key":"dishwasher_safe","label":"Dishwasher safe","placeholder":"No — hand wash and dry immediately"},
       {"key":"included","label":"In the box","placeholder":"Knife, sheath, presentation box"},
       {"key":"warranty","label":"Warranty","placeholder":"Lifetime on manufacturing defects"}]}]'),

  -- ======================= LARGE APPLIANCES ==========================
  ('large-appliances',
   '[{"key":"performance","label":"Performance"},{"key":"efficiency","label":"Efficiency"},
     {"key":"noise","label":"Noise"},{"key":"build","label":"Build"},
     {"key":"service","label":"Service"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"capacity","label":"Capacity","placeholder":"300 L"},
       {"key":"star_rating","label":"Star rating","placeholder":"5 star, current BEE cycle"},
       {"key":"annual_energy","label":"Annual energy","placeholder":"189 kWh per year"},
       {"key":"technology","label":"Key technology","placeholder":"Inverter compressor"}]},
     {"key":"build","label":"Build","fields":[
       {"key":"material","label":"Material","placeholder":"Toughened glass shelves, steel body"},
       {"key":"finish","label":"Finish","placeholder":"Fingerprint resistant"},
       {"key":"dimensions","label":"Dimensions","placeholder":"595 x 650 x 1,700 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"58 kg"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"warranty","label":"Warranty","placeholder":"1 year product, 10 on the compressor"},
       {"key":"service","label":"Service network","placeholder":"Reach in tier 2 and tier 3 cities"},
       {"key":"installation","label":"Installation","placeholder":"Free, scheduled after delivery"},
       {"key":"running_cost","label":"Annual running cost","placeholder":"State the rupee figure at 8 per unit"}]}]'),

  ('refrigerators',
   '[{"key":"cooling","label":"Cooling"},{"key":"usable_space","label":"Usable space"},
     {"key":"efficiency","label":"Efficiency"},{"key":"noise","label":"Noise"},
     {"key":"service","label":"Service"},{"key":"value","label":"Value"}]',
   '[{"key":"capacity","label":"Capacity","fields":[
       {"key":"type","label":"Type","placeholder":"Frost free, double door, bottom mount"},
       {"key":"gross_capacity","label":"Gross capacity","unit":"L","placeholder":"336 L"},
       {"key":"usable_capacity","label":"Usable capacity","placeholder":"Measured with the shelves in place"},
       {"key":"freezer_capacity","label":"Freezer capacity","unit":"L","placeholder":"96 L"},
       {"key":"shelves","label":"Shelves","placeholder":"3 toughened glass, one foldable"},
       {"key":"door_bins","label":"Door bins","placeholder":"4, one bottle rack"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"star_rating","label":"Star rating","placeholder":"3 star, current BEE cycle"},
       {"key":"annual_energy","label":"Annual energy","placeholder":"189 kWh per year"},
       {"key":"compressor","label":"Compressor","placeholder":"Inverter, 10-year warranty"},
       {"key":"cooling","label":"Cooling","placeholder":"Multi air flow, separate vegetable humidity"},
       {"key":"stabiliser_free","label":"Stabiliser free operation","placeholder":"100 to 300 V"},
       {"key":"convertible","label":"Convertible modes","placeholder":"5, freezer to fridge"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"38 dB"},
       {"key":"dimensions","label":"Dimensions","placeholder":"595 x 650 x 1,700 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"58 kg"},
       {"key":"running_cost","label":"Annual running cost","placeholder":"State the rupee figure at 8 per unit"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year product, 10 on the compressor"}]}]'),

  ('washing-machines',
   '[{"key":"wash","label":"Wash quality"},{"key":"water","label":"Water use"},
     {"key":"spin","label":"Spin"},{"key":"noise","label":"Noise"},
     {"key":"build","label":"Build"},{"key":"value","label":"Value"}]',
   '[{"key":"capacity","label":"Capacity & drum","fields":[
       {"key":"type","label":"Type","placeholder":"Front load"},
       {"key":"capacity","label":"Capacity","unit":"kg","placeholder":"8 kg"},
       {"key":"drum","label":"Drum","placeholder":"Stainless steel, honeycomb"},
       {"key":"spin_speed","label":"Spin speed","placeholder":"1,400 RPM"},
       {"key":"programs","label":"Programs","placeholder":"16, including a 15-minute refresh"},
       {"key":"inbuilt_heater","label":"Inbuilt heater","placeholder":"Yes, up to 90 C"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"star_rating","label":"Star rating","placeholder":"5 star"},
       {"key":"water_per_cycle","label":"Water per cycle","unit":"L","placeholder":"48 L on cotton eco"},
       {"key":"cycle_time","label":"Cycle time","placeholder":"195 minutes eco, 39 minutes quick"},
       {"key":"motor","label":"Motor","placeholder":"Direct drive inverter, 10-year warranty"},
       {"key":"steam","label":"Steam","placeholder":"Yes, allergy cycle"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","placeholder":"52 dB washing, 72 dB spinning"},
       {"key":"dimensions","label":"Dimensions","placeholder":"600 x 550 x 850 mm"},
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"68 kg"},
       {"key":"installation","label":"Installation","placeholder":"Free, inlet and drain point needed"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years product, 10 on the motor"}]}]'),

  ('dishwashers',
   '[{"key":"cleaning","label":"Cleaning"},{"key":"utensils","label":"Fit for your utensils"},
     {"key":"water","label":"Water use"},{"key":"noise","label":"Noise"},
     {"key":"value","label":"Value"}]',
   '[{"key":"capacity","label":"Capacity","fields":[
       {"key":"place_settings","label":"Place settings","placeholder":"13"},
       {"key":"programs","label":"Programs","placeholder":"8, including an intensive kadai cycle"},
       {"key":"racks","label":"Racks","placeholder":"3, height-adjustable middle basket"},
       {"key":"tall_item_clearance","label":"Tall item clearance","placeholder":"Fits a 30 cm pressure cooker"},
       {"key":"cutlery","label":"Cutlery","placeholder":"Third-level tray"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"water_per_cycle","label":"Water per cycle","unit":"L","placeholder":"9.5 L on eco"},
       {"key":"star_rating","label":"Star rating","placeholder":"5 star"},
       {"key":"cycle_time","label":"Cycle time","placeholder":"195 minutes eco, 60 minutes quick"},
       {"key":"drying","label":"Drying","placeholder":"Condensation, with a door auto-open"},
       {"key":"hot_water_inlet","label":"Hot water inlet","placeholder":"Supported, up to 60 C"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"44 dB"},
       {"key":"dimensions","label":"Dimensions","placeholder":"600 x 600 x 845 mm"},
       {"key":"installation","label":"Installation","placeholder":"Free standing, needs inlet, drain and a 16 A socket"},
       {"key":"consumables","label":"Consumables","placeholder":"Salt, rinse aid and tablets — state the monthly cost"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('air-conditioners',
   '[{"key":"cooling","label":"Cooling"},{"key":"efficiency","label":"Efficiency"},
     {"key":"noise","label":"Noise"},{"key":"air_quality","label":"Air quality"},
     {"key":"service","label":"Service"},{"key":"value","label":"Value"}]',
   '[{"key":"cooling","label":"Cooling","fields":[
       {"key":"capacity","label":"Capacity","placeholder":"1.5 ton"},
       {"key":"type","label":"Type","placeholder":"Split, inverter"},
       {"key":"iseer","label":"ISEER","placeholder":"5.2"},
       {"key":"star_rating","label":"Star rating","placeholder":"5 star, current BEE cycle"},
       {"key":"capacity_range","label":"Cooling capacity range","placeholder":"500 to 5,600 W"},
       {"key":"room_size","label":"Suited to","placeholder":"Rooms up to 150 sq ft"}]},
     {"key":"performance","label":"Performance","fields":[
       {"key":"compressor","label":"Compressor","placeholder":"Twin rotary inverter, 100% copper"},
       {"key":"annual_energy","label":"Annual energy","placeholder":"790 units per year at BEE test conditions"},
       {"key":"operating_range","label":"Operating range","placeholder":"Cools up to 52 C ambient"},
       {"key":"refrigerant","label":"Refrigerant","placeholder":"R32"},
       {"key":"filtration","label":"Filtration","placeholder":"PM 2.5 filter, washable"},
       {"key":"modes","label":"Modes","placeholder":"Turbo, sleep, dry, 4-in-1 convertible"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"32 dB indoor on low"},
       {"key":"running_cost","label":"Annual running cost","placeholder":"State the rupee figure at 8 per unit, 8 hours a day"},
       {"key":"installation","label":"Installation","placeholder":"Chargeable, copper piping beyond 3 m extra"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year product, 5 on the PCB, 10 on the compressor"}]}]'),

  -- ======================== HOME ESSENTIALS ==========================
  ('home-essentials',
   '[{"key":"performance","label":"Performance"},{"key":"consumables","label":"Consumables"},
     {"key":"noise","label":"Noise"},{"key":"build","label":"Build"},
     {"key":"running_cost","label":"Running cost"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"power","label":"Power","unit":"W","placeholder":"45 W"},
       {"key":"capacity","label":"Capacity","placeholder":"8 L"},
       {"key":"coverage","label":"Coverage","placeholder":"Up to 500 sq ft"},
       {"key":"technology","label":"Technology","placeholder":"HEPA, RO, or cyclonic — state which"}]},
     {"key":"consumables","label":"Consumables","fields":[
       {"key":"consumable_type","label":"Consumable","placeholder":"Filter set"},
       {"key":"consumable_life","label":"Life","placeholder":"8 to 12 months"},
       {"key":"consumable_cost","label":"Replacement cost","placeholder":"State the rupee figure per set"},
       {"key":"indicator","label":"Replacement indicator","placeholder":"Yes, on the display"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"24 to 52 dB"},
       {"key":"dimensions","label":"Dimensions","placeholder":"340 x 340 x 690 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year"},
       {"key":"service","label":"Service","placeholder":"Annual contract price, if one is needed"}]}]'),

  ('vacuum-cleaners',
   '[{"key":"suction","label":"Suction"},{"key":"run_time","label":"Run time"},
     {"key":"filtration","label":"Filtration"},{"key":"emptying","label":"Emptying"},
     {"key":"noise","label":"Noise"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"type","label":"Type","placeholder":"Cordless stick, convertible to handheld"},
       {"key":"suction","label":"Suction","placeholder":"150 AW"},
       {"key":"motor","label":"Motor","placeholder":"Digital, 125,000 RPM"},
       {"key":"modes","label":"Modes","placeholder":"Eco, auto, boost"},
       {"key":"filtration","label":"Filtration","placeholder":"Whole machine sealed HEPA"},
       {"key":"floor_heads","label":"Floor heads","placeholder":"Motorised, plus a soft roller"}]},
     {"key":"power","label":"Power","fields":[
       {"key":"battery","label":"Battery","placeholder":"Removable, click-in"},
       {"key":"rated_run_time","label":"Rated run time","placeholder":"60 minutes in eco"},
       {"key":"measured_run_time","label":"Measured run time","placeholder":"12 minutes on boost with the motorised head"},
       {"key":"charge_time","label":"Charge time","placeholder":"4.5 hours"},
       {"key":"bin_capacity","label":"Bin capacity","unit":"L","placeholder":"0.77 L"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"weight","label":"Weight","unit":"kg","placeholder":"3.1 kg"},
       {"key":"tools","label":"Tools included","placeholder":"Crevice, combination, mini motorised"},
       {"key":"noise","label":"Measured noise","unit":"dB","placeholder":"78 dB on boost"},
       {"key":"filters","label":"Filter replacement","placeholder":"Washable, replace every 12 months"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('air-purifiers',
   '[{"key":"cadr","label":"CADR"},{"key":"filtration","label":"Filtration"},
     {"key":"coverage","label":"Coverage"},{"key":"noise","label":"Noise"},
     {"key":"running_cost","label":"Running cost"},{"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"cadr","label":"CADR","placeholder":"400 m3/hr"},
       {"key":"coverage","label":"Coverage","placeholder":"Up to 500 sq ft"},
       {"key":"ach","label":"Air changes per hour","placeholder":"4.8 at 500 sq ft"},
       {"key":"filtration","label":"Filtration stages","placeholder":"Pre-filter, H13 HEPA, activated carbon"},
       {"key":"sensor","label":"Sensor","placeholder":"Laser PM2.5, with a numeric readout"},
       {"key":"extras","label":"Extras","placeholder":"VOC sensor, formaldehyde filter"}]},
     {"key":"consumables","label":"Consumables","fields":[
       {"key":"filter_life","label":"Filter life","placeholder":"8 to 12 months in Delhi winter conditions"},
       {"key":"filter_cost","label":"Filter cost","placeholder":"State the rupee figure per set"},
       {"key":"indicator","label":"Filter indicator","placeholder":"Percentage remaining, in the app"},
       {"key":"washable_prefilter","label":"Washable pre-filter","placeholder":"Yes"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"noise","label":"Measured noise","placeholder":"24 dB on sleep, 52 dB on maximum"},
       {"key":"power","label":"Power draw","unit":"W","placeholder":"45 W on maximum"},
       {"key":"dimensions","label":"Dimensions","placeholder":"340 x 340 x 690 mm"},
       {"key":"controls","label":"Controls","placeholder":"App, display, voice assistants"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years"}]}]'),

  ('water-purifiers',
   '[{"key":"fit","label":"Fit for your water"},{"key":"taste","label":"Taste"},
     {"key":"storage","label":"Storage"},{"key":"service_cost","label":"Service cost"},
     {"key":"value","label":"Value"}]',
   '[{"key":"purification","label":"Purification","fields":[
       {"key":"technology","label":"Technology","placeholder":"RO plus UV plus UF with TDS control"},
       {"key":"suitable_tds","label":"Suitable input TDS","placeholder":"Up to 2,000 ppm"},
       {"key":"stages","label":"Stages","placeholder":"8"},
       {"key":"output","label":"Output rate","placeholder":"15 L per hour"},
       {"key":"mineraliser","label":"Mineraliser","placeholder":"Yes, copper and mineral cartridge"},
       {"key":"waste_ratio","label":"Waste water ratio","placeholder":"1:1, with a reject water outlet"}]},
     {"key":"storage","label":"Storage","fields":[
       {"key":"tank_capacity","label":"Tank capacity","unit":"L","placeholder":"8 L"},
       {"key":"tank_material","label":"Tank material","placeholder":"Food grade, ABS"},
       {"key":"auto_shutoff","label":"Auto shut-off","placeholder":"Yes, on full tank"},
       {"key":"indicators","label":"Indicators","placeholder":"Water level, purification, filter change"}]},
     {"key":"ownership","label":"Ownership","fields":[
       {"key":"filter_life","label":"Filter life","placeholder":"6,000 L or 12 months, whichever first"},
       {"key":"annual_service","label":"Annual service cost","placeholder":"State the AMC rupee figure"},
       {"key":"installation","label":"Installation","placeholder":"Free, wall mount, needs a tap point and a socket"},
       {"key":"dimensions","label":"Dimensions","placeholder":"370 x 260 x 480 mm"},
       {"key":"warranty","label":"Warranty","placeholder":"1 year"}]}]'),

  ('water-heaters',
   '[{"key":"heating","label":"Heating"},{"key":"efficiency","label":"Efficiency"},
     {"key":"tank_life","label":"Tank life"},{"key":"safety","label":"Safety"},
     {"key":"value","label":"Value"}]',
   '[{"key":"performance","label":"Performance","fields":[
       {"key":"type","label":"Type","placeholder":"Storage, vertical"},
       {"key":"capacity","label":"Capacity","unit":"L","placeholder":"25 L"},
       {"key":"power","label":"Power","unit":"W","placeholder":"2,000 W"},
       {"key":"star_rating","label":"Star rating","placeholder":"5 star"},
       {"key":"heat_up_time","label":"Measured heat-up time","placeholder":"22 minutes for 25 L from 20 C"},
       {"key":"standing_loss","label":"Standing loss","placeholder":"0.60 kWh in 24 hours"}]},
     {"key":"build","label":"Build","fields":[
       {"key":"tank","label":"Tank","placeholder":"Glass-lined steel"},
       {"key":"anode","label":"Anode rod","placeholder":"Magnesium, replaceable"},
       {"key":"insulation","label":"Insulation","placeholder":"High-density PUF"},
       {"key":"max_pressure","label":"Maximum pressure","placeholder":"8 bar, suits high-rise supply"},
       {"key":"hard_water","label":"Hard water suitability","placeholder":"Up to 500 ppm"}]},
     {"key":"safety","label":"Safety & ownership","fields":[
       {"key":"thermostat","label":"Thermostat","placeholder":"Adjustable, 25 to 75 C"},
       {"key":"cutout","label":"Thermal cut-out","placeholder":"Yes"},
       {"key":"safety_valve","label":"Safety valve","placeholder":"Multi-function, included"},
       {"key":"installation","label":"Installation","placeholder":"Chargeable, wall mount"},
       {"key":"warranty","label":"Warranty","placeholder":"2 years product, 5 on the tank"}]}]')
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
