import type { Metadata } from "next";

import { listLogs, safe } from "@/lib/admin-api";
import { relativeTime } from "@/lib/format";
import { AdminPage, DataTable, FilterTabs, Td } from "@/components/admin/Shell";

export const metadata: Metadata = { title: "Activity logs", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Audit trail (spec §60).
 *
 * Read-only, and not by convention — there is no API endpoint to edit or delete
 * an entry, and Row Level Security grants no update or delete policy on this
 * table. An audit log you can rewrite is not an audit log.
 */
export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type ?? "all";
  const data = await safe(
    () => listLogs(type === "all" ? undefined : type, Number(sp.page ?? 1)),
    { items: [], total: 0, hasMore: false },
  );

  return (
    <AdminPage
      title="Activity logs"
      eyebrow="System"
      description="Every administrative change, in order. Append-only — entries cannot be edited or deleted."
    >
      <FilterTabs
        basePath="/admin/logs"
        param="type"
        active={type}
        options={[
          { value: "all", label: "All" },
          { value: "product", label: "Products" },
          { value: "review", label: "Reviews" },
        ]}
      />

      <p className="tabular my-6 text-body-sm text-ink-subtle">{data.total} entries</p>

      <DataTable
        columns={["When", "Action", "Entity", "Summary"]}
        empty={data.items.length === 0}
      >
        {data.items.map((l) => (
          <tr key={l.id} className="transition-colors duration-fast hover:bg-surface-1">
            <Td className="whitespace-nowrap text-ink-subtle">{relativeTime(l.createdAt)}</Td>
            <Td>
              <code className="rounded-xs border border-line bg-surface-1 px-2 py-0.5 font-mono text-label-xs text-ink">
                {l.action}
              </code>
            </Td>
            <Td className="text-ink-muted">{l.entityType}</Td>
            <Td className="text-ink">
              {l.summary ?? "—"}
              {l.meta && Object.keys(l.meta).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer font-label text-[10px] uppercase tracking-[0.1em] text-ink-faint hover:text-brand">
                    Detail
                  </summary>
                  <pre className="mt-2 max-w-xl overflow-x-auto rounded-md border border-line bg-surface-1 p-3 font-mono text-[11px] text-ink-muted">
                    {JSON.stringify(l.meta, null, 2)}
                  </pre>
                </details>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>
    </AdminPage>
  );
}
