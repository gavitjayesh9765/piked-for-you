"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { StatusPill } from "@/components/ui/Badge";

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

/** How the shortlist can be arranged while you are choosing from it. This is a
 *  *browsing* order and is never written anywhere. */
const SORTS = [
  { value: "score", label: "Best score" },
  { value: "title", label: "A–Z" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

/**
 * Top Picks curation (spec §15).
 *
 * ---------------------------------------------------------------------------
 * ORDER IS EDITORIAL, AND THE POSITION IS THE DECISION
 *
 * A Top Picks list sorted by rating is just the product grid again, so nothing
 * here ever derives the order from a score. The shortlist you *choose* from
 * can be sorted — that is browsing, not curation — but the list itself is
 * arranged by hand, and the position number is given the emphasis because it
 * is the thing being decided.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN NOW TELLS YOU THAT IT DID NOT
 *
 *   * **Where the homepage stops.** The public query takes a limit from the
 *     section config and defaults to eight. This screen used to list twenty
 *     picks with no hint that the last twelve render nowhere. The fold is
 *     drawn.
 *   * **When a pick has stopped working.** Only published products appear on
 *     the homepage. A product that was featured and later un-published
 *     silently vanishes from the site while still sitting here looking fine;
 *     its status is now on the row.
 *   * **That a pick can be paused.** `is_active` has been honoured by the
 *     public query since it was written and could not be set from anywhere, so
 *     the only way to take something off the homepage was to remove it and
 *     lose its position.
 *
 * ---------------------------------------------------------------------------
 * ADDING USED TO BE INVISIBLE, AND THAT WAS THE BUG
 *
 * `add()` called `router.refresh()` and nothing else, while the list lived in
 * `useState(initial)`. React ignores a prop after the first render, so the new
 * server data arrived and was discarded: featuring a product appeared to do
 * nothing at all until the page was reloaded by hand. Every mutation here now
 * re-reads the list and sets state with it — the same shape `ResourceManager`
 * and `CategoryTree` already use.
 */
export function TopPicksManager({
  initial,
  visibleLimit,
  sectionActive,
}: {
  initial: Pick[];
  /** How many the homepage renders. Null when the section is switched off. */
  visibleLimit: number | null;
  sectionActive: boolean;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  /** Re-read the list from the API and adopt it. */
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/admin/api/top-picks");
      if (!res.ok) return;
      const body = (await res.json()) as { items?: Pick[] };
      if (Array.isArray(body.items)) setPicks(body.items);
    } catch {
      /* the router refresh below is the fallback */
    }
    router.refresh();
  }, [router]);

  async function persist(next: Pick[]) {
    const previous = picks;
    setPicks(next);
    try {
      const res = await fetch("/admin/api/top-picks/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
      if (!res.ok) {
        setPicks(previous);
        setError("Could not save the new order.");
        return;
      }
      router.refresh();
    } catch {
      setPicks(previous);
      setError("Could not save the new order.");
    }
  }

  function move(from: number, to: number) {
    const target = Math.max(0, Math.min(picks.length - 1, to));
    if (from === target) return;
    const next = [...picks];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    // Announced, because a mouse user watches the row move and a screen reader
    // user gets nothing at all from a reordered list.
    setNote(`${moved.title} moved to position ${target + 1} of ${next.length}.`);
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
    await reload();
  }

  async function removeMany(ids: string[]) {
    setError(null);
    const previous = picks;
    setPicks((p) => p.filter((x) => !ids.includes(x.id)));
    setChosen(new Set());

    for (const id of ids) {
      try {
        const res = await fetch(`/admin/api/top-picks/${id}`, { method: "DELETE" });
        if (!res.ok) {
          setPicks(previous);
          setError("Could not remove that pick.");
          return;
        }
      } catch {
        setPicks(previous);
        setError("Lost the connection.");
        return;
      }
    }
    await reload();
  }

  async function setActive(id: string, isActive: boolean) {
    setError(null);
    setPendingId(id);
    const previous = picks;
    setPicks((p) => p.map((x) => (x.id === id ? { ...x, isActive } : x)));
    try {
      const res = await fetch(`/admin/api/top-picks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        setPicks(previous);
        setError("Could not change that pick.");
      } else {
        router.refresh();
      }
    } catch {
      setPicks(previous);
      setError("Could not change that pick.");
    } finally {
      setPendingId(null);
    }
  }

  function toggleChosen(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const live = picks.filter((p) => p.isActive && p.status === "published").length;

  return (
    <div>
      {/* --- Standing state --- */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-body-sm text-ink-subtle">
            {picks.length} featured · {live} currently on the homepage
          </p>
          {!sectionActive && (
            <p className="mt-1 text-label-xs text-warn-on-soft">
              The Top Picks section is switched off on the homepage, so none of these
              render. Turn it on under Homepage.
            </p>
          )}
        </div>
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

      {/* Reorder and selection announcements. */}
      <p aria-live="polite" className="sr-only">
        {note}
      </p>

      {adding && <CandidatePicker onPick={(id) => void add(id)} />}

      {/* --- Bulk bar. Only once something is selected: an always-visible
              toolbar of disabled buttons is noise. --- */}
      {chosen.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-line bg-brand-soft px-4 py-3">
          <p className="tabular text-body-sm text-brand-on-soft">{chosen.size} selected</p>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setChosen(new Set())}
              className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void removeMany([...chosen])}
              className="font-label text-label-xs font-semibold uppercase tracking-[0.1em] text-danger hover:underline"
            >
              Remove {chosen.size}
            </button>
          </span>
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
            <li key={p.id}>
              {/* The fold. Everything below it is stored, ordered, and not on
                  the site — which is a legitimate holding area, but only if
                  the screen admits it. */}
              {visibleLimit !== null && i === visibleLimit && (
                <div className="my-5 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-line-strong" />
                  <span className="font-label text-label-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
                    Homepage shows {visibleLimit} — below this line is a reserve
                  </span>
                  <span className="h-px flex-1 bg-line-strong" />
                </div>
              )}

              <Row
                pick={p}
                index={i}
                total={picks.length}
                beyondFold={visibleLimit !== null && i >= visibleLimit}
                selected={chosen.has(p.id)}
                pending={pendingId === p.id}
                dragging={dragIndex === i}
                dropTarget={overIndex === i && dragIndex !== null && dragIndex !== i}
                dropBelow={dragIndex !== null && dragIndex < i}
                onToggleChosen={() => toggleChosen(p.id)}
                onMove={(to) => move(i, to)}
                onSetActive={(v) => void setActive(p.id, v)}
                onRemove={() => void removeMany([p.id])}
                onDragStart={() => setDragIndex(i)}
                onDragOver={() => setOverIndex(i)}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One row                                                             */
/* ------------------------------------------------------------------ */

function Row({
  pick,
  index,
  total,
  beyondFold,
  selected,
  pending,
  dragging,
  dropTarget,
  dropBelow,
  onToggleChosen,
  onMove,
  onSetActive,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  pick: Pick;
  index: number;
  total: number;
  beyondFold: boolean;
  selected: boolean;
  pending: boolean;
  dragging: boolean;
  dropTarget: boolean;
  dropBelow: boolean;
  onToggleChosen: () => void;
  onMove: (to: number) => void;
  onSetActive: (v: boolean) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  // A pick only reaches the homepage if it is active AND its product is still
  // published. Two different failures, and conflating them would send an
  // editor to the wrong screen.
  const unpublished = pick.status !== "published";
  const off = !pick.isActive;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "panel flex items-center gap-3 px-3 py-3 transition-all duration-fast sm:gap-4 sm:px-4",
        dragging && "opacity-40",
        // A drop line on the edge the row will land against. Opacity alone
        // says something is moving, never where it is going.
        dropTarget && (dropBelow ? "border-b-2 border-b-brand-vivid" : "border-t-2 border-t-brand-vivid"),
        (off || unpublished) && "bg-surface-1",
        beyondFold && "opacity-70",
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleChosen}
        aria-label={`Select ${pick.title}`}
        className="h-4 w-4 shrink-0 accent-[var(--c-brand)]"
      />

      {/* The position IS the decision — so it gets the emphasis. */}
      <span
        className={cn(
          "tabular w-7 shrink-0 text-center font-mono text-headline-sm font-bold",
          off || unpublished ? "text-ink-faint" : "text-brand",
        )}
      >
        {index + 1}
      </span>

      <div className="plate relative h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-line">
        {pick.imageUrl ? (
          <Image
            src={pick.imageUrl}
            alt=""
            fill
            sizes="48px"
            className={cn("object-contain p-1", (off || unpublished) && "grayscale")}
          />
        ) : (
          <div className="dot-matrix h-full w-full" />
        )}
      </div>

      <span className="min-w-0 flex-1">
        <Link
          href={`/admin/products/${pick.productId}`}
          className="block truncate text-body-sm font-medium text-ink hover:text-brand"
        >
          {pick.title}
        </Link>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-label-xs text-ink-faint">{pick.brand}</span>
          {unpublished && <StatusPill status={pick.status} />}
          {off && !unpublished && (
            <span className="rounded-xs border border-line-strong px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-ink-muted">
              Paused
            </span>
          )}
        </span>
      </span>

      {pick.score != null && (
        <span className="tabular hidden shrink-0 font-mono text-body-sm text-ink-muted sm:block">
          {pick.score.toFixed(1)}
        </span>
      )}

      <span className="flex shrink-0 items-center gap-0.5">
        <IconBtn label="Move to top" onClick={() => onMove(0)} disabled={index === 0}>
          ⤒
        </IconBtn>
        <IconBtn label="Move up" onClick={() => onMove(index - 1)} disabled={index === 0}>
          ↑
        </IconBtn>
        <IconBtn label="Move down" onClick={() => onMove(index + 1)} disabled={index === total - 1}>
          ↓
        </IconBtn>
        <IconBtn
          label="Move to bottom"
          onClick={() => onMove(total - 1)}
          disabled={index === total - 1}
        >
          ⤓
        </IconBtn>

        <button
          type="button"
          onClick={() => onSetActive(!pick.isActive)}
          disabled={pending}
          title={
            pick.isActive
              ? "Take off the homepage, keeping this position"
              : "Put back on the homepage"
          }
          className="ml-2 font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle
                     transition-colors duration-fast hover:text-ink disabled:opacity-40"
        >
          {pick.isActive ? "Pause" : "Resume"}
        </button>

        <button
          type="button"
          onClick={onRemove}
          className="ml-2 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint hover:text-danger"
        >
          Remove
        </button>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choosing something to feature                                       */
/* ------------------------------------------------------------------ */

/**
 * The shortlist.
 *
 * The search goes to the server. It used to be a single fetch of fifty
 * arbitrary rows filtered in the browser, which meant typing a product's exact
 * name could still return "nothing left to feature" — the row was real, it was
 * just outside the window nobody could see.
 */
function CandidatePicker({ onPick }: { onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/admin/api/top-picks/candidates?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { items?: Candidate[] };
        setItems(Array.isArray(body.items) ? body.items : []);
        setFailed(false);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
      // No debounce on the first load; a quarter second on every keystroke
      // after it, aborted so a slow "ph" cannot land after "phone".
    }, first.current ? 0 : 250);
    first.current = false;

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const sorted =
    sort === "title"
      ? [...items].sort((a, b) => a.title.localeCompare(b.title))
      : items; // the API already returns best-score-first

  return (
    <div className="panel mb-5 border-brand-line p-5">
      <div className="flex flex-wrap items-center gap-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search published products…"
          aria-label="Search published products"
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface-1 px-3 text-body-sm
                     text-ink outline-none focus:border-brand-vivid"
        />
        {/* Sorting the SHORTLIST, never the picks. Labelled so the difference
            is not left to be inferred. */}
        <span className="flex items-center gap-1 rounded-full border border-line p-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSort(s.value)}
              aria-pressed={sort === s.value}
              className={cn(
                "rounded-full px-3 py-1.5 font-label text-label-xs uppercase tracking-[0.1em] transition-colors duration-fast",
                sort === s.value ? "bg-editorial-bg text-editorial-fg" : "text-ink-subtle hover:text-brand",
              )}
            >
              {s.label}
            </button>
          ))}
        </span>
      </div>

      <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto">
        {loading && (
          <li className="py-6 text-center text-body-sm text-ink-faint">Searching…</li>
        )}
        {!loading && failed && (
          <li className="py-6 text-center text-body-sm text-danger">
            Could not reach the catalogue.
          </li>
        )}
        {!loading && !failed && sorted.length === 0 && (
          <li className="py-6 text-center text-body-sm text-ink-muted">
            {query.trim()
              ? "No published product matches that, and is not already featured."
              : "Nothing left to feature — every published product is already here."}
          </li>
        )}
        {!loading &&
          sorted.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-body-sm text-ink">{c.title}</span>
                <span className="text-label-xs text-ink-faint">{c.brand}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tabular font-mono text-label-xs text-ink-muted">
                  {c.score != null ? c.score.toFixed(1) : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => onPick(c.id)}
                  className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
                >
                  Feature
                </button>
              </span>
            </li>
          ))}
      </ul>
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
