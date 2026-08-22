import type { Metadata } from "next";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Brands", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Brands (spec §22). Pinned brands appear in the homepage strip. */
export default async function AdminBrandsPage() {
  const { items = [] } = await adminGet<{ items: Record<string, unknown>[] }>("/brands", {
    items: [],
  });

  return (
    <AdminPage
      title="Brands"
      eyebrow="Content"
      description="Manufacturers we cover. Pinned brands appear in the homepage strip."
    >
      <ResourceManager
        endpoint="brands"
        singular="brand"
        initial={items}
        fields={[
          { key: "name", label: "Name", type: "text", required: true },
          { key: "slug", label: "Slug", type: "text", hint: "Blank generates one from the name." },
          { key: "website", label: "Website", type: "url", placeholder: "https://" },
          { key: "logoUrl", label: "Logo URL", type: "url", placeholder: "https://" },
          { key: "description", label: "Description", type: "textarea", span: 2 },
          { key: "displayOrder", label: "Order", type: "number" },
          { key: "isPinned", label: "Pinned to homepage", type: "checkbox" },
          { key: "isActive", label: "Active", type: "checkbox" },
        ]}
        columns={[
          { key: "name", label: "Brand" },
          { key: "slug", label: "Slug", mono: true },
          { key: "productCount", label: "Products", mono: true },
          { key: "isPinned", label: "Pinned", cell: "bool", yes: "Pinned" },
          { key: "displayOrder", label: "Order", mono: true },
        ]}
      />
    </AdminPage>
  );
}
