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
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

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
}

export const getMetrics = () => request<AdminMetrics>("/metrics");

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
  createdAt: string;
}

export const listMessages = (status = "new", page = 1) =>
  request<{ items: AdminMessage[]; total: number; hasMore: boolean }>(
    `/messages?${new URLSearchParams({ status, page: String(pageOf(page)) })}`,
  );

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
