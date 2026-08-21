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

export const categories: Category[] = [
  cat("c1", "Audio", "audio", ["electronics", "audio"], 1, { icon: "headphones", productCount: 48, description: "Headphones, earbuds and speakers — ranked by how they actually sound, not by spec sheet." }),
  cat("c2", "Computers", "computers", ["electronics", "computers"], 2, { icon: "laptop", productCount: 62 }),
  cat("c3", "Mobiles", "mobiles", ["electronics", "mobiles"], 3, { icon: "smartphone", productCount: 37 }),
  cat("c4", "Gaming", "gaming", ["electronics", "gaming"], 4, { icon: "gamepad", productCount: 44 }),
  cat("c5", "Cameras", "cameras", ["electronics", "cameras"], 5, { icon: "camera", productCount: 21 }),
  cat("c6", "Wearables", "wearables", ["electronics", "wearables"], 6, { icon: "watch", productCount: 29 }),
  cat("c7", "Smart Home", "smart-home", ["electronics", "smart-home"], 7, { icon: "home", productCount: 33 }),
  cat("c8", "Accessories", "accessories", ["electronics", "accessories"], 8, { icon: "cable", productCount: 71 }),
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
/* Products                                                            */
/* ------------------------------------------------------------------ */
type Seed = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  category: string;
  tagline: string;
  score: number;
  current: number;
  min: number;
  max: number;
  badges: Badge[];
  rating: [number, number];
  photo: string;
};

