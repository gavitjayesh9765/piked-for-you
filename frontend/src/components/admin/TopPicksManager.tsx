"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface Pick {
  id: string;
  productId: string;
  title: string;
  brand: string;
  status: string;
  score: number | null;
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
}

export interface Candidate {
  id: string;
  title: string;
  brand: string;
  score: number | null;
}

/**
 * Top Picks curation (spec §15).
 *
 * Order is **explicit**, never derived from score. That is the whole point:
 * a Top Picks list sorted by rating is just the product grid again. The
 * position number is shown large because it is the editorial decision.
 *
 * Only published products can be featured — the API refuses a draft, which
 * stops a promoted product 404ing on the homepage.
 */
export function TopPicksManager({
  initial,
  candidates,
}: {
  initial: Pick[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [picks, setPicks] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function persist(next: Pick[]) {
    setPicks(next);
    await fetch("/admin/api/top-picks/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    });
    router.refresh();
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= picks.length || from === to) return;
    const next = [...picks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persist(next);
  }

  async function add(productId: string) {
    setError(null);
    const res = await fetch("/admin/api/top-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(typeof d?.detail === "string" ? d.detail : "Could not add that product.");
      return;
    }
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    const previous = picks;
    setPicks((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/admin/api/top-picks/${id}`, { method: "DELETE" });
    if (!res.ok) setPicks(previous);
    else router.refresh();
  }

  const filtered = candidates.filter((c) =>
    query.trim() ? c.title.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-body-sm text-ink-subtle">
          {picks.length} featured · shown on the homepage in this order
        </p>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
          className="inline-flex h-10 items-center rounded-full bg-brand-fill px-5 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110"
        >
          {adding ? "Close" : "+ Feature a product"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      {adding && (
        <div className="panel mb-5 border-brand-line p-5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search published products…"
            className="h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-body-sm
                       text-ink outline-none focus:border-brand-vivid"
          />
          <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto">
            {filtered.length === 0 && (
              <li className="py-6 text-center text-body-sm text-ink-muted">
                Nothing left to feature — every published product is already here.
              </li>
            )}
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-body-sm text-ink">{c.title}</span>
                  <span className="text-label-xs text-ink-faint">{c.brand}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {c.score != null && (
                    <span className="tabular font-mono text-label-xs text-ink-muted">
                      {c.score.toFixed(1)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void add(c.id)}
                    className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
                  >
                    Feature
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picks.length === 0 ? (
        <div className="dot-matrix rounded-lg border border-line py-16 text-center">
          <p className="text-headline-sm text-ink">No Top Picks yet.</p>
          <p className="mt-2 text-body-sm text-ink-muted">
            The homepage section will be empty until you feature something.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {picks.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "panel flex items-center gap-4 px-4 py-3 transition-opacity duration-fast",
                dragIndex === i && "opacity-40",
              )}
            >
              {/* The position IS the decision — so it gets the emphasis. */}
              <span className="tabular w-8 shrink-0 text-center font-mono text-headline-sm font-bold text-brand">
                {i + 1}
              </span>

              <div className="plate relative h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-line">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt="" fill sizes="48px" className="object-contain p-1" />
                ) : (
                  <div className="dot-matrix h-full w-full" />
                )}
              </div>

              <span className="min-w-0 flex-1">
                <Link
                  href={`/admin/products/${p.productId}`}
                  className="block truncate text-body-sm font-medium text-ink hover:text-brand"
                >
                  {p.title}
                </Link>
                <span className="text-label-xs text-ink-faint">{p.brand}</span>
              </span>

              {p.score != null && (
                <span className="tabular shrink-0 font-mono text-body-sm text-ink-muted">
                  {p.score.toFixed(1)}
                </span>
              )}

              <span className="flex shrink-0 items-center gap-1">
                <IconBtn label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  ↑
                </IconBtn>
                <IconBtn
                  label="Move down"
                  onClick={() => move(i, i + 1)}
                  disabled={i === picks.length - 1}
                >
                  ↓
                </IconBtn>
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  className="ml-2 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint hover:text-danger"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-xs text-ink-subtle transition-colors
                 duration-fast hover:bg-surface-2 hover:text-ink
                 disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
