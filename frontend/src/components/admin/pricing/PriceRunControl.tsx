"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import {
  formatDuration,
  isTerminal,
  timeAgo,
  type PriceRun,
  type RunResult,
  type RunScope,
  type ScopeFilters,
} from "@/lib/pricing";
import { RunStatusChip, ScrapeStatusChip } from "@/components/admin/pricing/StatusChip";
import { SearchSelect } from "@/components/ui/SearchSelect";

/**
 * The price refresh button, and everything that makes pressing it a decision
 * rather than a leap.
 *
 * Three things happen on this panel, in this order:
 *
 *   1. Pick a scope. Every filter composes, so an editor can refresh one
 *      category on one retailer rather than the whole catalogue.
 *   2. See what that costs — how many links, roughly how long — *before*
 *      pressing anything. This is why the estimate call exists.
 *   3. Watch it happen, and cancel if it is going wrong.
 *
 * There is no schedule behind any of this. A run exists because someone here
 * created one, which is also why cancelling has to work: the person who
 * started it is the person watching it.
 */

const POLL_MS = 2000;

/** How long we keep polling a run that never reaches a terminal status.
 *  Background work lives in the API process, so a restart mid-run leaves a job
 *  that will never finish — better to stop asking and say so. */
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

interface Props {
  filters: ScopeFilters;
  activeRun: PriceRun | null;
  lastRun: PriceRun | null;
  defaultStaleHours: number;
}

