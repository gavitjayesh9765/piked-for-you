"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { Badge, Brand, Category, Product, SpecTemplateGroup } from "@/lib/types";
import {
  SpecEditor,
  specPayload,
  specValuesFrom,
  unmappedSpecs,
  type SpecValues,
} from "@/components/admin/SpecEditor";

/**
 * Product create / edit form (spec §37).
 *
 * Six sections, numbered 01-06: Basics · Pricing · The verdict ·
 * Specifications · Badges · SEO.
 *
 * Media, retailer links, price history and the score are NOT here, and the
 * list above used to claim they were. They all key off a product id, so they
 * live on the edit screen as sections 07-11 and only exist once a draft has
 * been saved.
 *
 * Three deliberate behaviours:
 *
 *  - **Save never publishes.** Creating always yields a draft; publishing is a
 *    separate, audited action (spec §38). The API enforces this too —
 *    `ProductCreate.status` is `Literal["draft"]`.
 *  - **String-list fields are one-per-line textareas**, not a bespoke tag
 *    widget. Pros, cons and audience fit are written in prose by an editor;
 *    a chip input would slow that down for no gain.
 *  - **Specification fields come from the category** (spec §41), and change
 *    live when the category select changes — picking Mice swaps a driver and
 *    a frequency response for a sensor and a polling rate. Values already
 *    typed are kept in state rather than discarded, so flipping the category
 *    to check something does not cost the editor their work.
 */
