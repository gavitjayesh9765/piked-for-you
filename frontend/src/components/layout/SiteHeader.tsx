import { Suspense, cache } from "react";
import Link from "next/link";

import type { Category } from "@/lib/types";
import { categoryHref } from "@/lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { SearchField } from "@/components/ui/SearchField";
import { AccountMenu } from "./AccountMenu";
import { MobileNav } from "./MobileNav";
import { CategoryNav, type NavItem } from "./CategoryNav";
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
 *
 * ---------------------------------------------------------------------------
 * WHY THIS COMPONENT IS NO LONGER `async`
 *
 * It used to await `getAuthedUser()` at the top level, and every page rendered
 * its own copy. Both halves of that were expensive:
 *
 *   - `getAuthedUser()` calls `supabase.auth.getUser()`, which is a network
 *     round trip to the auth server, and `hasAdminRole()` verifies claims for a
 *     second. Awaited here, those two calls sat in front of the FIRST BYTE of
 *     every page on the site — including pages whose content had already been
 *     fetched and was sitting there ready to render.
 *
 *   - Touching cookies opts the route out of static rendering entirely, so no
 *     page could ever be served from the edge instantly.
 *
 * Both are now confined to the two Suspense boundaries below. The shell — the
 * wordmark, the search field, the sub-nav — renders and streams immediately,
 * and the two controls that genuinely depend on who you are fill in behind it,
 * usually within the same paint. Their placeholders occupy the exact final
 * geometry, so nothing moves when they arrive.
 *
 * The component is also mounted once, by the site layout, instead of once per
 * page. A layout survives navigation; a page does not. That is what stopped the
 * whole header from being destroyed and rebuilt on every click.
 */
export function SiteHeader({ categories }: { categories: Category[] }) {
  const items = navItems(categories);

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
              {/* The slot is a fixed width because its two possible occupants
                  are not the same size — a 40px avatar when signed in, an 84px
                  "Log in" pill when not — and which one it will be is exactly
                  what we are still waiting to learn. Reserving the larger of
                  the two means the answer, whichever it is, arrives without
                  shoving the rest of the bar sideways. */}
              <div className="flex w-[5.5rem] justify-end">
                <Suspense fallback={<AccountSlotPlaceholder />}>
                  <HeaderAccount />
                </Suspense>
              </div>
            </div>

            <Suspense fallback={<MobileNavPlaceholder />}>
              {/* The sheet gets the sections, not the index entry — it has its
                  own "See all" link to /c. */}
              <HeaderMobileNav sections={items.filter((i) => i.kind === "section")} />
            </Suspense>
          </nav>
        </div>
      </div>

      {/* --- Category sub-nav (spec §13) --- */}
      <CategoryNav items={items} />
    </header>
  );
}


/* ------------------------------------------------------------------ */
/* What goes in the sub-nav                                            */
/* ------------------------------------------------------------------ */

/**
 * The categories the sub-nav offers.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS REPLACED, AND WHY IT HAD TO GO
 *
 * The rail used to be `categories.filter(isActive).slice(0, 8)` — the first
 * eight rows the API happened to return. Against the real taxonomy that
 * produced a bar nobody had designed:
 *
 *   - **It mixed three depths as if they were siblings.** "Electronics" is the
 *     ROOT of the entire tree; it sat between "Consoles" and "Headphones",
 *     which are leaves three levels down, styled identically. One of those
 *     links returns the whole catalogue and the others return a single shelf,
 *     and the bar gave the reader no way to tell which was which.
 *
 *   - **It was alphabetical by accident.** Every category in the fixture shares
 *     `displayOrder: 1`, so the API's `(displayOrder, name)` sort degenerated to
 *     name order and `slice(0, 8)` took A through S. Meanwhile the eight
 *     top-level sections carry a deliberate admin ordering — 1 through 8 — that
 *     nothing was reading.
 *
 *   - **It pointed mostly at nothing.** Six of the eight had no research behind
 *     them, while Smartphones, Earbuds, Gaming Monitors and Mice — which do —
 *     were not in the bar at all, because the alphabet did not reach them.
 *
 *   - **It hid 28 of 36 categories** with no affordance saying so.
 *
 * ---------------------------------------------------------------------------
 * THE RULE NOW
 *
 * Show the taxonomy's top level: the shallowest depth that has more than one
 * category in it. Today that is the eight children of Electronics — Audio,
 * Computers, Mobiles, Gaming, Cameras, Wearables, Smart Home, Accessories — in
 * the order an admin actually set. Add a second root and the rule promotes
 * itself to the roots without anyone editing this file.
 *
 * One consistent depth, an order somebody chose, and every one of the 36
 * categories reachable underneath one of them. Nothing is truncated away.
 */
