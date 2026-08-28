import type { Metadata } from "next";

import { AdminPage, Contained } from "@/components/admin/Shell";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Configuration reference.
 *
 * Deliberately read-only. Configuration lives in environment variables by
 * design (spec §66) — a settings UI that writes secrets into a database would
 * be a step backwards, and putting a "change the JWT secret" button behind a
 * session is exactly the kind of convenience that becomes a breach.
 */
const GROUPS = [
  {
    title: "Where things are configured",
    items: [
      ["Database, Supabase keys, media limits", "backend/.env"],
      ["Public site URL, Supabase anon key", "frontend/.env.local"],
      ["Schema, RLS policies, seed data", "supabase/migrations/"],
      ["Design tokens, both themes", "frontend/src/styles/tokens.css"],
    ],
  },
  {
    title: "Security posture",
    items: [
      ["Admin role", "app_metadata.role — service-role key only, set by hand"],
      ["Admin MFA", "Required. Every admin route checks aal2, not just the login page"],
      ["Row Level Security", "Enabled on all 21 tables"],
      ["Audit log", "Append-only. No endpoint or RLS policy grants update or delete"],
      ["Review video cap", "30s, read from the container header and a CHECK constraint"],
    ],
  },
  {
    title: "Not configurable here, on purpose",
    items: [
      ["Secrets", "Environment variables only — never a database row"],
      ["Admin accounts", "Created manually. See docs/05-admin-setup.md"],
      ["Publication rules", "A product needs image, price, score, verdict and a retailer link"],
    ],
  },
];

export default function AdminSettingsPage() {
  return (
    <AdminPage
      title="Settings"
      eyebrow="System"
      description="A reference, not a control panel. Configuration lives in environment variables."
      refreshable={false}
    >
      {/* The frame stays wide so this heading lines up with every other admin
          screen; only the body takes the shorter measure, because these are
          label/value pairs and a 1920px dl is unreadable. */}
      <Contained className="grid gap-6">
        {GROUPS.map((g) => (
          <section key={g.title} className="panel p-6">
            <h2 className="t-eyebrow mb-4">{g.title}</h2>
            <dl className="divide-y divide-line-faint">
              {g.items.map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-4">
                  <dt className="text-body-sm text-ink">{label}</dt>
                  <dd className="font-mono text-body-sm text-ink-muted">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </Contained>
    </AdminPage>
  );
}
