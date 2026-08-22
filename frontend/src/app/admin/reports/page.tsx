import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { adminGet } from "@/lib/admin-api";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";
import { StatusPill } from "@/components/ui/Badge";
import { ResolveReports } from "@/components/admin/ResolveReports";
import { TableArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Reports", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Group {
  reviewId: string;
  reviewStatus: string;
  reviewBody: string;
  author: string;
  productTitle: string;
  reports: { id: string; reason: string; detail: string | null; createdAt: string }[];
}

const REASON: Record<string, string> = {
  spam: "Spam",
  fake: "Fake review",
  offensive: "Offensive",
  irrelevant: "Irrelevant",
  promotional: "Promotional",
  inappropriate_media: "Inappropriate media",
};

/**
 * Abuse reports (spec §30).
 *
 * Grouped by the review they target: three reports on one review is one
 * decision, not three. An approved review stays visible until a human rules on
 * it — otherwise a single report becomes a censorship button.
 *
 * ---------------------------------------------------------------------------
 * The filter tabs come from the query string and respond instantly; only the
 * count and the grid stream, keyed on the filter so a new tab replaces the old
 * items rather than appearing to amend them. The fallback holds the height and
 * is invisible for its first 420ms, so a warm switch shows nothing at all.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "open" } = await searchParams;

  return (
    <AdminPage
      title="Reports"
      eyebrow="Community"
      description="Reviews flagged by readers. A report marks something for a look — it never removes content on its own."
    >
      <FilterTabs
        basePath="/admin/reports"
        active={status}
        options={[
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
        ]}
      />

      <Suspense key={status} fallback={<TableArriving rows={4} />}>
        <Queue status={status} />
      </Suspense>
    </AdminPage>
  );
}

async function Queue({ status }: { status: string }) {
  const data = await adminGet<{ items: Group[]; total: number }>(
    "/reports",
    { items: [], total: 0 },
    { resolved: String(status === "resolved") },
  );

  return (
    <>
      <p className="tabular my-6 text-body-sm text-ink-subtle">
        {data.total} reported {data.total === 1 ? "review" : "reviews"}
      </p>

      {data.items.length === 0 ? (
        <div className="dot-matrix rounded-lg border border-line py-20 text-center">
          <p className="text-headline-sm text-ink">Nothing reported.</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {data.items.map((g) => (
            <li key={g.reviewId} className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{g.productTitle}</p>
                  <p className="mt-1 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                    by {g.author} · {g.reports.length} report
                    {g.reports.length > 1 ? "s" : ""}
                  </p>
                </div>
                <StatusPill status={g.reviewStatus} />
              </div>

              <p className="mt-4 whitespace-pre-wrap text-body-sm text-ink-muted">{g.reviewBody}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {g.reports.map((r) => (
                  <span
                    key={r.id}
                    title={r.detail ?? undefined}
                    className="rounded-xs border border-danger-soft bg-danger-soft px-2 py-0.5 font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-danger-on-soft"
                  >
                    {REASON[r.reason] ?? r.reason}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                <ResolveReports reviewId={g.reviewId} />
                <Link
                  href="/admin/reviews?status=reported"
                  className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
                >
                  Moderate the review
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
