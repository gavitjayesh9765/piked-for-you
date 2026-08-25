/**
 * Domain types — the contract between the FastAPI backend and the frontend.
 * Mirrors backend/app/schemas/. Spec §40 (data model), §51 (product card).
 *
 * Rule from spec §54: the frontend renders structured data and holds no
 * product-specific logic. If a component needs to know about a *particular*
 * product, the model is wrong, not the component.
 */

export type ProductStatus = "draft" | "published" | "archived";
export type ReviewStatus = "pending" | "approved" | "rejected" | "hidden" | "reported";
/** `video_link` is an embed (YouTube/Vimeo); `video` is an uploaded file. */
export type MediaKind = "image" | "video" | "video_link";

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Full ancestor path, root first — used for breadcrumbs and /c/ URLs. */
  path: string[];
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  children?: Category[];
  displayOrder: number;
  isActive: boolean;
  showOnHomepage: boolean;
  productCount?: number;
  /**
   * Effective templates — after inheritance from ancestors. A mouse under
   * Computers → Mice is scored and specified as a mouse, never as a headphone
   * (spec §24, §41). Present on admin reads; the public category endpoint
   * omits them because no public surface authors against them.
   */
  scoreCriteria?: ScoreCriterionDef[];
  specTemplate?: SpecTemplateGroup[];
}

/* ------------------------------------------------------------------ */
/* Category templates (spec §24, §41)                                  */
/* ------------------------------------------------------------------ */

/** One scoring criterion a category allows. The *definition*, not a score. */
export interface ScoreCriterionDef {
  key: string;
  label: string;
  /** Relative weight in the overall score; absent means equal weighting. */
  weight?: number | null;
}

/** One specification field a category's products may carry. */
export interface SpecTemplateField {
  key: string;
  label: string;
  /** Shown beside the input as a hint — not appended to the stored value. */
  unit?: string | null;
  placeholder?: string | null;
}