export function PriceRunControl({ filters, activeRun, lastRun, defaultStaleHours }: Props) {
  const router = useRouter();

  const scrapable = useMemo(
    () => filters.retailers.filter((r) => r.scrapeEnabled),
    [filters.retailers],
  );

  const [scope, setScope] = useState<RunScope>({
    retailerSlugs: [],
    categoryId: null,
    brandId: null,
    status: "published",
    onlyStale: false,
    staleHours: defaultStaleHours,
    onlyFailing: false,
    limit: null,
    dryRun: false,
  });

  const [estimate, setEstimate] = useState<{ linkCount: number; estimatedSeconds: number } | null>(
    null,
  );
  const [estimating, setEstimating] = useState(false);
  const [run, setRun] = useState<PriceRun | null>(activeRun ?? lastRun ?? null);
  const [results, setResults] = useState<RunResult[]>([]);
  const [resultFilter, setResultFilter] = useState<"problems" | "all">("problems");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  /** Live while a run is in flight; false once it settles. */
  const live = run !== null && !isTerminal(run.status);

  /* ---------------------------------------------------------------- */
  /* Estimate — recomputed as the scope changes                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    // Debounced: the scope changes on every keystroke in the limit field, and
    // each estimate is a real query over product_retailers upstream.
    const timer = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await fetch("/admin/api/pricing/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scope),
        });
        if (res.ok) setEstimate(await res.json());
        else setEstimate(null);
      } catch {
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [scope]);

  /* ---------------------------------------------------------------- */
  /* Polling                                                           */
  /* ---------------------------------------------------------------- */

  const loadResults = useCallback(async (runId: string, filter: "problems" | "all") => {
    try {
      const res = await fetch(`/admin/api/pricing/runs/${runId}?status=${filter}&limit=200`);
      if (!res.ok) return;
      const body = await res.json();
      setResults(body.results ?? []);
      if (body.run) setRun(body.run);
    } catch {
      /* a dropped poll is not worth surfacing; the next one recovers */
    }
  }, []);

  useEffect(() => {
    if (!live || run === null) return;

    let cancelled = false;
    const startedPollingAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;

      if (Date.now() - startedPollingAt > POLL_TIMEOUT_MS) {
        setError(
          "This run has not reported progress for a long time. It may have been " +
            "interrupted by an API restart — force-close it below and start again.",
        );
        return;
      }

      try {
        const res = await fetch(`/admin/api/pricing/runs/${run!.id}?status=problems&limit=200`);
        if (res.ok) {
          const body = await res.json();
          if (cancelled) return;
          setRun(body.run);
          setResults(body.results ?? []);

          if (isTerminal(body.run.status)) {
            // Prices changed underneath every other admin screen.
            router.refresh();
            return;
          }
        }
      } catch {
        /* keep polling — a transient failure is not the run failing */
      }

      timer = setTimeout(poll, POLL_MS);
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [live, run, router]);

  // Results for a run that finished before this component mounted — a page
  // reload after a run, which is the normal way an editor comes back to one.
  useEffect(() => {
    if (run && isTerminal(run.status) && results.length === 0) {
      void loadResults(run.id, resultFilter);
    }
    // Only on mount and when the run identity changes; re-running on every
    // `results` change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id]);

  /* ---------------------------------------------------------------- */
  /* Actions                                                           */
  /* ---------------------------------------------------------------- */

  async function start() {
    setBusy(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/admin/api/pricing/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Could not start the run. Try again in a moment.",
        );
        return;
      }
      setRun(body);
    } catch {
      setError("Could not reach the API.");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "cancel" | "reap") {
    if (!run) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/admin/api/pricing/runs/${run.id}/${action}`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof body?.detail === "string" ? body.detail : "That did not work.");
        return;
      }
      setRun(body);
    } catch {
      setError("Could not reach the API.");
    } finally {
      setBusy(false);
    }
  }

  async function applyHeldBack(resultId: string) {
    setApplying(resultId);
    setError(null);

    try {
      const res = await fetch(`/admin/api/pricing/results/${resultId}/apply`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof body?.detail === "string" ? body.detail : "Could not apply that price.");
        return;
      }
      // Drop the row: it is no longer held back, and leaving it in a list
      // headed "needs a human" would be a lie.
      setResults((prev) => prev.filter((r) => r.id !== resultId));
      router.refresh();
    } catch {
      setError("Could not reach the API.");
    } finally {
      setApplying(null);
    }
  }

  function patch(next: Partial<RunScope>) {
    setScope((prev) => ({ ...prev, ...next }));
  }

  function toggleRetailer(slug: string) {
    setScope((prev) => {
      const current = prev.retailerSlugs ?? [];
      return {
        ...prev,
        retailerSlugs: current.includes(slug)
          ? current.filter((s) => s !== slug)
          : [...current, slug],
      };
    });
  }

  const selectedRetailers = scope.retailerSlugs ?? [];
  const progress = run && run.total > 0 ? Math.round((run.processed / run.total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      {/* ---------------------------------------------------------- */}
      {/* Scope                                                       */}
      {/* ---------------------------------------------------------- */}
      <section className="panel p-6">
        <h2 className="font-display text-headline-sm text-ink">What to check</h2>
        <p className="mt-1 text-body-sm text-ink-muted">
          Leave everything untouched to refresh every published product. Each filter
          narrows the run.
        </p>

        <div className="mt-6 grid gap-5">
          <Field label="Retailers">
            <div className="flex flex-wrap gap-2">
              {scrapable.map((r) => {
                const on = selectedRetailers.includes(r.slug);
                return (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => toggleRetailer(r.slug)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 font-label text-label-xs font-semibold",
                      "uppercase tracking-[0.08em] transition-colors duration-fast",
                      on
                        ? "border-brand-line bg-brand-soft text-brand-on-soft"
                        : "border-line text-ink-muted hover:border-brand hover:text-brand",
                    )}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-label-xs text-ink-faint">
              {selectedRetailers.length === 0
                ? "All retailers."
                : `Only ${selectedRetailers.length} of ${scrapable.length}.`}
            </p>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select
                value={scope.categoryId ?? ""}
                onChange={(v) => patch({ categoryId: v || null })}
                search
                ariaLabel="Category"
                options={[
                  { value: "", label: "Every category" },
                  ...filters.categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </Field>

            <Field label="Brand">
              <Select
                value={scope.brandId ?? ""}
                onChange={(v) => patch({ brandId: v || null })}
                search
                ariaLabel="Brand"
                options={[
                  { value: "", label: "Every brand" },
                  ...filters.brands.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </Field>

            <Field label="Product status">
              <Select
                value={scope.status ?? "published"}
                onChange={(v) => patch({ status: v as RunScope["status"] })}
                options={[
                  { value: "published", label: "Published only" },
                  { value: "draft", label: "Drafts only" },
                  { value: "all", label: "Everything" },
                ]}
              />
            </Field>

            <Field label="Stop after">
              <input
                type="number"
                min={1}
                max={5000}
                value={scope.limit ?? ""}
                placeholder="No limit"
                onChange={(e) =>
                  patch({ limit: e.target.value ? Number(e.target.value) : null })
                }
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Narrow further">
            <div className="grid gap-2.5">
              <Check
                checked={!!scope.onlyStale}
                onChange={(v) => patch({ onlyStale: v })}
                label={`Only links not checked in ${scope.staleHours ?? defaultStaleHours} hours`}
                hint="Skips what was already verified recently — the cheapest useful run."
              />
              {scope.onlyStale && (
                <div className="ml-6">
                  <input
                    type="number"
                    min={0}
                    max={8760}
                    value={scope.staleHours ?? defaultStaleHours}
                    onChange={(e) => patch({ staleHours: Number(e.target.value) })}
                    className={cn(inputClass, "w-32")}
                  />
                </div>
              )}
              <Check
                checked={!!scope.onlyFailing}
                onChange={(v) => patch({ onlyFailing: v })}
                label="Only links that failed last time"
                hint="After fixing a retailer's selectors, this re-checks exactly what broke."
              />
              <Check
                checked={!!scope.dryRun}
                onChange={(v) => patch({ dryRun: v })}
                label="Dry run — read everything, write nothing"
                hint="Records what we would have found without touching a single price."
              />
            </div>
          </Field>
        </div>

        <div className="mt-7 border-t border-line pt-5">
          <button
            type="button"
            onClick={start}
            disabled={busy || live || estimate?.linkCount === 0}
            className={cn(
              "inline-flex h-12 w-full items-center justify-center rounded-full px-6",
              "bg-brand-fill font-label text-label-xs font-bold uppercase tracking-[0.1em]",
              "text-brand-on shadow-brand transition-all duration-fast",
              "hover:brightness-110 disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {live
              ? "A run is already in progress"
              : busy
                ? "Starting…"
                : scope.dryRun
                  ? "Dry run"
                  : "Refresh prices now"}
          </button>

          <p className="mt-3 text-center text-label-xs text-ink-faint">
            {estimating ? (
              "Counting…"
            ) : estimate ? (
              estimate.linkCount === 0 ? (
                "Nothing matches this scope."
              ) : (
                <>
                  <span className="tabular text-ink-muted">{estimate.linkCount}</span> link
                  {estimate.linkCount === 1 ? "" : "s"} · about{" "}
                  <span className="tabular text-ink-muted">
                    {formatDuration(estimate.estimatedSeconds)}
                  </span>
                </>
              )
            ) : (
              " "
            )}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-body-sm text-danger">
            {error}
          </p>
        )}
      </section>

      {/* ---------------------------------------------------------- */}
      {/* Progress and results                                        */}
      {/* ---------------------------------------------------------- */}
      <section className="panel p-6">
        {run === null ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <p className="text-body-sm text-ink-muted">No price run has been started yet.</p>
            <p className="mt-1 max-w-sm text-label-xs text-ink-faint">
              Nothing checks prices on its own. Every run on this site starts with the
              button on the left.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <RunStatusChip status={run.status} />
                <span className="text-label-xs text-ink-faint">
                  {run.trigger === "single_product" ? "single product · " : ""}
                  started {timeAgo(run.startedAt ?? run.createdAt)}
                </span>
              </div>

              {live ? (
                <button
                  type="button"
                  onClick={() => act("cancel")}
                  disabled={busy || run.cancelRequested}
                  className={secondaryButtonClass}
                >
                  {run.cancelRequested ? "Stopping…" : "Cancel"}
                </button>
              ) : null}
            </div>

            {/* Progress bar. Present even when finished, because "384 of 400"
                is the fastest way to see that a run was cut short. */}
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-label-xs">
                <span className="text-ink-muted">
                  <span className="tabular text-ink">{run.processed}</span> of{" "}
                  <span className="tabular">{run.total}</span> links
                </span>
                <span className="tabular text-ink-faint">{progress}%</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    run.status === "failed" ? "bg-danger" : "bg-brand-fill",
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Updated" value={run.updatedCount} tone="value" />
              <Stat label="Unchanged" value={run.unchangedCount} />
              <Stat label="Problems" value={run.failedCount} tone="danger" />
              <Stat label="Skipped" value={run.skippedCount} />
            </dl>

            {run.error && (
              <p className="mt-4 rounded-md border border-danger bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
                {run.error}
              </p>
            )}

            {run.status === "running" && !live && (
              <button type="button" onClick={() => act("reap")} className={secondaryButtonClass}>
                Force-close this run
              </button>
            )}

            {/* --- Results --- */}
            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-ink">
                  {resultFilter === "problems" ? "Needs attention" : "Every result"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const next = resultFilter === "problems" ? "all" : "problems";
                    setResultFilter(next);
                    void loadResults(run.id, next);
                  }}
                  className="font-label text-label-xs uppercase tracking-[0.08em] text-ink-subtle hover:text-brand"
                >
                  {resultFilter === "problems" ? "Show all" : "Show problems only"}
                </button>
              </div>

              {results.length === 0 ? (
                <p className="py-8 text-center text-body-sm text-ink-faint">
                  {live
                    ? "Working…"
                    : resultFilter === "problems"
                      ? "Nothing needs attention. Every link read cleanly."
                      : "No results recorded."}
                </p>
              ) : (
                <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
                  {results.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-body-sm font-medium text-ink">
                            {r.productTitle ?? "—"}
                          </p>
                          <p className="text-label-xs text-ink-faint">{r.retailerName ?? "—"}</p>
                        </div>
                        <ScrapeStatusChip status={r.status} />
                      </div>

                      {(r.oldPrice !== null || r.newPrice !== null) && (
                        <p className="tabular mt-1.5 text-body-sm text-ink-muted">
                          {r.oldPrice !== null
                            ? formatPrice(r.oldPrice, r.currency ?? "INR")
                            : "—"}{" "}
                          <span aria-hidden="true">→</span>{" "}
                          <span
                            className={cn(
                              r.status === "updated" && "font-medium text-ink",
                              r.status === "rejected" && "text-warn-on-soft",
                            )}
                          >
                            {r.newPrice !== null
                              ? formatPrice(r.newPrice, r.currency ?? "INR")
                              : "—"}
                          </span>
                        </p>
                      )}

                      {r.message && (
                        <p className="mt-1.5 text-label-xs leading-relaxed text-ink-faint">
                          {r.message}
                        </p>
                      )}

                      {r.status === "rejected" && r.newPrice !== null && (
                        <button
                          type="button"
                          onClick={() => applyHeldBack(r.id)}
                          disabled={applying === r.id}
                          className={cn(secondaryButtonClass, "mt-2")}
                        >
                          {applying === r.id ? "Applying…" : "Apply this price anyway"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

const inputClass =
  "h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-full border border-line-strong px-4 font-label " +
  "text-label-xs font-semibold uppercase tracking-[0.08em] text-ink transition-colors " +
  "duration-fast hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-45";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * `search` swaps the native control for the type-to-filter combobox.
 *
 * Set on the two scope pickers backed by catalogue tables and not on the
 * three-item status enum below them: the same rule the rest of the admin
 * follows — a list whose length is a data fact gets a search box, a list whose
 * length is a code fact does not.
 */
function Select({
  value,
  onChange,
  options,
  search,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  search?: boolean;
  ariaLabel?: string;
}) {
  if (search) {
    return (
      <SearchSelect
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel={ariaLabel}
        placeholder={options[0]?.label}
        className={inputClass}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={cn(inputClass, "cursor-pointer")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-brand-fill)]"
      />
      <span className="min-w-0">
        <span className="block text-body-sm text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-label-xs text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "value" | "danger";
}) {
  return (
    <div className="rounded-md border border-line bg-surface-1 px-3 py-2.5">
      <dt className="font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd
        className={cn(
          "tabular mt-1 text-headline-sm font-bold",
          value === 0 ? "text-ink-faint" : tone === "value" ? "text-value" : tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
