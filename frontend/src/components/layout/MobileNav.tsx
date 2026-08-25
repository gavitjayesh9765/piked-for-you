"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import type { NavItem } from "./CategoryNav";
import { createClient } from "@/lib/supabase/client";
import { SearchField } from "@/components/ui/SearchField";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Navigation for viewports below `md`.
 *
 * The desktop header carries three things the narrow bar has no room for: the
 * search field, the category sub-nav, and the account control. Below `md` all
 * three collapse in here, because the alternative — hiding them — left a phone
 * with no route to any category, to Top Picks, or to the login form at all.
 *
 * The panel is a sheet rather than a full-screen takeover: the scrim keeps the
 * page visible behind it, so "I opened a menu" stays legible as a reversible
 * state. Escape, the scrim, the close button, and any navigation all dismiss it.
 *
 * The sheet is PORTALLED to <body>. The header bar it is triggered from lives
 * inside `.glass`, and `backdrop-filter` makes an element a containing block
 * for its fixed-position descendants — rendered in place, the sheet would be
 * positioned against a 68px-tall bar instead of the viewport and the scrim
 * would cover nothing. The trigger stays in the bar; only the overlay moves.
 *
 * `isAdmin` is presentation only — the same rule as <AccountMenu>. Forcing it
 * true reveals a link the proxy redirects away from.
 *
 * The category list here is the SAME list the desktop sub-nav shows — the
 * taxonomy's top-level sections, in the order an admin set. It used to be every
 * active category, flat: 36 rows on a phone, mixing the root of the tree with
 * leaves three levels down and offering no clue which was which. A menu that
 * long is not a menu, it is the index — and the index already exists, one tap
 * away under "See all".
 */
