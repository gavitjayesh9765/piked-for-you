/**
 * Wire types and helpers for price tracking.
 *
 * Kept out of `admin-api.ts` because these are shared by Server Components
 * (which read through `adminGet`) and Client Components (which post through
 * `/admin/api/pricing/*`). Putting them in the server-only client module would
 * drag `getAdminSession` into the browser bundle.
 */

import type { RunStatus, ScrapeStatus } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export interface PriceRun {
  id: string;
  status: RunStatus;
  trigger: "manual" | "single_product" | "api";
  scope: RunScope;
  total: number;
  processed: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  skippedCount: number;
  cancelRequested: boolean;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/**
 * What a run covers. Everything is optional and the filters compose, so
 * "every Flipkart link in Headphones not checked in three days" is one run.
 */
export interface RunScope {
  productIds?: string[];
  categoryId?: string | null;
  brandId?: string | null;
  retailerSlugs?: string[];
  status?: "published" | "draft" | "archived" | "all";
  onlyStale?: boolean;
  staleHours?: number | null;
  onlyFailing?: boolean;
  limit?: number | null;
  /** Read everything, write nothing. The safe way to try a settings change. */
  dryRun?: boolean;
}

export interface RunResult {
  id: string;
  productId: string | null;
  productTitle: string | null;
  retailerName: string | null;
  status: ScrapeStatus;
  oldPrice: number | null;
  newPrice: number | null;
  currency: string | null;
  inStock: boolean | null;
  message: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  createdAt: string;
}

export interface PricingOverview {
  links: {
    total: number;
    scrapable: number;
    stale: number;
    failing: number;
    missingPrice: number;
  };
  historyPoints: number;
  staleAfterHours: number;
  activeRun: PriceRun | null;
  lastRun: PriceRun | null;
}

export interface PricingSettings {
  concurrency: number;
  delayMs: number;
  timeoutSeconds: number;
  maxRetries: number;
  respectRobots: boolean;
  userAgent: string;
  staleAfterHours: number;
  defaultEngine: "http" | "browser";
  maxChangePercent: number;
  autoApply: boolean;
  updateProductPrice: boolean;
  historyRetentionDays: number;
  updatedAt: string;
}

export interface RetailerScrapeConfig {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  displayOrder: number;
  scrapeEnabled: boolean;
  scrapeEngine: "http" | "browser";
  scrapeConfig: {
    priceSelectors?: string[];
    outOfStockSelectors?: string[];
    currency?: string | null;
    allowTextScan?: boolean;
  };
  linkCount: number;
  failingCount: number;
}

export interface ScopeFilters {
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
  retailers: { id: string; name: string; slug: string; scrapeEnabled: boolean }[];
}

export interface PreviewResult {
  ok: boolean;
  url: string;
  engine: string;
  price: number | null;
  currency: string | null;
  inStock: boolean | null;
  strategy: string | null;
  confidence: "high" | "medium" | "low" | null;
  raw: string | null;
  httpStatus: number | null;
  durationMs: number | null;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

/** A run is finished when nothing more will happen to it. */
export function isTerminal(status: RunStatus): boolean {
  return (
    status === "succeeded" ||
    status === "partial" ||
    status === "failed" ||
    status === "cancelled"
  );
}

/**
 * Design tokens per outcome, so every table renders a status the same way.
 *
 * `rejected` is warn rather than danger deliberately: nothing broke, we read a
 * price and declined to publish it. Painting it red alongside real failures
 * would train an editor to ignore the colour.
 */
export const SCRAPE_STATUS_STYLE: Record<
  ScrapeStatus,
  { label: string; tone: "value" | "neutral" | "warn" | "danger" }
> = {
  updated: { label: "Updated", tone: "value" },
  unchanged: { label: "Unchanged", tone: "neutral" },
  rejected: { label: "Held back", tone: "warn" },
  not_found: { label: "No price found", tone: "warn" },
  blocked: { label: "Blocked", tone: "danger" },
  error: { label: "Error", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
};

export const RUN_STATUS_STYLE: Record<
  RunStatus,
  { label: string; tone: "value" | "neutral" | "warn" | "danger" | "brand" }
> = {
  queued: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "brand" },
  succeeded: { label: "Succeeded", tone: "value" },
  partial: { label: "Partial", tone: "warn" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** "4m 12s" — a duration a person reads at a glance. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** "3 hours ago" / "just now". Absolute timestamps sit in the title attribute. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 5400) {
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? `${minutes}m ago` : "1h ago";
  }
  const hours = Math.round(seconds / 3600);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
