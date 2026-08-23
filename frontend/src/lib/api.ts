import type {
  Brand,
  Category,
  FilterFacet,
  HomepageSection,
  Paginated,
  Product,
  ProductSummary,
  ContactRequest,
  ContactResponse,
  NewsletterSubscribeRequest,
  NewsletterSubscribeResponse,
  Review,
  SortOption,
} from "./types";
import { API_URL } from "./env";

/**
 * The single seam between the UI and the backend.
 *
 * Every page imports from here and nothing else, which is what keeps spec §54
 * honest — the frontend renders structured data and holds no product-specific
 * logic. Setting NEXT_PUBLIC_USE_MOCKS=1 swaps the transport for the fixtures
 * in ./mock/data without touching a component.
 *
 * Note the shape of every branch below:
 *
 *     if (USE_MOCKS) {
 *       const mock = await import("./mock/data");
 *       ...
 *     }
 *
 * The `await import` is deliberate and must not be hoisted back to a static
 * top-level import for tidiness. `USE_MOCKS` folds to a literal at build time
 * (see ./env), so when mocks are off the bundler deletes the whole branch and
 * never follows the import — which is what keeps 41 KB of fabricated products
 * out of a production bundle rather than merely unreferenced inside it. This
 * module is reachable from client components, so "unreferenced" would still
 * mean "downloaded by every visitor".
 *
 * Public endpoints return published content only; that filtering is enforced
 * server-side (spec §42), never here.
 */

/**
 * Re-derived from `process.env` here rather than imported from ./env, and that
 * is not duplication for its own sake — it is the difference between fixtures
 * being absent from the bundle and merely unreferenced in it.
 *
 * Importing `USE_MOCKS` across a module boundary was tried first and measurably
 * failed: `scripts/assert-no-mocks.mjs` found the full fixture module in both
 * `.next/server` and `.next/static` on a clean build. Turbopack inlines
 * `process.env.NEXT_PUBLIC_*` where it is written, but does not propagate the
 * resulting constant into another module, so `if (USE_MOCKS)` stayed opaque and
 * every `await import()` below kept its chunk.
 *
 * Written at the point of use, the expression folds to `false`, the branches
 * die, and the fixtures never enter the graph. ./env remains the source of
 * truth for the RULE and for validating it; this is the same rule stated where
 * the compiler can see it. The postbuild check fails the build if the two ever
 * disagree, which is what keeps the restatement honest.
 */
const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "1" ||
  process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Public content is cacheable and revalidated on a short window (spec §48). */
const REVALIDATE = 300;

/**
 * Upper bound on a single API call **at request time**.
 *
 * Sized to CLEAR a Render Free cold start, not to cut one off. That instance
 * spins down after 15 minutes idle and takes ~1 minute to answer the first
 * request; a shorter timeout would turn a slow-but-successful page into an
 * error page, which is strictly worse. Vercel Hobby allows a 300s function, so
 * without any bound a genuinely dead API would hold the request open for five
 * minutes before the platform killed it.
 */
const TIMEOUT_MS = 75_000;

/**
 * Upper bound on a single API call **during `next build`**.
 *
 * The reasoning above is about a user waiting on a request. At build time
 * nobody is waiting, and the surrounding budget is completely different:
 * Next allows `staticPageGenerationTimeout` seconds per page (we set 120 in
 * next.config.mjs, up from a 60s default) and retries a page three times
 * before failing the whole build.
 *
 * Applying the 75s request-time bound here is what broke the Vercel build —
 * it exceeded the 60s page budget, so every page that touched a sleeping API
 * was killed by Next before its own timeout could fire, three times over.
 * Twenty pages waiting 75s each is also 25 minutes of build time spent
 * discovering the same outage twenty times.
 *
 * So: fail fast at build, and let the callers that treat this data as page
 * chrome fall back (see `safe` in ./admin-api). Anything prerendered with a
 * fallback is corrected by the next revalidation, REVALIDATE seconds later.
 */
