import { getAccessToken } from "@/lib/supabase/server";
import type { Paginated, ProductSummary } from "@/lib/types";

/**
 * Server-side client for the caller's own data.
 *
 * Every endpoint scopes to the user id in the verified token — no user id
 * appears in any path or body — so the classic IDOR shape does not exist on
 * this surface. Row Level Security enforces the same rule at the database.
 *
 * All calls are `no-store`: a cached shortlist served to the next visitor
 * would be a data leak.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_URL}/me${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface SavedItem {
  id: string;
  product: ProductSummary;
  note: string | null;
  createdAt: string;
}

export const listSaved = (page = 1) =>
  request<Paginated<SavedItem>>(`/saved?page=${page}`);

export const savedIds = () => request<string[]>("/saved/ids");

export interface Preferences {
  categoryIds: string[];
  brandIds: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  useCase: string | null;
  notifyPriceDrops: boolean;
  notifyNewPicks: boolean;
}

export const getPreferences = () => request<Preferences>("/preferences");

export const forYou = (limit = 8) =>
  request<ProductSummary[]>(`/for-you?limit=${limit}`);

/** Degrade to a fallback rather than crashing a page. Safe here: it shows
 *  *less*, never more. */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
