"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";

/**
 * The two controls in a review card's footer.
 *
 * Both were drawn a long time ago and neither was ever wired: they rendered as
 * `<button>` elements with no handler, so "Helpful (42)" was a number that
 * could not be added to and "Report" was a word. Everything underneath them
 * already existed — `review_helpful_votes` with its unique key and counter
 * trigger, the report endpoint with its three-strike auto-flag — which made
 * this the rare feature that was finished apart from the click.
 *
 * They live in one component because reporting takes over the footer row that
 * both of them share. Two siblings each trying to own that row would need the
 * state lifted anyway.
 */

/** Exactly the set `reviews/router.py` validates against — an unlisted value
 *  is a 422, so the labels and the API cannot drift apart silently. */
const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake or paid" },
  { value: "offensive", label: "Offensive" },
  { value: "irrelevant", label: "Not about this product" },
  { value: "promotional", label: "Promotional" },
  { value: "inappropriate_media", label: "Inappropriate photo or video" },
];

const ACTION =
  "font-label text-label-xs uppercase tracking-[0.1em] transition-colors duration-fast";

export function ReviewActions({
  reviewId,
  helpfulCount,
  initialVoted = false,
  isAuthed = false,
}: {
  reviewId: string;
  helpfulCount: number;
  initialVoted?: boolean;
  isAuthed?: boolean;
}) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  if (reported) {
    return (
      <div className="hairline mt-auto pt-4">
        {/* Deliberately the same sentence whatever happened upstream. The API
            returns 202 for a duplicate report as well as a first one, because
            telling someone "you already reported this" confirms that their
            earlier report exists — and the outcome is identical either way. */}
        <p className="text-body-sm text-ink-subtle">Reported. A moderator will take a look.</p>
      </div>
    );
  }

  if (reporting) {
    return (
      <ReportPanel
        reviewId={reviewId}
        onDone={() => setReported(true)}
        onCancel={() => setReporting(false)}
      />
    );
  }

  return (
    <div className="hairline mt-auto flex items-center justify-between gap-4 pt-4">
      <HelpfulButton
        reviewId={reviewId}
        count={helpfulCount}
        initialVoted={initialVoted}
        isAuthed={isAuthed}
      />
      <button
        type="button"
        onClick={() => setReporting(true)}
        className={cn(ACTION, "text-ink-faint hover:text-danger")}
      >
        Report
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Optimistic, on the same argument SaveButton makes: the vote is low-stakes and
 * reversible, so waiting on a round trip would make a grid of review cards feel
 * sluggish for no gain. It reverts if the request fails.
 *
 * The count is adjusted locally rather than re-fetched. The authoritative
 * number is maintained by a database trigger on the votes table, so the value
 * shown here and the value in the database can only differ by this reader's own
 * un-acknowledged vote — which is exactly what an optimistic state is.
 */
function HelpfulButton({
  reviewId,
  count,
  initialVoted,
  isAuthed,
}: {
  reviewId: string;
  count: number;
  initialVoted: boolean;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState(initialVoted);
  const [busy, setBusy] = useState(false);

  // The server-rendered count already includes this reader's vote if they have
  // one, so the baseline is the count without it.
  const base = count - (initialVoted ? 1 : 0);
  const shown = base + (voted ? 1 : 0);

  async function toggle() {
    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const next = !voted;
    setVoted(next);
    setBusy(true);

    try {
      const res = next
        ? await fetch("/api/me/helpful", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewId }),
          })
        : await fetch(`/api/me/helpful?reviewId=${reviewId}`, { method: "DELETE" });

      if (!res.ok) setVoted(!next);
    } catch {
      setVoted(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={voted}
      className={cn(
        ACTION,
        "inline-flex items-center gap-1.5 disabled:opacity-60",
        voted ? "text-brand" : "text-ink-subtle hover:text-brand",
      )}
    >
      {/* The slot is always occupied, at a fixed width, so casting a vote does
          not shove the label sideways by 13px. Voting is the moment the reader
          is looking straight at this control; it is the worst possible moment
          for it to jump. */}
      <span className="grid w-[13px] shrink-0 place-items-center">
        <CheckGlyph className={voted ? "opacity-100" : "opacity-0"} />
      </span>
      {/* `tabular` so 9 → 10 does not re-flow the row either. */}
      Helpful <span className="tabular">({shown})</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Reporting, inline.
 *
 * A reason is not optional — the API validates against a fixed set and a report
 * with no reason is a 422 — so the control cannot be a single "Report" click.
 * The obvious build for "pick one of six" is a modal, and a modal is the wrong
 * instrument here: it stops the page, dims twelve other reviews, and traps
 * focus, all to ask one question about one card.
 *
 * So the card's own footer becomes the question. Each reason is its own button,
 * which also removes the second step — there is no "choose, then confirm",
 * because choosing IS the confirmation and nothing here is destructive.
 */
function ReportPanel({
  reviewId,
  onDone,
  onCancel,
}: {
  reviewId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function send(reason: string) {
    setFailed(false);
    setBusy(reason);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      // Authentication is enforced upstream; this is the convenience path back
      // for a reader whose session expired while the page was open.
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) {
        setFailed(true);
        return;
      }
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="hairline mt-auto pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="t-eyebrow">What is wrong with it?</p>
        <button
          type="button"
          onClick={onCancel}
          className={cn(ACTION, "text-ink-faint hover:text-ink")}
        >
          Cancel
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => send(r.value)}
            disabled={busy !== null}
            className="rounded-xs border border-line px-2.5 py-1.5 text-body-sm text-ink-muted
                       transition-colors duration-fast hover:border-danger hover:text-danger
                       disabled:opacity-50"
          >
            {r.label}
          </button>
        ))}
      </div>

      {failed && (
        <p className="mt-3 text-body-sm text-danger">
          That did not send. Try again in a moment.
        </p>
      )}
    </div>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("transition-opacity duration-fast", className)}
    >
      <path d="M5 13l4.5 4.5L19 6.5" />
    </svg>
  );
}
