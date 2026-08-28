"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { saveError } from "@/lib/admin-errors";
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
 * Seven sections, numbered 01-07: Basics · Pricing · The verdict ·
 * How this was researched · Specifications · Badges · SEO.
 *
 * Media, retailer links, price history, the score and the curated alternatives
 * are NOT here. They all key off a product id, so they live on the edit screen
 * as sections 08-12 and only exist once a draft has been saved.
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
  specTemplateSources = {},
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
  /**
   * Category id -> the category its template actually came from, when that is
   * an ancestor rather than itself. SpecEditor has always been able to say
   * "template inherited from Computers"; nothing ever passed it the value, so
   * it never did, and an editor looking at fields their own category does not
   * define had no way to learn where to go and change them.
   */
  specTemplateSources?: Record<string, string | null>;
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
    verdictStance: product?.verdictStance ?? "",
    verdictSummary: product?.verdictSummary ?? "",
    verdict: product?.verdict ?? "",
    researchNote: product?.researchNote ?? "",
    researchedAt: product?.researchedAt ? product.researchedAt.slice(0, 10) : "",
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
  // Outside `f` because `f` is string-keyed and `set()` takes a string. A
  // boolean coerced through that would reach the API as "false" — which is
  // truthy, on the one field where a silent truthy default would have the
  // site claim a hands-on test that never happened.
  const [handsOnTested, setHandsOnTested] = useState(product?.handsOnTested ?? false);
  const [specs, setSpecs] = useState<SpecValues>(() =>
    specValuesFrom(product?.specifications),
  );

  const specTemplate = useMemo(
    () => specTemplates[f.categoryId] ?? [],
    [specTemplates, f.categoryId],
  );
  const specTemplateSource = specTemplateSources[f.categoryId] ?? null;
  const categoryName = useMemo(
    () => categories.find((c) => c.id === f.categoryId)?.name,
    [categories, f.categoryId],
  );

  /**
   * What the two selects may offer.
   *
   * getBrands() and getCategories() return ACTIVE rows only. A product whose
   * brand or category was deactivated after it was filed therefore had a
   * select with no matching option: the control rendered blank, and the
   * obvious response to a blank required field is to pick something - quietly
   * refiling the product under whatever sat at the top of the list. The
   * current value is appended instead, labelled, so it stays selected and the
   * reason it looks odd is on the screen.
   *
   * Categories are shown as a full path. A flat list of leaf names is
   * ambiguous the moment two branches both have an "Accessories", and a
   * product filed one level too high is invisible afterwards.
   */
  const brandOptions = useMemo(() => {
    const list = brands.map((b) => ({ id: b.id, label: b.name }));
    if (product && !list.some((o) => o.id === product.brand.id)) {
      list.push({ id: product.brand.id, label: product.brand.name + " — deactivated" });
    }
    return list;
  }, [brands, product]);

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const pathLabel = (c: Category): string => {
      const names: string[] = [];
      const seen = new Set<string>();
      let node: Category | undefined = c;
      while (node && !seen.has(node.id)) {
        seen.add(node.id);
        names.unshift(node.name);
        node = node.parentId ? byId.get(node.parentId) : undefined;
      }
      return names.join(" › ");
    };

    const list = categories
      .map((c) => ({ id: c.id, label: pathLabel(c) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (product && !list.some((o) => o.id === product.category.id)) {
      list.push({ id: product.category.id, label: product.category.name + " — deactivated" });
    }
    return list;
  }, [categories, product]);
  const unmapped = useMemo(
    () => unmappedSpecs(product?.specifications, specTemplate),
    [product?.specifications, specTemplate],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  /** Every edit path calls this, so no control can forget to mark the form. */
  function touch() {
    setSaved(false);
    setDirty(true);
  }

  function set<K extends keyof typeof f>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
    touch();
  }

  /**
   * Refuse to lose a half-written verdict to a closed tab.
   *
   * This form holds the longest-form writing anywhere in the panel and has no
   * autosave, so a reload or a stray ctrl-W took the lot with no warning. The
   * browser only lets us guard a real unload - an in-app navigation to another
   * admin screen is not covered, which is why the save bar now says in words
   * that there are unsaved changes.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const lines = (v: string) =>
    v.split("\n").map((s) => s.trim()).filter(Boolean);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const priceCurrent = num(f.priceCurrent);
    const priceMin = num(f.priceMin);
    const priceMax = num(f.priceMax);

    // Checked here because nothing downstream checks it. The schema bounds
    // each of the three at >= 0 and independently of the others, so low 5,000
    // with high 3,000 saved without complaint and the product page then
    // rendered the range backwards.
    const priceProblem = checkPrices(priceCurrent, priceMin, priceMax);
    if (priceProblem) {
      setError(priceProblem);
      return;
    }

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
      priceCurrent,
      priceMin,
      priceMax,
      verdictStance: f.verdictStance || null,
      verdictSummary: f.verdictSummary.trim() || null,
      verdict: f.verdict.trim() || null,
      handsOnTested,
      researchNote: f.researchNote.trim() || null,
      // A date input yields "2026-08-25"; the column is timestamptz. Sent as
      // midnight UTC rather than local, so the same save from two timezones
      // stores the same instant.
      researchedAt: f.researchedAt ? `${f.researchedAt}T00:00:00Z` : null,
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
        // `isEdit` decides how a timeout is phrased: repeating a PATCH is
        // harmless, repeating a create is how one draft becomes two.
        setError(saveError(res.status, detail, { idempotent: isEdit }));
        return;
      }

      const created = await res.json();
      setSaved(true);
      setDirty(false);
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
              {brandOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Category"
            required
            hint="Shown as a full path. File against the most specific one - the specification fields in 05 and the scoring criteria on the next screen both come from it."
          >
            <select
              required
              value={f.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className={input}
            >
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
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

          <Field
            label="Current price"
            publish
            hint="The headline number. Per-retailer prices are separate, on the edit screen."
          >
            <input
              type="number"
              min={0}
              step="0.01"
              value={f.priceCurrent}
              onChange={(e) => set("priceCurrent", e.target.value)}
              className={cn(input, "tabular")}
            />
          </Field>

          <Field label="Range — low" hint="The lowest you have seen it sell for.">
            <input
              type="number"
              min={0}
              step="0.01"
              value={f.priceMin}
              onChange={(e) => set("priceMin", e.target.value)}
              className={cn(input, "tabular")}
            />
          </Field>

          <Field label="Range — high" hint="Its usual, non-sale price.">
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
        {/* The recommendation itself. First field in the section because it is
            the first thing on the public page and the first thing an editor
            should have decided — a verdict written before the stance is chosen
            tends to argue its way to whichever answer the prose reached. */}
        <Grid>
          <Field
            label="Should you buy this?"
            publish
            hint="Shown at the top of the product page, above everything else."
          >
            <select
              value={f.verdictStance}
              onChange={(e) => set("verdictStance", e.target.value)}
              className={input}
            >
              <option value="">— Not decided yet —</option>
              {STANCES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {f.verdictStance && (
              <span className="mt-2 block text-label-xs leading-relaxed text-ink-subtle">
                {STANCES.find((o) => o.value === f.verdictStance)?.hint}
              </span>
            )}
          </Field>

          <Field
            label="Last researched"
            hint="Shown on the page. A recommendation with no date is a rumour."
          >
            <input
              type="date"
              value={f.researchedAt}
              onChange={(e) => set("researchedAt", e.target.value)}
              className={cn(input, "tabular")}
            />
          </Field>

          <Field
            label="Why — in one or two sentences"
            publish
            span={2}
            hint="Sits directly beside the recommendation above the fold, so it has to stand on its own without the full verdict below it."
          >
            <textarea
              rows={3}
              maxLength={400}
              value={f.verdictSummary}
              onChange={(e) => set("verdictSummary", e.target.value)}
              placeholder="The noise cancellation and call quality are a real step ahead at this price, and it has sat at this price long enough that waiting is unlikely to save you anything."
              className={cn(input, "min-h-[90px] resize-y py-3 leading-relaxed")}
            />
            <Counter value={f.verdictSummary.length} max={400} />
          </Field>
        </Grid>

        <div className="mt-6">
        <Field
          label="Our verdict"
          publish
          hint="Who it is for, who should skip it, and why. The long-form argument under the banner."
        >
          <textarea
            rows={8}
            value={f.verdict}
            onChange={(e) => set("verdict", e.target.value)}
            placeholder="This is the headphone to buy if noise cancellation is the reason you are shopping…"
            className={cn(input, "min-h-[190px] resize-y py-3 leading-relaxed")}
          />
        </Field>
        </div>

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

          <Field label="Pros" publish hint="One per line. At least one, to publish.">
            <textarea
              rows={5}
              value={f.pros}
              onChange={(e) => set("pros", e.target.value)}
              className={cn(input, "min-h-[120px] resize-y py-3")}
            />
          </Field>

          <Field
            label="Cons"
            publish
            hint="One per line. At least one, to publish — a product with no downsides is a page nobody believes."
          >
            <textarea
              rows={5}
              value={f.cons}
              onChange={(e) => set("cons", e.target.value)}
              className={cn(input, "min-h-[120px] resize-y py-3")}
            />
          </Field>
        </Grid>
      </Section>

      {/* --- 4. How this was researched --- */}
      <Section
        n="04"
        title="How this was researched"
        hint="Renders as the “How we reviewed this” box on the product page."
      >
        {/* A checkbox, and the copy beside it is the point. The public page
            claims a hands-on test on the strength of this one boolean and
            nothing else, and it defaults to off everywhere — schema, API,
            database — so the failure mode is a page that under-claims. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-4 transition-colors duration-fast hover:border-brand">
          <input
            type="checkbox"
            checked={handsOnTested}
            onChange={(e) => {
              setHandsOnTested(e.target.checked);
              touch();
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-brand-fill)]"
          />
          <span className="min-w-0">
            <span className="t-eyebrow block">Somebody here physically used this product</span>
            <span className="mt-1.5 block text-label-xs leading-relaxed text-ink-subtle">
              Tick this <strong>only</strong> if a person on the team held and used this unit.
              Leave it off for a research verdict — the page then says so explicitly, which is
              the promise we make on{" "}
              <span className="font-mono">/how-we-score</span>. Reading a spec sheet, however
              thoroughly, is not a test.
            </span>
          </span>
        </label>

        <Field
          label="Anything specific about this one"
          hint="Optional. Added to the standard method statement — e.g. which comparisons drove the verdict, or a caveat about the evidence."
        >
          <textarea
            rows={4}
            value={f.researchNote}
            onChange={(e) => set("researchNote", e.target.value)}
            placeholder="Compared directly against the XM4 and the QC45 at the same street price. Battery figures are the manufacturer's — we have no independent measurement for this generation yet."
            className={cn(input, "mt-6 min-h-[110px] resize-y py-3 leading-relaxed")}
          />
        </Field>
      </Section>

      {/* --- 5. Specifications --- */}
      <Section
        n="05"
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
          onChange={(next) => {
            setSpecs(next);
            touch();
          }}
          templateSource={specTemplateSource}
          categoryName={categoryName}
          unmapped={unmapped}
        />
      </Section>

      {/* --- 6. Badges --- */}
      <Section n="06" title="Badges" hint="Created in the admin panel, never hard-coded (spec §21).">
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
                onClick={() => {
                  setBadgeIds((prev) =>
                    prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id],
                  );
                  touch();
                }}
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

      {/* --- 7. SEO --- */}
      <Section n="07" title="SEO" hint="Falls back to the title and tagline when blank (spec §47).">
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
            ) : dirty ? (
              // An in-app navigation cannot be intercepted, so the only
              // honest thing left is to say so where the editor is looking.
              <p className="text-body-sm text-warn">
                Unsaved changes. Leaving this screen loses them.
              </p>
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

/**
 * The four verdicts, with the line that tells an editor which one they mean.
 *
 * Kept next to the form rather than imported from the public component: these
 * hints are authoring guidance, and the labels a reader sees are the public
 * component's business. Shared strings between the two would tempt someone to
 * change the reader's copy while editing an editor's hint.
 */
const STANCES = [
  {
    value: "buy_now",
    label: "Buy now",
    hint: "Worth its current price today. Not “best in the world” — worth what it costs, now.",
  },
  {
    value: "wait_for_sale",
    label: "Wait for a sale",
    hint: "Right product, wrong price. Use this when the product is sound and the price history says the number moves.",
  },
  {
    value: "skip",
    label: "Skip",
    hint: "Not worth it at any price we expect it to reach. Say so plainly in the verdict.",
  },
  {
    value: "consider_alternative",
    label: "Consider an alternative",
    hint: "Nothing wrong with it, but something else does the job better. Add the alternatives in section 13, on the edit screen — this verdict is incomplete without them.",
  },
] as const;

/**
 * The price relationships nothing else checks.
 *
 * `ProductCreate` bounds each of the three at >= 0 and independently of the
 * others. Nothing compares them, so "low 5,000 / high 3,000" saved cleanly and
 * the product page rendered the range backwards; a current price outside its
 * own stated range reads as either a typo or a lie, depending which way it
 * falls. Both are cheap to catch here and expensive to notice in production.
 */
function checkPrices(
  current: number | null,
  low: number | null,
  high: number | null,
): string | null {
  for (const [label, value] of [
    ["Current price", current],
    ["Range — low", low],
    ["Range — high", high],
  ] as const) {
    if (value !== null && !Number.isFinite(value)) return `${label} is not a number.`;
    if (value !== null && value < 0) return `${label} cannot be negative.`;
  }
  if (low !== null && high !== null && low > high) {
    return "Range — low is above Range — high. Swap them.";
  }
  if (current !== null && low !== null && current < low) {
    return "The current price is below the bottom of the range you gave.";
  }
  if (current !== null && high !== null && current > high) {
    return "The current price is above the top of the range you gave.";
  }
  return null;
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
  publish,
  span,
  children,
}: {
  label: string;
  hint?: string;
  /** Enforced by this form — save is blocked without it. */
  required?: boolean;
  /**
   * Not needed to save, refused at publish (spec §62).
   *
   * These used to carry the same red asterisk as the genuinely required
   * fields, which said the wrong thing in both directions: the form let you
   * save without them anyway, so the marker was a bluff, and the fields that
   * really do block a save looked no different from the ones that do not.
   */
  publish?: boolean;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      <span className="t-eyebrow flex flex-wrap items-center gap-1.5">
        {label}
        {required && <span className="text-brand">*</span>}
        {publish && (
          <span className="rounded-xs border border-warn bg-warn-soft px-1.5 py-px font-label text-[9px] font-bold uppercase tracking-[0.08em] text-warn-on-soft">
            To publish
          </span>
        )}
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
