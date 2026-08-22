/**
 * Mock fixtures for design/development. Shapes match backend/app/schemas
 * exactly, so swapping NEXT_PUBLIC_USE_MOCKS=0 changes the transport and
 * nothing else.
 *
 * These live behind lib/api.ts and are never imported by a component directly.
 */
import type {
  Badge,
  Brand,
  Category,
  HomepageSection,
  Product,
  ProductSummary,
  Review,
  ScoreCriterionDef,
  SpecTemplateGroup,
} from "../types";

/* ------------------------------------------------------------------ */
/* Badges (spec §21)                                                   */
/* ------------------------------------------------------------------ */
export const badges: Record<string, Badge> = {
  top: { id: "b1", name: "Top Recommendation", slug: "top-recommendation", style: "editorial", icon: null, isActive: true },
  editors: { id: "b2", name: "Editor's Choice", slug: "editors-choice", style: "editorial", icon: null, isActive: true },
  value: { id: "b3", name: "Best Value", slug: "best-value", style: "value", icon: null, isActive: true },
  worthIt: { id: "b4", name: "Worth It", slug: "worth-it", style: "value", icon: null, isActive: true },
  gaming: { id: "b5", name: "Best for Gaming", slug: "best-for-gaming", style: "brand", icon: null, isActive: true },
  premium: { id: "b6", name: "Premium Pick", slug: "premium-pick", style: "brand", icon: null, isActive: true },
  fresh: { id: "b7", name: "New", slug: "new", style: "neutral", icon: null, isActive: true },
};

/* ------------------------------------------------------------------ */
/* Categories — hierarchical (spec §23)                                */
/* ------------------------------------------------------------------ */
function cat(
  id: string,
  name: string,
  slug: string,
  path: string[],
  order: number,
  extra: Partial<Category> = {},
): Category {
  return {
    id,
    name,
    slug,
    path,
    displayOrder: order,
    isActive: true,
    showOnHomepage: true,
    parentId: null,
    ...extra,
  };
}

function leaf(
  id: string,
  name: string,
  slug: string,
  parentSlug: string,
  parentId: string,
  order: number,
  icon: string,
): Category {
  return cat(id, name, slug, ["electronics", parentSlug, slug], order, {
    icon,
    parentId,
    showOnHomepage: false,
  });
}

export const categories: Category[] = [
  /* Second level — these are the homepage tiles. */
  cat("c1", "Audio", "audio", ["electronics", "audio"], 1, { icon: "headphones", productCount: 48, description: "Headphones, earbuds and speakers — ranked by how they actually sound, not by spec sheet." }),
  cat("c2", "Computers", "computers", ["electronics", "computers"], 2, { icon: "laptop", productCount: 62 }),
  cat("c3", "Mobiles", "mobiles", ["electronics", "mobiles"], 3, { icon: "smartphone", productCount: 37 }),
  cat("c4", "Gaming", "gaming", ["electronics", "gaming"], 4, { icon: "gamepad", productCount: 44 }),
  cat("c5", "Cameras", "cameras", ["electronics", "cameras"], 5, { icon: "camera", productCount: 21 }),
  cat("c6", "Wearables", "wearables", ["electronics", "wearables"], 6, { icon: "watch", productCount: 29 }),
  cat("c7", "Smart Home", "smart-home", ["electronics", "smart-home"], 7, { icon: "home", productCount: 33 }),
  cat("c8", "Accessories", "accessories", ["electronics", "accessories"], 8, { icon: "cable", productCount: 71 }),

  /* Third level. Products are filed HERE, not on the tile above them — that
     is what gives a mouse the mouse template instead of the audio one. Only
     the leaves these fixtures actually use are listed; the real tree has the
     rest (see 20260820000007_category_tree_seed.sql). */
  leaf("c11", "Headphones", "headphones", "audio", "c1", 1, "headphones"),
  leaf("c12", "Earbuds", "earbuds", "audio", "c1", 2, "headphones"),
  leaf("c21", "Laptops", "laptops", "computers", "c2", 1, "laptop"),
  leaf("c22", "Mice", "mice", "computers", "c2", 4, "cable"),
  leaf("c31", "Smartphones", "smartphones", "mobiles", "c3", 1, "smartphone"),
  leaf("c41", "Gaming Monitors", "gaming-monitors", "gaming", "c4", 2, "monitor"),
  leaf("c51", "Mirrorless", "mirrorless", "cameras", "c5", 1, "camera"),
  leaf("c61", "Smartwatches", "smartwatches", "wearables", "c6", 1, "watch"),
];

/* ------------------------------------------------------------------ */
/* Brands (spec §22)                                                   */
/* ------------------------------------------------------------------ */
export const brands: Brand[] = [
  { id: "br1", name: "Sony", slug: "sony", isPinned: true, displayOrder: 1, productCount: 34 },
  { id: "br2", name: "Samsung", slug: "samsung", isPinned: true, displayOrder: 2, productCount: 41 },
  { id: "br3", name: "Logitech", slug: "logitech", isPinned: true, displayOrder: 3, productCount: 28 },
  { id: "br4", name: "Nothing", slug: "nothing", isPinned: true, displayOrder: 4, productCount: 12 },
  { id: "br5", name: "Apple", slug: "apple", isPinned: true, displayOrder: 5, productCount: 26 },
  { id: "br6", name: "Bose", slug: "bose", isPinned: true, displayOrder: 6, productCount: 17 },
  { id: "br7", name: "Sennheiser", slug: "sennheiser", isPinned: true, displayOrder: 7, productCount: 19 },
  { id: "br8", name: "Asus", slug: "asus", isPinned: true, displayOrder: 8, productCount: 31 },
];