const BUILD_TIMEOUT_MS = 20_000;

/** True only inside `next build`; Next sets this itself. */
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(IS_BUILD ? BUILD_TIMEOUT_MS : TIMEOUT_MS),
    });
  } catch (cause) {
    // DNS failure, connection refused, or the timeout above. `fetch` reports
    // all of these as a bare TypeError, which surfaces as an opaque 500 with
    // nothing naming the endpoint. 503 is the honest status: the upstream is
    // unavailable, and the request may well succeed on retry.
    throw new ApiError(
      `GET ${path} could not reach the API at ${API_URL}`,
      503,
      { cause },
    );
  }

  if (!res.ok) {
    throw new ApiError(`GET ${path} failed`, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

/* ------------------------------------------------------------------ */
/* Homepage (spec §39)                                                 */
/* ------------------------------------------------------------------ */

export async function getHomepage(): Promise<HomepageSection[]> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return mock.homepageSections.filter((s) => s.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return get<HomepageSection[]>("/homepage");
}

/**
 * The curated Top Picks board, in the order an editor arranged it.
 *
 * The endpoint returns the same section envelope as the homepage rail, because
 * it is the same curation — /top-picks is the uncropped view of it, not a
 * second list that could drift out of sync.
 */
export async function getTopPicks(): Promise<HomepageSection | null> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return mock.homepageSections.find((s) => s.kind === "top_picks") ?? null;
  }
  const sections = await get<HomepageSection[]>("/homepage/top-picks");
  return sections[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export async function getCategories(): Promise<Category[]> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return mock.categories;
  }
  return get<Category[]>("/categories");
}

/**
 * The taxonomy, for callers that use it as navigation *chrome* rather than as
 * the content of the page — the header rail, the 404's suggestions, the
 * document-page footer nav.
 *
 * Those pages have their own reason to exist. `/privacy` is static prose; it
 * should not go down, or fail a deploy, because a category list was slow. An
 * empty rail renders a smaller page, never a wrong one — the same trade
 * `safe()` makes in ./admin-api, and a prerender that lands here is corrected
 * by the next revalidation REVALIDATE seconds later.
 *
 * Pages whose *content* is the taxonomy — /c, /b — keep calling
 * `getCategories()` and let the error surface, because for them an empty list
 * is a lie rather than a smaller page.
 */
export async function getCategoriesForChrome(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch {
    return [];
  }
}

/**
 * Slug shape, checked before a value from the URL becomes part of an upstream
 * path.
 *
 * Route params are attacker-controlled: `/c/<anything>`, `/b/<anything>`,
 * `/p/<anything>/<anything>` all reach these functions verbatim. Interpolating
 * them raw means `..%2f..%2f` — which Next decodes for us — reaches an
 * endpoint the caller chose rather than the one written here.
 *
 * These particular calls send no Authorization header, so the worst case today
 * is an unauthenticated 404 rather than a privileged read. That is a property
 * of the current call sites, not of the pattern, and it is the same class the
 * admin guard rejects outright with `isId`. Category, brand and product slugs
 * are generated kebab-case, so the check costs nothing legitimate.
 */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isSlug(value: string | undefined | null): value is string {
  return typeof value === "string" && value.length <= 120 && SLUG_RE.test(value);
}

