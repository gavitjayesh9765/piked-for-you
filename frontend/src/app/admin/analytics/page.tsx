import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import {
  getAnalytics,
  safe,
  type AnalyticsOverview,
  type AnalyticsProductRow,
  type AnalyticsWindow,
} from "@/lib/admin-api";
import { cn } from "@/lib/cn";
import { StatusPill } from "@/components/ui/Badge";
import { RowsArriving, ValueArriving } from "@/components/ui/Arriving";
import { BarList, TrafficChart } from "@/components/admin/analytics/Charts";
import { StatTile } from "@/components/admin/analytics/StatTile";

export const metadata: Metadata = { title: "Analytics", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Traffic and outbound clicks (spec §35, extended).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN CAN AND CANNOT ANSWER
 *
 * Everything here is built on daily counters with no visitor identity behind
 * them — no session id, no IP, no user id, no cookie. See the header of
 * `supabase/migrations/20260827180440_analytics_daily.sql` for why.
 *
 * Answerable: how many people read us, which products they read, which ones
 * they clicked through from, which retailer earns those clicks, where readers
 * arrive from, and how all of that is trending.
 *
 * NOT answerable, and no chart here should be read as implying otherwise:
 * anything about an individual. There are no funnels, no sessions, no
 * "visitors who read X then bought Y", and no bounce rate — a bounce rate
 * requires knowing that two page views came from the same person, which is
 * exactly the fact this schema does not hold.
 *
 * If a question needs the second list, it needs a different table and a
 * consent banner, and that is a decision rather than a feature request.
 */

const WINDOWS: { days: AnalyticsWindow; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const parsed = Number(sp.days);
  // Coerced here as well as server-side. The API refuses anything outside the
  // set, so this is about the tab highlight agreeing with the data rather than
  // about safety.
  const days: AnalyticsWindow = ([7, 30, 90] as const).includes(parsed as AnalyticsWindow)
    ? (parsed as AnalyticsWindow)
    : 30;

  return (
    <div className="mx-auto w-full max-w-wide">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-lg text-ink">Analytics</h1>
          <p className="t-eyebrow mt-2">Readership and outbound clicks</p>
        </div>

        <nav aria-label="Time window" className="flex gap-1 rounded-full border border-line p-1">
          {WINDOWS.map((w) => (
            <Link
              key={w.days}
              href={`/admin/analytics?days=${w.days}`}
              aria-current={w.days === days ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 font-label text-label-xs uppercase tracking-[0.1em] transition-colors duration-fast",
                w.days === days
                  ? "bg-brand-fill text-brand-on"
                  : "text-ink-subtle hover:text-brand",
              )}
            >
              {w.label}
            </Link>
          ))}
        </nav>
      </header>

      <Suspense key={days} fallback={<AnalyticsArriving />}>
        <Report days={days} />
      </Suspense>
    </div>
  );
}