const brandBy = (slug: string) => {
  const b = brands.find((x) => x.slug === slug)!;
  return { id: b.id, name: b.name, slug: b.slug };
};
const catBy = (slug: string) => {
  const c = categories.find((x) => x.slug === slug)!;
  return { id: c.id, name: c.name, slug: c.slug, path: c.path };
};

/* Placeholder imagery. Replace with object-storage URLs once media lands. */
const img = (id: string, seed: string) => ({
  id,
  kind: "image" as const,
  url: `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=1200&q=80`,
  alt: null,
  displayOrder: 0,
});

/* ------------------------------------------------------------------ */
/* Category templates (spec §24, §41)                                  */
/*                                                                      */
/* Mirrors 20260822000013_category_templates.sql. A mouse is not scored  */
/* on noise cancellation and has no frequency response, so the criteria  */
/* and specification fields are properties of the CATEGORY. Before this  */
/* existed, productDetail() handed every product the same headphone      */
/* block, and an MX Master 3S listed a 30mm driver.                      */
/* ------------------------------------------------------------------ */
interface CategoryTemplate {
  criteria: ScoreCriterionDef[];
  specs: SpecTemplateGroup[];
}

/** Terse group builder — these fixtures need keys and labels, nothing else. */
const specGroup = (
  key: string,
  label: string,
  fields: [string, string][],
): SpecTemplateGroup => ({
  key,
  label,
  fields: fields.map(([k, l]) => ({ key: k, label: l })),
});