export async function getCategory(path: string[]): Promise<Category | null> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    const slug = path[path.length - 1];
    return mock.categories.find((c) => c.slug === slug) ?? null;
  }
  // A path that is not made of slugs cannot match a category, so refusing it
  // here is the same answer the API would give — reached without making the
  // request, and without the segments ever entering a URL template.
  if (path.length === 0 || path.length > 6 || !path.every(isSlug)) return null;

  try {
    return await get<Category>(`/categories/${path.join("/")}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getBrands(opts: { pinnedOnly?: boolean } = {}): Promise<Brand[]> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return opts.pinnedOnly ? mock.brands.filter((b) => b.isPinned) : mock.brands;
  }
  return get<Brand[]>(`/brands${opts.pinnedOnly ? "?pinned=true" : ""}`);
}

export async function getBrand(slug: string): Promise<Brand | null> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return mock.brands.find((b) => b.slug === slug) ?? null;
  }
  if (!isSlug(slug)) return null;
  try {
    return await get<Brand>(`/brands/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface ProductQuery {
  category?: string;
  brand?: string[];
  badge?: string[];
  minPrice?: number;
  maxPrice?: number;
  minScore?: number;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export async function listProducts(q: ProductQuery = {}): Promise<Paginated<ProductSummary>> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    let items = q.category ? mock.productsByCategory(q.category) : mock.products;
    if (q.brand?.length) items = items.filter((p) => q.brand!.includes(p.brand.slug));
    if (q.minScore) items = items.filter((p) => (p.score?.overall ?? 0) >= q.minScore!);
    if (q.minPrice) items = items.filter((p) => p.pricing.current >= q.minPrice!);
    if (q.maxPrice) items = items.filter((p) => p.pricing.current <= q.maxPrice!);
    items = sortMock(items, q.sort ?? "score_desc");

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 24;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
      page,
      pageSize,
      hasMore: start + pageSize < items.length,
    };
  }

  const params = new URLSearchParams();
  if (q.category) params.set("category", q.category);
  q.brand?.forEach((b) => params.append("brand", b));
  q.badge?.forEach((b) => params.append("badge", b));
  if (q.minPrice != null) params.set("min_price", String(q.minPrice));
  if (q.maxPrice != null) params.set("max_price", String(q.maxPrice));
  if (q.minScore != null) params.set("min_score", String(q.minScore));
  if (q.sort) params.set("sort", q.sort);
  params.set("page", String(q.page ?? 1));
  params.set("page_size", String(q.pageSize ?? 24));

  return get<Paginated<ProductSummary>>(`/products?${params}`);
}

function sortMock(items: ProductSummary[], sort: SortOption): ProductSummary[] {
  const copy = [...items];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.pricing.current - b.pricing.current);
    case "price_desc":
      return copy.sort((a, b) => b.pricing.current - a.pricing.current);
    case "rating_desc":
      return copy.sort((a, b) => (b.communityRating?.average ?? 0) - (a.communityRating?.average ?? 0));
    case "score_desc":
    default:
      return copy.sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0));
  }
}

