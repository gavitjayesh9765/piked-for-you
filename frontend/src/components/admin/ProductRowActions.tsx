"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Per-row actions.
 *
 * Publish goes through a Route Handler rather than calling the API directly:
 * the access token lives in an `httpOnly` cookie that client JavaScript cannot
 * read, which is exactly the property that makes an XSS bug unable to steal a
 * session. The handler reads the cookie server-side and forwards it.
 *
 * Publishing can legitimately fail with a list of missing fields (spec §62),
 * so the failure path is a real message, not a generic toast.
 */
export function ProductRowActions({
  id,
  status,
  slug,
  categorySlug,
}: {
  id: string;
  status: string;
  slug: string;
  categorySlug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "publish" | "unpublish" | "archive") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/products/${id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const missing = body?.detail?.missing as string[] | undefined;
        setError(missing?.length ? `Missing: ${missing.join(", ")}` : "That didn't work.");
        return;
      }
      router.refresh();
    } catch {
      setError("That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {error && (
        <span
          role="alert"
          className="max-w-[260px] truncate text-label-xs text-danger"
          title={error}
        >
          {error}
        </span>
      )}

      {status === "published" && (
        <a
          href={`/p/${categorySlug}/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
        >
          View
        </a>
      )}

      <Link
        href={`/admin/products/${id}`}
        className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
      >
        Edit
      </Link>

      {status !== "archived" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => act(status === "published" ? "unpublish" : "publish")}
          className={cn(
            "font-label text-label-xs uppercase tracking-[0.1em] transition-colors duration-fast",
            "disabled:opacity-45",
            status === "published" ? "text-ink-subtle hover:text-warn" : "text-brand hover:underline",
          )}
        >
          {busy ? "…" : status === "published" ? "Unpublish" : "Publish"}
        </button>
      )}
    </div>
  );
}
