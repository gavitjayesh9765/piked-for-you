import Link from "next/link";
import type { Category } from "@/lib/types";
import { categoryHref } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { SearchField } from "@/components/ui/SearchField";
import { AccountMenu } from "./AccountMenu";
import { MobileNav } from "./MobileNav";
import { getAuthedUser, hasAdminRole } from "@/lib/supabase/server";

/**
 * Sticky glass header (spec §12) + dynamic category sub-nav (spec §13).
 *
 * Full-bleed by design: the bar spans the entire viewport with only the gutter
 * as padding, so the brand sits at the far left and actions at the far right
 * regardless of display width.
 *
 * The sub-nav is entirely data-driven — categories come from the API and are
 * never hard-coded (spec §6, §13).
 *
 * BELOW `md` the sub-nav, the search field and the account control all have to
 * go — a 360px bar cannot hold them. They are not dropped, they move: see
 * <MobileNav>, which is the only route to a category, to Top Picks or to the
 * login form on a phone.
 */
export async function SiteHeader({ categories }: { categories: Category[] }) {
  const navCategories = categories.filter((c) => c.isActive).slice(0, 8);

  // Resolved server-side from the verified session, so the header renders in
  // its final state — no signed-out flash, no client round trip.
  const user = await getAuthedUser();
  // Role only, deliberately not the MFA-verified gate: an admin who has not
  // enrolled yet still needs the link, and the proxy routes them to enrolment.
  const admin = user ? await hasAdminRole() : false;
  const displayName =
    (user?.user_metadata as Record<string, string> | undefined)?.display_name ?? null;

  return (
    <header className="sticky top-0 z-nav">
      {/* --- Primary bar --- */}
      <div className="glass">
        <div className="shell flex h-nav items-center gap-4">
          <Link
            href="/"
            className="shrink-0 font-display text-[1.15rem] font-black tracking-[-0.045em] text-ink sm:text-[1.35rem]"
          >
            PickDForYou
          </Link>

          {/* Search is the front door (spec §33) — it gets the growing space.
              `min-w-0` lets it give that space back: without it the field's
              intrinsic width wins the squeeze at ~768px and the actions beside
              it are the ones that compress. */}
          <div className="mx-auto hidden w-full min-w-0 max-w-2xl md:block">
            <SearchField placeholder="Search products, brands, or what you need…" />
          </div>

          <nav className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
            <Link
              href="/top-picks"
              className="hidden rounded-full px-4 py-2 font-label text-label uppercase tracking-[0.08em]
                         text-ink-muted transition-colors duration-fast hover:text-brand lg:block"
            >
              Top Picks
            </Link>
            <Link
              href="/search"
              aria-label="Search"
              className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-muted
                         transition-colors duration-fast hover:border-brand hover:text-brand md:hidden"
            >
              <SearchIcon />
            </Link>

            {/* Below `md` the theme control and the account menu move into the
                sheet. Four 40px circles plus the wordmark overflow a 360px bar,
                and the two that survive the squeeze should be the ones a reader
                reaches for mid-task: search, and everything else. */}
            <div className="hidden items-center gap-1.5 md:flex">
              <ThemeToggle />
              <AccountMenu
                initialEmail={user?.email ?? null}
                initialName={displayName}
                isAdmin={admin}
              />
            </div>

            <MobileNav
              categories={categories}
              email={user?.email ?? null}
              name={displayName}
              isAdmin={admin}
            />
          </nav>
        </div>
      </div>

      {/* --- Category sub-nav (spec §13) --- */}
      <div className="hidden border-b border-line bg-bg/95 backdrop-blur-md md:block">
        <div className="shell flex h-subnav items-center gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href="/c"
            className="whitespace-nowrap font-label text-label uppercase tracking-[0.08em]
                       text-ink-subtle transition-colors duration-fast hover:text-ink"
          >
            All categories
          </Link>
          {navCategories.map((c) => (
            <Link
              key={c.id}
              href={categoryHref(c)}
              className="whitespace-nowrap font-label text-label uppercase tracking-[0.08em]
                         text-ink-subtle transition-colors duration-fast hover:text-ink"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.7-4.7" />
    </svg>
  );
}
