import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AdminNav, type NavGroup } from "@/components/admin/AdminNav";
import { AdminNavDrawer } from "@/components/admin/AdminNavDrawer";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { AdminProgress } from "@/components/admin/AdminProgress";
import { IdleLogout } from "@/components/admin/IdleLogout";
import { getAdminGate } from "@/lib/supabase/server";
import { BrandMark } from "@/components/layout/BrandMark";

export const metadata: Metadata = {
  title: "Admin · SortedChoice",
  robots: { index: false, follow: false },
};

/**
 * Admin shell (spec §34).
 *
 * Deliberately inverts the public spacing rules: this is a tool, so it is
 * dense, tabular and desktop-first (spec §49). Same tokens, tighter scale.
 *
 * NOTE: route protection is not authorization. Every admin API call is checked
 * server-side for authentication AND role (spec §44). This layout is chrome.
 *
 * But chrome is still reconnaissance. A child layout cannot *remove* a parent
 * one — Next composes them — so the gate has to live here: until the caller is
 * a fully authenticated, MFA-verified admin, this renders nothing but its
 * children.
 */
const nav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard" },
      // What every field on every form is for, what publishing demands, and
      // the prompts that draft the writing. Filed here rather than under
      // System because it is the first thing a new editor needs and the last
      // place anyone would look for it is behind Settings.
      { href: "/admin/guide", label: "Guide" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/brands", label: "Brands" },
      { href: "/admin/badges", label: "Badges" },
      { href: "/admin/top-picks", label: "Top Picks" },
      { href: "/admin/homepage", label: "Homepage" },
      { href: "/admin/media", label: "Media Library" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/reviews", label: "Reviews" },
      { href: "/admin/reports", label: "Reports" },
      { href: "/admin/user-media", label: "User Media" },
      // The page existed and was reachable only by typing the URL — no link
      // anywhere in the panel pointed at the contact-form inbox.
      { href: "/admin/messages", label: "Messages" },
      // Signups have been landing in the table since launch with no screen
      // showing them. Filed under Community rather than System because the
      // list is an audience, not an operation.
      { href: "/admin/newsletter", label: "Newsletter" },
    ],
  },
  {
    label: "System",
    items: [
      // Price runs and their history. Filed under System rather than Content
      // because it is an operation, not an edit — the screen's job is to
      // decide what to check and to show what the last check found.
      { href: "/admin/pricing", label: "Pricing" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/security", label: "Security" },
      { href: "/admin/logs", label: "Activity Logs" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await getAdminGate();

  // Signed out, not an admin, or admin-without-a-second-factor. Render the
  // page bare: the sign-in form and the enrolment screen are the only things
  // reachable in this state, and neither should be framed by a navigation
  // tree that maps the entire admin surface.
  if (!gate.ok) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Mounted only past the gate, so it never runs on the login or
          enrolment screens — there is no session to time out there, and a
          countdown over a sign-in form would be nonsense. */}
      <IdleLogout />
      {/* --- Sidebar --- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface-0 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-display text-body-lg font-black tracking-[-0.04em] text-ink"
          >
            {/* 22px, not the site header's 30 — this bar shares 256px with the
                wordmark and the Admin chip, and the chip is the half that
                carries the meaning here. */}
            <BrandMark size={22} />
            SortedChoice
          </Link>
          <span className="rounded-xs border border-brand-line bg-brand-soft px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.12em] text-brand-on-soft">
            Admin
          </span>
        </div>

        <AdminNav groups={nav} />

        <div className="border-t border-line p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-body-sm text-ink-muted
                       transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
          >
            ← View public site
          </Link>
        </div>
      </aside>

      {/* --- Canvas --- */}
      <div className="dot-matrix flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex h-16 items-center justify-between gap-3 overflow-hidden border-b border-line bg-surface-0/90 px-4 backdrop-blur-md sm:gap-4 sm:px-6">
          {/* Below `lg` the sidebar is hidden and this is the only way back to
              it — without it the panel has no navigation at all on a tablet. */}
          <AdminNavDrawer groups={nav} />

          {/* This was a bare <input> with no form and no handler — it looked
              like a global search and did nothing at all. Rather than build a
              cross-entity search that does not exist behind the API, it now
              drives the one search that does: the product catalogue. */}
          <Suspense fallback={<div className="h-10 w-full max-w-md" />}>
            <AdminSearch
              placeholder="Search products…"
              action="/admin/products"
              className="w-full max-w-md"
            />
          </Suspense>

          <div className="flex shrink-0 items-center gap-3">
            {/* The menu button takes this slot on a narrow bar; the theme
                control moves into the drawer's footer rather than away. */}
            <span className="hidden sm:block">
              <ThemeToggle />
            </span>
            <div className="border-l border-line pl-3">
              <AdminUserMenu email={gate.email} />
            </div>
          </div>

          <AdminProgress />
        </header>

        <main className="flex-1 p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