function navItems(categories: Category[]): NavItem[] {
  const active = categories.filter((c) => c.isActive);
  const pathOf = (c: Category) => (c.path?.length ? c.path : [c.slug]).join("/");
  const depthOf = (c: Category) => (c.path?.length ? c.path.length : 1);

  // The shallowest level that is actually a level — a single root is a trunk,
  // not a navigation, so we descend past it to its branches.
  const depths = [...new Set(active.map(depthOf))].sort((a, b) => a - b);
  const depth = depths.find((d) => active.filter((c) => depthOf(c) === d).length > 1) ?? depths[0];
  const sections = active.filter((c) => depthOf(c) === depth);

  return [
    { href: "/c", label: "All categories", kind: "index" },
    ...sections.map((section) => {
      const prefix = pathOf(section);
      const beneath = active.filter(
        (c) => pathOf(c) === prefix || pathOf(c).startsWith(`${prefix}/`),
      );

      return {
        href: categoryHref(section),
        label: section.name,
        kind: "section" as const,
        // Every slug filed under this section. A product URL carries its LEAF
        // category (`/p/headphones/...`), so without this the rail would go
        // blank the moment you opened a product — the leaf is never one of the
        // items, only its section is.
        slugs: beneath.map((c) => c.slug),
        // `productCount` on a category is its own rows only; the products
        // endpoint rolls descendants up. Summing the subtree here is what makes
        // "Audio" honest — it holds no products itself and two underneath it.
        researched: beneath.reduce((sum, c) => sum + (c.productCount ?? 0), 0) > 0,
      };
    }),
  ];
}

/**
 * Who the caller is, resolved once per request.
 *
 * `cache()` is doing real work here, not tidiness: the desktop account menu and
 * the mobile sheet are two separate Suspense boundaries that need the same
 * three facts, and without deduplication each would independently pay for a
 * `getUser()` round trip plus a claims verification.
 */
const identity = cache(async () => {
  // Resolved server-side from the verified session, so the control renders in
  // its final state — no signed-out flash, no client round trip.
  const user = await getAuthedUser();
  // Role only, deliberately not the MFA-verified gate: an admin who has not
  // enrolled yet still needs the link, and the proxy routes them to enrolment.
  const admin = user ? await hasAdminRole() : false;
  const name =
    (user?.user_metadata as Record<string, string> | undefined)?.display_name ?? null;

  return { email: user?.email ?? null, name, admin };
});

async function HeaderAccount() {
  const { email, name, admin } = await identity();
  return <AccountMenu initialEmail={email} initialName={name} isAdmin={admin} />;
}

async function HeaderMobileNav({ sections }: { sections: NavItem[] }) {
  const { email, name, admin } = await identity();
  return <MobileNav sections={sections} email={email} name={name} isAdmin={admin} />;
}

/**
 * Placeholders, not skeletons.
 *
 * Neither shimmers, pulses, or announces itself. They are the real control's
 * outline in the real control's position, so the moment of resolution reads as
 * the label appearing rather than as a widget swapping in.
 */
function AccountSlotPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="h-10 w-10 rounded-full border border-line-faint bg-surface-1"
    />
  );
}

function MobileNavPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-faint md:hidden"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    </div>
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
