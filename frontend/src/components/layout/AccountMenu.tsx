"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Account control in the site header.
 *
 * `isAdmin` decides whether to *show* an admin link. It is presentation only —
 * forcing it true in devtools reveals a link whose destination the proxy
 * redirects away from and whose API calls all 403. The real gate is server-side.
 */
export function AccountMenu({
  initialEmail,
  initialName,
  isAdmin,
}: {
  initialEmail: string | null;
  initialName: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /**
   * Log in and come back here.
   *
   * Skipped on the auth pages themselves — `next=/login` would bounce the
   * reader back to the form they just completed. Admin paths are excluded too:
   * this is the public control, and a shopper signing in has no business being
   * returned to an admin URL.
   */
  const loginHref =
    pathname &&
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !pathname.startsWith("/admin") &&
    !["/login", "/register", "/forgot-password"].includes(pathname)
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (!initialEmail) {
    return (
      <Link
        href={loginHref}
        className="ml-1 hidden h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-editorial-bg
                   px-5 font-label text-label-xs font-semibold uppercase tracking-[0.1em]
                   text-editorial-fg transition-opacity duration-fast hover:opacity-90 sm:inline-flex"
      >
        Log in
      </Link>
    );
  }

  const label = initialName || initialEmail;
  const initial = label.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-2
                   font-label text-label font-semibold text-ink transition-colors duration-fast
                   hover:border-brand hover:text-brand"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-nav w-60 overflow-hidden rounded-lg border
                     border-line bg-surface-0 shadow-e3"
        >
          <div className="border-b border-line px-4 py-3">
            {initialName && <p className="truncate text-body-sm font-medium text-ink">{initialName}</p>}
            <p className="truncate text-label-xs text-ink-subtle">{initialEmail}</p>
          </div>

          <div className="py-1">
            <MenuLink href="/account">Your reviews</MenuLink>
            <MenuLink href="/account/settings">Settings</MenuLink>
            {isAdmin && (
              <>
                <div className="my-1 border-t border-line" />
                <MenuLink href="/admin">
                  <span className="flex items-center justify-between">
                    Admin panel
                    <span className="rounded-xs border border-brand-line bg-brand-soft px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-brand-on-soft">
                      Staff
                    </span>
                  </span>
                </MenuLink>
              </>
            )}
          </div>

          <div className="border-t border-line py-1">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="block w-full px-4 py-2.5 text-left text-body-sm text-ink-muted
                         transition-colors duration-fast hover:bg-surface-1 hover:text-danger"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="block px-4 py-2.5 text-body-sm text-ink-muted transition-colors duration-fast
                 hover:bg-surface-1 hover:text-ink"
    >
      {children}
    </Link>
  );
}