export async function getProduct(categorySlug: string, slug: string): Promise<Product | null> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return mock.productDetail(slug);
  }
  if (!isSlug(categorySlug) || !isSlug(slug)) return null;
  try {
    return await get<Product>(`/products/${categorySlug}/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getAlternatives(productId: string, limit = 4): Promise<ProductSummary[]> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    return mock.products.filter((p) => p.id !== productId).slice(0, limit);
  }
  // productId comes from data we rendered rather than from the URL, but it is
  // still interpolated into a path — encode rather than assume.
  return get<ProductSummary[]>(
    `/products/${encodeURIComponent(productId)}/alternatives?limit=${limit}`,
  );
}

export async function getFacets(categorySlug?: string): Promise<FilterFacet[]> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    const pool = categorySlug ? mock.productsByCategory(categorySlug) : mock.products;
    const brandCounts = new Map<string, { label: string; count: number }>();
    pool.forEach((p) => {
      const cur = brandCounts.get(p.brand.slug);
      brandCounts.set(p.brand.slug, { label: p.brand.name, count: (cur?.count ?? 0) + 1 });
    });
    return [
      {
        key: "brand",
        label: "Brand",
        options: [...brandCounts.entries()].map(([value, v]) => ({ value, label: v.label, count: v.count })),
      },
      {
        key: "score",
        label: "PickD Score",
        options: [
          { value: "9", label: "9.0 and above", count: pool.filter((p) => (p.score?.overall ?? 0) >= 9).length },
          { value: "8", label: "8.0 and above", count: pool.filter((p) => (p.score?.overall ?? 0) >= 8).length },
        ],
      },
    ];
  }
  // Encoded: unescaped, a slug containing `&` would append query parameters of
  // the caller's choosing to our own request.
  return get<FilterFacet[]>(
    `/products/facets${categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ""}`,
  );
}

/* ------------------------------------------------------------------ */
/* Reviews (spec §28)                                                  */
/* ------------------------------------------------------------------ */

export async function getReviews(productId: string): Promise<Paginated<Review>> {
  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    const items = mock.reviews.filter((r) => r.productId === productId && r.status === "approved");
    return { items, total: items.length, page: 1, pageSize: 20, hasMore: false };
  }
  // Route lives under /reviews, not nested under /products — see
  // backend/app/modules/reviews/router.py
  return get<Paginated<Review>>(`/reviews/product/${productId}`);
}

/* ------------------------------------------------------------------ */
/* Search (spec §33)                                                   */
/* ------------------------------------------------------------------ */

export interface SearchResults {
  products: ProductSummary[];
  categories: Category[];
  brands: Brand[];
  total: number;
}

export async function search(q: string): Promise<SearchResults> {
  // An empty query is a valid UI state (the bare /search landing), but it is not
  // a valid API call — the backend rejects `?q=` with a 422. Guard before the
  // transport split so neither path can send it.
  const needle = q.toLowerCase().trim();
  if (!needle) return { products: [], categories: [], brands: [], total: 0 };

  if (USE_MOCKS) {
    const mock = await import("./mock/data");
    const products = mock.products.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.brand.name.toLowerCase().includes(needle) ||
        p.category.name.toLowerCase().includes(needle) ||
        p.tagline.toLowerCase().includes(needle),
    );
    return {
      products,
      categories: mock.categories.filter((c) => c.name.toLowerCase().includes(needle)),
      brands: mock.brands.filter((b) => b.name.toLowerCase().includes(needle)),
      total: products.length,
    };
  }
  return get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

/**
 * Double opt-in by design: a successful call means "we sent a confirmation",
 * not "you are subscribed". The response is identical whether or not the
 * address was already on the list, so this cannot be used to test who is.
 */
export async function subscribeToNewsletter(
  payload: NewsletterSubscribeRequest,
): Promise<NewsletterSubscribeResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 600));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
      throw new ApiError("Invalid email", 422);
    }
    return { accepted: true, confirmationRequired: true };
  }

  const res = await fetch(`${API_URL}/newsletter/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError("Subscription failed", res.status);
  return res.json() as Promise<NewsletterSubscribeResponse>;
}

/**
 * Complete double opt-in with the token from the confirmation email.
 *
 * The 404 is meaningful and the only one that is: the API returns it for a
 * token that is unknown, already used, or malformed, deliberately without
 * distinguishing them. Anything else is a transport or server problem and
 * should read as "try again", not "your link is dead" — telling someone their
 * confirmation link expired when the API was simply down loses a subscriber
 * who was one click from confirmed.
 */
export async function confirmNewsletterSubscription(token: string): Promise<void> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 500));
    if (token === "expired") throw new ApiError("That link is no longer valid.", 404);
    return;
  }

  const res = await fetch(
    `${API_URL}/newsletter/confirm?${new URLSearchParams({ token }).toString()}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new ApiError("Confirmation failed", res.status);
}

/* ------------------------------------------------------------------ */
/* Contact / research requests                                         */
/* ------------------------------------------------------------------ */

export async function submitContactRequest(payload: ContactRequest): Promise<ContactResponse> {
  if (USE_MOCKS) {
    await new Promise((r) => setTimeout(r, 700));
    const ref = `PDY-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return { reference: ref, accepted: true };
  }

  const res = await fetch(`${API_URL}/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new ApiError("Could not send message", res.status);
  return res.json() as Promise<ContactResponse>;
}
