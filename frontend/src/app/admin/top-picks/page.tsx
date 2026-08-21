import type { Metadata } from "next";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { TopPicksManager, type Pick, type Candidate } from "@/components/admin/TopPicksManager";

export const metadata: Metadata = { title: "Top Picks", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Top Picks curation (spec §15).
 *
 * Order is editorial, not algorithmic — a list sorted by score is just the
 * product grid again.
 */
export default async function AdminTopPicksPage() {
  const [picks, candidates] = await Promise.all([
    adminGet<{ items: Pick[] }>("/top-picks", { items: [] }),
    adminGet<{ items: Candidate[] }>("/top-picks/candidates", { items: [] }),
  ]);

  return (
    <AdminPage
      title="Top Picks"
      eyebrow="Content"
      description="The curated homepage list. Drag to reorder — the position is the editorial call, so it is set by hand rather than derived from score."
    >
      <TopPicksManager initial={picks.items} candidates={candidates.items} />
    </AdminPage>
  );
}
