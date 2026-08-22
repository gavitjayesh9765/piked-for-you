import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";

import { getMetrics, listLogs, listProducts, safe, type AdminMetrics } from "@/lib/admin-api";
import { formatPrice, relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/product/ScoreRing";
import { RowsArriving, ValueArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Admin dashboard (spec §35).
 *
 * Every number and every log line on this page used to be a literal in the
 * source — "1,284 published products", an activity feed naming products that
 * may not exist. The catalogue table was fetched from the *public* API, so it
 * showed only published rows: the one view whose entire purpose is drafts and
 * moderation queues was the one view that could not see them.
 *
 * A dashboard that reports invented numbers is worse than no dashboard. An
 * empty one tells you the API is unreachable; a confident one tells you
 * nothing is wrong. Both endpoints exist and are now what this reads.
 */
const EMPTY_METRICS: AdminMetrics = {
  published_products: 0,
  draft_products: 0,
  archived_products: 0,
  categories: 0,
  brands: 0,
  pending_reviews: 0,
  reported_reviews: 0,
  open_messages: 0,
};

/**
 * The three endpoints behind this page are independent and are not equally
 * fast, so they no longer share one `Promise.all` in front of the whole
 * screen. Each has its own boundary and lands when it lands: the metric tiles
 * are usually first, the catalogue and the activity feed follow. The heading
 * and the grid itself are ours and render immediately.
 */
export default function AdminDashboard() {
  return (
    <div className="mx-auto w-full max-w-wide">
      <header className="mb-8">
        <h1 className="font-display text-display-lg text-ink">Platform overview</h1>
        <p className="t-eyebrow mt-2">System metrics and recent activity</p>
      </header>

      {/* --- Metrics (spec §35) --- */}
      <Suspense fallback={<MetricsArriving />}>
        <Metrics />
      </Suspense>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        {/* --- Product catalogue (spec §36) --- */}
        <Suspense fallback={<CataloguePanelArriving />}>
          <Catalogue />
        </Suspense>

        {/* --- Activity log (spec §60) --- */}
        <Suspense fallback={<ActivityPanelArriving />}>
          <Activity />
        </Suspense>
      </div>
    </div>
  );
}

const METRIC_GRID = "repeat(auto-fit, minmax(min(220px, 100%), 1fr))";

async function Metrics() {
  const metrics = await safe(getMetrics, EMPTY_METRICS);
  const number = (n: number) => n.toLocaleString("en-IN");

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: METRIC_GRID }}>
        <Metric
          label="Published products"
          value={number(metrics.published_products)}
          delta="Live on the public site"
          tone="value"
          href="/admin/products?status=published"
        />
        <Metric
          label="Drafts"
          value={number(metrics.draft_products)}
          delta={metrics.draft_products > 0 ? "Not visible publicly" : undefined}
          href="/admin/products?status=draft"
        />
        <Metric
          label="Pending reviews"
          value={number(metrics.pending_reviews)}
          delta={metrics.pending_reviews > 0 ? "Waiting on a decision" : "Queue is clear"}
          tone={metrics.pending_reviews > 0 ? "warn" : "neutral"}
          href="/admin/reviews?status=pending"
        />
        <Metric
          label="Reported content"
          value={number(metrics.reported_reviews)}
          delta={metrics.reported_reviews > 0 ? "Moderate now" : "Nothing reported"}
          tone={metrics.reported_reviews > 0 ? "danger" : "neutral"}
          href="/admin/reports"
        />
        <Metric
          label="Open messages"
          value={number(metrics.open_messages)}
          href="/admin/messages?status=new"
        />
        <Metric label="Categories" value={number(metrics.categories)} href="/admin/categories" />
        <Metric label="Brands" value={number(metrics.brands)} href="/admin/brands" />
        <Metric
          label="Archived"
          value={number(metrics.archived_products)}
          href="/admin/products?status=archived"
        />
    </div>
  );
}

/** Eight tiles at their real size, so the grid below never jumps. */
function MetricsArriving() {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: METRIC_GRID }}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="panel p-5" aria-hidden="true">
          <p className="tabular font-display text-headline-lg font-bold leading-none text-ink">
            <ValueArriving width={4} />
          </p>
          <p className="t-eyebrow mt-3">
            <ValueArriving width={10} />
          </p>
        </div>
      ))}
    </div>
  );
}

