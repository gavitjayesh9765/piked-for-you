import type { Metadata } from "next";

import { adminGet } from "@/lib/admin-api";
import { getCategories } from "@/lib/api";
import { AdminPage } from "@/components/admin/Shell";
import { HomepageComposer, type Section } from "@/components/admin/HomepageComposer";

export const metadata: Metadata = { title: "Homepage", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Homepage composer (spec §39).
 *
 * The homepage renders entirely from these rows — order, titles, which rails
 * appear. Adding a section is an admin action, not a deploy.
 */
export default async function AdminHomepagePage() {
  const [data, categories] = await Promise.all([
    adminGet<{ items: Section[]; kinds: string[] }>("/homepage", { items: [], kinds: [] }),
    getCategories(),
  ]);

  return (
    <AdminPage
      title="Homepage"
      eyebrow="Content"
      description="Compose the homepage without touching code. Changes are live as soon as you save."
    >
      <HomepageComposer
        initial={data.items}
        kinds={data.kinds}
        categorySlugs={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      />
    </AdminPage>
  );
}
