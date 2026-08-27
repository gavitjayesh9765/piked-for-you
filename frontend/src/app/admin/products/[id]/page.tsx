import type { Metadata } from "next";
import type { AlternativePick, Badge, PriceHistory, SpecTemplateGroup } from "@/lib/types";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getBrands, getCategories } from "@/lib/api";
import { adminGet, getProduct, publishCheck, safe } from "@/lib/admin-api";
import { StatusPill } from "@/components/ui/Badge";
import { AdminPage } from "@/components/admin/Shell";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { MediaManager } from "@/components/admin/MediaManager";
import { RetailerLinks } from "@/components/admin/RetailerLinks";
import { PriceHistoryChart } from "@/components/admin/pricing/PriceHistoryChart";
import { RefreshPriceButton } from "@/components/admin/pricing/RefreshPriceButton";
import { VideoLinks } from "@/components/admin/VideoLinks";
import { ScoreEditor, type Criterion } from "@/components/admin/ScoreEditor";
import { AlternativesManager } from "@/components/admin/AlternativesManager";
import { listRetailers } from "@/lib/admin-api";

/** The template fields the score and specification editors need. */
interface CategoryRow {
  id: string;
  name?: string;
  scoreCriteria?: Criterion[] | null;
  specTemplate?: SpecTemplateGroup[] | null;
  specTemplateSource?: string | null;
}

