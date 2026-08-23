import type { Metadata } from "next";
import Link from "next/link";

import { forYou, listSaved, safe } from "@/lib/me-api";
import { getAuthedUser } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/display-name";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/admin/Shell";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Account overview.
 *
 * "For you" is recommended from what the person **explicitly told us** — their
 * chosen categories, brands and budget. No behavioural tracking, no inferred
 * profile. It is the only input we have, and the only one we have consent for.
 */
export default async function AccountPage() {
  const [user, saved, picks] = await Promise.all([
    getAuthedUser(),
    safe(() => listSaved(1), { items: [], total: 0, page: 1, pageSize: 24, hasMore: false }),
    safe(() => forYou(8), []),
  ]);

  // Shared with the header and the settings page, and with the Postgres
  // trigger that names the profile row — see lib/display-name.ts. Reading
  // user_metadata.display_name directly greeted every Google account as the
  // front half of their email address.
  const name = resolveDisplayName(user) ?? "there";

  return (
    <div>
      <header className="mb-10">
        <h1 className="font-display text-display-lg text-ink">Hello, {name}.</h1>
        <p className="mt-3 max-w-xl text-body-lg text-ink-muted">
          Your shortlist and the picks that match what you&apos;re looking for.
        </p>
      </header>

      {/* --- Quick stats --- */}
      <div className="mb-12 grid gap-3 sm:grid-cols-3">
        <Stat label="Saved products" value={saved.total} href="/account/saved" />
        <Stat label="Reviews written" value={0} href="/account/reviews" />
        <Stat label="Interests set" value={picks.length > 0 ? "Yes" : "Not yet"} href="/account/preferences" />
      </div>

      {/* --- For you --- */}
      <section>
        <div className="flex items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="t-eyebrow mb-2">Matched to your interests</p>
            <h2 className="t-headline text-ink">Picked for you</h2>
          </div>
          <Link
            href="/account/preferences"
            className="shrink-0 font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
          >
            Adjust
          </Link>
        </div>

        {picks.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Tell us what you're shopping for"
              body="Pick a few categories and a budget, and we'll surface the products worth your attention."
              action={
                <Link
                  href="/account/preferences"
                  className="inline-flex h-11 items-center rounded-full bg-brand-fill px-7 font-label
                             text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on shadow-brand
                             transition-all duration-fast hover:brightness-110"
                >
                  Set preferences
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid-products mt-8">
            {picks.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link href={href} className="panel p-5 transition-colors duration-fast hover:border-brand-line">
      <p className="t-eyebrow">{label}</p>
      <p className="tabular mt-3 text-headline-lg font-bold leading-none text-ink">{value}</p>
    </Link>
  );
}
