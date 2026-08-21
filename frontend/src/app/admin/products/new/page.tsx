import type { Metadata } from "next";
import Link from "next/link";

import { getBrands, getCategories } from "@/lib/api";
import { AdminPage } from "@/components/admin/Shell";
import { ProductForm } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "New product", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Create a product (spec §37).
 *
 * Always produces a draft. Publishing is a separate, audited action, so the
 * form cannot accidentally push half-written content live (spec §38).
 */
export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([getCategories(), getBrands()]);

  const blocked = categories.length === 0 || brands.length === 0;

  return (
    <AdminPage
      title="New product"
      eyebrow="Content · Products"
      description="Saves as a draft. Nothing is public until you publish it."
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
        <ProductForm categories={categories} brands={brands} badges={[]} />
      )}
    </AdminPage>
  );
}
