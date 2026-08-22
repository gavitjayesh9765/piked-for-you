import type { Metadata } from "next";
import { Suspense } from "react";

import { listMessages, safe } from "@/lib/admin-api";
import { relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badge";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";
import { TableArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

const TOPIC_LABEL: Record<string, string> = {
  research_request: "Research request",
  correction: "Correction",
  press: "Press & partnerships",
  general: "General",
};

/**
 * Inbox from the contact form.
 *
 * Research requests are the valuable ones — they say what the audience wants
 * covered next — so the topic is prominent and the category tags are shown as
 * chips rather than buried.
 *
 * ---------------------------------------------------------------------------
 * The controls at the top of this screen are driven by the query string, so
 * they render and respond instantly — a tab or a search must never wait on the
 * rows it is about to fetch. Only the count and the list stream, keyed on the
 * filter so a new view replaces the old rows rather than appearing to amend
 * them, behind a fallback that holds the height and stays invisible for its
 * first 420ms.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "new" } = await searchParams;

  return (
    <AdminPage
      title="Messages"
      eyebrow="Community"
      description="Requests from the contact form. Research requests are a signal about what to cover next."
    >
      <FilterTabs
        basePath="/admin/messages"
        active={status}
        options={[
          { value: "new", label: "New" },
          { value: "in_progress", label: "In progress" },
          { value: "answered", label: "Answered" },
          { value: "all", label: "All" },
        ]}
      />

      <Suspense key={status} fallback={<TableArriving rows={5} />}>
        <Inbox status={status} />
      </Suspense>
    </AdminPage>
  );
}

async function Inbox({ status }: { status: string }) {
  const data = await safe(() => listMessages(status), {
    items: [],
    total: 0,
    hasMore: false,
  });

  return (
    <>
      <p className="tabular my-6 text-body-sm text-ink-subtle">
        {data.total} {data.total === 1 ? "message" : "messages"}
      </p>

      {data.items.length === 0 ? (
        <div className="dot-matrix rounded-lg border border-line py-20 text-center">
          <p className="text-headline-sm text-ink">Inbox is empty.</p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {data.items.map((m) => (
            <li key={m.id} className="panel p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xs border border-brand-line bg-brand-soft px-2 py-0.5 font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-brand-on-soft">
                      {TOPIC_LABEL[m.topic] ?? m.topic}
                    </span>
                    <code className="font-mono text-label-xs text-ink-faint">{m.reference}</code>
                  </div>
                  <p className="mt-2 text-body-sm text-ink">
                    {m.name || "—"}{" "}
                    <a
                      href={`mailto:${m.email}?subject=Re: ${m.reference}`}
                      className="text-ink-muted hover:text-brand"
                    >
                      &lt;{m.email}&gt;
                    </a>
                  </p>
                  <p className="mt-0.5 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                    {relativeTime(m.createdAt)}
                  </p>
                </div>
                <StatusPill status={m.status === "new" ? "pending" : m.status} />
              </div>

              {/* Plain text, never HTML — untrusted public input. */}
              <p className="mt-4 whitespace-pre-wrap text-body-sm text-ink-muted">{m.message}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {m.categorySlugs?.map((slug) => (
                  <span
                    key={slug}
                    className="rounded-xs border border-line bg-surface-1 px-2 py-0.5 font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle"
                  >
                    {slug.replace(/-/g, " ")}
                  </span>
                ))}
                {m.budgetRange && (
                  <span className="rounded-xs border border-line bg-surface-1 px-2 py-0.5 font-mono text-label-xs text-ink-subtle">
                    {m.budgetRange}
                  </span>
                )}
              </div>

              {m.productUrl && (
                <p className="mt-3 truncate font-mono text-label-xs text-ink-faint">
                  {m.productUrl}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