export function ProductForm({
  product,
  categories,
  brands,
  badges,
  specTemplates = {},
}: {
  product?: Product;
  categories: Category[];
  brands: Brand[];
  badges: Badge[];
  /**
   * Category id → its effective specification template, already resolved up
   * the tree by the API. Keyed by every category so switching the select does
   * not need a round trip mid-form.
   */
  specTemplates?: Record<string, SpecTemplateGroup[]>;
}) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [f, setF] = useState({
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    brandId: product?.brand.id ?? brands[0]?.id ?? "",
    categoryId: product?.category.id ?? categories[0]?.id ?? "",
    tagline: product?.tagline ?? "",
    shortDescription: product?.shortDescription ?? "",
    description: product?.description ?? "",
    currency: product?.pricing.currency ?? "INR",
    priceCurrent: product?.pricing.current?.toString() ?? "",
    priceMin: product?.pricing.min?.toString() ?? "",
    priceMax: product?.pricing.max?.toString() ?? "",
    verdict: product?.verdict ?? "",
    bestFor: (product?.bestFor ?? []).join("\n"),
    notIdealFor: (product?.notIdealFor ?? []).join("\n"),
    pros: (product?.pros ?? []).join("\n"),
    cons: (product?.cons ?? []).join("\n"),
    metaTitle: product?.seo?.metaTitle ?? "",
    metaDescription: product?.seo?.metaDescription ?? "",
  });

  const [badgeIds, setBadgeIds] = useState<string[]>(
    (product?.badges ?? []).map((b) => b.id),
  );
  const [specs, setSpecs] = useState<SpecValues>(() =>
    specValuesFrom(product?.specifications),
  );

  const specTemplate = useMemo(
    () => specTemplates[f.categoryId] ?? [],
    [specTemplates, f.categoryId],
  );
  const categoryName = useMemo(
    () => categories.find((c) => c.id === f.categoryId)?.name,
    [categories, f.categoryId],
  );
  const unmapped = useMemo(
    () => unmappedSpecs(product?.specifications, specTemplate),
    [product?.specifications, specTemplate],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  const lines = (v: string) =>
    v.split("\n").map((s) => s.trim()).filter(Boolean);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const body: Record<string, unknown> = {
      title: f.title.trim(),
      brandId: f.brandId,
      categoryId: f.categoryId,
      tagline: f.tagline.trim(),
      shortDescription: f.shortDescription.trim() || null,
      description: f.description.trim() || null,
      currency: f.currency,
      priceCurrent: num(f.priceCurrent),
      priceMin: num(f.priceMin),
      priceMax: num(f.priceMax),
      verdict: f.verdict.trim() || null,
      bestFor: lines(f.bestFor),
      notIdealFor: lines(f.notIdealFor),
      pros: lines(f.pros),
      cons: lines(f.cons),
      badgeIds,
      metaTitle: f.metaTitle.trim() || null,
      metaDescription: f.metaDescription.trim() || null,
    };
    if (f.slug.trim()) body.slug = f.slug.trim();

    // Only sent when the category actually has a template. Without this guard
    // a category with no template would PATCH `specifications: []` on every
    // save and silently wipe any free-form specs the product already had —
    // the editor has no field to retype them into, so the save would destroy
    // content it never showed. Built from the *current* category's template,
    // so moving a product between categories cannot smuggle the old
    // category's fields along.
    if (specTemplate.length > 0) {
      body.specifications = specPayload(specTemplate, specs);
    }

    try {
      const res = await fetch(
        isEdit ? `/admin/api/products/${product!.id}` : "/admin/api/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        setError(readableError(detail));
        return;
      }

      const created = await res.json();
      setSaved(true);
      if (!isEdit && created?.id) {
        router.replace(`/admin/products/${created.id}`);
      }
      router.refresh();
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="pb-24">
      {/* --- 1. Basic --- */}
      <Section n="01" title="Basics">
        <Grid>
          <Field label="Title" required span={2}>
            <input
              required
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="WH-1000XM5"
              className={input}
            />
          </Field>

          <Field label="Slug" hint="Leave blank to generate from the title.">
            <input
              value={f.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="sony-wh-1000xm5"
              className={cn(input, "font-mono")}
            />
          </Field>

          <Field label="Brand" required>
            <select
              required
              value={f.brandId}
              onChange={(e) => set("brandId", e.target.value)}
              className={input}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Category" required>
            <select
              required
              value={f.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className={input}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Tagline"
            required
            span={2}
            hint="The one-line reason this is worth considering. Shown on every card — a card without it is a listing, not a recommendation."
          >
            <input
              required
              maxLength={300}
              value={f.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Class-leading noise cancellation with the best call quality in its price band."
              className={input}
            />
            <Counter value={f.tagline.length} max={300} />
          </Field>

          <Field label="Short description" span={2}>
            <input
              maxLength={500}
              value={f.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              className={input}
            />
          </Field>

          <Field label="Full description" span={2}>
            <textarea
              rows={5}
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              className={cn(input, "min-h-[130px] resize-y py-3")}
            />
          </Field>
        </Grid>
      </Section>

      {/* --- 2. Pricing --- */}
      <Section n="02" title="Pricing" hint="Prices can be updated later without recreating the product.">
        <Grid>
          <Field label="Currency">
            <select
              value={f.currency}
              onChange={(e) => set("currency", e.target.value)}
              className={input}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </Field>

          <Field label="Current price" hint="Required to publish.">
            <input
              type="number"
              min={0}
              step="0.01"
              value={f.priceCurrent}
              onChange={(e) => set("priceCurrent", e.target.value)}
              className={cn(input, "tabular")}
            />
          </Field>

          <Field label="Range — low">
            <input
              type="number"
              min={0}
              step="0.01"
              value={f.priceMin}
              onChange={(e) => set("priceMin", e.target.value)}
              className={cn(input, "tabular")}
            />
          </Field>

          <Field label="Range — high">
            <input
              type="number"
              min={0}
              step="0.01"
              value={f.priceMax}
              onChange={(e) => set("priceMax", e.target.value)}
              className={cn(input, "tabular")}
            />
          </Field>
        </Grid>
      </Section>

      {/* --- 3. Recommendation --- */}
      <Section
        n="03"
        title="The verdict"
        hint="The reason this platform exists. Written before any retailer link is attached."
      >
        <Field label="Our verdict" hint="Required to publish. Who it's for, who should skip it, and why.">
          <textarea
            rows={8}
            value={f.verdict}
            onChange={(e) => set("verdict", e.target.value)}
            placeholder="This is the headphone to buy if noise cancellation is the reason you are shopping…"
            className={cn(input, "min-h-[190px] resize-y py-3 leading-relaxed")}
          />
        </Field>

        <Grid className="mt-6">
          <Field label="Best for" hint="One per line.">
            <textarea
              rows={5}
              value={f.bestFor}
              onChange={(e) => set("bestFor", e.target.value)}
              placeholder={"Frequent travellers\nOpen-plan office work"}
              className={cn(input, "min-h-[120px] resize-y py-3")}
            />
          </Field>

          <Field label="Not ideal for" hint="One per line.">
            <textarea
              rows={5}
              value={f.notIdealFor}
              onChange={(e) => set("notIdealFor", e.target.value)}
              placeholder={"Tight bag space\nStudio monitoring"}
              className={cn(input, "min-h-[120px] resize-y py-3")}
            />
          </Field>

          <Field label="Pros" hint="One per line.">
            <textarea
              rows={5}
              value={f.pros}
              onChange={(e) => set("pros", e.target.value)}
              className={cn(input, "min-h-[120px] resize-y py-3")}
            />
          </Field>

          <Field label="Cons" hint="One per line.">
            <textarea
              rows={5}
              value={f.cons}
              onChange={(e) => set("cons", e.target.value)}
              className={cn(input, "min-h-[120px] resize-y py-3")}
            />
          </Field>
        </Grid>
      </Section>

      {/* --- 4. Specifications --- */}
      <Section
        n="04"
        title="Specifications"
        hint={
          categoryName
            ? `The fields ${categoryName} allows. Change the category above and these change with it.`
            : "Fields come from the category (spec §41)."
        }
      >
        <SpecEditor
          template={specTemplate}
          values={specs}
          onChange={setSpecs}
          categoryName={categoryName}
          unmapped={unmapped}
        />
      </Section>

      {/* --- 5. Badges --- */}
      <Section n="05" title="Badges" hint="Created in the admin panel, never hard-coded (spec §21).">
        <div className="flex flex-wrap gap-2">
          {badges.length === 0 && (
            <p className="text-body-sm text-ink-muted">No badges defined yet.</p>
          )}
          {badges.map((b) => {
            const on = badgeIds.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() =>
                  setBadgeIds((prev) =>
                    prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id],
                  )
                }
                className={cn(
                  "rounded-full border px-4 py-2 font-label text-label-xs font-semibold uppercase",
                  "tracking-[0.1em] transition-all duration-fast",
                  on
                    ? "border-brand-vivid bg-brand-fill text-brand-on"
                    : "border-line text-ink-muted hover:border-brand hover:text-brand",
                )}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </Section>

      {/* --- 6. SEO --- */}
      <Section n="06" title="SEO" hint="Falls back to the title and tagline when blank (spec §47).">
        <Grid>
          <Field label="Meta title" span={2}>
            <input
              maxLength={200}
              value={f.metaTitle}
              onChange={(e) => set("metaTitle", e.target.value)}
              className={input}
            />
          </Field>
          <Field label="Meta description" span={2}>
            <textarea
              rows={3}
              maxLength={400}
              value={f.metaDescription}
              onChange={(e) => set("metaDescription", e.target.value)}
              className={cn(input, "min-h-[84px] resize-y py-3")}
            />
            <Counter value={f.metaDescription.length} max={400} />
          </Field>
        </Grid>
      </Section>

      {/* --- Sticky save bar --- */}
      <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-line bg-surface-0/95 backdrop-blur-md lg:left-64">
        <div className="mx-auto flex max-w-wide items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            {error ? (
              <p role="alert" className="truncate text-body-sm text-danger">
                {error}
              </p>
            ) : saved ? (
              <p className="text-body-sm text-value">Saved.</p>
            ) : (
              <p className="text-label-xs text-ink-faint">
                Saving keeps this a draft — publishing is a separate step.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !f.title.trim() || !f.tagline.trim()}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-brand-fill px-8
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                       text-brand-on shadow-brand transition-all duration-fast hover:brightness-110
                       disabled:pointer-events-none disabled:opacity-45"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create draft"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function readableError(detail: unknown): string {
  if (!detail) return "Could not save.";
  const d = (detail as { detail?: unknown }).detail ?? detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    // FastAPI validation errors — surface the field, not the raw shape.
    const first = d[0] as { loc?: string[]; msg?: string };
    const field = first?.loc?.slice(-1)[0];
    return field ? `${field}: ${first.msg}` : (first?.msg ?? "Validation failed.");
  }
  if (typeof d === "object" && d && "message" in d) return String((d as never)["message"]);
  return "Could not save.";
}

const input =
  "h-11 w-full rounded-md border border-line bg-surface-0 px-3.5 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel mb-6 p-6 lg:p-8">
      <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
        <span className="font-mono text-label-xs tabular-nums text-brand">{n}</span>
        <div>
          <h2 className="font-display text-headline-sm text-ink">{title}</h2>
          {hint && <p className="mt-1 text-body-sm text-ink-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>;
}

function Field({
  label,
  hint,
  required,
  span,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      <span className="t-eyebrow flex items-center gap-1">
        {label}
        {required && <span className="text-brand">*</span>}
      </span>
      {hint && <span className="mt-1 block text-label-xs leading-relaxed text-ink-subtle">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={cn(
        "mt-1 block text-right font-mono text-[10px] tabular-nums",
        value > max * 0.9 ? "text-warn" : "text-ink-faint",
      )}
    >
      {value} / {max}
    </span>
  );
}
