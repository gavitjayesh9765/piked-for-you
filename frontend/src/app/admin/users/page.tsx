import type { Metadata } from "next";
import { Suspense } from "react";

import { listUsers, safe } from "@/lib/admin-api";
import { formatDate } from "@/lib/format";
import { AdminPage, DataTable, Td } from "@/components/admin/Shell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { TableArriving, ValueArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Users", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Registered shoppers — read-only, and deliberately minimal.
 *
 * Notice what is absent: saved products and stated interests. Row Level
 * Security grants admins no policy on those tables at all, so this screen
 * *cannot* show them even if someone added the column. Browsing an
 * individual's shortlist is not an operational need.
 *
 * ---------------------------------------------------------------------------
 * The search field is driven by the query string and renders instantly; only
 * the count and the table stream, keyed on the query and page so a new search
 * replaces the old rows rather than appearing to amend them. The fallback
 * holds the table's height and is invisible for its first 420ms.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Number(sp.page ?? 1);

  return (
    <AdminPage
      title="Users"
      eyebrow="System"
      description="People who registered to write reviews. Read-only."
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <AdminSearch placeholder="Search name or email…" defaultValue={q} />
        <p className="tabular shrink-0 text-body-sm text-ink-subtle">
          <Suspense fallback={<ValueArriving width={9} />}>
            <UserCount q={q} page={page} />
          </Suspense>
        </p>
      </div>

      <Suspense key={`${q}:${page}`} fallback={<TableArriving rows={10} />}>
        <UserTable q={q} page={page} />
      </Suspense>
    </AdminPage>
  );
}

/**
 * Both halves share one memoized `listUsers` call, so the count and the table
 * cost one request and land together.
 */
async function users(q: string, page: number) {
  return safe(() => listUsers(q || undefined, page), { items: [], total: 0, hasMore: false });
}

async function UserCount({ q, page }: { q: string; page: number }) {
  const data = await users(q, page);
  return (
    <>
      {data.total} {data.total === 1 ? "user" : "users"}
    </>
  );
}

async function UserTable({ q, page }: { q: string; page: number }) {
  const data = await users(q, page);

  return (
    <>
      <DataTable
        columns={["Name", "Email", "Reviews", "Joined", "Status"]}
        empty={data.items.length === 0}
      >
        {data.items.map((u) => (
          <tr key={u.id} className="transition-colors duration-fast hover:bg-surface-1">
            <Td>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 font-label text-label font-semibold text-ink-muted">
                  {u.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="font-medium text-ink">{u.displayName}</span>
              </div>
            </Td>
            <Td className="text-ink-muted">{u.email}</Td>
            <Td mono>{u.reviewCount}</Td>
            <Td className="whitespace-nowrap text-ink-muted">{formatDate(u.createdAt)}</Td>
            <Td>
              <span
                className={
                  u.isActive
                    ? "font-label text-label-xs uppercase tracking-[0.1em] text-value"
                    : "font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint"
                }
              >
                {u.isActive ? "Active" : "Disabled"}
              </span>
            </Td>
          </tr>
        ))}
      </DataTable>

      <p className="mt-6 max-w-2xl text-label-xs leading-relaxed text-ink-faint">
        Admin accounts do not appear here. They live in Supabase Auth and are created manually —
        see docs/05-admin-setup.md. There is no way to grant the admin role from this panel, by
        design.
      </p>
    </>
  );
}
