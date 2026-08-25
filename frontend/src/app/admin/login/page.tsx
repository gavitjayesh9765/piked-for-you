import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

// Never prerender or cache a login page: it reads the session cookie and the
// `next` parameter, and a cached copy would be both wrong and a leak.
export const dynamic = "force-dynamic";

/**
 * Admin sign-in.
 *
 * Deliberately austere and detached from the public site: no nav, no footer,
 * no marketing. This is a staff door, and it should not look like a storefront.
 *
 * There is no "create account" link — and no endpoint behind one. Admins are
 * created manually (docs/05-admin-setup.md).
 *
 * Uses its own layout, bypassing the admin shell, so an unauthenticated visitor
 * never sees the sidebar or its structure.
 */
export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-gutter py-16">
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3">
            <BrandMark size={40} />
            <p className="font-display text-[1.6rem] font-black tracking-[-0.045em] text-ink">
              SortedChoice
            </p>
          </div>
          <p className="t-eyebrow mt-2">Staff access</p>
        </div>

        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>

        <p className="mt-8 text-center text-label-xs leading-relaxed text-ink-faint">
          Authorised personnel only. All sign-in attempts are logged.
        </p>
      </div>
    </div>
  );
}
