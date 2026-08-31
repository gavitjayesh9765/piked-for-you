import { Suspense } from "react";

import { getCategoriesForChrome } from "@/lib/api";
import { getAuthedUser } from "@/lib/supabase/server";
import { SessionExpiry } from "@/components/auth/SessionExpiry";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PageView } from "@/components/analytics/PageView";
import { CompareProvider } from "@/components/compare/CompareProvider";
import { CompareShelf } from "@/components/compare/CompareShelf";

/**
 * The public site shell.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *
 * Every public page used to render `<SiteHeader>` and `<SiteFooter>` itself —
 * twenty pages, twenty copies, each fetching the category taxonomy and
 * resolving the session before it could render a single byte.
 *
 * The cost was not the duplication. It was that **a page does not survive a
 * navigation and a layout does.** Because the header lived in the page, every
 * click tore down the wordmark, the search field, the account control and the
 * category rail, then rebuilt all of them from a server response — after
 * waiting on the API and the auth server first. Nothing on screen could move
 * until all of that finished, which is precisely the "laggy" feeling: not slow
 * animation, but a UI with nothing to show and no way to say so.
 *
 * With the chrome hoisted here, a navigation between any two public routes
 * re-renders only what is genuinely different: the content below this layout.
 * The header is not re-fetched, not re-rendered, and not remounted. The sub-nav
 * keeps its scroll position and its underline slides rather than reappearing.
 *
 * This is also what makes the Suspense boundaries inside the pages useful. As
 * the Next.js instant-navigation guide puts it, a client navigation only
 * re-renders below the layout the two routes share — so a fallback declared
 * *above* that point can never be shown during the transition. Putting the
 * chrome in the shared layout is what moves every page's Suspense boundary
 * below it, where it can actually do its job.
 *
 * ---------------------------------------------------------------------------
 * WHY `getCategoriesForChrome` AND NOT `getCategories`
 *
 * Here the taxonomy is navigation, not content. This layout wraps `/privacy`
 * and `/login` as well as `/c` — pages that have nothing to do with the
 * catalogue and must not fail, or fail a deploy, because a category list was
 * slow. The safe variant degrades to an empty rail, which renders a smaller
 * page rather than a wrong one. Pages whose *subject* is the taxonomy keep
 * calling `getCategories()` themselves and let the error surface; the request
 * is deduplicated, so asking twice costs one call.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategoriesForChrome();

  return (
    /* The comparison shortlist lives at the layout for the same reason the
       header does: this is the boundary that SURVIVES a navigation. Held in a
       page, the shelf would unmount and remount on every click, and a shortlist
       built across three category pages is by definition built across three
       navigations. Session storage would carry the data, but the bar would
       still flicker out and back on each one. */
    <CompareProvider>
      {/* Renders nothing. Behind its own boundary because resolving the
          caller is a round trip to the auth server, and the shell must not
          wait on it — the same reason the header account slot is suspended
          rather than awaited inline. */}
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
      <SiteHeader categories={categories} />
      {children}
      <SiteFooter />
      {/* After the footer, so the spacer it renders extends the page rather
          than sitting between content and the footer. */}
      <CompareShelf />
      {/* Renders nothing. Mounted here rather than per-page precisely
          BECAUSE this layout survives navigation — see the note in
          components/analytics/PageView.tsx for why that means it watches
          the pathname instead of firing on mount. */}
      <PageView />
    </CompareProvider>
  );
}

/** Mirrors `timebox = "720h"` in supabase/config.toml. */
const TIMEBOX_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Arms the shopper session bound, or renders nothing for a signed-out visitor.
 *
 * The absolute deadline is derived here rather than in the browser because
 * `last_sign_in_at` comes from the verified user — a timebox the client could
 * rewrite would not be a timebox. See SessionExpiry for why the hosted project
 * cannot enforce either bound on the Free plan.
 */
async function SessionGuard() {
  const user = await getAuthedUser();
  if (!user) return null;

  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;

  return (
    <SessionExpiry
      hardDeadline={Number.isFinite(signedInAt) ? signedInAt + TIMEBOX_MS : null}
    />
  );
}