export const metadata: Metadata = { title: "Edit product", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Edit a product (spec §37).
 *
 * The publish checklist sits at the top rather than behind the publish button:
 * an editor should see what is still missing while they are filling the form,
 * not discover it as a rejection afterwards (spec §62).
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await safe(() => getProduct(id), null);
  if (!product) notFound();

  const [categories, brands, check, retailers, taxonomy, history, badgeList, alternatives] =
    await Promise.all([
    getCategories(),
    getBrands(),
    safe(() => publishCheck(id), { canPublish: false, missing: [] }),
    safe(() => listRetailers(), [] as { id: string; name: string; slug: string }[]),
    // Scoring criteria and specification fields are configured per category
    // (spec §24, §41) and the API rejects any key the category does not list,
    // so the editors have to read them rather than guess. The admin route
    // returns them already resolved up the tree, so a product filed under Mice
    // gets the Mice template rather than nothing.
    adminGet<{ items: CategoryRow[] }>("/categories", { items: [] }),
    // Six months is long enough to show a launch-price decline and short
    // enough that the chart is still readable at this width.
    adminGet<PriceHistory>(
      `/products/${id}/price-history`,
      { points: [], summary: { count: 0, lowest: null, highest: null, latest: null, windowDays: 180 } },
      { days: 180 },
    ),
    // The full catalogue, not `product.badges`. Passing the attached ones as
    // the available ones meant the picker could only ever *remove* a badge —
    // there was no way to add one to an existing product.
    adminGet<{ items: Badge[] }>("/badges", { items: [] }),
    // The curated set only — the admin route does not top up from the price
    // heuristic, because an editor should see what they chose, not what the
    // public page will pad it out with.
    adminGet<AlternativePick[]>(`/products/${id}/alternatives`, [] as AlternativePick[]),
  ]);

  // Active badges, plus any this product already carries even if since
  // retired. A badge that is attached but absent from the picker would be
  // invisible in the UI yet still submitted on save.
  const attached = new Set((product.badges ?? []).map((b) => b.id));
  const badges = [
    ...(badgeList.items ?? []).filter((b) => b.isActive || attached.has(b.id)),
    ...(product.badges ?? []).filter(
      (b) => !(badgeList.items ?? []).some((x) => x.id === b.id),
    ),
  ];

  const criteria =
    (taxonomy.items ?? []).find((c) => c.id === product.category.id)?.scoreCriteria ?? [];

  // Keyed by every category, not just this product's: the form's category
  // select can change mid-edit and the fields have to follow it without a
  // round trip.
  const specTemplates: Record<string, SpecTemplateGroup[]> = Object.fromEntries(
    (taxonomy.items ?? []).map((c) => [c.id, c.specTemplate ?? []]),
  );

  const specTemplateSources: Record<string, string | null> = Object.fromEntries(
    (taxonomy.items ?? []).map((c) => [c.id, c.specTemplateSource ?? null]),
  );

  return (
    <AdminPage
      title={product.title}
      eyebrow="Content · Products"
      actions={
        <div className="flex items-center gap-4">
          <StatusPill status={product.status} />
          <ProductRowActions
            id={product.id}
            title={product.title}
            status={product.status}
            slug={product.slug}
            categorySlug={product.category.slug}
            afterDelete="list"
          />
          <Link
            href="/admin/products"
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
          >
            ← Back
          </Link>
        </div>
      }
    >
      {product.status !== "published" && check.missing.length > 0 && (
        <div className="mb-6 rounded-lg border border-warn bg-warn-soft px-5 py-4">
          <p className="font-label text-label-xs font-bold uppercase tracking-[0.12em] text-warn-on-soft">
            Not ready to publish
          </p>
          <p className="mt-2 text-body-sm text-warn-on-soft">
            Still missing: <strong>{check.missing.join(", ")}</strong>
          </p>
        </div>
      )}

      {product.status !== "published" && check.canPublish && (
        <div className="mb-6 rounded-lg border border-value-line bg-value-soft px-5 py-4">
          <p className="text-body-sm text-value-on-soft">
            This product has everything it needs. Publish when you&apos;re ready.
          </p>
        </div>
      )}

      <ProductForm
        product={product}
        categories={categories}
        brands={brands}
        badges={badges}
        specTemplates={specTemplates}
        specTemplateSources={specTemplateSources}
      />

      {/* Media, retailer links, the score and the alternatives are edit-only:
          a product must exist before an image, an outbound link, or a pointer
          to another product can attach to it. They sit after the form so the
          numbering reads 01 → 13 down the page. */}
      <section className="panel mb-6 p-6 lg:p-8">
        <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
          <span className="font-mono text-label-xs tabular-nums text-brand">08</span>
          <div>
            <h2 className="font-display text-headline-sm text-ink">Images</h2>
            <p className="mt-1 text-body-sm text-ink-muted">
              Drag to reorder. The first image is the primary one, shown on every card.
            </p>
          </div>
        </div>
        <MediaManager productId={product.id} initial={product.images} />
      </section>

      <section className="panel mb-6 p-6 lg:p-8">
        <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
          <span className="font-mono text-label-xs tabular-nums text-brand">09</span>
          <div>
            <h2 className="font-display text-headline-sm text-ink">Videos</h2>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste a YouTube or Vimeo link — we embed it rather than hosting it, so it
              appears in the gallery alongside the photos.
            </p>
          </div>
        </div>
        <VideoLinks productId={product.id} initial={product.videos} />
      </section>

      <section className="panel mb-6 p-6 lg:p-8">
        <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
          <span className="font-mono text-label-xs tabular-nums text-brand">10</span>
          <div>
            <h2 className="font-display text-headline-sm text-ink">Where to buy</h2>
            <p className="mt-1 text-body-sm text-ink-muted">
              We don&apos;t sell — these are the outbound links (spec §26).
            </p>
          </div>
        </div>
        <RetailerLinks
          productId={product.id}
          retailers={retailers}
          initial={product.retailers}
        />
      </section>

      <section className="panel mb-6 p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-label-xs tabular-nums text-brand">11</span>
            <div>
              <h2 className="font-display text-headline-sm text-ink">Price history</h2>
              <p className="mt-1 max-w-xl text-body-sm text-ink-muted">
                Every price we have observed, per retailer. Nothing checks these on a
                schedule — this button, or a run from{" "}
                <Link href="/admin/pricing" className="text-brand hover:underline">
                  Pricing
                </Link>
                , is the only thing that writes a new point.
              </p>
            </div>
          </div>
          <RefreshPriceButton productId={product.id} />
        </div>

        <PriceHistoryChart history={history} currency={product.pricing.currency} />
      </section>

      <section className="panel mb-6 p-6 lg:p-8">
        <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
          <span className="font-mono text-label-xs tabular-nums text-brand">12</span>
          <div>
            <h2 className="font-display text-headline-sm text-ink">PickD Score</h2>
            <p className="mt-1 text-body-sm text-ink-muted">
              Ours, and never merged with the community rating (spec §32). Required
              before this product can be published.
            </p>
          </div>
        </div>
        <ScoreEditor
          productId={product.id}
          criteria={criteria}
          initial={
            product.score
              ? { overall: product.score.overall, criteria: product.score.criteria }
              : null
          }
        />
      </section>

      <section className="panel mb-6 p-6 lg:p-8">
        <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
          <span className="font-mono text-label-xs tabular-nums text-brand">13</span>
          <div>
            <h2 className="font-display text-headline-sm text-ink">Better alternatives</h2>
            <p className="mt-1 max-w-xl text-body-sm text-ink-muted">
              What to buy instead, and why. Anything you leave empty is filled by similar
              products at a similar price — labelled as such on the page, because that is all
              the price heuristic actually knows.{" "}
              {product.verdictStance === "skip" || product.verdictStance === "consider_alternative"
                ? "This verdict sends readers here, so it needs at least one."
                : ""}
            </p>
          </div>
        </div>
        <AlternativesManager productId={product.id} initial={alternatives} />
      </section>

    </AdminPage>
  );
}
