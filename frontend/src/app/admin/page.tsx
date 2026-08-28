import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  getAnalyticsPulse,
  getMetrics,
  listLogs,
  listProducts,
  safe,
  type AdminMetrics,
  type AnalyticsPulse,
} from "@/lib/admin-api";
import { formatPrice, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StatusPill } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/product/ScoreRing";
import { RowsArriving, ValueArriving } from "@/components/ui/Arriving";
import { Sparkline } from "@/components/admin/analytics/Charts";
import { StatTile } from "@/components/admin/analytics/StatTile";
import { AdminPage } from "@/components/admin/Shell";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Admin dashboard (spec §35).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PAGE IS FOR, WHICH DECIDES ITS ORDER
 *
 * It was nine identical count tiles in one flat grid, a catalogue table and a
 * log. Every number had the same visual weight, which meant the page answered
 * "what exists" and never "what needs me". "Brands: 12" sat beside "Reported
 * content: 3" in the same typeface at the same size, and the second one is the
 * only one worth opening the page for.
 *
 * So the page is now ordered by urgency rather than by entity:
 *
 *   1. NEEDS ATTENTION — queues with work in them. Hidden entirely when empty,
 *      because a permanent row of zeroes trains you to stop looking at it.
 *   2. THIS WEEK — is anyone reading, and are they clicking through. The
 *      commercial question, and the one nothing on this screen could answer
 *      before there was any analytics at all.
 *   3. CATALOGUE — what was touched most recently.
 *   4. ACTIVITY — the audit trail.
 *   5. LIBRARY — the reference counts. Last, small, and stated once.
 *
 * ---------------------------------------------------------------------------
 * FOUR INDEPENDENT SUSPENSE BOUNDARIES, NOT ONE PROMISE.ALL
 *
 * The four endpoints behind this page are not equally fast and do not depend
 * on each other, so each streams in on its own. The heading and the grid are
 * ours and render immediately; a slow analytics query cannot hold up the
 * moderation queue, which is the half of this page with something at stake.
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
  newsletter_subscribers: 0,
  newsletter_confirmed: 0,
};

/** See the ⚠ on `EMPTY` in admin/analytics/page.tsx: `hasData: true` is the
 *  safe default because it renders zeroes rather than a wrong diagnosis. */
const EMPTY_PULSE: AnalyticsPulse = {
  days: 7,
  pageViews: 0,
  productViews: 0,
  clicks: 0,
  ctr: 0,
  viewsChange: null,
  clicksChange: null,
  sparkline: [],
  hasData: true,
};

/**
 * ⚠ `cache()` HERE IS NOT AN OPTIMISATION, IT IS A CORRECTNESS-ADJACENT FIX.
 *
 * Two sections on this page need the metrics: <Attention/> at the top and
 * <Library/> at the bottom. They are separate Suspense boundaries on purpose —
 * the queues must not wait on anything — but that means two independent
 * `await`s of the same endpoint, and `request()` in lib/admin-api.ts is
 * `cache: "no-store"`, so Next's fetch deduplication does not apply.
 *
 * Without this the dashboard makes the same authenticated call twice per
 * render, and the two halves of the page could disagree: a review approved
 * between the two responses would show in one section and not the other.
 * React's `cache()` memoises per request, so both boundaries read one answer.
 */
const metricsOnce = cache(() => safe(getMetrics, EMPTY_METRICS));

const TILE_GRID = "repeat(auto-fit, minmax(min(220px, 100%), 1fr))";

