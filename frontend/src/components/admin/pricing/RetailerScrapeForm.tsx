"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import type { PreviewResult, RetailerScrapeConfig } from "@/lib/pricing";

/**
 * One retailer's engine and selectors, with a Test button next to them.
 *
 * The Test button is the point of this screen. Without it, fixing a selector
 * means editing a config, starting a real run across the catalogue, and
 * reading a results table to find out whether the guess was right — a loop
 * slow enough that people stop tuning selectors and start living with broken
 * ones. With it, the loop is about four seconds.
 *
 * Selectors live in the database rather than in Python for the same reason: a
 * retailer changing its markup is a Tuesday, and a redeploy is not an
 * acceptable answer to it.
 */
export function RetailerScrapeForm({ retailer }: { retailer: RetailerScrapeConfig }) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(retailer.scrapeEnabled);
  const [engine, setEngine] = useState(retailer.scrapeEngine);
  const [priceSelectors, setPriceSelectors] = useState(
    (retailer.scrapeConfig.priceSelectors ?? []).join("\n"),
  );
  const [oosSelectors, setOosSelectors] = useState(
    (retailer.scrapeConfig.outOfStockSelectors ?? []).join("\n"),
  );
  const [currency, setCurrency] = useState(retailer.scrapeConfig.currency ?? "");
  const [allowTextScan, setAllowTextScan] = useState(
    retailer.scrapeConfig.allowTextScan ?? true,
  );

  const [testUrl, setTestUrl] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [testing, setTesting] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function lines(value: string): string[] {
    return value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function touched() {
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/admin/api/pricing/retailers/${retailer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrapeEnabled: enabled,
          scrapeEngine: engine,
          priceSelectors: lines(priceSelectors),
          outOfStockSelectors: lines(oosSelectors),
          currency: currency.trim().toUpperCase() || null,
          allowTextScan,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.detail === "string" ? body.detail : "Could not save the configuration.",
        );
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not reach the API.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (!testUrl.trim()) return;
    setTesting(true);
    setPreview(null);
    setError(null);

    try {
      const res = await fetch("/admin/api/pricing/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: testUrl.trim(),
          retailerId: retailer.id,
          engine,
          // The selectors currently in the textarea, saved or not — the whole
          // point is to try a candidate before committing it to every product
          // on this retailer.
          priceSelectors: lines(priceSelectors),
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof body?.detail === "string" ? body.detail : "The test could not run.");
        return;
      }
      setPreview(body);
    } catch {
      setError("Could not reach the API.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h3 className="font-display text-headline-sm text-ink">{retailer.name}</h3>
          <p className="mt-1 text-label-xs text-ink-faint">
            <span className="tabular">{retailer.linkCount}</span> product link
            {retailer.linkCount === 1 ? "" : "s"}
            {retailer.failingCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-danger">
                  {retailer.failingCount} failing
                </span>
              </>
            )}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-label-xs text-ink-subtle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              touched();
            }}
            className="h-3.5 w-3.5 accent-[var(--c-brand-fill)]"
          />
          Include in price runs
        </label>
      </div>

      <div className="mt-5 grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div>
            <Label>Engine</Label>
            <select
              value={engine}
              onChange={(e) => {
                setEngine(e.target.value as "http" | "browser");
                touched();
              }}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="http">Plain request — fast, cheap</option>
              <option value="browser">Headless browser — for JavaScript prices</option>
            </select>
            <Hint>
              Most storefronts render the price server-side so Google can see it, which
              the plain request handles. Switch to the browser only when a test finds
              nothing on a page that clearly shows a price.
            </Hint>
          </div>

          <div>
            <Label>Currency</Label>
            <input
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                touched();
              }}
              maxLength={3}
              placeholder="INR"
              className={cn(inputClass, "uppercase")}
            />
            <Hint>Used only when the page does not say.</Hint>
          </div>
        </div>

        <div>
          <Label>Price selectors</Label>
          <textarea
            value={priceSelectors}
            onChange={(e) => {
              setPriceSelectors(e.target.value);
              touched();
            }}
            rows={5}
            spellCheck={false}
            placeholder="span.a-price span.a-offscreen"
            className={cn(inputClass, "h-auto py-2.5 font-mono text-label-xs leading-relaxed")}
          />
          <Hint>
            One CSS selector per line, tried in order. The first one that resolves to a
            number wins. A selector that no longer matches is skipped rather than
            treated as an error, so a stale line here costs nothing but the try.
          </Hint>
        </div>

        <div>
          <Label>Out-of-stock selectors</Label>
          <textarea
            value={oosSelectors}
            onChange={(e) => {
              setOosSelectors(e.target.value);
              touched();
            }}
            rows={2}
            spellCheck={false}
            className={cn(inputClass, "h-auto py-2.5 font-mono text-label-xs leading-relaxed")}
          />
          <Hint>If any of these is present on the page, the product is marked unavailable.</Hint>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={allowTextScan}
            onChange={(e) => {
              setAllowTextScan(e.target.checked);
              touched();
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-brand-fill)]"
          />
          <span>
            <span className="block text-body-sm text-ink">
              Fall back to scanning the page text
            </span>
            <span className="mt-0.5 block text-label-xs text-ink-faint">
              Last resort when no selector and no structured data match. It reports low
              confidence, so a price found this way needs a much smaller change before it
              is held back for review.
            </span>
          </span>
        </label>
      </div>

      {/* --- Test --- */}
      <div className="mt-6 rounded-md border border-line bg-surface-1 p-4">
        <Label>Test against a real product page</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder={`https://www.${retailer.slug}.in/…`}
            className={cn(inputClass, "font-mono text-label-xs")}
          />
          <button
            type="button"
            onClick={test}
            disabled={testing || !testUrl.trim()}
            className={cn(secondaryButtonClass, "h-10 shrink-0")}
          >
            {testing ? "Fetching…" : "Test"}
          </button>
        </div>

        {preview && (
          <div
            className={cn(
              "mt-3 rounded-md border px-4 py-3",
              preview.ok
                ? "border-value-line bg-value-soft"
                : "border-transparent bg-danger-soft",
            )}
          >
            {preview.ok ? (
              <>
                <p className="tabular text-body-md font-semibold text-value-on-soft">
                  {preview.currency ?? ""} {preview.price}
                </p>
                <p className="mt-1 text-label-xs text-value-on-soft">
                  Found by <strong>{preview.strategy}</strong> ({preview.confidence}{" "}
                  confidence)
                  {preview.inStock === false && " · reported out of stock"}
                  {preview.durationMs !== null && ` · ${preview.durationMs}ms`}
                </p>
                {preview.raw && (
                  <p className="mt-1.5 break-all font-mono text-[11px] text-value-on-soft opacity-80">
                    read from “{preview.raw}”
                  </p>
                )}
              </>
            ) : (
              <p className="text-body-sm text-danger-on-soft">{preview.error}</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={secondaryButtonClass}
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
        {error ? (
          <span role="alert" className="text-body-sm text-danger">
            {error}
          </span>
        ) : saved ? (
          <span className="text-body-sm text-value">Saved.</span>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

const secondaryButtonClass =
  "inline-flex h-10 items-center rounded-full border border-line-strong px-5 font-label " +
  "text-label-xs font-semibold uppercase tracking-[0.08em] text-ink transition-colors " +
  "duration-fast hover:border-brand hover:text-brand disabled:pointer-events-none disabled:opacity-45";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
      {children}
    </p>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-label-xs leading-relaxed text-ink-faint">{children}</p>;
}
