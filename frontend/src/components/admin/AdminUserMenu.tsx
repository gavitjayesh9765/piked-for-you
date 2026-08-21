"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * The signed-in admin, and the way out.
 *
 * The shell had neither. It drew an avatar and an email address and offered no
 * sign-out anywhere in the panel — so the only way to end a privileged session
 * was to find the public site's account menu, or clear cookies. On a shared or
 * borrowed machine that is the difference between "logged out" and "still an
 * admin for the next hour".
 *
 * `scope: "global"` on purpose. A staff session ended deliberately should end
 * everywhere, not just in this tab: "sign me out" from an admin panel means the
 * session is over, including on whichever other device is holding one.
 */
export function AdminUserMenu({ email }: { email: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await createClient().auth.signOut({ scope: "global" });
    } catch {
      // The cookie is cleared locally either way, and the proxy will refuse
      // the next admin request. Nothing useful to say, and staying on the page
      // pretending to still be signed in would be worse.
    }
    // `replace`, not `push`: back should not return to a dashboard shell.
    router.replace("/admin/login");
    router.refresh();
  }

  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors duration-fast hover:bg-surface-2"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft font-label text-label font-semibold text-brand-on-soft">
          {initial}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[14rem] truncate text-body-sm font-medium leading-tight text-ink">
            {email ?? "Signed in"}
          </span>
          <span className="block font-label text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            Admin · 2FA verified
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="hidden shrink-0 text-ink-faint sm:block"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-nav mt-2 w-60 overflow-hidden rounded-lg border border-line bg-surface-0 shadow-e3"
        >
          <p className="truncate border-b border-line px-4 py-3 text-body-sm text-ink-muted sm:hidden">
            {email ?? "Signed in"}
          </p>

          <Link
            href="/admin/security"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-body-sm text-ink-muted transition-colors duration-fast hover:bg-surface-1 hover:text-ink"
          >
            Security &amp; 2FA
          </Link>
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-body-sm text-ink-muted transition-colors duration-fast hover:bg-surface-1 hover:text-ink"
          >
            View public site
          </Link>

          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void signOut()}
            className="block w-full border-t border-line px-4 py-2.5 text-left text-body-sm
                       text-danger transition-colors duration-fast hover:bg-danger-soft
                       disabled:opacity-45"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
