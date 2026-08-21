"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary.
 *
 * There was none, anywhere. Any throw in a Server Component — and
 * `lib/api.ts` throws `ApiError` on every non-2xx response — went straight
 * past Next and out as a bare 500, which the browser renders as "This page
 * couldn't load". No branding, no retry, no indication whether the reader
 * should wait or leave.
 *
 * This matters more than it looks on the current hosting: the API runs on a
 * Render Free instance that spins down after 15 minutes idle and takes ~1
 * minute to wake. The first request after any quiet period WILL fail. That is
 * the normal operating behaviour of the stack, not an exceptional case, so the
 * failure needs a real screen rather than a stack trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack — Next strips the
    // real message in production. Without logging it, a support report is
    // untraceable.
    console.error("Route error:", error.digest ?? error.message, error);
  }, [error]);

  return (
    <main className="shell-content flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <p className="t-eyebrow mb-4">Something went wrong</p>

      <h1 className="t-headline max-w-xl text-ink">We couldn&rsquo;t load this page.</h1>

      <p className="mt-5 max-w-md text-body-md text-ink-muted">
        This is usually temporary — our research service may still be waking up.
        Give it a moment and try again.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand-fill px-6
                     font-label text-label font-semibold uppercase tracking-[0.06em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full border border-line-strong
                     px-6 font-label text-label font-semibold uppercase tracking-[0.06em] text-ink
                     transition-colors duration-fast hover:border-brand hover:text-brand"
        >
          Back to home
        </Link>
      </div>

      {error.digest && (
        <p className="tabular mt-10 text-label-xs text-ink-faint">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
