"use client";

import { useState } from "react";
import type { Review } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { CommunityRating } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReviewForm } from "./ReviewForm";
import { ReviewActions } from "./ReviewActions";

/**
 * Community reviews (spec §28–§32).
 *
 * Two rules encoded here:
 *  - The label is "User Review", never "Verified Buyer" — we have no purchase
 *    verification mechanism yet, so claiming one would be a lie (spec §31).
 *  - This block is visually distinct from the SortedChoice verdict above it. Different
 *    source, different treatment (spec §32).
 */
export function ReviewList({
  reviews,
  average,
  count,
  productId,
  productTitle,
  isAuthed = false,
  helpfulIds,
}: {
  reviews: Review[];
  average?: number;
  count?: number;
  productId: string;
  productTitle: string;
  isAuthed?: boolean;
  /** Which of these the caller has already found helpful. Fetched separately
   *  from the reviews themselves — see `helpfulReviewIds` in lib/me-api.ts for
   *  why a per-caller field cannot ride along on an edge-cached list. */
  helpfulIds?: string[];
}) {
  const [writing, setWriting] = useState(false);
  // A Set because this is read once per card and the list is unbounded in
  // principle — a returning reader can have marked every review on the page.
  const voted = new Set(helpfulIds ?? []);

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="t-eyebrow mb-3">From the community</p>
          <h2 className="t-headline text-ink">What owners say</h2>
          {average != null && count ? (
            <CommunityRating average={average} count={count} className="mt-3" />
          ) : null}
        </div>
        {/* Authentication is enforced server-side; hiding this button is only a
            convenience, never the control (spec §27). */}
        {!writing && (
          <Button variant="outline" size="md" onClick={() => setWriting(true)}>
            Write a review
          </Button>
        )}
      </div>

      {writing && (
        <div className="mt-8">
          <ReviewForm
            productId={productId}
            productTitle={productTitle}
            isAuthed={isAuthed}
            onClose={() => setWriting(false)}
          />
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="dot-matrix mt-6 rounded-lg border border-line py-12 text-center">
          <p className="text-body-md text-ink-muted">No community reviews yet.</p>
          <p className="mt-1 text-body-sm text-ink-subtle">Be the first to share your experience.</p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))" }}>
          {reviews.map((r) => (
            <li key={r.id} className="panel flex flex-col p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 font-label text-label font-semibold text-ink-muted">
                    {r.author.displayName.charAt(0)}
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-ink">{r.author.displayName}</p>
                    <p className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                      User review · {relativeTime(r.createdAt)}
                    </p>
                  </div>
                </div>
                {r.isFeatured && (
                  <span className="rounded-xs border border-brand-line bg-brand-soft px-2 py-0.5 font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-brand-on-soft">
                    Featured
                  </span>
                )}
              </div>

              <div className="mt-4">
                <CommunityRating average={r.rating} count={0} className="[&>span:last-child]:hidden" />
              </div>

              {r.title && <h3 className="mt-3 text-headline-sm text-ink">{r.title}</h3>}
              <p className="mt-2 text-body-sm text-ink-muted">{r.body}</p>

              <ReviewActions
                reviewId={r.id}
                helpfulCount={r.helpfulCount}
                initialVoted={voted.has(r.id)}
                isAuthed={isAuthed}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
