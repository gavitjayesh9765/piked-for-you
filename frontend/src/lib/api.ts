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
import * as mock from "./mock/data";

/**
 * The single seam between the UI and the backend.
 *
 * Every page imports from here and nothing else. Flipping
 * NEXT_PUBLIC_USE_MOCKS=0 swaps the transport without touching a component,
 * which is what keeps spec §54 honest — the frontend renders structured data
 * and holds no product-specific logic.
 *
 * Public endpoints return published content only; that filtering is enforced
 * server-side (spec §42), never here.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "0";

/** Public content is cacheable and revalidated on a short window (spec §48). */
const REVALIDATE = 300;

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed`, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ------------------------------------------------------------------ */
/* Homepage (spec §39)                                                 */
/* ------------------------------------------------------------------ */

export async function getHomepage(): Promise<HomepageSection[]> {
  if (USE_MOCKS) return mock.homepageSections.filter((s) => s.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
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
    return mock.homepageSections.find((s) => s.kind === "top_picks") ?? null;
  }
  const sections = await get<HomepageSection[]>("/homepage/top-picks");
  return sections[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export async function getCategories(): Promise<Category[]> {
  if (USE_MOCKS) return mock.categories;
  return get<Category[]>("/categories");
}

export async function getCategory(path: string[]): Promise<Category | null> {
  if (USE_MOCKS) {
    const slug = path[path.length - 1];
    return mock.categories.find((c) => c.slug === slug) ?? null;
  }
  try {
    return await get<Category>(`/categories/${path.join("/")}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getBrands(opts: { pinnedOnly?: boolean } = {}): Promise<Brand[]> {
  if (USE_MOCKS) return opts.pinnedOnly ? mock.brands.filter((b) => b.isPinned) : mock.brands;
  return get<Brand[]>(`/brands${opts.pinnedOnly ? "?pinned=true" : ""}`);
}

export async function getBrand(slug: string): Promise<Brand | null> {
  if (USE_MOCKS) return mock.brands.find((b) => b.slug === slug) ?? null;
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
  if (USE_MOCKS) return mock.productDetail(slug);
  try {
    return await get<Product>(`/products/${categorySlug}/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getAlternatives(productId: string, limit = 4): Promise<ProductSummary[]> {
  if (USE_MOCKS) return mock.products.filter((p) => p.id !== productId).slice(0, limit);
  return get<ProductSummary[]>(`/products/${productId}/alternatives?limit=${limit}`);
}

export async function getFacets(categorySlug?: string): Promise<FilterFacet[]> {
  if (USE_MOCKS) {
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
  return get<FilterFacet[]>(`/products/facets${categorySlug ? `?category=${categorySlug}` : ""}`);
}

/* ------------------------------------------------------------------ */
/* Reviews (spec §28)                                                  */
/* ------------------------------------------------------------------ */

export async function getReviews(productId: string): Promise<Paginated<Review>> {
  if (USE_MOCKS) {
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
