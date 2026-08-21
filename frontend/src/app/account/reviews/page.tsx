import type { Metadata } from "next";
import Link from "next/link";

import { getAccessToken } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/admin/Shell";
import type { Paginated, Review } from "@/lib/types";

export const metadata: Metadata = { title: "Your reviews", robots: { index: false } };
export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const EMPTY: Paginated<Review> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  hasMore: false,
};

async function loadMine(): Promise<Paginated<Review>> {
  const token = await getAccessToken();
  if (!token) return EMPTY;
  try {
    const res = await fetch(`${API_URL}/reviews/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return EMPTY;
    return (await res.json()) as Paginated<Review>;
  } catch {
    return EMPTY;
  }
}

const STATUS_NOTE: Record<string, string> = {
  pending: "Waiting for a moderator. Nobody else can see it yet.",
  approved: "Live on the product page.",
  rejected: "Not published. It broke the guidelines.",
  hidden: "Removed from public view by a moderator.",
  reported: "Flagged by other readers and under review.",
};

/**
 * The user's own review history (spec §10.2).
 *
 * Shows every state, not just approved — "where is my review?" is the question
 * this page exists to answer, so the status and what it means are both stated
 * plainly rather than left to be inferred.
 */
export default async function AccountReviewsPage() {
  const reviews = await loadMine();

  return (
    <div>
      <header className="mb-8 border-b border-line pb-6">
        <p className="t-eyebrow mb-2">Your account</p>
        <h1 className="font-display text-display-lg text-ink">Your reviews</h1>
        <p className="mt-3 max-w-xl text-body-md text-ink-muted">
          Everything you&apos;ve written, and where it stands. All reviews are read by a person
          before they appear — that applies to everyone, and it&apos;s why this section stays
          worth reading.
        </p>
      </header>

      {reviews.items.length === 0 ? (
        <EmptyState
          title="You haven't written a review yet"
          body="Found something you have real experience with? Say so on its product page."
          action={
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full bg-brand-fill px-7 font-label
                         text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                         shadow-brand transition-all duration-fast hover:brightness-110"
            >
              Browse products
            </Link>
          }
        />
      ) : (
        <>
          <p className="tabular mb-6 text-body-sm text-ink-subtle">
            {reviews.total} {reviews.total === 1 ? "review" : "reviews"}
          </p>

          <ul className="grid gap-4">
            {reviews.items.map((r) => (
              <li key={r.id} className="panel p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="tabular font-mono text-body-sm text-ink">{r.rating}/5</span>
                      <span className="text-ink-faint">·</span>
                      <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                        {relativeTime(r.createdAt)}
                      </span>
                    </div>
                    {r.title && (
                      <h2 className="mt-2 text-headline-sm text-ink">{r.title}</h2>
                    )}
                  </div>
                  <StatusPill status={r.status} />
                </div>

                <p className="mt-4 whitespace-pre-wrap text-body-sm text-ink-muted">{r.body}</p>

                {r.media.length > 0 && (
                  <p className="mt-3 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                    {r.media.length} attachment{r.media.length > 1 ? "s" : ""}
                  </p>
                )}

                <p className="mt-4 border-t border-line pt-3 text-label-xs text-ink-subtle">
                  {STATUS_NOTE[r.status] ?? ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