async function Report({ days }: { days: AnalyticsWindow }) {
  const data = await safe(() => getAnalytics(days), EMPTY);

  // The state that matters most and is easiest to miss: this looks exactly
  // like a quiet week, and it is not one.
  if (!data.hasData) {
    return <NothingRecordedYet />;
  }

  const { totals } = data;

  return (
    <div className="flex flex-col gap-6">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}
      >
        <StatTile
          label="Page views"
          value={n(totals.pageViews)}
          change={totals.pageViewsChange}
          tone="brand"
        />
        <StatTile
          label="Product views"
          value={n(totals.productViews)}
          change={totals.productViewsChange}
          hint="Views of a product page specifically"
        />
        <StatTile
          label="Outbound clicks"
          value={n(totals.clicks)}
          change={totals.clicksChange}
          tone="warn"
          hint="Readers who left for a retailer"
        />
        <StatTile
          label="Click-through rate"
          value={`${totals.ctr}%`}
          // No change figure on purpose. A CTR delta is a ratio of ratios, and
          // it moves for two unrelated reasons — more clicks, or fewer views —
          // which makes "CTR down 8%" a sentence that cannot be acted on
          // without looking at the two tiles to its left anyway.
          hint="Of product views, in this window"
          tone={totals.ctr > 0 ? "value" : "neutral"}
        />
      </div>

      <section className="panel p-5 sm:p-6">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="text-headline-sm text-ink">Traffic</h2>
          <p className="font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            {data.start} → {data.end}
          </p>
        </div>
        <TrafficChart series={data.series} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProductTable
          title="Most read"
          caption="Ranked by product page views"
          rows={data.topProducts}
          empty="No product views recorded in this window."
        />
        <ProductTable
          title="Most clicked"
          caption="Ranked by outbound clicks — not the same list"
          rows={data.topConverting}
          empty="No outbound clicks recorded in this window."
          highlight="clicks"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Retailers" caption="Where the clicks go">
          <BarList
            tone="retail"
            rows={data.retailers.map((r) => ({ key: r.name, count: r.clicks }))}
            empty="No outbound clicks yet."
          />
        </Panel>

        <Panel title="Pages" caption="By route, not by URL">
          <BarList rows={data.paths} empty="No page views yet." />
        </Panel>

        <Panel title="Referrers" caption="External sources only">
          <BarList
            tone="value"
            rows={data.referrers}
            empty="No external referrers yet — direct visits and links that strip the referrer are not counted here."
          />
        </Panel>
      </div>

      <Panel title="Devices" caption="Three buckets, deliberately">
        <BarList rows={data.devices} empty="No device data yet." />
      </Panel>

      <p className="px-1 pb-2 text-body-sm leading-relaxed text-ink-faint">
        These counters are anonymous and pre-aggregated: no cookies, no session
        identifiers, no IP addresses, nothing that can be traced to a person.
        Known crawlers are filtered by user agent, so the numbers run slightly
        below raw server hits — and closer to real readership. Individual
        visitor journeys are not recorded and cannot be reconstructed.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProductTable({
  title,
  caption,
  rows,
  empty,
  highlight = "views",
}: {
  title: string;
  caption: string;
  rows: AnalyticsProductRow[];
  empty: string;
  highlight?: "views" | "clicks";
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line p-5">
        <h2 className="text-headline-sm text-ink">{title}</h2>
        <p className="t-eyebrow mt-1">{caption}</p>
      </div>

      {rows.length === 0 ? (
        <div className="dot-matrix py-14 text-center">
          <p className="text-body-sm text-ink-muted">{empty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {["Product", "Views", "Clicks", "CTR"].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-5 py-3 font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint",
                      i > 0 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors duration-fast hover:bg-surface-1">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/products/${r.id}`}
                      className="text-body-sm font-medium text-ink hover:text-brand"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-2 text-label-xs text-ink-faint">
                      {r.brand}
                      {/* Only where the API sent one — `topConverting` does not
                          carry a status, and a pill rendered from `undefined`
                          would claim the product is in a state nobody set. */}
                      {r.status && r.status !== "published" ? (
                        <StatusPill status={r.status} />
                      ) : null}
                    </p>
                  </td>
                  <td
                    className={cn(
                      "tabular px-5 py-3 text-right text-body-sm",
                      highlight === "views" ? "font-semibold text-ink" : "text-ink-subtle",
                    )}
                  >
                    {n(r.views)}
                  </td>
                  <td
                    className={cn(
                      "tabular px-5 py-3 text-right text-body-sm",
                      highlight === "clicks" ? "font-semibold text-retail" : "text-ink-subtle",
                    )}
                  >
                    {n(r.clicks)}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-body-sm text-ink-subtle">
                    {r.views > 0 ? `${r.ctr}%` : "—"}
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

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line p-5">
        <h2 className="text-headline-sm text-ink">{title}</h2>
        {caption ? <p className="t-eyebrow mt-1">{caption}</p> : null}
      </div>
      <div className="py-1">{children}</div>
    </section>
  );
}

/**
 * The empty state that is actually a diagnosis.
 *
 * Every number on this screen is zero in two completely different situations,
 * and only one of them is a problem. `hasData` is the only thing that tells
 * them apart, so this state says what to check rather than "no data yet".
 */
function NothingRecordedYet() {
  return (
    <section className="panel dot-matrix p-10 text-center">
      <h2 className="text-headline-sm text-ink">Nothing has been recorded yet</h2>
      <p className="mx-auto mt-3 max-w-prose text-body-md leading-relaxed text-ink-muted">
        Not a quiet week — this is the state before the first beacon ever
        arrives. If the site has had visitors since the analytics migration was
        applied, something in the chain is not connected.
      </p>
      <ul className="mx-auto mt-5 max-w-prose space-y-2 text-left text-body-sm text-ink-subtle">
        <li>
          <strong className="text-ink">The migration.</strong> Check that{" "}
          <code className="text-label-xs">20260827180440_analytics_daily.sql</code> has run on this
          environment.
        </li>
        <li>
          <strong className="text-ink">The API.</strong>{" "}
          <code className="text-label-xs">POST /api/v1/track</code> should answer 204.
        </li>
        <li>
          <strong className="text-ink">The site.</strong>{" "}
          <code className="text-label-xs">NEXT_PUBLIC_API_URL</code> must be set in the front-end
          deployment, and the API&rsquo;s <code className="text-label-xs">CORS_ORIGINS</code> must
          name the site&rsquo;s origin — the beacon is a cross-origin POST and is blocked without it.
        </li>
        <li>
          <strong className="text-ink">Your own visit.</strong> Admin pages are not tracked, and an
          ad blocker will stop the beacon on the public site too. Test in a clean window.
        </li>
      </ul>
    </section>
  );
}

function AnalyticsArriving() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel p-5">
            <p className="tabular font-display text-headline-lg font-bold leading-none text-ink">
              <ValueArriving width={4} />
            </p>
            <p className="t-eyebrow mt-3">
              <ValueArriving width={10} />
            </p>
          </div>
        ))}
      </div>
      <div className="panel h-[300px]" />
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <section key={i} className="panel overflow-hidden">
            <div className="border-b border-line p-5">
              <h2 className="text-headline-sm text-ink">Loading</h2>
            </div>
            <div className="px-5">
              <RowsArriving rows={6} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const n = (v: number) => v.toLocaleString("en-IN");

/**
 * The shape returned when the API is unreachable.
 *
 * ⚠ `hasData: true` is deliberate and is the opposite of what it looks like.
 * `safe()` returns this on a network failure, and `hasData: false` renders the
 * "nothing has ever been recorded" diagnosis above — which would send whoever
 * is reading it to check a migration when the real problem is that the API is
 * down. Zeroes with a working chart frame are the honest rendering of "we
 * could not reach the API"; a confident misdiagnosis is not.
 */
const EMPTY: AnalyticsOverview = {
  days: 30,
  start: "",
  end: "",
  totals: {
    pageViews: 0,
    productViews: 0,
    clicks: 0,
    ctr: 0,
    pageViewsChange: null,
    productViewsChange: null,
    clicksChange: null,
  },
  series: [],
  topProducts: [],
  topConverting: [],
  retailers: [],
  paths: [],
  referrers: [],
  devices: [],
  hasData: true,
};
