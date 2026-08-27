"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 *
 * ---------------------------------------------------------------------------
 * Archive and Delete are both here, and they are not the same action.
 *
 *   Archive — reversible, keeps the product and every review written about it,
 *     and takes it off the public site. Right for anything with a history.
 *   Delete — removes the row and everything cascading from it. Right for a
 *     duplicate, a test row, or something created by mistake.
 *
 * Only archive existed before, which meant a mistyped test product could never
 * be got rid of, only hidden — so the archived tab filled with things that were
 * never really products and stopped being a useful record of anything.
 *
 * Delete asks for the product's title back before it will proceed. `confirm()`
 * would have been one line, but it is dismissed by reflex and it cannot say
 * WHICH row is about to be destroyed — the failure mode that actually matters
 * in a table of near-identical variants.
 */
export function ProductRowActions({
  id,
  title,
  status,
  slug,
  categorySlug,
  afterDelete = "refresh",
}: {
  id: string;
  title: string;
  status: string;
  slug: string;
  categorySlug: string;
  /**
   * What "deleted" means for the screen this is on. In the catalogue the row
   * simply disappears, so a refresh is right. On the product's own page the
   * thing being viewed no longer exists — refreshing there would re-fetch a
   * 404, so that caller asks to be sent back to the list instead.
   */
  afterDelete?: "refresh" | "list";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

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

  async function destroy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/products/${id}`, { method: "DELETE" });
      // 204 is the success shape; anything else carries a reason worth showing
      // rather than collapsing into "that didn't work".
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.detail === "string" ? body.detail : "Could not delete that.");
        return;
      }
      setConfirming(false);
      if (afterDelete === "list") {
        router.push("/admin/products");
        // The catalogue is a cached RSC payload that still contains this row.
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not delete that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        {error && !confirming && (
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

        {/* The reversible half of the pair, and therefore the easier reach. */}
        {status !== "archived" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act("archive")}
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle
                       transition-colors duration-fast hover:text-warn disabled:opacity-45"
          >
            Archive
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          aria-haspopup="dialog"
          className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint
                     transition-colors duration-fast hover:text-danger disabled:opacity-45"
        >
          Delete
        </button>
      </div>

      {confirming && (
        <DeleteDialog
          title={title}
          busy={busy}
          error={error}
          onCancel={() => setConfirming(false)}
          onConfirm={destroy}
        />
      )}
    </>
  );
}

/**
 * The confirmation.
 *
 * A real dialog rather than `window.confirm`, for three reasons that all bite
 * in a table: it can name the row, it can spell out what cascades, and it can
 * require an action a reflex click does not satisfy.
 *
 * The typed title is compared trimmed and case-insensitively. The gate exists
 * to make an editor look at which row they are on, not to test their typing.
 */
function DeleteDialog({
  title,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = typed.trim().toLowerCase() === title.trim().toLowerCase();

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-product-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="panel w-full max-w-lg p-6 text-left sm:p-8">
        <h2 id="delete-product-heading" className="font-display text-headline-sm text-ink">
          Delete this product?
        </h2>

        <p className="mt-3 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">{title}</span> and everything filed under it —
          images, specs, badges, retailer links, price history, saved lists and any reviews
          readers wrote — are removed permanently. This cannot be undone.
        </p>

        <p className="mt-3 rounded-md border border-line bg-surface-1 px-4 py-3 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">Wanted it off the site instead? </span>
          Archive keeps the product and its reviews, and can be reversed.
        </p>

        <label className="mt-6 block">
          <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
            Type the product title to confirm
          </span>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={title}
            className="mt-2 h-10 w-full rounded-sm border border-line bg-surface-1 px-3 text-body-sm
                       text-ink outline-none transition-colors duration-fast
                       placeholder:text-ink-faint focus:border-danger"
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 text-body-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-full border border-line-strong px-5
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink
                       transition-colors duration-fast hover:border-brand hover:text-brand
                       disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !matches}
            className="inline-flex h-10 items-center rounded-full bg-danger-fill px-5 font-label
                       text-label-xs font-semibold uppercase tracking-[0.08em] text-danger-on
                       transition-all duration-fast hover:brightness-110
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
