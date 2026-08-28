import type { Metadata } from "next";
import type { Badge, SpecTemplateGroup } from "@/lib/types";
import Link from "next/link";

import { getBrands, getCategories } from "@/lib/api";
import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { ProductForm } from "@/components/admin/ProductForm";

/** Only the template field the specification editor needs. */
interface CategoryRow {
  id: string;
  specTemplate?: SpecTemplateGroup[] | null;
  /** Which category the template came from, when it is inherited. */
  specTemplateSource?: string | null;
}

export const metadata: Metadata = { title: "New product", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Create a product (spec §37).
 *
 * Always produces a draft. Publishing is a separate, audited action, so the
 * form cannot accidentally push half-written content live (spec §38).
 */
export default async function NewProductPage() {
  const [categories, brands, taxonomy, badgeList] = await Promise.all([
    getCategories(),
    getBrands(),
    // Specification fields are configured per category and resolved up the
    // tree (spec §41). Fetched for every category so the form's category
    // select can swap the fields without a round trip.
    adminGet<{ items: CategoryRow[] }>("/categories", { items: [] }),
    // The badge catalogue. This page used to pass `badges={[]}`, so the
    // Badges section permanently read "No badges defined yet" and a product
    // could never be given one at creation however many existed.
    adminGet<{ items: Badge[] }>("/badges", { items: [] }),
  ]);

  const specTemplates: Record<string, SpecTemplateGroup[]> = Object.fromEntries(
    (taxonomy.items ?? []).map((c) => [c.id, c.specTemplate ?? []]),
  );

  // So the specification editor can say "template inherited from Computers"
  // rather than leaving an editor wondering why fields they never configured
  // are on screen, and where to go to change them.
  const specTemplateSources: Record<string, string | null> = Object.fromEntries(
    (taxonomy.items ?? []).map((c) => [c.id, c.specTemplateSource ?? null]),
  );

  // Inactive badges stay out of the picker: a retired marker should not be
  // attachable to something new.
  const badges = (badgeList.items ?? []).filter((b) => b.isActive);

  const blocked = categories.length === 0 || brands.length === 0;

  return (
    <AdminPage
      title="New product"
      eyebrow="Content · Products"
      description="Saves as a draft. Nothing is public until you publish it."
      refreshable={false}
      actions={
        <Link
          href="/admin/products"
          className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
        >
          ← Back
        </Link>
      }
    >
      {blocked ? (
        <div className="panel dot-matrix p-10">
          <h2 className="font-display text-headline-sm text-ink">
            You need a category and a brand first
          </h2>
          <p className="mt-3 max-w-xl text-body-md text-ink-muted">
            Every product belongs to one of each, so those have to exist before a product can.
            The seed data creates eight of each — run{" "}
            <code className="font-mono text-ink">supabase db reset</code> if you haven&apos;t yet.
          </p>
        </div>
      ) : (
        <>
          {/* The create endpoint takes the product's own fields only —
              `ProductCreate` has no `retailers`, and images, videos and the
              score all key off a product id that does not exist yet. So they
              genuinely cannot be on this screen. What was missing was saying
              so: editors filled the form looking for somewhere to put the
              Amazon and Flipkart prices, found "Range — low/high", and
              assumed the page was out of date. */}
          <div className="panel mb-6 border-brand-soft p-6 lg:p-8">
            <h2 className="font-display text-headline-sm text-ink">
              Where the retailer prices go
            </h2>
            <p className="mt-3 max-w-2xl text-body-md text-ink-muted">
              The <strong className="text-ink">Pricing</strong> section below is the
              headline price and the range you have seen it sell in. The per-retailer
              links and prices — Amazon, Flipkart, the official site — are added on the
              next screen, under <strong className="text-ink">Where to buy</strong>,
              because each one attaches to a product that has to exist first.
            </p>
            <p className="mt-4 max-w-2xl text-body-sm text-ink-subtle">
              Save this as a draft and you land straight on it. Waiting there:
            </p>
            <ul className="mt-3 grid gap-2 text-body-sm text-ink-muted sm:grid-cols-2">
              <li>Images &amp; videos</li>
              <li>Where to buy — Amazon / Flipkart / official, with a price each</li>
              <li>Price history, and a button to re-check it</li>
              <li>SortedChoice Score, against this category&apos;s criteria</li>
            </ul>
          </div>

          <ProductForm
            categories={categories}
            brands={brands}
            badges={badges}
            specTemplates={specTemplates}
            specTemplateSources={specTemplateSources}
          />
        </>
      )}
    </AdminPage>
  );
}