export const categoryTemplates: Record<string, CategoryTemplate> = {
  headphones: {
    criteria: [
      { key: "sound", label: "Sound" },
      { key: "anc", label: "Noise cancellation" },
      { key: "comfort", label: "Comfort" },
      { key: "battery", label: "Battery" },
      { key: "mic", label: "Call quality" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("audio", "Audio", [
        ["driver", "Driver"],
        ["frequency_response", "Frequency response"],
        ["codecs", "Codecs"],
        ["anc", "Noise cancellation"],
      ]),
      specGroup("power", "Battery & power", [
        ["battery_anc_on", "Playback (ANC on)"],
        ["quick_charge", "Quick charge"],
        ["charging", "Charging"],
      ]),
      specGroup("physical", "Physical", [
        ["weight", "Weight"],
        ["connectivity", "Connectivity"],
        ["folding", "Folds flat"],
        ["water_resistance", "Water resistance"],
      ]),
    ],
  },

  earbuds: {
    criteria: [
      { key: "sound", label: "Sound" },
      { key: "anc", label: "Noise cancellation" },
      { key: "fit", label: "Fit & seal" },
      { key: "battery", label: "Battery" },
      { key: "mic", label: "Call quality" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("audio", "Audio", [
        ["driver", "Driver"],
        ["codecs", "Codecs"],
        ["anc", "Noise cancellation"],
        ["transparency", "Transparency mode"],
      ]),
      specGroup("power", "Battery & power", [
        ["battery_buds", "Buds (ANC on)"],
        ["battery_case", "With case"],
        ["charging", "Charging"],
      ]),
      specGroup("physical", "Physical", [
        ["weight_bud", "Weight per bud"],
        ["tips", "Ear tips included"],
        ["water_resistance", "Water resistance"],
        ["connectivity", "Connectivity"],
      ]),
    ],
  },

  mice: {
    criteria: [
      { key: "ergonomics", label: "Ergonomics" },
      { key: "sensor", label: "Sensor accuracy" },
      { key: "buttons", label: "Buttons & scroll" },
      { key: "build", label: "Build" },
      { key: "software", label: "Software" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("sensor", "Sensor & tracking", [
        ["sensor", "Sensor"],
        ["max_dpi", "Max DPI"],
        ["max_speed", "Max speed"],
        ["polling_rate", "Polling rate"],
      ]),
      specGroup("controls", "Buttons & scroll", [
        ["buttons", "Buttons"],
        ["switches", "Switch rating"],
        ["scroll", "Scroll wheel"],
        ["thumb_wheel", "Thumb wheel"],
      ]),
      specGroup("connectivity", "Connectivity & power", [
        ["connection", "Connection"],
        ["battery_life", "Battery life"],
        ["quick_charge", "Quick charge"],
        ["multi_device", "Multi-device"],
      ]),
      specGroup("physical", "Physical", [
        ["weight", "Weight"],
        ["dimensions", "Dimensions"],
        ["hand", "Hand orientation"],
        ["grip", "Grip style"],
      ]),
    ],
  },

  laptops: {
    criteria: [
      { key: "performance", label: "Performance" },
      { key: "display", label: "Display" },
      { key: "battery", label: "Battery" },
      { key: "keyboard", label: "Keyboard & trackpad" },
      { key: "build", label: "Build" },
      { key: "thermals", label: "Thermals & noise" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("performance", "Performance", [
        ["processor", "Processor"],
        ["graphics", "Graphics"],
        ["memory", "Memory"],
        ["storage", "Storage"],
      ]),
      specGroup("display", "Display", [
        ["size", "Size"],
        ["resolution", "Resolution"],
        ["panel", "Panel"],
        ["refresh_rate", "Refresh rate"],
      ]),
      specGroup("power", "Battery & power", [
        ["battery_capacity", "Battery"],
        ["battery_life", "Rated battery life"],
        ["charger", "Charger"],
      ]),
      specGroup("connectivity", "Ports & wireless", [
        ["ports", "Ports"],
        ["wireless", "Wireless"],
        ["webcam", "Webcam"],
      ]),
      specGroup("physical", "Physical", [
        ["weight", "Weight"],
        ["dimensions", "Dimensions"],
        ["os", "Operating system"],
      ]),
    ],
  },

  smartphones: {
    criteria: [
      { key: "camera", label: "Camera" },
      { key: "performance", label: "Performance" },
      { key: "battery", label: "Battery" },
      { key: "display", label: "Display" },
      { key: "software", label: "Software & updates" },
      { key: "build", label: "Build" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("display", "Display", [
        ["size", "Size"],
        ["resolution", "Resolution"],
        ["panel", "Panel"],
        ["refresh_rate", "Refresh rate"],
        ["peak_brightness", "Peak brightness"],
      ]),
      specGroup("performance", "Performance", [
        ["processor", "Processor"],
        ["memory", "Memory"],
        ["storage", "Storage"],
      ]),
      specGroup("camera", "Camera", [
        ["main_camera", "Main"],
        ["ultrawide", "Ultra-wide"],
        ["telephoto", "Telephoto"],
        ["front_camera", "Front"],
        ["video", "Video"],
      ]),
      specGroup("power", "Battery & charging", [
        ["battery_capacity", "Battery"],
        ["wired_charging", "Wired charging"],
        ["wireless_charging", "Wireless charging"],
      ]),
      specGroup("physical", "Physical & software", [
        ["weight", "Weight"],
        ["dimensions", "Dimensions"],
        ["water_resistance", "Water resistance"],
        ["sim", "SIM"],
        ["os", "Operating system"],
        ["update_policy", "Update policy"],
      ]),
    ],
  },

  "gaming-monitors": {
    criteria: [
      { key: "motion", label: "Motion clarity" },
      { key: "latency", label: "Input latency" },
      { key: "image", label: "Image quality" },
      { key: "colour", label: "Colour accuracy" },
      { key: "features", label: "Gaming features" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("panel", "Panel", [
        ["size", "Size"],
        ["resolution", "Resolution"],
        ["panel_type", "Panel type"],
        ["refresh_rate", "Refresh rate"],
        ["response_time", "Response time"],
        ["curvature", "Curvature"],
      ]),
      specGroup("gaming", "Gaming features", [
        ["adaptive_sync", "Adaptive sync"],
        ["hdr", "HDR"],
        ["input_lag", "Measured input lag"],
      ]),
      specGroup("connectivity", "Connectivity", [
        ["inputs", "Inputs"],
        ["usb_hub", "USB hub"],
        ["usb_c", "USB-C"],
      ]),
      specGroup("physical", "Stand & physical", [
        ["adjustment", "Adjustment"],
        ["vesa", "VESA mount"],
        ["burn_in_cover", "Burn-in warranty"],
      ]),
    ],
  },

  mirrorless: {
    criteria: [
      { key: "image", label: "Image quality" },
      { key: "autofocus", label: "Autofocus" },
      { key: "video", label: "Video" },
      { key: "handling", label: "Handling & controls" },
      { key: "lenses", label: "Lens ecosystem" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("sensor", "Sensor & processing", [
        ["sensor", "Sensor"],
        ["processor", "Processor"],
        ["iso_range", "ISO range"],
        ["stabilisation", "Stabilisation"],
      ]),
      specGroup("autofocus", "Autofocus & speed", [
        ["af_points", "AF points"],
        ["subject_detection", "Subject detection"],
        ["burst_rate", "Burst rate"],
        ["shutter_speed", "Shutter speed"],
      ]),
      specGroup("video", "Video", [
        ["max_video", "Max video"],
        ["log_profile", "Log profile"],
        ["recording_limit", "Recording limit"],
      ]),
      specGroup("body", "Body", [
        ["mount", "Lens mount"],
        ["viewfinder", "Viewfinder"],
        ["screen", "Screen"],
        ["card_slots", "Card slots"],
        ["weight", "Weight"],
        ["battery_life", "Battery life"],
        ["weather_sealing", "Weather sealing"],
      ]),
    ],
  },

  smartwatches: {
    criteria: [
      { key: "tracking", label: "Tracking accuracy" },
      { key: "battery", label: "Battery" },
      { key: "comfort", label: "Comfort" },
      { key: "software", label: "Software & apps" },
      { key: "health", label: "Health features" },
      { key: "value", label: "Value" },
    ],
    specs: [
      specGroup("display", "Display", [
        ["size", "Case size"],
        ["panel", "Panel"],
        ["resolution", "Resolution"],
        ["brightness", "Peak brightness"],
        ["glass", "Glass"],
      ]),
      specGroup("health", "Health & sensors", [
        ["heart_rate", "Heart rate"],
        ["ecg", "ECG"],
        ["spo2", "Blood oxygen"],
        ["sleep", "Sleep tracking"],
        ["gps", "GPS"],
      ]),
      specGroup("platform", "Platform", [
        ["os", "Operating system"],
        ["processor", "Processor"],
        ["storage", "Storage"],
        ["phone_support", "Phone support"],
        ["connectivity", "Connectivity"],
      ]),
      specGroup("physical", "Battery & physical", [
        ["battery_capacity", "Battery"],
        ["battery_life", "Battery life"],
        ["charging", "Charging"],
        ["weight", "Weight"],
        ["water_resistance", "Water resistance"],
        ["strap", "Strap width"],
      ]),
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */
type Seed = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  /** Leaf category slug — that is what selects the template. */
  category: string;
  tagline: string;
  score: number;
  current: number;
  min: number;
  max: number;
  badges: Badge[];
  rating: [number, number];
  photo: string;
  /** Criterion key → 0–10. Keys must exist in the category's template. */
  scores: Record<string, number>;
  /** "groupKey.fieldKey" → value. Same contract as the admin spec editor. */
  specs: Record<string, string>;
};

const seeds: Seed[] = [
  {
    id: "p1", title: "WH-1000XM5", slug: "sony-wh-1000xm5", brand: "sony", category: "headphones",
    tagline: "Class-leading noise cancellation with the best call quality in its price band.",
    score: 9.4, current: 24990, min: 22990, max: 29990,
    badges: [badges.top, badges.worthIt], rating: [4.6, 128], photo: "photo-1505740420928-5e560c06d30e",
    scores: { sound: 9.2, anc: 9.6, comfort: 8.8, battery: 9.0, mic: 9.1, value: 8.4 },
    specs: {
      "audio.driver": "30mm carbon fibre composite",
      "audio.frequency_response": "4 Hz – 40,000 Hz",
      "audio.codecs": "SBC, AAC, LDAC",
      "audio.anc": "Adaptive, 8 microphones",
      "power.battery_anc_on": "30 hours",
      "power.quick_charge": "3 min → 3 hours",
      "power.charging": "USB-C",
      "physical.weight": "250 g",
      "physical.connectivity": "Bluetooth 5.2, Multipoint",
      "physical.folding": "Swivel only",
      "physical.water_resistance": "None",
    },
  },
  {
    id: "p2", title: "Ear (a)", slug: "nothing-ear-a", brand: "nothing", category: "earbuds",
    tagline: "The most interesting design under ₹10,000, and the ANC finally keeps up with it.",
    score: 8.6, current: 7499, min: 6999, max: 8999,
    badges: [badges.value, badges.fresh], rating: [4.4, 312], photo: "photo-1590658268037-6bf12165a8df",
    scores: { sound: 8.7, anc: 8.4, fit: 8.8, battery: 8.9, mic: 8.0, value: 9.3 },
    specs: {
      "audio.driver": "11mm dynamic",
      "audio.codecs": "SBC, AAC, LDAC",
      "audio.anc": "Hybrid ANC, up to 45 dB",
      "audio.transparency": "Yes",
      "power.battery_buds": "5.5 hours",
      "power.battery_case": "24 hours",
      "power.charging": "USB-C",
      "physical.weight_bud": "4.8 g",
      "physical.tips": "S / M / L",
      "physical.water_resistance": "IP54",
      "physical.connectivity": "Bluetooth 5.3, Multipoint",
    },
  },
  {
    id: "p3", title: "MX Master 3S", slug: "logitech-mx-master-3s", brand: "logitech", category: "mice",
    tagline: "Still the mouse to beat for long working days — quiet clicks, flawless scroll.",
    score: 9.1, current: 8495, min: 7995, max: 10995,
    badges: [badges.editors, badges.worthIt], rating: [4.7, 486], photo: "photo-1527864550417-7fd91fc51a46",
    scores: { ergonomics: 9.4, sensor: 8.9, buttons: 9.5, build: 9.0, software: 8.6, value: 8.5 },
    specs: {
      "sensor.sensor": "Darkfield high precision",
      "sensor.max_dpi": "8,000 DPI",
      "sensor.max_speed": "Tracks on glass, 4mm+",
      "sensor.polling_rate": "125 Hz",
      "controls.buttons": "7 programmable",
      "controls.switches": "Quiet, 90% less click noise",
      "controls.scroll": "MagSpeed electromagnetic, 1,000 lines/sec",
      "controls.thumb_wheel": "Yes, horizontal",
      "connectivity.connection": "Bluetooth LE, Logi Bolt, USB-C",
      "connectivity.battery_life": "70 days",
      "connectivity.quick_charge": "1 min → 3 hours",
      "connectivity.multi_device": "Up to 3, Flow across machines",
      "physical.weight": "141 g",
      "physical.dimensions": "124.9 × 84.3 × 51 mm",
      "physical.hand": "Right-handed",
      "physical.grip": "Palm",
    },
  },
  {
    id: "p4", title: "Galaxy S24", slug: "samsung-galaxy-s24", brand: "samsung", category: "smartphones",
    tagline: "The compact flagship that doesn't compromise the camera to stay small.",
    score: 8.9, current: 66999, min: 61999, max: 79999,
    badges: [badges.premium], rating: [4.5, 903], photo: "photo-1610945265064-0e34e5519bbf",
    scores: { camera: 9.0, performance: 9.1, battery: 8.3, display: 9.2, software: 9.4, build: 8.8, value: 8.2 },
    specs: {
      "display.size": "6.2-inch",
      "display.resolution": "2340 × 1080",
      "display.panel": "Dynamic AMOLED 2X",
      "display.refresh_rate": "1–120 Hz adaptive",
      "display.peak_brightness": "2,600 nits",
      "performance.processor": "Snapdragon 8 Gen 3 for Galaxy",
      "performance.memory": "8 GB",
      "performance.storage": "256 GB, no microSD",
      "camera.main_camera": "50 MP, f/1.8, OIS",
      "camera.ultrawide": "12 MP, f/2.2, 120°",
      "camera.telephoto": "10 MP, 3× optical, OIS",
      "camera.front_camera": "12 MP, f/2.2",
      "camera.video": "8K/30, 4K/60 all lenses",
      "power.battery_capacity": "4,000 mAh",
      "power.wired_charging": "25 W",
      "power.wireless_charging": "15 W",
      "physical.weight": "167 g",
      "physical.dimensions": "147 × 70.6 × 7.6 mm",
      "physical.water_resistance": "IP68",
      "physical.sim": "Nano-SIM + eSIM",
      "physical.os": "Android 14, One UI 6.1",
      "physical.update_policy": "7 years OS and security",
    },
  },
  {
    id: "p5", title: "ROG Swift OLED PG27", slug: "asus-rog-swift-oled-pg27", brand: "asus", category: "gaming-monitors",
    tagline: "OLED response times at 240Hz — the clearest motion you can currently buy.",
    score: 9.2, current: 89990, min: 84990, max: 99990,
    badges: [badges.gaming, badges.premium], rating: [4.6, 74], photo: "photo-1593305841991-05c297ba4575",
    scores: { motion: 9.8, latency: 9.6, image: 9.3, colour: 9.0, features: 8.9, value: 7.8 },
    specs: {
      "panel.size": "26.5-inch",
      "panel.resolution": "2560 × 1440",
      "panel.panel_type": "QD-OLED",
      "panel.refresh_rate": "240 Hz",
      "panel.response_time": "0.03 ms GtG",
      "panel.curvature": "Flat",
      "gaming.adaptive_sync": "G-SYNC Compatible, FreeSync Premium Pro",
      "gaming.hdr": "DisplayHDR True Black 400",
      "gaming.input_lag": "1.2 ms",
      "connectivity.inputs": "2 × HDMI 2.1, DisplayPort 1.4 DSC",
      "connectivity.usb_hub": "2 × USB-A 3.2, 1 × USB-B",
      "connectivity.usb_c": "None",
      "physical.adjustment": "Height, tilt, swivel, pivot",
      "physical.vesa": "100 × 100 mm",
      "physical.burn_in_cover": "3 years",
    },
  },
  {
    id: "p6", title: "QuietComfort Ultra", slug: "bose-quietcomfort-ultra", brand: "bose", category: "headphones",
    tagline: "The most comfortable ANC headphone made — if you can live with shorter battery.",
    score: 8.8, current: 29900, min: 27900, max: 35900,
    badges: [badges.worthIt], rating: [4.5, 211], photo: "photo-1546435770-a3e426bf472b",
    scores: { sound: 8.9, anc: 9.4, comfort: 9.7, battery: 7.6, mic: 8.5, value: 7.9 },
    specs: {
      "audio.driver": "35mm dynamic",
      "audio.frequency_response": "20 Hz – 20,000 Hz",
      "audio.codecs": "SBC, AAC, aptX Adaptive",
      "audio.anc": "Adaptive, with Immersive Audio",
      "power.battery_anc_on": "24 hours",
      "power.quick_charge": "15 min → 2.5 hours",
      "power.charging": "USB-C",
      "physical.weight": "254 g",
      "physical.connectivity": "Bluetooth 5.3, Multipoint",
      "physical.folding": "Folds flat and inward",
      "physical.water_resistance": "None",
    },
  },
  {
    id: "p7", title: "MacBook Air M3", slug: "apple-macbook-air-m3", brand: "apple", category: "laptops",
    tagline: "Silent, cool and genuinely all-day. The default laptop for most people.",
    score: 9.3, current: 114900, min: 104900, max: 134900,
    badges: [badges.top, badges.editors], rating: [4.8, 642], photo: "photo-1517336714731-489689fd1ca8",
    scores: { performance: 9.0, display: 8.8, battery: 9.7, keyboard: 9.3, build: 9.5, thermals: 9.8, value: 8.6 },
    specs: {
      "performance.processor": "Apple M3, 8-core CPU",
      "performance.graphics": "10-core integrated GPU",
      "performance.memory": "16 GB unified",
      "performance.storage": "512 GB SSD",
      "display.size": "13.6-inch",
      "display.resolution": "2560 × 1664",
      "display.panel": "IPS, 500 nits",
      "display.refresh_rate": "60 Hz",
      "power.battery_capacity": "52.6 Wh",
      "power.battery_life": "18 hours",
      "power.charger": "35 W dual USB-C",
      "connectivity.ports": "2 × Thunderbolt 4, MagSafe, 3.5mm",
      "connectivity.wireless": "Wi-Fi 6E, Bluetooth 5.3",
      "connectivity.webcam": "1080p",
      "physical.weight": "1.24 kg",
      "physical.dimensions": "304 × 215 × 11.3 mm",
      "physical.os": "macOS Sonoma",
    },
  },
  {
    id: "p8", title: "Momentum 4", slug: "sennheiser-momentum-4", brand: "sennheiser", category: "headphones",
    tagline: "60-hour battery and the warmest tuning here — a listener's headphone.",
    score: 8.7, current: 21990, min: 19990, max: 27990,
    badges: [badges.value], rating: [4.4, 168], photo: "photo-1583394838336-acd977736f90",
    scores: { sound: 9.3, anc: 8.0, comfort: 8.9, battery: 9.9, mic: 7.8, value: 9.0 },
    specs: {
      "audio.driver": "42mm dynamic",
      "audio.frequency_response": "6 Hz – 22,000 Hz",
      "audio.codecs": "SBC, AAC, aptX Adaptive",
      "audio.anc": "Adaptive hybrid",
      "power.battery_anc_on": "60 hours",
      "power.quick_charge": "10 min → 4 hours",
      "power.charging": "USB-C",
      "physical.weight": "293 g",
      "physical.connectivity": "Bluetooth 5.2, Multipoint",
      "physical.folding": "Folds flat",
      "physical.water_resistance": "None",
    },
  },
  {
    id: "p9", title: "Alpha 6700", slug: "sony-alpha-6700", brand: "sony", category: "mirrorless",
    tagline: "Autofocus that simply does not miss, in a body you'll actually carry.",
    score: 9.0, current: 134990, min: 129990, max: 154990,
    badges: [badges.premium], rating: [4.7, 58], photo: "photo-1502920917128-1aa500764cbd",
    scores: { image: 8.9, autofocus: 9.7, video: 9.2, handling: 8.5, lenses: 9.4, value: 8.3 },
    specs: {
      "sensor.sensor": "26 MP Exmor R APS-C BSI CMOS",
      "sensor.processor": "BIONZ XR with AI unit",
      "sensor.iso_range": "100 – 32,000 (expandable 50 – 102,400)",
      "sensor.stabilisation": "5-axis IBIS, 5.0 stops",
      "autofocus.af_points": "759 phase-detect",
      "autofocus.subject_detection": "Human, animal, bird, insect, vehicle",
      "autofocus.burst_rate": "11 fps mechanical",
      "autofocus.shutter_speed": "1/4000 – 30 s",
      "video.max_video": "4K/120 (1.58× crop), 10-bit 4:2:2",
      "video.log_profile": "S-Log3, S-Cinetone",
      "video.recording_limit": "None",
      "body.mount": "Sony E",
      "body.viewfinder": "2.36M-dot OLED EVF",
      "body.screen": "3-inch vari-angle touchscreen",
      "body.card_slots": "1 × SD UHS-II",
      "body.weight": "493 g with battery",
      "body.battery_life": "570 shots CIPA",
      "body.weather_sealing": "Dust and moisture resistant",
    },
  },
  {
    id: "p10", title: "Galaxy Watch 6", slug: "samsung-galaxy-watch-6", brand: "samsung", category: "smartwatches",
    tagline: "The best Android watch, provided you own a Samsung phone.",
    score: 8.4, current: 27999, min: 24999, max: 33999,
    badges: [badges.worthIt], rating: [4.3, 287], photo: "photo-1523275335684-37898b6baf30",
    scores: { tracking: 8.6, battery: 7.4, comfort: 8.9, software: 8.8, health: 8.7, value: 8.1 },
    specs: {
      "display.size": "44 mm",
      "display.panel": "Super AMOLED, always-on",
      "display.resolution": "480 × 480",
      "display.brightness": "2,000 nits",
      "display.glass": "Sapphire crystal",
      "health.heart_rate": "Optical, continuous",
      "health.ecg": "Yes, single-lead",
      "health.spo2": "Yes, on demand and overnight",
      "health.sleep": "Stages, apnoea detection",
      "health.gps": "Dual-band L1 + L5",
      "platform.os": "Wear OS 4, One UI Watch 5",
      "platform.processor": "Exynos W930, dual-core",
      "platform.storage": "16 GB",
      "platform.phone_support": "Android 11+ only",
      "platform.connectivity": "Bluetooth 5.3, Wi-Fi, optional LTE",
      "physical.battery_capacity": "425 mAh",
      "physical.battery_life": "40 hours with always-on",
      "physical.charging": "Wireless, 0–45% in 30 min",
      "physical.weight": "33.3 g without strap",
      "physical.water_resistance": "5 ATM + IP68, MIL-STD-810H",
      "physical.strap": "20 mm, quick-release",
    },
  },
  {
    id: "p11", title: "G Pro X Superlight 2", slug: "logitech-g-pro-x-superlight-2", brand: "logitech", category: "mice",
    tagline: "60g, 95-hour battery, zero latency. Competitive players stop looking here.",
    score: 9.1, current: 15995, min: 14495, max: 18995,
    badges: [badges.gaming], rating: [4.7, 154], photo: "photo-1615663245857-ac93bb7c39e7",
    scores: { ergonomics: 8.8, sensor: 9.8, buttons: 8.9, build: 9.2, software: 8.4, value: 8.0 },
    specs: {
      "sensor.sensor": "HERO 2",
      "sensor.max_dpi": "32,000 DPI",
      "sensor.max_speed": "500 IPS",
      "sensor.polling_rate": "2,000 Hz",
      "controls.buttons": "5 programmable",
      "controls.switches": "Hybrid optical-mechanical, 100M clicks",
      "controls.scroll": "Standard notched",
      "controls.thumb_wheel": "No",
      "connectivity.connection": "Lightspeed 2.4 GHz, USB-C",
      "connectivity.battery_life": "95 hours",
      "connectivity.quick_charge": "5 min → 8 hours",
      "connectivity.multi_device": "No",
      "physical.weight": "60 g",
      "physical.dimensions": "125 × 63.5 × 40 mm",
      "physical.hand": "Right-handed",
      "physical.grip": "Claw, fingertip",
    },
  },
  {
    id: "p12", title: "Phone (2a)", slug: "nothing-phone-2a", brand: "nothing", category: "smartphones",
    tagline: "The most distinctive phone under ₹30,000, with software that stays out of the way.",
    score: 8.5, current: 23999, min: 21999, max: 27999,
    badges: [badges.value, badges.fresh], rating: [4.4, 519], photo: "photo-1598327105666-5b89351aff97",
    scores: { camera: 8.1, performance: 8.3, battery: 8.9, display: 8.7, software: 9.2, build: 8.4, value: 9.4 },
    specs: {
      "display.size": "6.7-inch",
      "display.resolution": "2412 × 1084",
      "display.panel": "Flexible AMOLED",
      "display.refresh_rate": "30–120 Hz adaptive",
      "display.peak_brightness": "1,300 nits",
      "performance.processor": "MediaTek Dimensity 7200 Pro",
      "performance.memory": "8 GB",
      "performance.storage": "128 GB, no microSD",
      "camera.main_camera": "50 MP, f/1.88, OIS",
      "camera.ultrawide": "50 MP, f/2.2, 114°",
      "camera.front_camera": "32 MP, f/2.2",
      "camera.video": "4K/30",
      "power.battery_capacity": "5,000 mAh",
      "power.wired_charging": "45 W",
      "power.wireless_charging": "None",
      "physical.weight": "190 g",
      "physical.dimensions": "161.7 × 76.3 × 8.6 mm",
      "physical.water_resistance": "IP54",
      "physical.sim": "Dual nano-SIM",
      "physical.os": "Android 14, Nothing OS 2.5",
      "physical.update_policy": "3 years OS, 4 years security",
    },
  },
];

function toSummary(s: Seed): ProductSummary {
  return {
    id: s.id,
    title: s.title,
    slug: s.slug,
    brand: brandBy(s.brand),
    category: catBy(s.category),
    tagline: s.tagline,
    primaryImage: img(`${s.id}-i1`, s.photo),
    score: { overall: s.score },
    badges: s.badges,
    pricing: { currency: "INR", current: s.current, min: s.min, max: s.max, updatedAt: "2026-08-18T09:00:00Z" },
    communityRating: { average: s.rating[0], count: s.rating[1] },
    status: "published",
  };
}

export const products: ProductSummary[] = seeds.map(toSummary);

/**
 * Products in a category *or anything beneath it*.
 *
 * Matches the API, which filters on `Category.path.contains([slug])` — the
 * path holds the ancestor chain, so /c/electronics/audio still returns the
 * headphones and earbuds filed one level down. An exact-slug match would empty
 * every tile page the moment products were filed against real leaf categories.
 */
export function productsByCategory(slug: string): ProductSummary[] {
  return products.filter((p) => p.category.path.includes(slug));
}

/**
 * Full detail for the product page.
 *
 * The score breakdown and the specification table are assembled from the
 * product's **category template**, not from a shared block. That is the whole
 * point: a mouse gets Ergonomics / Sensor accuracy / Buttons & scroll and a
 * sensor spec group, and never a driver or a frequency response. A criterion
 * or field the seed has no value for is left out rather than rendered blank.
 */
export function productDetail(slug: string): Product | null {
  const summary = products.find((p) => p.slug === slug);
  if (!summary) return null;
  const seed = seeds.find((s) => s.slug === slug)!;
  const template = categoryTemplates[seed.category] ?? { criteria: [], specs: [] };

  return {
    ...summary,
    description:
      "A full research write-up lives here, authored in the admin panel. It covers what the product " +
      "is, who it is for, how it compares to the obvious alternatives, and where it falls short.",
    shortDescription: seed.tagline,
    images: [
      img(`${seed.id}-i1`, seed.photo),
      { ...img(`${seed.id}-i2`, "photo-1484704849700-f032a568e944"), displayOrder: 1 },
      { ...img(`${seed.id}-i3`, "photo-1524678606370-a47ad25cb82a"), displayOrder: 2 },
      { ...img(`${seed.id}-i4`, "photo-1558756520-22cfe5d382ca"), displayOrder: 3 },
    ],
    videos: [],
    score: {
      overall: seed.score,
      updatedAt: "2026-08-12T00:00:00Z",
      criteria: template.criteria
        .filter((c) => seed.scores[c.key] !== undefined)
        .map((c) => ({ key: c.key, label: c.label, value: seed.scores[c.key] })),
    },
    verdict:
      "This is the headphone to buy if noise cancellation is the reason you are shopping. The ANC is a " +
      "clear step ahead of everything else at this price, and the call quality — usually the first thing " +
      "sacrificed — is the best we have tested. You are paying a premium for that, and the folding hinge " +
      "of the previous generation is gone, so it travels less gracefully. If you spend more time on calls " +
      "and commutes than in a bag, that trade is worth making.",
    bestFor: ["Frequent flyers and commuters", "Open-plan office work", "Long call-heavy days", "Podcasts and spoken audio"],
    notIdealFor: ["Tight bag space — it no longer folds flat", "Studio monitoring or mixing", "Competitive gaming (latency)", "Workouts — there is no IP rating"],
    pros: [
      "Best-in-class active noise cancellation",
      "Exceptional microphone clarity on calls",
      "Genuinely comfortable past the three-hour mark",
      "30-hour battery with ANC engaged",
    ],
    cons: ["No longer folds down compactly", "Carrying case is bulky", "Touch controls are inconsistent in cold weather"],
    specifications: template.specs
      .map((group) => ({
        key: group.key,
        label: group.label,
        items: group.fields
          .filter((f) => seed.specs[`${group.key}.${f.key}`])
          .map((f) => ({
            key: f.key,
            label: f.label,
            value: seed.specs[`${group.key}.${f.key}`],
          })),
      }))
      // A heading with nothing under it is worse than no heading.
      .filter((group) => group.items.length > 0),
    retailers: [
      { id: "r1", retailer: "Amazon", retailerSlug: "amazon", url: "https://www.amazon.in/", displayPrice: 24990, isActive: true, lastUpdatedAt: "2026-08-19T06:00:00Z" },
      { id: "r2", retailer: "Flipkart", retailerSlug: "flipkart", url: "https://www.flipkart.com/", displayPrice: 25499, isActive: true, lastUpdatedAt: "2026-08-19T06:00:00Z" },
    ],
    seo: {
      metaTitle: `${summary.brand.name} ${summary.title} review, score and price`,
      metaDescription: seed.tagline,
    },
    createdAt: "2026-05-02T00:00:00Z",
    updatedAt: "2026-08-12T00:00:00Z",
  };
}

/* ------------------------------------------------------------------ */
/* Reviews (spec §28) — "User Review", never "Verified Buyer" (§31)    */
/* ------------------------------------------------------------------ */
export const reviews: Review[] = [
  {
    id: "rv1",
    productId: "p1",
    author: { id: "u1", displayName: "Ananya R." },
    rating: 5,
    title: "Finally quiet on the metro",
    body: "I bought these mostly for the commute and they have completely changed it. The ANC handles the low rumble better than anything I have tried. Battery easily lasts me a week of two-hour days.",
    media: [],
    status: "approved",
    isFeatured: true,
    helpfulCount: 42,
    createdAt: "2026-07-28T10:12:00Z",
  },
  {
    id: "rv2",
    productId: "p1",
    author: { id: "u2", displayName: "Karthik V." },
    rating: 4,
    title: "Great, but I miss the fold",
    body: "Sound and comfort are excellent. My only real complaint is the case — it takes up noticeably more room in my bag than the XM4 did, and that is a daily annoyance rather than a one-off.",
    media: [],
    status: "approved",
    isFeatured: false,
    helpfulCount: 18,
    createdAt: "2026-07-14T16:40:00Z",
  },
  {
    id: "rv3",
    productId: "p1",
    author: { id: "u3", displayName: "Meera S." },
    rating: 5,
    title: "Call quality is the real story",
    body: "I take calls all day and people have stopped asking me to repeat myself. That alone justified the upgrade for me.",
    media: [],
    status: "approved",
    isFeatured: false,
    helpfulCount: 27,
    createdAt: "2026-06-30T08:05:00Z",
  },
];

/* ------------------------------------------------------------------ */
/* Homepage composition (spec §11, §39)                                */
/* ------------------------------------------------------------------ */
export const homepageSections: HomepageSection[] = [
  { id: "hs1", kind: "hero", displayOrder: 1, isActive: true },
  { id: "hs2", kind: "category_tiles", title: "What are you looking for?", displayOrder: 2, isActive: true, categories },
  {
    id: "hs3", kind: "top_picks", title: "Top Picks right now",
    subtitle: "The highest-scoring products across every category we cover.",
    displayOrder: 3, isActive: true,
    products: [products[0], products[6], products[4], products[2], products[8]],
  },
  {
    id: "hs4", kind: "category_rail", title: "Audio",
    subtitle: "Headphones, earbuds and speakers, ranked on how they actually sound.",
    displayOrder: 4, isActive: true, products: productsByCategory("audio"),
    data: { categorySlug: "audio" },
  },
  {
    id: "hs5", kind: "category_rail", title: "Gaming",
    subtitle: "Monitors, mice and headsets that hold up under competitive play.",
    displayOrder: 5, isActive: true, products: productsByCategory("gaming"),
    data: { categorySlug: "gaming" },
  },
  {
    id: "hs6", kind: "category_rail", title: "Mobiles",
    subtitle: "Phones worth your money at every price point we track.",
    displayOrder: 6, isActive: true, products: productsByCategory("mobiles"),
    data: { categorySlug: "mobiles" },
  },
  { id: "hs7", kind: "featured_brands", title: "Brands we cover", displayOrder: 7, isActive: true, brands },
  { id: "hs8", kind: "newsletter", displayOrder: 8, isActive: true },
];
