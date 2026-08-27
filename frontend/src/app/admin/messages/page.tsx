import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { listMessages, safe, type AdminMessageList } from "@/lib/admin-api";
import { relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badge";
import { AdminPage, EmptyState, FilterTabs } from "@/components/admin/Shell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { MessageListControls } from "@/components/admin/MessageListControls";
import { CONTACT_TOPICS, CONTACT_TOPIC_LABEL } from "@/lib/contact-topics";
import { MessageActions } from "@/components/admin/MessageActions";
import { TableArriving, ValueArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The tabs this screen offers; anything else falls back to "all". */
const STATUSES = new Set(["all", "new", "in_progress", "answered", "closed"]);

/** A hand-edited `?topic=' or 1=1` never reaches the API. */
const TOPICS = new Set<string>(CONTACT_TOPICS.map((t) => t.value));

/** A hand-edited `?page=abc` produced `page=NaN` upstream. */
function pageOf(value: string | undefined): number {
  const n = Math.floor(Number(value ?? 1));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

const EMPTY: AdminMessageList = {
  items: [],
  counts: {},
  total: 0,
  page: 1,
  hasMore: false,
};

/**
 * Inbox from the contact form.
 *
 * Research requests are the valuable ones — they say what the audience wants
 * covered next — so the topic is prominent and the category tags are shown as
 * chips rather than buried.
 *
 * ---------------------------------------------------------------------------
 * This screen used to be four status tabs and a list, and that was the whole
 * of it: no search, no topic filter, no pagination, and no way to change a
 * status. Which meant the tabs were decoration — every message stayed `new`
 * for ever, so "New" and "All" showed the same rows and the other two were
 * permanently empty — and finding one message among a few hundred meant
 * scrolling. It is now built the same way /admin/products is, because it is
 * the same kind of screen:
 *
 *   status tabs (with counts) · search · topic filter · count · rows · paging
 *
 * The controls at the top are driven by the query string, so they render and
 * respond instantly — a tab or a search must never wait on the rows it is
 * about to fetch. Only the count and the list stream, keyed on the filter so a
 * new view replaces the old rows rather than appearing to amend them, behind a
 * fallback that holds the height and stays invisible for its first 420ms.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; topic?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;

  const status = STATUSES.has(sp.status ?? "") ? sp.status! : "new";
  const topic = TOPICS.has(sp.topic ?? "") ? sp.topic : undefined;
  const page = pageOf(sp.page);

  const query: Query = { status, topic, q: sp.q, page };
  const key = JSON.stringify(query);

  return (
    <AdminPage
      title="Messages"
      eyebrow="Community"
      description="Requests from the contact form. Research requests are a signal about what to cover next."
    >
      <Suspense fallback={<Tabs active={status} />}>
        <TabsWithCounts query={query} />
      </Suspense>

      <div className="my-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AdminSearch
            placeholder="Search reference, sender or message…"
            defaultValue={sp.q ?? ""}
          />
          <p className="tabular shrink-0 text-body-sm text-ink-subtle">
            <Suspense fallback={<ValueArriving width={12} />}>
              <Count query={query} />
            </Suspense>
          </p>
        </div>

        <MessageListControls topic={topic} />
      </div>

      <Suspense key={key} fallback={<TableArriving rows={4} />}>
        <Inbox query={query} />
      </Suspense>
    </AdminPage>
  );
}

type Query = {
  status: string;
  topic: string | undefined;
  q: string | undefined;
  page: number;
};

/**
 * The tabs, the count and the list are the same request; Next memoizes it per
 * render pass, so asking three times from three boundaries costs one call.
 */
async function messages(query: Query) {
  return safe(
    () =>
      listMessages({
        status: query.status,
        topic: query.topic,
        q: query.q,
        page: query.page,
      }),
    EMPTY,
  );
}

const TAB_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const;

/**
 * Rendered twice: once immediately without numbers as the Suspense fallback,
 * once with them. The tabs are how an admin navigates this screen and they
 * must be on the page before the counts land, or the whole header jumps when
 * they arrive.
 */
function Tabs({ active, counts }: { active: string; counts?: Record<string, number> }) {
  return (
    <FilterTabs
      basePath="/admin/messages"
      active={active}
      options={TAB_OPTIONS.map((o) => ({ ...o, count: counts?.[o.value] }))}
    />
  );
}

async function TabsWithCounts({ query }: { query: Query }) {
  const data = await messages(query);
  return <Tabs active={query.status} counts={data.counts} />;
}

async function Count({ query }: { query: Query }) {
  const data = await messages(query);
  return (
    <>
      {data.total} {data.total === 1 ? "message" : "messages"}
    </>
  );
}

/** Carries every active filter into the next page. Dropping any of them makes
 *  "Load more" return page 2 of a different list. */
function nextPageQuery(query: Query, nextPage: number): string {
  const qs = new URLSearchParams({ status: query.status, page: String(nextPage) });
  if (query.topic) qs.set("topic", query.topic);
  if (query.q) qs.set("q", query.q);
  return qs.toString();
}

async function Inbox({ query }: { query: Query }) {
  const data = await messages(query);

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={query.q || query.topic ? "Nothing matches that." : "Inbox is empty."}
        body={
          query.q || query.topic
            ? "Try a different search, or clear the topic filter."
            : "New requests from the contact form land here."
        }
        action={
          query.q || query.topic ? (
            <Link
              href={`/admin/messages?status=${query.status}`}
              className="font-label text-label-xs uppercase tracking-[0.08em] text-brand hover:underline"
            >
              Clear search and filters
            </Link>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <ul className="stagger grid gap-4">
        {data.items.map((m) => (
          <li key={m.id} className="panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xs border border-brand-line bg-brand-soft px-2 py-0.5 font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-brand-on-soft">
                    {CONTACT_TOPIC_LABEL[m.topic] ?? m.topic}
                  </span>
                  <code className="font-mono text-label-xs text-ink-faint">{m.reference}</code>
                </div>
                <p className="mt-2 text-body-sm text-ink">
                  {m.name || "—"}{" "}
                  {/* The reference in the subject is the whole point of having
                      one: a reply lands in a thread the sender can match to
                      what they asked. */}
                  <a
                    href={`mailto:${m.email}?subject=Re: ${m.reference}`}
                    className="text-ink-muted hover:text-brand"
                  >
                    &lt;{m.email}&gt;
                  </a>
                </p>
                <p className="mt-0.5 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                  {relativeTime(m.createdAt)}
                  {m.answeredAt && <> · answered {relativeTime(m.answeredAt)}</>}
                </p>
              </div>
              <StatusPill status={m.status} />
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
              {m.organisation && (
                <span className="rounded-xs border border-line bg-surface-1 px-2 py-0.5 font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
                  {m.organisation}
                </span>
              )}
            </div>

            {m.productUrl && (
              <p className="mt-3 truncate font-mono text-label-xs text-ink-faint">
                {m.productUrl}
              </p>
            )}

            {m.internalNote && (
              <p className="mt-4 rounded-md border border-line bg-surface-1 px-4 py-3 text-body-sm text-ink-muted">
                <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                  Internal note ·{" "}
                </span>
                {m.internalNote}
              </p>
            )}

            <MessageActions id={m.id} status={m.status} note={m.internalNote} />
          </li>
        ))}
      </ul>

      {data.hasMore && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/admin/messages?${nextPageQuery(query, query.page + 1)}`}
            className="inline-flex h-10 items-center rounded-full border border-line-strong px-6
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                       text-ink transition-colors duration-fast hover:border-brand hover:text-brand"
          >
            Load more
          </Link>
        </div>
      )}
    </>
  );
}