const seeds: Seed[] = [
  {
    id: "p1", title: "WH-1000XM5", slug: "sony-wh-1000xm5", brand: "sony", category: "audio",
    tagline: "Class-leading noise cancellation with the best call quality in its price band.",
    score: 9.4, current: 24990, min: 22990, max: 29990,
    badges: [badges.top, badges.worthIt], rating: [4.6, 128], photo: "photo-1505740420928-5e560c06d30e",
  },
  {
    id: "p2", title: "Ear (a)", slug: "nothing-ear-a", brand: "nothing", category: "audio",
    tagline: "The most interesting design under ₹10,000, and the ANC finally keeps up with it.",
    score: 8.6, current: 7499, min: 6999, max: 8999,
    badges: [badges.value, badges.fresh], rating: [4.4, 312], photo: "photo-1590658268037-6bf12165a8df",
  },
  {
    id: "p3", title: "MX Master 3S", slug: "logitech-mx-master-3s", brand: "logitech", category: "accessories",
    tagline: "Still the mouse to beat for long working days — quiet clicks, flawless scroll.",
    score: 9.1, current: 8495, min: 7995, max: 10995,
    badges: [badges.editors, badges.worthIt], rating: [4.7, 486], photo: "photo-1527864550417-7fd91fc51a46",
  },
  {
    id: "p4", title: "Galaxy S24", slug: "samsung-galaxy-s24", brand: "samsung", category: "mobiles",
    tagline: "The compact flagship that doesn't compromise the camera to stay small.",
    score: 8.9, current: 66999, min: 61999, max: 79999,
    badges: [badges.premium], rating: [4.5, 903], photo: "photo-1610945265064-0e34e5519bbf",
  },
  {
    id: "p5", title: "ROG Swift OLED PG27", slug: "asus-rog-swift-oled-pg27", brand: "asus", category: "gaming",
    tagline: "OLED response times at 240Hz — the clearest motion you can currently buy.",
    score: 9.2, current: 89990, min: 84990, max: 99990,
    badges: [badges.gaming, badges.premium], rating: [4.6, 74], photo: "photo-1593305841991-05c297ba4575",
  },
  {
    id: "p6", title: "QuietComfort Ultra", slug: "bose-quietcomfort-ultra", brand: "bose", category: "audio",
    tagline: "The most comfortable ANC headphone made — if you can live with shorter battery.",
    score: 8.8, current: 29900, min: 27900, max: 35900,
    badges: [badges.worthIt], rating: [4.5, 211], photo: "photo-1546435770-a3e426bf472b",
  },
  {
    id: "p7", title: "MacBook Air M3", slug: "apple-macbook-air-m3", brand: "apple", category: "computers",
    tagline: "Silent, cool and genuinely all-day. The default laptop for most people.",
    score: 9.3, current: 114900, min: 104900, max: 134900,
    badges: [badges.top, badges.editors], rating: [4.8, 642], photo: "photo-1517336714731-489689fd1ca8",
  },
  {
    id: "p8", title: "Momentum 4", slug: "sennheiser-momentum-4", brand: "sennheiser", category: "audio",
    tagline: "60-hour battery and the warmest tuning here — a listener's headphone.",
    score: 8.7, current: 21990, min: 19990, max: 27990,
    badges: [badges.value], rating: [4.4, 168], photo: "photo-1583394838336-acd977736f90",
  },
  {
    id: "p9", title: "Alpha 6700", slug: "sony-alpha-6700", brand: "sony", category: "cameras",
    tagline: "Autofocus that simply does not miss, in a body you'll actually carry.",
    score: 9.0, current: 134990, min: 129990, max: 154990,
    badges: [badges.premium], rating: [4.7, 58], photo: "photo-1502920917128-1aa500764cbd",
  },
  {
    id: "p10", title: "Galaxy Watch 6", slug: "samsung-galaxy-watch-6", brand: "samsung", category: "wearables",
    tagline: "The best Android watch, provided you own a Samsung phone.",
    score: 8.4, current: 27999, min: 24999, max: 33999,
    badges: [badges.worthIt], rating: [4.3, 287], photo: "photo-1523275335684-37898b6baf30",
  },
  {
    id: "p11", title: "G Pro X Superlight 2", slug: "logitech-g-pro-x-superlight-2", brand: "logitech", category: "gaming",
    tagline: "60g, 95-hour battery, zero latency. Competitive players stop looking here.",
    score: 9.1, current: 15995, min: 14495, max: 18995,
    badges: [badges.gaming], rating: [4.7, 154], photo: "photo-1615663245857-ac93bb7c39e7",
  },
  {
    id: "p12", title: "Phone (2a)", slug: "nothing-phone-2a", brand: "nothing", category: "mobiles",
    tagline: "The most distinctive phone under ₹30,000, with software that stays out of the way.",
    score: 8.5, current: 23999, min: 21999, max: 27999,
    badges: [badges.value, badges.fresh], rating: [4.4, 519], photo: "photo-1598327105666-5b89351aff97",
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

export function productsByCategory(slug: string): ProductSummary[] {
  return products.filter((p) => p.category.slug === slug);
}

/* Full detail for the product page. Only p1 is fleshed out — the rest fall
   back to a generated shell, which is enough to exercise the layout. */
export function productDetail(slug: string): Product | null {
  const summary = products.find((p) => p.slug === slug);
  if (!summary) return null;
  const seed = seeds.find((s) => s.slug === slug)!;

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
      criteria: [
        { key: "sound", label: "Sound", value: 9.2 },
        { key: "anc", label: "Noise cancellation", value: 9.6 },
        { key: "comfort", label: "Comfort", value: 8.8 },
        { key: "battery", label: "Battery", value: 9.0 },
        { key: "mic", label: "Call quality", value: 9.1 },
        { key: "value", label: "Value", value: 8.4 },
      ],
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
    specifications: [
      {
        label: "Audio",
        items: [
          { label: "Driver", value: "30mm carbon fibre composite" },
          { label: "Frequency response", value: "4 Hz – 40,000 Hz" },
          { label: "Codecs", value: "SBC, AAC, LDAC" },
        ],
      },
      {
        label: "Battery & power",
        items: [
          { label: "Playback (ANC on)", value: "30 hours" },
          { label: "Quick charge", value: "3 min → 3 hours" },
          { label: "Charging", value: "USB-C" },
        ],
      },
      {
        label: "Physical",
        items: [
          { label: "Weight", value: "250 g" },
          { label: "Connectivity", value: "Bluetooth 5.2, Multipoint" },
          { label: "Water resistance", value: "None" },
        ],
      },
    ],
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
