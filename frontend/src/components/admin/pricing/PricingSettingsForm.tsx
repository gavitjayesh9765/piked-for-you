"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import type { PricingSettings } from "@/lib/pricing";

/**
 * The run's knobs.
 *
 * These are settings rather than environment variables because they are turned
 * by an editor while watching a run misbehave — a retailer starts refusing
 * requests, the delay goes up, the run is tried again. An editor cannot deploy.
 *
 * Every bound here is mirrored by a CHECK constraint on the table. The
 * validation in this form is for the message; the constraint is for the
 * guarantee.
 */
export function PricingSettingsForm({ settings }: { settings: PricingSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<PricingSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<PricingSettings>) {
    setForm((prev) => ({ ...prev, ...next }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/admin/api/pricing/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concurrency: form.concurrency,
          delayMs: form.delayMs,
          timeoutSeconds: form.timeoutSeconds,
          maxRetries: form.maxRetries,
          respectRobots: form.respectRobots,
          userAgent: form.userAgent,
          staleAfterHours: form.staleAfterHours,
          defaultEngine: form.defaultEngine,
          maxChangePercent: form.maxChangePercent,
          autoApply: form.autoApply,
          updateProductPrice: form.updateProductPrice,
          historyRetentionDays: form.historyRetentionDays,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.detail === "string" ? body.detail : "Could not save.");
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ------------------------------------------------------------ */}
      <section className="panel p-6">
        <h3 className="font-display text-headline-sm text-ink">Politeness</h3>
        <p className="mt-1 text-body-sm text-ink-muted">
          These sites are not ours. The defaults are deliberately gentle; turning them
          up is how a working scraper becomes a blocked one.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Parallel requests"
            value={form.concurrency}
            min={1}
            max={16}
            onChange={(v) => patch({ concurrency: v })}
            hint="Across all retailers at once."
          />
          <NumberField
            label="Gap between requests (ms)"
            value={form.delayMs}
            min={0}
            max={60000}
            step={100}
            onChange={(v) => patch({ delayMs: v })}
            hint="Per host, not overall — two retailers are never made to wait for each other."
          />
          <NumberField
            label="Timeout (seconds)"
            value={form.timeoutSeconds}
            min={5}
            max={120}
            onChange={(v) => patch({ timeoutSeconds: v })}
          />
          <NumberField
            label="Retries"
            value={form.maxRetries}
            min={0}
            max={5}
            onChange={(v) => patch({ maxRetries: v })}
            hint="Timeouts and 5xx only. A refusal is never retried."
          />
        </div>

        <div className="mt-5">
          <Label>User-Agent</Label>
          <input
            value={form.userAgent}
            onChange={(e) => patch({ userAgent: e.target.value })}
            maxLength={300}
            className={cn(inputClass, "font-mono text-label-xs")}
          />
          <Hint>
            Identify the crawler honestly and leave a contact address in it. A site
            operator who can tell what is hitting them can ask us to stop, which is
            better for everyone than being quietly blocked.
          </Hint>
        </div>

        <div className="mt-5">
          <Check
            checked={form.respectRobots}
            onChange={(v) => patch({ respectRobots: v })}
            label="Honour robots.txt"
            hint="On by default. Turning it off is a decision someone owns, which is why it lives here and not in a config file."
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="panel p-6">
        <h3 className="font-display text-headline-sm text-ink">What a run is allowed to change</h3>
        <p className="mt-1 text-body-sm text-ink-muted">
          A scraped number reaching the live site is a decision, not a default.
        </p>

        <div className="mt-5 grid gap-5">
          <NumberField
            label="Hold back changes larger than (%)"
            value={form.maxChangePercent}
            min={1}
            max={100}
            onChange={(v) => patch({ maxChangePercent: v })}
            hint={
              "A price 90% below the last one is almost always a selector that " +
              "wandered onto an EMI instalment, not a sale. Anything past this is " +
              "recorded and left for a human. Low-confidence readings get a tighter " +
              "threshold than this one automatically."
            }
          />

          <Check
            checked={form.autoApply}
            onChange={(v) => patch({ autoApply: v })}
            label="Write accepted prices to the live links"
            hint="Turn this off to make every run a read-only audit — which is what you want the first time."
          />
          <Check
            checked={form.updateProductPrice}
            onChange={(v) => patch({ updateProductPrice: v })}
            label="Update the product's headline price"
            hint="The product shows the cheapest active link, recomputed from all of them rather than taken from whichever ran last."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Consider a price stale after (hours)"
              value={form.staleAfterHours}
              min={0}
              max={8760}
              onChange={(v) => patch({ staleAfterHours: v })}
            />
            <NumberField
              label="Keep history for (days)"
              value={form.historyRetentionDays}
              min={30}
              max={3650}
              onChange={(v) => patch({ historyRetentionDays: v })}
            />
          </div>

          <div>
            <Label>Default engine</Label>
            <select
              value={form.defaultEngine}
              onChange={(e) => patch({ defaultEngine: e.target.value as "http" | "browser" })}
              className={cn(inputClass, "cursor-pointer")}
            >
              <option value="http">Plain request</option>
              <option value="browser">Headless browser</option>
            </select>
            <Hint>Used by a retailer that has not chosen one of its own.</Hint>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 border-t border-line pt-5">
          <button type="button" onClick={save} disabled={saving} className={buttonClass}>
            {saving ? "Saving…" : "Save settings"}
          </button>
          {error ? (
            <span role="alert" className="text-body-sm text-danger">
              {error}
            </span>
          ) : saved ? (
            <span className="text-body-sm text-value">Saved.</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

const buttonClass =
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

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          // Clamp here rather than letting an out-of-range value reach the API
          // and come back as a 422 the editor has to decode.
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, next)));
        }}
        className={cn(inputClass, "tabular")}
      />
      {hint && <Hint>{hint}</Hint>}
    </div>
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
        {hint && <span className="mt-0.5 block text-label-xs leading-relaxed text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}
