import type { Metadata } from "next";
import { Suspense } from "react";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { TableArriving } from "@/components/ui/Arriving";
import { CategoryTree, type AdminCategory } from "@/components/admin/CategoryTree";

export const metadata: Metadata = { title: "Categories", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Category management (spec §23).
 *
 * A real tree, because browsing needs depth: Electronics → Audio → Headphones,
 * not one flat "Audio" bucket holding earbuds, soundbars and turntables.
 *
 * ---------------------------------------------------------------------------
 * The screen's own copy — its title, its standing explanation — is not waiting
 * on anything, so it renders with the click. Only the list behind it streams,
 * behind a fallback that is invisible for its first 420ms and therefore never
 * seen on a warm navigation. Same shape on every admin list screen.
 */
export default function AdminCategoriesPage() {
  return (
    <AdminPage
      title="Categories"
      eyebrow="Content"
      description="The category tree. Products are filed against these, the site sub-nav is built from them, and the URL path follows the hierarchy."
    >
      <Suspense fallback={<TableArriving rows={10} />}>
        <Tree />
      </Suspense>
    </AdminPage>
  );
}

async function Tree() {
  const { items = [] } = await adminGet<{ items: AdminCategory[] }>("/categories", { items: [] });

  return (
    <>
      <CategoryTree initial={items} />

      <div className="panel mt-6 p-6">
        <h2 className="t-eyebrow mb-3">How the tree behaves</h2>
        <ul className="grid gap-2 text-body-sm text-ink-muted">
          <li>
            <strong className="text-ink">Moving a branch</strong> rewrites the URL path of every
            category beneath it, in one transaction. Old links to a moved category will 404.
          </li>
          <li>
            <strong className="text-ink">Deleting</strong> is refused while products or
            sub-categories still depend on it — deactivate instead if you just want it hidden.
          </li>
          <li>
            <strong className="text-ink">Homepage tiles</strong> work best at the second level:
            the root is too broad, the leaves are too many.
          </li>
        </ul>
      </div>
    </>
  );
}
