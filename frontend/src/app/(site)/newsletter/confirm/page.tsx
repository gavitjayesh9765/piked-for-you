import type { Metadata } from "next";

import { ConfirmSubscription } from "@/components/newsletter/ConfirmSubscription";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  // The URL carries a single-use token. Keeping it out of an index is the
  // cheap half of not leaking it; the other half is that the token is cleared
  // on first use anyway.
  robots: { index: false, follow: false },
};

// The token makes every request unique and the page performs a write. Nothing
// here is cacheable.
export const dynamic = "force-dynamic";

/**
 * Landing page for the double opt-in link in the newsletter confirmation
 * email (`app/core/mail.py` builds the URL; `SITE_URL` is what points it here
 * rather than at the API, which would answer a click with raw JSON).
 */
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  // `?token=a&token=b` parses to an array. Treat it as absent rather than
  // guessing which one was meant.
  const value = typeof token === "string" ? token : null;

  return (
    <main id="main" className="shell-content py-16 lg:py-24">
      <div className="mx-auto w-full max-w-xl">
        <ConfirmSubscription token={value} />
      </div>
    </main>
  );
}