export default function AdminDashboard() {
  return (
    <AdminPage
      title="Platform overview"
      eyebrow="Overview"
      description="What needs you, and what happened. Ordered by urgency rather than by entity."
    >
      <div className="flex flex-col gap-8">
        {/* --- 1. Queues with work in them (spec §35) --- */}
        <Suspense fallback={<AttentionArriving />}>
          <Attention />
        </Suspense>

        {/* --- 2. Readership (see components/analytics/PageView.tsx) --- */}
        <Suspense fallback={<PulseArriving />}>
          <Pulse />
        </Suspense>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          {/* --- 3. Product catalogue (spec §36) --- */}
          <Suspense fallback={<CataloguePanelArriving />}>
            <Catalogue />
          </Suspense>

          {/* --- 4. Activity log (spec §60) --- */}
          <Suspense fallback={<ActivityPanelArriving />}>
            <Activity />
          </Suspense>
        </div>

        {/* --- 5. Reference counts --- */}
        <Suspense fallback={null}>
          <Library />
        </Suspense>
      </div>
    </AdminPage>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Needs attention                                                  */
/* ------------------------------------------------------------------ */

/**
 * The queues, and only the ones with something in them.
 *
 * ⚠ THE EMPTY CASE RENDERS A SINGLE LINE, NOT FOUR ZEROES, and that is the
 * whole design. A dashboard that permanently shows "Pending reviews: 0" beside
 * "Reported content: 0" teaches you within a week that this region never
 * changes, and then the one morning it says 3 you scroll past it. Hiding the
 * empty rows is what keeps the region meaningful: if anything is here, it
 * needs doing.
 */
async function Attention() {
  const m = await metricsOnce();

  const queues = [
    {
      label: "Reported content",
      count: m.reported_reviews,
      href: "/admin/reports",
      hint: "Moderate now",
      tone: "danger" as const,
    },
    {
      label: "Pending reviews",
      count: m.pending_reviews,
      href: "/admin/reviews?status=pending",
      hint: "Waiting on a decision",
      tone: "warn" as const,
    },
    {
      label: "Open messages",
      count: m.open_messages,
      href: "/admin/messages?status=new",
      hint: "Unanswered",
      tone: "warn" as const,
    },
    {
      label: "Drafts",
      count: m.draft_products,
      href: "/admin/products?status=draft",
      hint: "Not visible publicly",
      tone: "neutral" as const,
    },
  ].filter((q) => q.count > 0);

  if (queues.length === 0) {
    return (
      <section className="panel flex items-center gap-3 border-value-line bg-value-soft/40 px-5 py-4">
        <span className="h-2 w-2 shrink-0 rounded-full bg-value" aria-hidden="true" />
        <p className="text-body-sm text-ink">
          Every queue is clear — no reports, no pending reviews, no unanswered messages, no drafts.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="t-eyebrow mb-3">Needs attention</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: TILE_GRID }}>
        {queues.map((q) => (
          <StatTile
            key={q.label}
            label={q.label}
            value={n(q.count)}
            hint={q.hint}
            tone={q.tone}
            href={q.href}
          />
        ))}
      </div>
    </section>
  );
}

function AttentionArriving() {
  return (
    <section aria-hidden="true">
      <h2 className="t-eyebrow mb-3">Needs attention</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: TILE_GRID }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="panel p-5">
            <p className="t-eyebrow">
              <ValueArriving width={10} />
            </p>
            <p className="tabular mt-3 font-display text-display-lg font-bold leading-none text-ink">
              <ValueArriving width={3} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Readership                                                       */
/* ------------------------------------------------------------------ */

async function Pulse() {
  const p = await safe(getAnalyticsPulse, EMPTY_PULSE);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="t-eyebrow">Last 7 days</h2>
        <Link
          href="/admin/analytics"
          className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
        >
          Full analytics
        </Link>
      </div>

      {!p.hasData ? (
        <div className="panel dot-matrix px-5 py-8 text-center">
          <p className="text-body-sm text-ink-muted">
            No traffic has been recorded yet.{" "}
            <Link href="/admin/analytics" className="text-brand hover:underline">
              What to check
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: TILE_GRID }}>
          <StatTile label="Page views" value={n(p.pageViews)} tone="brand">
            {p.sparkline.length > 1 ? (
              <Sparkline values={p.sparkline} className="w-full" />
            ) : null}
          </StatTile>
          <StatTile label="Product views" value={n(p.productViews)} change={p.viewsChange} />
          <StatTile
            label="Outbound clicks"
            value={n(p.clicks)}
            change={p.clicksChange}
            tone="warn"
          />
          <StatTile
            label="Click-through"
            value={`${p.ctr}%`}
            hint="Of product views"
            tone={p.ctr > 0 ? "value" : "neutral"}
          />
        </div>
      )}
    </section>
  );
}

function PulseArriving() {
  return (
    <section aria-hidden="true">
      <h2 className="t-eyebrow mb-3">Last 7 days</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: TILE_GRID }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel p-5">
            <p className="t-eyebrow">
              <ValueArriving width={9} />
            </p>
            <p className="tabular mt-3 font-display text-display-lg font-bold leading-none text-ink">
              <ValueArriving width={4} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Catalogue                                                        */
/* ------------------------------------------------------------------ */

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
        <div>
          <h2 className="text-headline-sm text-ink">Product catalogue</h2>
          <p className="t-eyebrow mt-1">
            {products.total > 0 ? `${n(products.total)} total` : "Most recently updated"}
          </p>
        </div>
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

/* ------------------------------------------------------------------ */
/* 4. Activity                                                         */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 5. Library                                                          */
/* ------------------------------------------------------------------ */

/**
 * The reference counts, stated once and quietly.
 *
 * These were four full-size tiles competing with the moderation queue for
 * attention. They are facts about the shape of the catalogue, not work — you
 * look at "Brands: 12" when you are about to add a brand, and never otherwise
 * — so they get one row at label size, at the bottom, where a fact belongs.
 */
async function Library() {
  const m = await metricsOnce();

  const items = [
    { label: "Published", value: m.published_products, href: "/admin/products?status=published" },
    { label: "Archived", value: m.archived_products, href: "/admin/products?status=archived" },
    { label: "Categories", value: m.categories, href: "/admin/categories" },
    { label: "Brands", value: m.brands, href: "/admin/brands" },
    {
      label: "Subscribers",
      value: m.newsletter_subscribers,
      href: "/admin/newsletter",
      // Both numbers, because the gap between them is the story. While
      // MAIL_PROVIDER is `disabled` the confirmed count is zero by
      // construction — nobody can click a link that was never sent — so a
      // figure showing only "confirmed" would read as nobody signing up.
      note:
        m.newsletter_subscribers > 0 ? `${n(m.newsletter_confirmed)} confirmed` : undefined,
    },
  ];

  return (
    <section className="panel px-5 py-4">
      <h2 className="t-eyebrow mb-3">Library</h2>
      <dl className="flex flex-wrap gap-x-8 gap-y-4">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className="group min-w-[100px] transition-colors duration-fast"
          >
            <dt className="font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {it.label}
            </dt>
            <dd
              className={cn(
                "tabular mt-1 text-headline-sm font-semibold text-ink",
                "group-hover:text-brand",
              )}
            >
              {n(it.value)}
              {it.note ? (
                <span className="ml-2 font-normal text-label-xs text-ink-faint">{it.note}</span>
              ) : null}
            </dd>
          </Link>
        ))}
      </dl>
    </section>
  );
}

const n = (v: number) => v.toLocaleString("en-IN");