export function MobileNav({
  sections,
  email,
  name,
  isAdmin,
}: {
  sections: NavItem[];
  email: string | null;
  name: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // The portal target only exists on the client; rendering nothing on the
  // server keeps SSR and the first client paint in agreement.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Navigating dismisses the sheet. Keyed on the pathname rather than an
  // onClick per link so it also covers the back button and the search form.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The sheet is `md:hidden`. On rotation into a tablet-width landscape it
  // therefore vanishes — but the scroll lock below would survive it, leaving a
  // page that cannot scroll and no visible control to release it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const close = () => mq.matches && setOpen(false);
    close();
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  // Body scroll lock. Without it the page behind the scrim scrolls under the
  // finger on iOS, and closing the sheet lands the reader somewhere else.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the sheet on open and hand it back to the trigger on close,
  // so a keyboard or screen-reader user is never left stranded behind the
  // scrim. Guarded on `wasOpen` so the closed initial render does not pull
  // focus to the hamburger on page load.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      // Contain Tab inside the sheet: everything behind the scrim is inert to
      // the pointer, so it has to be inert to the keyboard too.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input, select, textarea",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Same-origin paths only — this value ends up in a redirect, and an absolute
  // URL here would make the login page an open redirect.
  const loginHref =
    pathname &&
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !pathname.startsWith("/admin") &&
    !["/login", "/register", "/forgot-password"].includes(pathname)
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";

  async function signOut() {
    // Wrapped, because an unhandled rejection here left the person signed in
    // on a page that had just told them they were signing out. `signOut()`
    // rejects on any network blip, and the two lines below — the ones that
    // actually take them off the account UI — never ran.
    //
    // The redirect is the right outcome either way: supabase-js clears the
    // local session before it calls the server, so the browser is signed out
    // regardless of whether the revocation request landed.
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Nothing useful to tell them, and nothing they could do about it.
    }
    setOpen(false);
    router.replace("/");
    router.refresh();
  }

  const sheet = (
    <>
      {/* Scrim. Kept mounted for the fade, but pointer-events-none while closed
          so it can never swallow a tap meant for the page. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-overlay bg-scrim transition-opacity duration-base ease-ease md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        ref={panelRef}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        // `dvh`, not `vh`: with mobile browser chrome retracted, `100vh` puts
        // the account row under the address bar where it cannot be tapped.
        className={cn(
          "fixed right-0 top-0 z-modal flex h-[100dvh] w-[min(22rem,88vw)] flex-col",
          "border-l border-line bg-surface-0 shadow-e3",
          "transition-transform duration-base ease-ease md:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
        // Out of the accessibility tree and the tab order while closed. The
        // panel stays mounted so the slide has something to animate.
        inert={!open}
      >
        <div className="flex h-nav shrink-0 items-center justify-between gap-3 border-b border-line px-5">
          <span className="font-display text-body-lg font-black tracking-[-0.04em] text-ink">
            SortedChoice
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="-mr-1.5 grid h-11 w-11 place-items-center rounded-full text-ink-muted
                       transition-colors duration-fast hover:text-brand"
          >
            <CloseGlyph />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          <SearchField placeholder="What are you trying to buy?" />

          <nav aria-label="Primary" className="mt-7">
            <ul className="space-y-0.5">
              <SheetLink href="/top-picks">Top Picks</SheetLink>
              <SheetLink href="/compare">Compare</SheetLink>
              <SheetLink href="/how-we-research">How we research</SheetLink>
            </ul>
          </nav>

          {sections.length > 0 && (
            <nav aria-label="Categories" className="mt-7 border-t border-line pt-6">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="t-eyebrow">Categories</h2>
                <Link
                  href="/c"
                  className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
                >
                  See all
                </Link>
              </div>
              <ul className="space-y-0.5">
                {sections.map((section) => (
                  <SheetLink key={section.href} href={section.href} muted>
                    {section.label}
                  </SheetLink>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div className="shrink-0 border-t border-line px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {email ? (
                <>
                  {name && <p className="truncate text-body-sm font-medium text-ink">{name}</p>}
                  <p className="truncate text-label-xs text-ink-subtle">{email}</p>
                </>
              ) : (
                <p className="text-label-xs text-ink-subtle">Not signed in</p>
              )}
            </div>
            <ThemeToggle />
          </div>

          {email ? (
            <ul className="mt-3 space-y-0.5">
              <SheetLink href="/account" muted>
                Your account
              </SheetLink>
              <SheetLink href="/account/saved" muted>
                Saved
              </SheetLink>
              {isAdmin && (
                <SheetLink href="/admin" muted>
                  Admin panel
                </SheetLink>
              )}
              <li>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex min-h-11 w-full items-center rounded-sm px-3 py-2.5 text-left
                             text-body-sm text-ink-muted transition-colors duration-fast
                             hover:bg-surface-1 hover:text-danger"
                >
                  Sign out
                </button>
              </li>
            </ul>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href={loginHref}
                className="flex h-11 items-center justify-center rounded-full bg-editorial-bg
                           font-label text-label-xs font-semibold uppercase tracking-[0.1em]
                           text-editorial-fg transition-opacity duration-fast hover:opacity-90"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="flex h-11 items-center justify-center rounded-full border border-line-strong
                           font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-ink
                           transition-colors duration-fast hover:border-brand hover:text-brand"
              >
                Create an account
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink-muted
                   transition-colors duration-fast hover:border-brand hover:text-brand md:hidden"
      >
        <MenuGlyph />
      </button>

      {mounted && createPortal(sheet, document.body)}
    </>
  );
}

/** 44px minimum tap height — the sheet is a touch surface first. */
function SheetLink({
  href,
  children,
  muted,
}: {
  href: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex min-h-11 items-center rounded-sm px-3 py-2.5 transition-colors duration-fast",
          muted
            ? "text-body-sm text-ink-muted hover:bg-surface-1 hover:text-ink"
            : "text-body-md font-medium text-ink hover:bg-surface-1 hover:text-brand",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function MenuGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
