import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { adminGet } from "@/lib/admin-api";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { TableArriving } from "@/components/ui/Arriving";
import { MediaGrid } from "@/components/admin/MediaGrid";
import type { LibraryAsset } from "@/components/admin/MediaPicker";

export const metadata: Metadata = { title: "Media library", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The filters this screen offers. Anything else falls back to "all". */
const KINDS = new Set(["all", "image", "video_link"]);

/**
 * Every file attached to a product, newest first.
 *
 * ---------------------------------------------------------------------------
 * LISTED BY FILE, NOT BY ATTACHMENT
 *
 * The API groups `product_media` rows by the object they point at, so an image
 * shared between three products is one tile here saying "3 products" rather
 * than three identical tiles. That distinction is the whole point: the screen
 * exists to show what this site is actually storing, and a list of attachments
 * would report the same photograph three times and make de-duplication look
 * like it had failed.
 *
 * ---------------------------------------------------------------------------
 * The filter tabs, the search and the pager all drive the query string, so a
 * filtered view is shareable and the back button behaves. Only the grid
 * streams, keyed on the whole query so a new filter replaces the old items
 * rather than appearing to amend them.
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status = "all", q = "", page = "1" } = await searchParams;
  const key = `${status}|${q}|${page}`;

  return (
    <AdminPage
      title="Media library"
      eyebrow="Content"
      description="Every image and video attached to a product. Uploads live in a private bucket and are served through signed URLs."
      actions={<AdminSearch placeholder="Search by product…" defaultValue={q} />}
    >
      <FilterTabs
        basePath="/admin/media"
        active={KINDS.has(status) ? status : "all"}
        options={[
          { value: "all", label: "All" },
          { value: "image", label: "Images" },
          { value: "video_link", label: "Video links" },
        ]}
      />

      <Suspense key={key} fallback={<TableArriving rows={6} />}>
        <Library status={status} q={q} page={page} seed={key} />
      </Suspense>
    </AdminPage>
  );
}

interface Payload {
  items: LibraryAsset[];
  total: number;
  page: number;
  hasMore: boolean;
}

async function Library({
  status,
  q,
  page,
  seed,
}: {
  status: string;
  q: string;
  page: string;
  seed: string;
}) {
  // `kind` came straight off the URL and was interpolated into the query
  // string unescaped, so `?status=all%26limit=99999` became a second parameter.
  // Checked against the tabs this page actually offers.
  const parsed = Number(page);
  const current = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;

  const data = await adminGet<Payload>(
    "/media",
    { items: [], total: 0, page: 1, hasMore: false },
    { kind: KINDS.has(status) ? status : "all", q: q.trim() || undefined, page: current },
  );

  // A file shared by two products is one file. Saying so is the only report
  // this screen can give on whether de-duplication is doing anything.
  const attachments = data.items.reduce((n, m) => n + m.usageCount, 0);
  const shared = data.items.filter((m) => m.usageCount > 1).length;

  return (
    <>
      <p className="tabular my-6 text-body-sm text-ink-subtle">
        {data.total} {data.total === 1 ? "file" : "files"}
        {q.trim() && <> matching “{q.trim()}”</>}
        {shared > 0 && (
          <>
            {" · "}
            <span className="text-ink-muted">
              {shared} shared across {attachments} product slots
            </span>
          </>
        )}
      </p>

      <MediaGrid initial={data.items} seed={seed} />

      {/* The API has always paged at 60 and the screen never offered a way to
          reach page 2 — every file past the first sixty was unreachable. */}
      {(current > 1 || data.hasMore) && (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-between border-t border-line pt-5"
        >
          <PageLink status={status} q={q} page={current - 1} disabled={current <= 1}>
            ← Newer
          </PageLink>
          <span className="tabular text-label-xs text-ink-faint">Page {current}</span>
          <PageLink status={status} q={q} page={current + 1} disabled={!data.hasMore}>
            Older →
          </PageLink>
        </nav>
      )}
    </>
  );
}

function PageLink({
  status,
  q,
  page,
  disabled,
  children,
}: {
  status: string;
  q: string;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint opacity-40">
        {children}
      </span>
    );
  }

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (q.trim()) params.set("q", q.trim());
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();

  return (
    <Link
      href={qs ? `/admin/media?${qs}` : "/admin/media"}
      className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-muted hover:text-brand"
    >
      {children}
    </Link>
  );
}
