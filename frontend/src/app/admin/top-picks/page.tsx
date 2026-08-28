import type { Metadata } from "next";
import { Suspense } from "react";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { TableArriving } from "@/components/ui/Arriving";
import { TopPicksManager, type Pick } from "@/components/admin/TopPicksManager";

export const metadata: Metadata = { title: "Top Picks", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Top Picks curation (spec §15).
 *
 * Order is editorial, not algorithmic — a list sorted by score is just the
 * product grid again.
 *
 * ---------------------------------------------------------------------------
 * The screen's own copy — its title, its standing explanation — is not waiting
 * on anything, so it renders with the click. Only the list behind it streams,
 * behind a fallback that is invisible for its first 420ms and therefore never
 * seen on a warm navigation. Same shape on every admin list screen.
 */
export default function AdminTopPicksPage() {
  return (
    <AdminPage
      title="Top Picks"
      eyebrow="Content"
      description="The curated homepage list. Drag to reorder, or use the arrows — the position is the editorial call, so it is set by hand rather than derived from score."
    >
      <Suspense fallback={<TableArriving rows={6} />}>
        <Board />
      </Suspense>
    </AdminPage>
  );
}

async function Board() {
  // The shortlist is no longer fetched here. It is searched from the client
  // against the API, because filtering one server-side fetch in the browser
  // meant searching inside an arbitrary fifty rows — a product outside that
  // window could not be found at all.
  const picks = await adminGet<{
    items: Pick[];
    visibleLimit: number | null;
    sectionActive: boolean;
  }>("/top-picks", { items: [], visibleLimit: null, sectionActive: true });

  return (
    <TopPicksManager
      initial={picks.items}
      visibleLimit={picks.visibleLimit}
      sectionActive={picks.sectionActive}
    />
  );
}
