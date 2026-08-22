import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { adminGet } from "@/lib/admin-api";
import { cn } from "@/lib/cn";
import { formatDuration, timeAgo, type PriceRun, type PricingOverview, type PricingSettings, type RetailerScrapeConfig, type ScopeFilters } from "@/lib/pricing";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";
import { TableArriving, ValueArriving } from "@/components/ui/Arriving";
import { PriceRunControl } from "@/components/admin/pricing/PriceRunControl";
import { PricingSettingsForm } from "@/components/admin/pricing/PricingSettingsForm";
import { RetailerScrapeForm } from "@/components/admin/pricing/RetailerScrapeForm";
import { RunStatusChip } from "@/components/admin/pricing/StatusChip";

export const metadata: Metadata = { title: "Pricing", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = new Set(["run", "retailers", "settings", "history"]);

const EMPTY_OVERVIEW: PricingOverview = {
  links: { total: 0, scrapable: 0, stale: 0, failing: 0, missingPrice: 0 },
  historyPoints: 0,
  staleAfterHours: 24,
  activeRun: null,
  lastRun: null,
};

const EMPTY_FILTERS: ScopeFilters = { categories: [], brands: [], retailers: [] };

/**
 * Price tracking.
 *
 * Four screens behind one page, because they are four steps of one job:
 * decide what to check, fix the retailer that keeps failing, tune how hard we
 * push, and look at what past runs did.
 *
 * The thing worth stating plainly, because it is the design and not an
 * omission: **nothing here runs on a schedule.** There is no cron entry, no
 * pg_cron job, no timer in the API. A price run exists because somebody
 * pressed the button on this page, which is also why every run records who
 * started it and what scope they chose.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = TABS.has(sp.tab ?? "") ? sp.tab! : "run";

  return (
    <AdminPage
      title="Pricing"
      eyebrow="System"
      description="Check retailer prices, keep a record of what they were, and control exactly how and when that happens."
    >
      {/* Nothing on this page is automatic, and an editor should not have to
          infer that from the absence of a schedule field. */}
      <div className="mb-6 rounded-lg border border-line bg-surface-1 px-5 py-4">
        <p className="text-body-sm text-ink-muted">
          <span className="font-medium text-ink">Prices are never checked automatically.</span>{" "}
          There is no scheduled job anywhere in this system — every run below was started
          by a person, and the next one will be too.
        </p>
      </div>

      <Suspense fallback={<MetricsArriving />}>
        <Metrics />
      </Suspense>

      <FilterTabs
        basePath="/admin/pricing"
        param="tab"
        active={tab}
        options={[
          { value: "run", label: "Run" },
          { value: "retailers", label: "Retailers" },
          { value: "settings", label: "Settings" },
          { value: "history", label: "Past runs" },
        ]}
      />

      <Suspense key={tab} fallback={<TableArriving rows={4} />}>
        <TabPanel tab={tab} />
      </Suspense>
    </AdminPage>
  );
}

