import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { adminGet } from "@/lib/admin-api";
import { AdminPage, FilterTabs } from "@/components/admin/Shell";

export const metadata: Metadata = { title: "Media library", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Item {
  id: string;
  kind: string;
  url: string;
  thumbnailUrl: string;
  provider: string | null;
  productId: string;
  productTitle: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
}

/** The filters this screen offers. Anything else falls back to "all". */
const KINDS = new Set(["all", "image", "video_link"]);

function kb(bytes: number | null) {
  if (!bytes) return "—";
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Everything attached to a product, newest first. */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  // `kind` came straight off the URL and was interpolated into the query
  // string unescaped, so `?status=all%26limit=99999` became a second parameter.
  // Checked against the tabs this page actually offers.
  const data = await adminGet<{ items: Item[]; total: number }>(
    "/media",
    { items: [], total: 0 },
    { kind: KINDS.has(status) ? status : "all" },
  );

  return (
    <AdminPage
      title="Media library"
      eyebrow="Content"
      description="Every image and video attached to a product. Uploads live in a private bucket and are served through signed URLs."
    >
      <FilterTabs
        basePath="/admin/media"
        active={status}
        options={[
          { value: "all", label: "All" },
          { value: "image", label: "Images" },
          { value: "video_link", label: "Video links" },
        ]}
      />

      <p className="tabular my-6 text-body-sm text-ink-subtle">{data.total} files</p>

      {data.items.length === 0 ? (
        <div className="dot-matrix rounded-lg border border-line py-16 text-center">
          <p className="text-body-md text-ink-muted">Nothing uploaded yet.</p>
        </div>
      ) : (
        <ul
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(170px, 100%), 1fr))" }}
        >
          {data.items.map((m) => (
            <li key={m.id} className="panel overflow-hidden">
              <div className="plate relative aspect-square">
                {m.thumbnailUrl ? (
                  <Image
                    src={m.thumbnailUrl}
                    alt=""
                    fill
                    sizes="200px"
                    className={m.kind === "video_link" ? "object-cover" : "object-contain p-2"}
                  />
                ) : (
                  <div className="dot-matrix h-full w-full" />
                )}
                {m.kind === "video_link" && (
                  <span className="absolute left-2 top-2 rounded-xs bg-editorial-bg px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-editorial-fg">
                    {m.provider}
                  </span>
                )}
              </div>
              <div className="border-t border-line px-3 py-2">
                <Link
                  href={`/admin/products/${m.productId}`}
                  className="block truncate text-body-sm text-ink hover:text-brand"
                >
                  {m.productTitle}
                </Link>
                <span className="font-mono text-[10px] text-ink-faint">
                  {m.kind === "video_link"
                    ? "linked"
                    : `${m.width ?? "?"}\u00d7${m.height ?? "?"} \u00b7 ${kb(m.sizeBytes)}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