export interface SpecTemplateGroup {
  key: string;
  label: string;
  fields: SpecTemplateField[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  website?: string | null;
  isPinned: boolean;
  displayOrder: number;
  productCount?: number;
}

/**
 * Badges are content, not code (spec §21). Style is a token-safe enum so a new
 * badge created in the admin panel renders correctly without a frontend deploy.
 */
export type BadgeStyle = "editorial" | "brand" | "value" | "warn" | "neutral";

export interface Badge {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  style: BadgeStyle;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/* Scoring — configurable per category (spec §24)                      */
/* ------------------------------------------------------------------ */

export interface ScoreCriterion {
  key: string;
  label: string;
  /** 0–10 */
  value: number;
  /** Relative weight in the overall score; absent means equal weighting. */
  weight?: number;
}

export interface PickdScore {
  /** 0–10, one decimal. Ours. Never merged with communityRating (spec §32). */
  overall: number;
  criteria: ScoreCriterion[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* The verdict (spec §25)                                              */
/* ------------------------------------------------------------------ */

/**
 * The buying recommendation. Four values, deliberately — every product a
 * reader is looking at falls into exactly one of them, and a fifth ("it
 * depends") would be the one every undecided verdict quietly drifted into.
 */
export type VerdictStance = "buy_now" | "wait_for_sale" | "skip" | "consider_alternative";

/** Why a reader might take an alternative over this product. */
export type AlternativeReason =
  | "better_value"
  | "better_performance"
  | "better_budget"
  | "better_for_professionals"
  | "better_features"
  | "closest_rival";

/**
 * An alternative, plus the reason it is here. Extends the card shape rather
 * than wrapping it, so `<ProductCard product={alt} />` still works and the
 * label is read off the same object.
 */
export interface AlternativePick extends ProductSummary {
  reason: AlternativeReason;
  note?: string | null;
  /**
   * False for rows the price-band heuristic supplied. The page labels curated
   * and similar products differently — presenting arithmetic as an editorial
   * choice is the exact failure this site exists to avoid.
   */
  isCurated: boolean;
}

/* ------------------------------------------------------------------ */
/* Retailers (spec §26)                                                */
/* ------------------------------------------------------------------ */

export interface RetailerLink {
  id: string;
  retailer: string;
  retailerSlug: string;
  url: string;
  displayPrice?: number | null;
  isActive: boolean;
  lastUpdatedAt?: string | null;
  /**
   * Whether this link carries our referral tag. Derived server-side from the
   * retailer's affiliate template, so the badge on the button can never
   * disagree with the tag actually being appended (spec §59).
   */
  isAffiliate?: boolean;

  /* --- Scrape state. Present on admin reads; absent on cached public ones. --- */

  /**
   * Three-valued on purpose. `null` means the retailer's page did not say,
   * which is not the same as "available" — claiming availability we never
   * observed would send a reader to a dead listing.
   */
  inStock?: boolean | null;
  scrapeEnabled?: boolean;
  lastScrapeStatus?: ScrapeStatus | null;
  lastScrapeError?: string | null;
  lastScrapedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Price tracking                                                      */
/* ------------------------------------------------------------------ */

/**
 * What one scrape attempt made of one link.
 *
 * `rejected` is the interesting one: we read a price and chose not to publish
 * it, because it disagreed with the stored price by more than the configured
 * tolerance. That is a held-back reading awaiting a human, not a failure.
 */
export type ScrapeStatus =
  | "updated"
  | "unchanged"
  | "not_found"
  | "blocked"
  | "rejected"
  | "error"
  | "skipped";

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled";

export interface PricePoint {
  price: number;
  currency: string;
  retailer: string | null;
  inStock: boolean | null;
  source: "scrape" | "manual" | "import";
  capturedAt: string;
}

export interface PriceHistory {
  points: PricePoint[];
  summary: {
    count: number;
    lowest: number | null;
    highest: number | null;
    latest: number | null;
    windowDays: number;
  };
}

/* ------------------------------------------------------------------ */
/* Media (spec §19, §45)                                               */
/* ------------------------------------------------------------------ */

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  /** Signed URL for an upload; the watch page for a link. */
  url: string;
  /** Player src — set only for `video_link`, rebuilt server-side from the
   *  validated provider + id so nothing user-supplied reaches an iframe. */
  embedUrl?: string | null;
  provider?: string | null;
  title?: string | null;
  thumbnailUrl?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  /** Seconds. User review videos are capped at 30 (spec §29). */
  durationSeconds?: number | null;
  displayOrder: number;
}

/* ------------------------------------------------------------------ */
/* Pricing (spec §20)                                                  */
/* ------------------------------------------------------------------ */

export interface Pricing {
  currency: string;
  current: number;
  min?: number | null;
  max?: number | null;
  updatedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Product                                                             */
/* ------------------------------------------------------------------ */

/** The shape a product card needs. Kept deliberately small — list endpoints
 *  return this, not the full product, so category pages stay fast (spec §48). */
export interface ProductSummary {
  id: string;
  title: string;
  slug: string;
  brand: Pick<Brand, "id" | "name" | "slug">;
  category: Pick<Category, "id" | "name" | "slug" | "path">;
  /** The one-line reason this product is worth considering. The card is a
   *  recommendation, not a listing — see docs/01-design-brainstorm.md §3.3. */
  tagline: string;
  primaryImage?: MediaAsset | null;
  score?: Pick<PickdScore, "overall"> | null;
  badges: Badge[];
  pricing: Pricing;
  communityRating?: { average: number; count: number } | null;
  status: ProductStatus;
}

export interface Product extends ProductSummary {
  description: string;
  shortDescription?: string | null;
  images: MediaAsset[];
  videos: MediaAsset[];
  score?: PickdScore | null;
  /**
   * The recommendation itself — the answer the reader came for, and the thing
   * the page now leads with. A closed set, so the banner can style itself from
   * it and the publish check can refuse a product without one.
   */
  verdictStance?: VerdictStance | null;
  /** The one-or-two-sentence WHY, shown beside the stance above the fold. */
  verdictSummary?: string | null;
  /** Admin-authored prose (spec §25). Rendered in a prose-width column. */
  verdict?: string | null;
  /**
   * True only where a person physically used the product. The "how we
   * reviewed this" block reads this and nothing else — the site never claims
   * hands-on testing by omission.
   */
  handsOnTested?: boolean;
  /** Product-specific note on how this one was researched, when there is one. */
  researchNote?: string | null;
  /** ISO date. A recommendation with no date is a rumour. */
  researchedAt?: string | null;
  bestFor: string[];
  notIdealFor: string[];
  pros: string[];
  cons: string[];
  /** Category-specific, hence loosely typed here (spec §41 — JSONB). */
  specifications: SpecGroup[];
  retailers: RetailerLink[];
  seo?: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    ogImageUrl?: string | null;
    canonicalUrl?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SpecGroup {
  label: string;
  /** Template group key. Absent on free-form specs authored before templates. */
  key?: string;
  items: { key?: string; label: string; value: string }[];
}

/* ------------------------------------------------------------------ */
/* Reviews (spec §28–§32)                                              */
/* ------------------------------------------------------------------ */

export interface Review {
  id: string;
  productId: string;
  author: { id: string; displayName: string; avatarUrl?: string | null };
  /** 1–5. Community scale. Distinct from PickdScore.overall (0–10). */
  rating: number;
  title?: string | null;
  body: string;
  media: MediaAsset[];
  status: ReviewStatus;
  isFeatured: boolean;
  helpfulCount: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Homepage — admin-composed sections (spec §39)                       */
/* ------------------------------------------------------------------ */

export type HomepageSectionKind =
  | "hero"
  | "category_tiles"
  | "top_picks"
  | "featured_products"
  | "category_rail"
  | "featured_brands"
  | "newsletter"
  | "editorial";

export interface HomepageSection {
  id: string;
  kind: HomepageSectionKind;
  title?: string | null;
  subtitle?: string | null;
  displayOrder: number;
  isActive: boolean;
  /** Resolved server-side so the frontend never queries per section. */
  products?: ProductSummary[];
  categories?: Category[];
  brands?: Brand[];
  data?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FilterFacet {
  key: string;
  label: string;
  options: { value: string; label: string; count: number }[];
}

export type SortOption =
  | "relevance"
  | "score_desc"
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "newest";

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

/** Cadence is a first-class field, not a buried preference — see
 *  components/home/Newsletter.tsx for why. */
export type NewsletterFrequency = "daily" | "weekly" | "deals_only";

export interface NewsletterSubscribeRequest {
  email: string;
  frequency: NewsletterFrequency;
}

export interface NewsletterSubscribeResponse {
  /** Always true for a well-formed address. Whether the address was already
   *  subscribed is deliberately not revealed — that would make this endpoint an
   *  account-enumeration oracle. */
  accepted: boolean;
  /** Double opt-in: nothing is sent until the confirmation link is clicked. */
  confirmationRequired: boolean;
}

/* ------------------------------------------------------------------ */
/* Contact / research requests                                         */
/* ------------------------------------------------------------------ */

/**
 * Topics are deliberately shaped around what this product actually is.
 * "Research a product" is the primary path — a research desk's inbox is mostly
 * requests, not support tickets — and each topic reveals different fields.
 */
export type ContactTopic = "research_request" | "correction" | "press" | "general";

export type ContactStatus = "new" | "in_progress" | "answered" | "closed";

export interface ContactRequest {
  topic: ContactTopic;
  /** Category slugs. Capped client-side at 4 — a focused request gets a
   *  better answer, and an "all categories" request is not a request. */
  categorySlugs: string[];
  name: string;
  email: string;
  message: string;
  /** Topic-conditional. */
  budgetRange?: string | null;
  productUrl?: string | null;
  organisation?: string | null;
}

export interface ContactResponse {
  /** Short human-quotable id, e.g. "PDY-7K42" — so a follow-up email can
   *  reference the original request. */
  reference: string;
  accepted: boolean;
}
