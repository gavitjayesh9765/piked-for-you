import type { Metadata } from "next";
import { Suspense } from "react";

import { adminGet, safe } from "@/lib/admin-api";
import { getCategories } from "@/lib/api";
import { AdminPage } from "@/components/admin/Shell";
import { TableArriving } from "@/components/ui/Arriving";
import { HomepageComposer, type Section } from "@/components/admin/HomepageComposer";

export const metadata: Metadata = { title: "Homepage", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Homepage composer (spec §39).
 *
 * The homepage renders entirely from these rows — order, titles, which rails
 * appear. Adding a section is an admin action, not a deploy.
 */
export default function AdminHomepagePage() {
  return (
    <AdminPage
      title="Homepage"
      eyebrow="Content"
      description="Compose the homepage without touching code. Changes are live as soon as you save."
    >
      <Suspense fallback={<TableArriving rows={5} />}>
        <Composer />
      </Suspense>
    </AdminPage>
  );
}

async function Composer() {
  const [data, categories] = await Promise.all([
    adminGet<{ items: Section[]; kinds: string[] }>("/homepage", { items: [], kinds: [] }),
    // Guarded like every other read on this screen. Unwrapped, a timed-out
    // category lookup took down the whole homepage composer — including the
    // section list beside it, which does not depend on categories at all.
    // Without them the one control that needs them (a category rail's picker)
    // is empty; everything else still works.
    safe(() => getCategories(), []),
  ]);

  return (
    <HomepageComposer
      initial={data.items}
      kinds={data.kinds}
      categorySlugs={categories.map((c) => ({ slug: c.slug, name: c.name }))}
    />
  );
}