async function Catalogue() {
  const products = await safe(() => listProducts({ page: 1 }), {
    items: [],
    total: 0,
    page: 1,
    pageSize: 25,
    hasMore: false,
  });
  const recent = products.items.slice(0, 8);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line p-5">
        <h2 className="text-headline-sm text-ink">Product catalogue</h2>
        <Link
          href="/admin/products"
          className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
        >
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="dot-matrix border-t border-line py-16 text-center">
          <p className="text-body-md text-ink-muted">No products yet.</p>
          <Link
            href="/admin/products/new"
            className="mt-3 inline-block font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {["Product", "Brand / Category", "Price", "Score", "Status", ""].map((h, i) => (
                  <th
                    key={h || `col-${i}`}
                    className="px-5 py-3 font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="stagger divide-y divide-line">
              {recent.map((p) => (
                <tr key={p.id} className="transition-colors duration-fast hover:bg-surface-1">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="plate relative h-10 w-10 shrink-0 overflow-hidden rounded-sm border border-line">
                        {p.primaryImage?.url ? (
                          <Image
                            src={p.primaryImage.url}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <div className="dot-matrix h-full w-full" />
                        )}
                      </div>
                      <span className="text-body-sm font-medium text-ink">{p.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-body-sm text-ink">{p.brand.name}</p>
                    <p className="text-label-xs text-ink-faint">{p.category.name}</p>
                  </td>
                  <td className="tabular px-5 py-3 text-body-sm text-ink">
                    {p.pricing.current ? (
                      formatPrice(p.pricing.current, p.pricing.currency)
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {p.score ? (
                      <ScoreRing score={p.score.overall} size="sm" showLabel={false} />
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** The catalogue panel's frame and its row rhythm, held still. */
function CataloguePanelArriving() {
  return (
    <section className="panel overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between gap-4 border-b border-line p-5">
        <h2 className="text-headline-sm text-ink">Product catalogue</h2>
      </div>
      <div className="px-5">
        <RowsArriving rows={8} />
      </div>
    </section>
  );
}

function ActivityPanelArriving() {
  return (
    <section className="panel" aria-hidden="true">
      <div className="border-b border-line p-5">
        <h2 className="text-headline-sm text-ink">Recent activity</h2>
      </div>
      <div className="px-5">
        <RowsArriving rows={6} />
      </div>
    </section>
  );
}

async function Activity() {
  const logs = await safe(() => listLogs(undefined, 1), { items: [], total: 0, hasMore: false });

  return (
    <section className="panel">
      <div className="border-b border-line p-5">
        <h2 className="text-headline-sm text-ink">Recent activity</h2>
      </div>

      {logs.items.length === 0 ? (
        <div className="dot-matrix border-t border-line py-14 text-center">
          <p className="text-body-sm text-ink-muted">Nothing logged yet.</p>
        </div>
      ) : (
        <ol className="stagger divide-y divide-line">
          {logs.items.slice(0, 6).map((entry) => (
            <li key={entry.id} className="flex gap-3 p-5">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: `var(--c-${toneFor(entry.action)})` }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                {/* Plain text. The summary is composed server-side from
                    admin input, and this is not the place to trust it. */}
                <p className="text-body-sm text-ink">
                  {entry.summary ?? `${entry.action} · ${entry.entityType}`}
                </p>
                <p className="font-label text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                  {relativeTime(entry.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="border-t border-line p-4 text-center">
        <Link
          href="/admin/logs"
          className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
        >
          View all logs
        </Link>
      </div>
    </section>
  );
}

/** Colour by what the action did, not by which entity it touched. */
function toneFor(action: string): "value" | "danger" | "warn" | "brand" {
  if (action.includes("publish") && !action.includes("unpublish")) return "value";
  if (action.includes("approve")) return "value";
  if (action.includes("delete") || action.includes("reject") || action.includes("archive")) {
    return "danger";
  }
  if (action.includes("unpublish") || action.includes("hide")) return "warn";
  return "brand";
}

function Metric({
  label,
  value,
  delta,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "value" | "warn" | "danger";
  href?: string;
}) {
  const deltaColor = {
    neutral: "text-ink-subtle",
    value: "text-value",
    warn: "text-warn",
    danger: "text-danger",
  }[tone];

  const body = (
    <>
      <p className="t-eyebrow">{label}</p>
      <p className="tabular mt-3 text-display-lg font-bold leading-none text-ink">{value}</p>
      {delta && <p className={`mt-2 text-body-sm ${deltaColor}`}>{delta}</p>}
    </>
  );

  return href ? (
    <Link href={href} className="panel p-5 transition-colors duration-fast hover:border-brand-line">
      {body}
    </Link>
  ) : (
    <div className="panel p-5">{body}</div>
  );
}
