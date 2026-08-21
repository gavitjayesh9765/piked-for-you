import type { Metadata } from "next";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { ResourceManager, badgePreview, boolCell } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Badges", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Badges (spec §21).
 *
 * `style` is a design-system token, not a colour. That is what lets a badge
 * created here render correctly with no frontend deploy — and stops anyone
 * introducing an off-palette hue.
 */
export default async function AdminBadgesPage() {
  const { items = [] } = await adminGet<{ items: Record<string, unknown>[] }>("/badges", {
    items: [],
  });

  return (
    <AdminPage
      title="Badges"
      eyebrow="Content"
      description="Reusable editorial markers, attached to products. Never hard-coded."
    >
      <ResourceManager
        endpoint="badges"
        singular="badge"
        initial={items}
        fields={[
          { key: "name", label: "Name", type: "text", required: true },
          { key: "slug", label: "Slug", type: "text", hint: "Blank generates one from the name." },
          {
            key: "style",
            label: "Style token",
            type: "select",
            options: ["editorial", "brand", "value", "warn", "neutral"],
            hint: "A token, never a colour — the design system decides how it looks.",
          },
          { key: "icon", label: "Icon (emoji)", type: "text", placeholder: "Optional" },
          { key: "description", label: "Description", type: "textarea", span: 2 },
          { key: "displayOrder", label: "Order", type: "number" },
          { key: "isActive", label: "Active", type: "checkbox" },
        ]}
        columns={[
          { key: "preview", label: "Preview", render: badgePreview },
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug", mono: true },
          { key: "style", label: "Style", mono: true },
          { key: "isActive", label: "Active", render: (r) => boolCell(r.isActive, "Active") },
        ]}
      />
    </AdminPage>
  );
}
