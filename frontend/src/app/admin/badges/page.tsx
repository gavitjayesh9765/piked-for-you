import type { Metadata } from "next";
import { Suspense } from "react";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { TableArriving } from "@/components/ui/Arriving";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const metadata: Metadata = { title: "Badges", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Badges (spec §21).
 *
 * `style` is a design-system token, not a colour. That is what lets a badge
 * created here render correctly with no frontend deploy — and stops anyone
 * introducing an off-palette hue.
 *
 * ---------------------------------------------------------------------------
 * The screen's own copy — its title, its standing explanation — is not waiting
 * on anything, so it renders with the click. Only the list behind it streams,
 * behind a fallback that is invisible for its first 420ms and therefore never
 * seen on a warm navigation. Same shape on every admin list screen.
 */
export default function AdminBadgesPage() {
  return (
    <AdminPage
      title="Badges"
      eyebrow="Content"
      description="Reusable editorial markers, attached to products. Never hard-coded."
    >
      <Suspense fallback={<TableArriving />}>
        <BadgeList />
      </Suspense>
    </AdminPage>
  );
}

async function BadgeList() {
  const { items = [] } = await adminGet<{ items: Record<string, unknown>[] }>("/badges", {
    items: [],
  });

  return (
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
          options: ["neutral", "editorial", "brand", "value", "warn"],
          // The select had no default, so a new badge submitted style: "" and
          // the API refused it with the style list — as "Could not save."
          default: "neutral",
          hint: "A token, never a colour — the design system decides how it looks.",
        },
        { key: "icon", label: "Icon (emoji)", type: "text", placeholder: "Optional" },
        { key: "description", label: "Description", type: "textarea", span: 2 },
        { key: "displayOrder", label: "Order", type: "number", default: 0 },
        {
          key: "isActive",
          label: "Active",
          type: "checkbox",
          // Same defect as brands: created unchecked, submitted as false, and
          // the product form only offers active badges — so a badge made here
          // could never be attached to anything.
          default: true,
          hint: "Only active badges can be attached to a product. Products already carrying it keep it.",
        },
      ]}
      columns={[
        { key: "preview", label: "Preview", cell: "badge" },
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug", mono: true },
        { key: "style", label: "Style", mono: true },
        { key: "isActive", label: "Active", cell: "bool", yes: "Active" },
      ]}
    />
  );
}
