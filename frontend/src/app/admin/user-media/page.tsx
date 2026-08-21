import type { Metadata } from "next";
import Image from "next/image";

import { adminGet } from "@/lib/admin-api";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";
import { MediaModerateActions } from "@/components/admin/MediaModerateActions";

export const metadata: Metadata = { title: "User media", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The filters this screen offers. Anything else falls back to "pending". */
const STATES = new Set(["pending", "approved", "rejected", "all"]);

interface Item {
  id: string;
  kind: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  moderationStatus: string;
  reviewId: string;
  author: string;
}

/**
 * Review attachments awaiting moderation (spec §29).
 *
 * Moderated separately from the review text: a thoughtful review can carry a
 * photo that should not be published, and rejecting the whole review for that
 * would be the wrong call.
 */
export default async function AdminUserMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "pending" } = await searchParams;
  // Constrained to the tabs on this page: the raw value was interpolated
  // into the query string, so it could append parameters of its own.
  const data = await adminGet<{ items: Item[]; total: number }>(
    "/user-media",
    { items: [], total: 0 },
    { moderation: STATES.has(status) ? status : "pending" },
  );

  return (
    <AdminPage
      title="User media"
      eyebrow="Community"
      description="Photos and video attached to reviews. Nothing appears publicly until it is approved here."
    >
      <FilterTabs
        basePath="/admin/user-media"
        active={status}
        options={[
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "all", label: "All" },
        ]}
      />

      <p className="tabular my-6 text-body-sm text-ink-subtle">{data.total} files</p>

      {data.items.length === 0 ? (
        <div className="dot-matrix rounded-lg border border-line py-20 text-center">
          <p className="text-headline-sm text-ink">Queue is clear.</p>
          <p className="mt-2 text-body-sm text-ink-muted">Nothing waiting for a decision.</p>
        </div>
      ) : (
        <ul
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(230px, 100%), 1fr))" }}
        >
          {data.items.map((m) => (
            <li key={m.id} className="panel overflow-hidden">
              <div className="plate relative aspect-square">
                {m.kind === "image" && m.url ? (
                  <Image src={m.url} alt="" fill sizes="260px" className="object-cover" />
                ) : m.kind === "video" && m.url ? (
                  <video
                    src={m.url}
                    controls
                    preload="metadata"
                    className="absolute inset-0 h-full w-full bg-black object-contain"
                  />
                ) : (
                  <div className="dot-matrix h-full w-full" />
                )}
                {m.kind === "video" && m.durationSeconds != null && (
                  <span className="absolute right-2 top-2 rounded-xs bg-editorial-bg px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-editorial-fg">
                    {m.durationSeconds}s
                  </span>
                )}
              </div>
              <div className="border-t border-line p-3">
                <p className="truncate text-body-sm text-ink">{m.author}</p>
                <p className="font-mono text-[10px] text-ink-faint">{m.mimeType}</p>
                <div className="mt-3">
                  <MediaModerateActions id={m.id} status={m.moderationStatus} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
