import type { Metadata } from "next";
import Link from "next/link";

import { listReviews, safe } from "@/lib/admin-api";
import { relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badge";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";
import { ModerateActions } from "@/components/admin/ModerateActions";

export const metadata: Metadata = { title: "Reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Moderation queue (spec §30).
 *
 * A card list rather than a table: a moderator has to *read* the review to
 * judge it, and a table row truncates the one thing the decision depends on.
 * Oldest first, so nothing waits indefinitely.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "pending" } = await searchParams;
  const data = await safe(() => listReviews(status), {
    items: [],
    total: 0,
    hasMore: false,
  });

  return (
    <AdminPage
      title="Reviews"
      eyebrow="Community"
      description="Everything users submit is held until approved. Nothing reaches the public site unmoderated."
    >
      <FilterTabs
        basePath="/admin/reviews"
        active={status}
        options={[
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "reported", label: "Reported" },
          { value: "all", label: "All" },
        ]}
      />

      <p className="tabular my-6 text-body-sm text-ink-subtle">
        {data.total} {data.total === 1 ? "review" : "reviews"}
      </p>

      {data.items.length === 0 ? (
        <div className="dot-matrix rounded-lg border border-line py-20 text-center">
          <p className="text-headline-sm text-ink">Queue is clear.</p>
          <p className="mt-2 text-body-sm text-ink-muted">
            Nothing is waiting for moderation.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {data.items.map((r) => (
            <li key={r.id} className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div className="min-w-0">
                  <Link
                    href={`/admin/products/${r.productId}`}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {r.productTitle}
                  </Link>
                  <p className="mt-1 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                    {r.author} · {relativeTime(r.createdAt)}
                    {r.mediaCount > 0 && ` · ${r.mediaCount} attachment${r.mediaCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular font-mono text-body-sm text-ink">{r.rating}/5</span>
                  <StatusPill status={r.status} />
                </div>
              </div>

              {r.title && <h3 className="mt-4 text-headline-sm text-ink">{r.title}</h3>}
              {/* Rendered as text, never HTML — this is untrusted user input. */}
              <p className="mt-2 whitespace-pre-wrap text-body-sm text-ink-muted">{r.body}</p>

              <div className="mt-5 border-t border-line pt-4">
                <ModerateActions id={r.id} status={r.status} isFeatured={r.isFeatured} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
