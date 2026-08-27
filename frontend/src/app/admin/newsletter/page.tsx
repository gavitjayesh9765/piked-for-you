import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { listSubscribers, safe, type AdminSubscriberList } from "@/lib/admin-api";
import { relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/Badge";
import { AdminPage, DataTable, FilterTabs, Td } from "@/components/admin/Shell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { SubscriberListControls } from "@/components/admin/SubscriberListControls";
import {
  NEWSLETTER_FREQUENCIES,
  NEWSLETTER_FREQUENCY_LABEL,
  SUBSCRIBER_STATES,
} from "@/lib/newsletter";
import { TableArriving, ValueArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATES = new Set<string>(SUBSCRIBER_STATES.map((s) => s.value));
const FREQUENCIES = new Set<string>(NEWSLETTER_FREQUENCIES.map((f) => f.value));

/** A hand-edited `?page=abc` produced `page=NaN` upstream. */
function pageOf(value: string | undefined): number {
  const n = Math.floor(Number(value ?? 1));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

const EMPTY: AdminSubscriberList = { items: [], counts: {}, total: 0, page: 1, hasMore: false };

/**
 * The newsletter list.
 *
 * Built now, deliberately ahead of the first send. Signups have been landing in
 * `newsletter_subscribers` since the site went up and there was no screen
 * anywhere that showed them — so the one number that says whether this feature
 * is worth building out was invisible.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE WONDERING WHY EVERYONE IS "UNCONFIRMED"
 *
 * `MAIL_PROVIDER` is `disabled` while the list is being collected. Double
 * opt-in means a subscriber reaches `confirmed` only by clicking a link in an
 * email, and no email is going out — so every row sits in Unconfirmed, with
 * `confirmationSentAt` NULL, and that is correct rather than broken. The
 * banner below says so on the screen, because a "0 confirmed" tab with no
 * explanation reads as a bug and someone eventually "fixes" it by marking
 * people confirmed, which is consent nobody gave.
 *
 * Nothing here can change a subscriber's state. Confirming, unsubscribing and
 * changing cadence are all theirs to do, each authorised by a token they hold.
 * An admin control that set `confirmed_at` would be a way to manufacture
 * consent, which is the one thing double opt-in exists to prevent.
 */
export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; frequency?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;

  const state = STATES.has(sp.state ?? "") ? sp.state! : "all";
  const frequency = FREQUENCIES.has(sp.frequency ?? "") ? sp.frequency : undefined;
  const page = pageOf(sp.page);

  const query: Query = { state, frequency, q: sp.q, page };
  const key = JSON.stringify(query);

  return (
    <AdminPage
      title="Newsletter"
      eyebrow="Community"
      description="Everyone who has asked for the newsletter. Collected now; the first send comes later."
      actions={
        // A plain link, not a fetch: the response is a file, and letting the
        // browser navigate is what makes it save rather than sit in memory.
        // `state` follows the tab, so what you export is what you are looking
        // at — except that the API refuses to widen past a recognised value.
        <a
          href={`/admin/api/newsletter/export?state=${state === "all" ? "all" : state}`}
          className="inline-flex h-10 items-center justify-center rounded-full border
                     border-line-strong px-5 font-label text-label-xs font-semibold uppercase
                     tracking-[0.08em] text-ink transition-colors duration-fast
                     hover:border-brand hover:text-brand"
        >
          Export CSV
        </a>
      }
    >
      <Suspense fallback={<Tabs active={state} />}>
        <TabsWithCounts query={query} />
      </Suspense>

      <div className="my-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AdminSearch placeholder="Search by email…" defaultValue={sp.q ?? ""} />
          <p className="tabular shrink-0 text-body-sm text-ink-subtle">
            <Suspense fallback={<ValueArriving width={12} />}>
              <Count query={query} />
            </Suspense>
          </p>
        </div>

        <SubscriberListControls frequency={frequency} />
      </div>

      <SendingPaused />

      <Suspense key={key} fallback={<TableArriving rows={10} />}>
        <Subscribers query={query} />
      </Suspense>
    </AdminPage>
  );
}

/**
 * Why nobody is confirmed.
 *
 * Stated on the screen rather than left to be rediscovered. The alternative is
 * an admin seeing "Confirmed 0" against a growing list and concluding the
 * signup flow is broken — which is exactly the wrong conclusion, and the fix
 * they would reach for is the one nobody should have.
 */
function SendingPaused() {
  return (
    <div className="mb-6 rounded-lg border border-warn bg-warn-soft px-5 py-4">
      <p className="font-label text-label-xs font-bold uppercase tracking-[0.12em] text-warn-on-soft">
        Sending is off
      </p>
      <p className="mt-1.5 max-w-3xl text-body-sm text-warn-on-soft">
        Addresses are being collected, and no mail is going out — so everyone stays{" "}
        <strong className="font-semibold">unconfirmed</strong> until the first send. That is
        expected, not a fault: confirmation happens by clicking a link in an email, and there is
        no email yet. Brevo is already wired up; switching{" "}
        <code className="font-mono">MAIL_PROVIDER</code> to <code className="font-mono">brevo</code>{" "}
        on the API turns it on, and the confirmation goes out to each new signup from that moment.
        See <span className="font-mono">docs/10-newsletter-email.md</span>.
      </p>
    </div>
  );
}

type Query = {
  state: string;
  frequency: string | undefined;
  q: string | undefined;
  page: number;
};

/** Tabs, count and table are the same request; Next memoizes it per render
 *  pass, so three boundaries asking costs one call. */
async function subscribers(query: Query) {
  return safe(
    () =>
      listSubscribers({
        state: query.state,
        frequency: query.frequency,
        q: query.q,
        page: query.page,
      }),
    EMPTY,
  );
}

/** Rendered twice — once without numbers as the Suspense fallback, once with
 *  them — so the header does not jump when the counts land. */
function Tabs({ active, counts }: { active: string; counts?: Record<string, number> }) {
  return (
    <FilterTabs
      basePath="/admin/newsletter"
      param="state"
      active={active}
      options={SUBSCRIBER_STATES.map((s) => ({ ...s, count: counts?.[s.value] }))}
    />
  );
}

async function TabsWithCounts({ query }: { query: Query }) {
  const data = await subscribers(query);
  return <Tabs active={query.state} counts={data.counts} />;
}

async function Count({ query }: { query: Query }) {
  const data = await subscribers(query);
  return (
    <>
      {data.total} {data.total === 1 ? "subscriber" : "subscribers"}
    </>
  );
}

/** Carries every active filter into the next page. Dropping any of them makes
 *  "Load more" return page 2 of a different list. */
function nextPageQuery(query: Query, nextPage: number): string {
  const qs = new URLSearchParams({ state: query.state, page: String(nextPage) });
  if (query.frequency) qs.set("frequency", query.frequency);
  if (query.q) qs.set("q", query.q);
  return qs.toString();
}

async function Subscribers({ query }: { query: Query }) {
  const data = await subscribers(query);

  return (
    <>
      <DataTable
        columns={["Email", "Cadence", "State", "Confirmed", "Source", "Signed up"]}
        empty={data.items.length === 0}
      >
        {data.items.map((s) => (
          <tr key={s.id} className="transition-colors duration-fast hover:bg-surface-1">
            <Td>
              {/* Plain text. An address here is untrusted public input and is
                  never turned into a link that could be clicked by accident. */}
              <span className="block truncate font-mono text-body-sm text-ink">{s.email}</span>
            </Td>

            <Td>{NEWSLETTER_FREQUENCY_LABEL[s.frequency] ?? s.frequency}</Td>

            <Td>
              <StatusPill status={s.state} />
            </Td>

            <Td className="whitespace-nowrap">
              {s.confirmedAt ? (
                <span className="text-body-sm text-ink-subtle">{relativeTime(s.confirmedAt)}</span>
              ) : (
                <span
                  className="text-body-sm text-ink-faint"
                  title={
                    s.confirmationSentAt
                      ? `Confirmation sent ${relativeTime(s.confirmationSentAt)}; not yet clicked.`
                      : "No confirmation has been sent to this address yet."
                  }
                >
                  {s.confirmationSentAt ? "Awaiting click" : "Not asked yet"}
                </span>
              )}
            </Td>

            <Td className="text-ink-subtle">{s.source ?? "—"}</Td>

            <Td className="whitespace-nowrap text-ink-subtle">{relativeTime(s.createdAt)}</Td>
          </tr>
        ))}
      </DataTable>

      {data.hasMore && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/admin/newsletter?${nextPageQuery(query, query.page + 1)}`}
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
