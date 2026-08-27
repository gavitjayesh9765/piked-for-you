// Single source of truth, and validated there: an unset NEXT_PUBLIC_API_URL
// fails the build rather than silently resolving to a loopback address no
// deployed instance can reach.
import { API_URL } from "@/lib/env";
import { getAdminSession } from "@/lib/supabase/server";
import { isProductSort } from "@/lib/product-sort";
import type { Paginated, Product, ProductSummary } from "@/lib/types";

/**
 * Server-side admin API client.
 *
 * Forwards the caller's own access token — never a service-role key. The API
 * re-verifies it and checks `app_metadata.role` plus MFA on every request, so
 * this client grants nothing by itself; it only carries the caller's identity.
 *
 * Resolution goes through `getAdminSession()` rather than a bare
 * `getAccessToken()`: a page that is not being viewed by a verified admin
 * should not be issuing admin requests at all, even ones the API would refuse.
 * The refusal is cheaper and more honest here.
 *
 * Every call is `no-store`: admin data includes unpublished content and must
 * never be cached.
 */

/** A hung API should fail the render, not hold a server worker open. */
const TIMEOUT_MS = 15_000;

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getAdminSession();
  if (!session.ok) {
    throw new AdminApiError(
      session.reason,
      session.reason === "anonymous" ? 401 : 403,
      session.reason,
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    throw new AdminApiError(
      timedOut ? "The API did not respond in time." : "The API is unreachable.",
      timedOut ? 504 : 502,
    );
  }

  if (!res.ok) {
    let detail: unknown;
    try {
      detail = (await res.json())?.detail;
    } catch {
      /* non-JSON error body */
    }
    // 403 with detail "mfa_required" means the password was right but the
    // second factor is outstanding — the caller should route to enrolment
    // rather than show "access denied".
    throw new AdminApiError(
      typeof detail === "string" ? detail : `Request failed (${res.status})`,
      res.status,
      detail,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * A gated GET for Server Components.
 *
 * Six admin pages each carried their own copy of this — a bare
 * `getAccessToken()`, a `fetch`, a swallowed error — with no admin check of
 * their own, no timeout, and query values interpolated unescaped. One helper,
 * gated the same way as everything else.
 */
export async function adminGet<T>(
  path: string,
  fallback: T,
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = [...qs.keys()].length ? `?${qs}` : "";
  return safe(() => request<T>(`${path}${suffix}`), fallback);
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface AdminMetrics {
  published_products: number;
  draft_products: number;
  archived_products: number;
  categories: number;
  brands: number;
  pending_reviews: number;
  reported_reviews: number;
  open_messages: number;
  newsletter_subscribers: number;
  newsletter_confirmed: number;
}

export const getMetrics = () => request<AdminMetrics>("/metrics");

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

/**
 * Traffic counters. Read `supabase/migrations/20260827180440_analytics_daily.sql`
 * for what these numbers are and — more importantly — what they are not.
 *
 * The short version for anyone reading a screen built on these: they are
 * pre-aggregated daily counts with no visitor identity behind them at all.
 * There is no way to ask "who" or "in what order" of this data, and no UI built
 * on it should imply otherwise.
 */

/** A percentage change against the previous equal-length period, or `null`
 *  where the previous period was zero and no percentage exists. Rendering
 *  `null` as 0% or as +100% would both be inventions — the UI says
 *  "no prior data". */
export type Change = number | null;

export interface AnalyticsSeriesPoint {
  day: string;
  views: number;
  clicks: number;
  pageViews: number;
}

export interface AnalyticsProductRow {
  id: string;
  title: string;
  slug: string;
  status?: string;
  brand: string;
  category?: string;
  views: number;
  clicks: number;
  /** Clicks as a percentage of views, one decimal. 0 when views is 0. */
  ctr: number;
}

export interface AnalyticsKeyRow {
  key: string;
  count: number;
}

export interface AnalyticsOverview {
  days: number;
  start: string;
  end: string;
  totals: {
    pageViews: number;
    productViews: number;
    clicks: number;
    ctr: number;
    pageViewsChange: Change;
    productViewsChange: Change;
    clicksChange: Change;
  };
  series: AnalyticsSeriesPoint[];
  topProducts: AnalyticsProductRow[];
  topConverting: AnalyticsProductRow[];
  retailers: { id: string; name: string; clicks: number }[];
  paths: AnalyticsKeyRow[];
  referrers: AnalyticsKeyRow[];
  devices: AnalyticsKeyRow[];
  /** False when NOTHING has ever been recorded — which looks identical to a
   *  quiet week in every other field, and is the only one of the two that
   *  means something is broken. */
  hasData: boolean;
}

export interface AnalyticsPulse {
  days: number;
  pageViews: number;
  productViews: number;
  clicks: number;
  ctr: number;
  viewsChange: Change;
  clicksChange: Change;
  sparkline: number[];
  hasData: boolean;
}

/** Windows the API accepts. Anything else is coerced to 30 server-side. */
export type AnalyticsWindow = 7 | 30 | 90;

export const getAnalytics = (days: AnalyticsWindow = 30) =>
  request<AnalyticsOverview>(`/analytics?days=${days}`);

export const getAnalyticsPulse = () => request<AnalyticsPulse>("/analytics/pulse");

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export function listProducts(params: {
  status?: string;
  q?: string;
  page?: number;
  sort?: string;
  categoryId?: string;
  brandId?: string;
  retailer?: string;
  priceState?: string;
  staleHours?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (isProductSort(params.sort)) qs.set("sort", params.sort);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.brandId) qs.set("brandId", params.brandId);
  if (params.retailer) qs.set("retailer", params.retailer);
  if (params.priceState) qs.set("priceState", params.priceState);
  if (params.staleHours !== undefined) qs.set("staleHours", String(params.staleHours));
  qs.set("page", String(pageOf(params.page)));
  return request<Paginated<ProductSummary>>(`/products?${qs}`);
}

/**
 * A page number that came from a URL.
 *
 * `Number(searchParams.page)` yields NaN for "abc" and -1 for "-1", both of
 * which reached the API as a literal `page=NaN`. Clamped to something the API
 * can act on so a hand-edited URL renders an empty list, not an error.
 */
function pageOf(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

export const getProduct = (id: string) => request<Product>(`/products/${id}`);

export interface PublishCheck {
  canPublish: boolean;
  missing: string[];
}
export const publishCheck = (id: string) =>
  request<PublishCheck>(`/products/${id}/publish-check`);

export const listRetailers = () =>
  request<{ id: string; name: string; slug: string }[]>("/retailers");

/* ------------------------------------------------------------------ */
/* Moderation & queues                                                 */
/* ------------------------------------------------------------------ */

export interface AdminReview {
  id: string;
  productId: string;
  productTitle: string;
  author: string;
  rating: number;
  title: string | null;
  body: string;
  status: string;
  isFeatured: boolean;
  mediaCount: number;
  createdAt: string;
}

export const listReviews = (status = "pending", page = 1) =>
  request<{ items: AdminReview[]; total: number; hasMore: boolean }>(
    `/reviews?${new URLSearchParams({ status, page: String(pageOf(page)) })}`,
  );

export interface AdminMessage {
  id: string;
  reference: string;
  topic: string;
  categorySlugs: string[];
  name: string | null;
  email: string;
  message: string;
  budgetRange: string | null;
  productUrl: string | null;
  organisation: string | null;
  status: string;
  internalNote: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface AdminMessageList {
  items: AdminMessage[];
  /** Per-status totals for the filter tabs, plus `all`. Grouped in one query
   *  upstream — the tabs are chrome and must not cost a round trip each. */
  counts: Record<string, number>;
  total: number;
  page: number;
  hasMore: boolean;
}

export const listMessages = (
  params: { status?: string; topic?: string; q?: string; page?: number } = {},
) => {
  const qs = new URLSearchParams({
    status: params.status ?? "new",
    page: String(pageOf(params.page)),
  });
  if (params.topic) qs.set("topic", params.topic);
  if (params.q) qs.set("q", params.q);
  return request<AdminMessageList>(`/messages?${qs}`);
};

export interface AdminSubscriber {
  id: string;
  email: string;
  frequency: string;
  /** Derived upstream from confirmed_at / unsubscribed_at / is_active — there
   *  is no `status` column, and a fifth column duplicating four others is a
   *  column that can disagree with them. */
  state: "pending" | "confirmed" | "unsubscribed";
  confirmedAt: string | null;
  /** NULL means no confirmation has ever been sent — which is every row while
   *  MAIL_PROVIDER is `disabled`. That is the record that makes "who still
   *  needs asking?" answerable once mail is switched on. */
  confirmationSentAt: string | null;
  unsubscribedAt: string | null;
  source: string | null;
  createdAt: string;
}

export interface AdminSubscriberList {
  items: AdminSubscriber[];
  /** Whole-table totals for the tabs, not filtered ones. */
  counts: Record<string, number>;
  total: number;
  page: number;
  hasMore: boolean;
}

export const listSubscribers = (
  params: { state?: string; frequency?: string; q?: string; page?: number } = {},
) => {
  const qs = new URLSearchParams({
    state: params.state ?? "all",
    page: String(pageOf(params.page)),
  });
  if (params.frequency) qs.set("frequency", params.frequency);
  if (params.q) qs.set("q", params.q);
  return request<AdminSubscriberList>(`/newsletter?${qs}`);
};

export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  reviewCount: number;
  createdAt: string;
}

export const listUsers = (q?: string, page = 1) => {
  const qs = new URLSearchParams({ page: String(pageOf(page)) });
  if (q) qs.set("q", q);
  return request<{ items: AdminUser[]; total: number; hasMore: boolean }>(`/users?${qs}`);
};

export interface AdminLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export const listLogs = (entityType?: string, page = 1) => {
  const qs = new URLSearchParams({ page: String(pageOf(page)) });
  if (entityType) qs.set("entity_type", entityType);
  return request<{ items: AdminLog[]; total: number; hasMore: boolean }>(`/logs?${qs}`);
};

/**
 * Wraps an admin call so a page can render an empty state instead of crashing
 * when the API is unreachable or the session has lapsed. Returning a fallback
 * is safe here — it shows *less*, never more.
 */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
