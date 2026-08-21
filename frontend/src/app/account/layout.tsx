import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { cn } from "@/lib/cn";
import { getAuthedUser } from "@/lib/supabase/server";
import { safePublicPath } from "@/lib/safe-path";
import { getCategories } from "@/lib/api";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/saved", label: "Saved" },
  { href: "/account/reviews", label: "Your reviews" },
  { href: "/account/preferences", label: "Preferences" },
  { href: "/account/settings", label: "Settings" },
];

/**
 * Account area shell.
 *
 * Uses the public design system — this is a reader's own space, not a tool, so
 * it keeps the spacious public rhythm rather than the admin's tighter density.
 *
 * The redirect here is convenience. Every `/me` endpoint independently verifies
 * the token, so an unauthenticated request gets nothing regardless.
 *
 * It sends them back to the page they actually asked for. This used to
 * hardcode `next=/account`, so a signed-out visitor opening a link to
 * /account/saved or /account/reviews was returned to the overview after
 * logging in and had to navigate again — the deep link was silently discarded.
 * Server Components cannot read the pathname, so the proxy stamps it on the
 * request as `x-pathname`.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser();

  // The proxy stamps this; a Server Component cannot read the pathname itself.
  // It carries the query string too, which the redirect below wants and the
  // nav's active test does not.
  const here = (await headers()).get("x-pathname");
  const pathname = here?.split("?")[0] ?? null;

  if (!user) {
    // Same-origin paths only — this value ends up in a redirect, and an
    // absolute URL here would make the login page an open redirect. Uses the
    // shared validator rather than a prefix test: `x-pathname` is stamped by
    // the proxy from the request URL, so it is attacker-influenced.
    const next = safePublicPath(here, "/account");
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const categories = await getCategories();

  return (
    <>
      <SiteHeader categories={categories} />

      <main id="main" className="shell-wide py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-[calc(var(--nav-h)+var(--subnav-h)+1.5rem)] lg:self-start">
            <p className="t-eyebrow mb-4">Your account</p>
            {/* Below `lg` this is a scrolling tab strip rather than a column.
                It had no active state at either size, so on a phone — where the
                page heading is the only other cue — the strip never told the
                reader which of the five sections they were actually in. The
                scrollbar is hidden because the strip is short enough to reveal
                its overflow by the last item sitting half-cut at the edge. */}
            <nav>
              <ul
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1
                           [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                           lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
              >
                {NAV.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center whitespace-nowrap rounded-sm px-3 py-2",
                          "text-body-sm transition-colors duration-fast lg:min-h-0",
                          active
                            ? "bg-brand-soft font-medium text-brand-on-soft"
                            : "text-ink-muted hover:bg-surface-1 hover:text-ink",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <p className="mt-6 hidden truncate border-t border-line pt-4 text-label-xs text-ink-faint lg:block">
              {user.email}
            </p>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