/* ------------------------------------------------------------------ */

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-0 px-4 py-3.5">
      <p className="font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 font-display text-headline-sm font-bold",
          value === 0
            ? "text-ink-faint"
            : tone === "danger"
              ? "text-danger"
              : tone === "warn"
                ? "text-warn"
                : "text-ink",
        )}
      >
        {value.toLocaleString("en-IN")}
      </p>
      {hint && <p className="mt-0.5 text-label-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/**
 * Past runs.
 *
 * Deliberately shows who-ran-what-when rather than aggregate throughput: when
 * a wrong price reaches the site, the first question is which run wrote it,
 * and the second is what scope that run covered.
 */
function RunHistory({ runs }: { runs: PriceRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="py-12 text-center text-body-sm text-ink-faint">
        No price runs yet. Start one from the Run tab.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {["Started", "Status", "Scope", "Links", "Updated", "Problems", "Took"].map((h) => (
              <th
                key={h}
                className="px-3 py-2.5 font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {runs.map((run) => {
            const seconds =
              run.startedAt && run.finishedAt
                ? (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                : null;

            return (
              <tr key={run.id} className="transition-colors duration-fast hover:bg-surface-1">
                <td className="px-3 py-3">
                  <span
                    className="text-body-sm text-ink"
                    title={new Date(run.createdAt).toLocaleString()}
                  >
                    {timeAgo(run.startedAt ?? run.createdAt)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <RunStatusChip status={run.status} />
                </td>
                <td className="max-w-xs px-3 py-3">
                  <span className="text-body-sm text-ink-muted">{describeScope(run)}</span>
                </td>
                <td className="tabular px-3 py-3 text-body-sm text-ink-muted">{run.total}</td>
                <td className="tabular px-3 py-3 text-body-sm">
                  <span className={run.updatedCount ? "text-value" : "text-ink-faint"}>
                    {run.updatedCount}
                  </span>
                </td>
                <td className="tabular px-3 py-3 text-body-sm">
                  <span className={run.failedCount ? "text-danger" : "text-ink-faint"}>
                    {run.failedCount}
                  </span>
                </td>
                <td className="tabular px-3 py-3 text-body-sm text-ink-faint">
                  {seconds === null ? "—" : formatDuration(seconds)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-4 text-label-xs text-ink-faint">
        Every run is also in the{" "}
        <Link href="/admin/logs?entity_type=price_scrape_job" className="text-brand hover:underline">
          activity log
        </Link>
        , with the admin who started it.
      </p>
    </div>
  );
}

/** A scope, in words. "Everything published" is the common case and says so. */
function describeScope(run: PriceRun): string {
  const scope = run.scope ?? {};
  const parts: string[] = [];

  if (run.trigger === "single_product") return "One product";
  if (scope.dryRun) parts.push("dry run");
  if (scope.retailerSlugs?.length) parts.push(scope.retailerSlugs.join(", "));
  if (scope.categoryId) parts.push("one category");
  if (scope.brandId) parts.push("one brand");
  if (scope.onlyStale) parts.push(`stale >${scope.staleHours ?? "?"}h`);
  if (scope.onlyFailing) parts.push("previously failing");
  if (scope.limit) parts.push(`first ${scope.limit}`);
  if (scope.status && scope.status !== "published") parts.push(scope.status);

  return parts.length ? parts.join(" · ") : "Everything published";
}

/**
 * Five endpoints back this screen and they used to be awaited together, in
 * front of everything — so switching between Run, Retailers, Settings and Past
 * runs waited on all five every time, including the four the chosen tab does
 * not use. The notice and the tabs are now synchronous, and the two parts that
 * need data stream independently.
 */
async function Metrics() {
  const overview = await adminGet<PricingOverview>("/pricing/overview", EMPTY_OVERVIEW);

  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Retailer links" value={overview.links.total} />
        <Metric
          label="In price runs"
          value={overview.links.scrapable}
          hint={
            overview.links.scrapable < overview.links.total
              ? `${overview.links.total - overview.links.scrapable} excluded`
              : undefined
          }
        />
        <Metric
          label={`Stale (>${overview.staleAfterHours}h)`}
          value={overview.links.stale}
          tone={overview.links.stale > 0 ? "warn" : undefined}
        />
        <Metric
          label="Failing"
          value={overview.links.failing}
          tone={overview.links.failing > 0 ? "danger" : undefined}
        />
        <Metric label="History points" value={overview.historyPoints} />
    </div>
  );
}

function MetricsArriving() {
  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface-0 px-4 py-3.5">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            <ValueArriving width={9} />
          </p>
          <p className="tabular mt-1.5 font-display text-headline-sm font-bold text-ink-faint">
            <ValueArriving width={3} />
          </p>
        </div>
      ))}
    </div>
  );
}

async function TabPanel({ tab }: { tab: string }) {
  // Only what the visible tab actually needs. `overview` is memoized with the
  // request <Metrics> already made, so the Run tab costs one extra call rather
  // than two.
  const [overview, filters, settings, retailers, runs] = await Promise.all([
    tab === "run"
      ? adminGet<PricingOverview>("/pricing/overview", EMPTY_OVERVIEW)
      : Promise.resolve(EMPTY_OVERVIEW),
    tab === "run"
      ? adminGet<ScopeFilters>("/pricing/filters", EMPTY_FILTERS)
      : Promise.resolve(EMPTY_FILTERS),
    tab === "settings"
      ? adminGet<PricingSettings | null>("/pricing/settings", null)
      : Promise.resolve(null),
    tab === "retailers"
      ? adminGet<RetailerScrapeConfig[]>("/pricing/retailers", [])
      : Promise.resolve([] as RetailerScrapeConfig[]),
    tab === "history"
      ? adminGet<{ items: PriceRun[] }>("/pricing/runs", { items: [] })
      : Promise.resolve({ items: [] as PriceRun[] }),
  ]);

  return (
    <div className="mt-6">
        {tab === "run" && (
          <PriceRunControl
            filters={filters}
            activeRun={overview.activeRun}
            lastRun={overview.lastRun}
            defaultStaleHours={overview.staleAfterHours}
          />
        )}

        {tab === "retailers" && (
          <div className="grid gap-6">
            <p className="max-w-3xl text-body-sm text-ink-muted">
              Selectors live in the database, not in the code, so a retailer changing its
              markup is an edit here rather than a deploy. Use <strong>Test</strong> against
              a real product page before saving — it fetches the page and reports which
              strategy found the price, without writing anything.
            </p>
            {retailers.length === 0 ? (
              <p className="text-body-sm text-ink-faint">No retailers configured.</p>
            ) : (
              retailers.map((r) => <RetailerScrapeForm key={r.id} retailer={r} />)
            )}
          </div>
        )}

        {tab === "settings" &&
          (settings ? (
            <PricingSettingsForm settings={settings} />
          ) : (
            <p className="text-body-sm text-danger">
              Pricing settings could not be loaded. Check that the pricing migration has
              been applied.
            </p>
          ))}

        {tab === "history" && <RunHistory runs={runs.items ?? []} />}
    </div>
  );
}
