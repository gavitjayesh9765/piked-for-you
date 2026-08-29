"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * A select you can type into.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A native `<select>` is the right control for a handful of options and the
 * wrong one past that. The product form's Category field offers 98 entries
 * rendered as full paths — "Home & Kitchen › Kitchen Appliances › Air Fryers"
 * — and the only way to reach one was to scroll a popup and read. Brand is
 * 118. Native type-ahead does not rescue either: it matches the *start* of the
 * option text, and every category path starts with the same handful of root
 * names, so typing "air" in that list lands on nothing at all.
 *
 * So: filter as you type, match anywhere in the path, and rank the leaf.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS NOT
 *
 * This is NOT a drop-in for every `<select>` in the admin. A search box above
 * "Plain request / Headless browser" is furniture — it costs a keystroke,
 * loses the native mobile picker, and hides two options behind a popup. The
 * rule applied across this codebase is: a list whose length is a *data* fact
 * (categories, brands) gets this; a list whose length is a *code* fact (an
 * enum of two to six) stays native.
 *
 * ---------------------------------------------------------------------------
 * THE LISTBOX IS PORTALLED, AND THAT IS NOT AN AESTHETIC CHOICE
 *
 * Two concrete failures it avoids:
 *
 *   1. `Field` in ProductForm wraps its children in a `<label>`. A click
 *      inside a label is forwarded to the labelled control, so an options list
 *      rendered in place would re-fire every option click on the input — the
 *      dropdown would fight itself.
 *   2. The admin sections are bordered panels with their own stacking and
 *      scroll containers. An absolutely positioned list is clipped by the
 *      first ancestor with `overflow` set; a fixed, portalled one never is.
 */

export type SearchSelectOption = { value: string; label: string };

/** The separator ProductForm puts between path segments. */
const SEP = "›";

type Ranked = {
  option: SearchSelectOption;
  /** Position in the ORIGINAL options array — stable ids across re-filters. */
  index: number;
  rank: number;
  ranges: [number, number][];
};

/**
 * Where the last path segment starts.
 *
 * The leaf is the part an editor is actually choosing — the hint on the
 * category field says to file against the most specific node — so it both
 * ranks higher and reads darker than its ancestors.
 */
function leafStart(label: string): number {
  const at = label.lastIndexOf(SEP);
  if (at === -1) return 0;
  let i = at + SEP.length;
  while (i < label.length && label[i] === " ") i++;
  return i;
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length < 2) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [sorted[0]];
  for (const [s, e] of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/**
 * Score one option against an already-lowercased query, or reject it.
 *
 * Every whitespace-separated token must appear somewhere in the label, which
 * is what makes "kitchen air" find "Home & Kitchen › Kitchen Appliances › Air
 * Fryers" — a match neither a substring search nor native type-ahead makes.
 *
 * The rank then answers "which of these did they mean": a leaf that *starts*
 * with what you typed beats a leaf that merely contains it, and both beat a
 * hit up among the ancestors. Typing "air" therefore offers Air Fryers and Air
 * Purifiers before Hair Dryers, and before everything filed under a branch
 * that happens to contain those letters.
 */
function score(option: SearchSelectOption, query: string): Ranked | null {
  const label = option.label;
  const hay = label.toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { option, index: -1, rank: 0, ranges: [] };

  const ranges: [number, number][] = [];
  for (const token of tokens) {
    let from = 0;
    let hit = false;
    for (;;) {
      const at = hay.indexOf(token, from);
      if (at === -1) break;
      ranges.push([at, at + token.length]);
      from = at + token.length;
      hit = true;
    }
    if (!hit) return null;
  }

  const leaf = leafStart(label);
  const whole = hay.indexOf(query);
  const rank = whole === -1 ? 3 : whole === leaf ? 0 : whole > leaf ? 1 : 2;

  return { option, index: -1, rank, ranges: mergeRanges(ranges) };
}

/**
 * The label, with matches marked and ancestors dimmed.
 *
 * Walked once, emitting a run wherever both facts about a character — inside a
 * match, before the leaf — stay constant. Long paths wrap rather than truncate:
 * the leaf is the answer, and truncation is exactly what removes it.
 */
function renderLabel(label: string, ranges: [number, number][]) {
  const leaf = leafStart(label);
  const marked = (n: number) => ranges.some(([s, e]) => n >= s && n < e);

  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < label.length) {
    const hit = marked(i);
    const ancestor = i < leaf;
    let j = i + 1;
    while (j < label.length && marked(j) === hit && (j < leaf) === ancestor) j++;
    const text = label.slice(i, j);
    nodes.push(
      hit ? (
        <mark key={key++} className="rounded-xs bg-brand-soft px-0.5 text-brand-on-soft">
          {text}
        </mark>
      ) : (
        <span key={key++} className={ancestor ? "text-ink-faint" : undefined}>
          {text}
        </span>
      ),
    );
    i = j;
  }
  return nodes;
}

type Placement = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function SearchSelect({
  value,
  onChange,
  options,
  className,
  placeholder = "Type to search…",
  emptyLabel = "Nothing matches that.",
  ariaLabel,
  id,
  required,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SearchSelectOption[];
  /** Applied to the text input, so callers keep their own field styling. */
  className?: string;
  placeholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  id?: string;
  /**
   * Native validation still applies, because the combobox IS a visible,
   * focusable text input — the browser can focus it to show its message,
   * which a hidden mirror input could never do (it reports "an invalid form
   * control is not focusable" and blocks the submit silently instead).
   * Constrained only while nothing is chosen, so an open-and-empty search box
   * cannot report a field that does in fact hold a value.
   */
  required?: boolean;
  disabled?: boolean;
}) {
  const uid = useId();
  const listId = `${uid}-list`;

  const [open, setOpen] = useState(false);
  /** `null` = idle, so the input shows the selected label instead of a query. */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const [mounted, setMounted] = useState(false);

  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setMounted(true), []);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value],
  );

  const results = useMemo<Ranked[]>(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return options.map((option, index) => ({ option, index, rank: 0, ranges: [] }));
    const hits: Ranked[] = [];
    options.forEach((option, index) => {
      const s = score(option, q);
      if (s) hits.push({ ...s, index });
    });
    // Stable in V8, so equal ranks keep the order they arrived in.
    return hits.sort((a, b) => a.rank - b.rank);
  }, [options, query]);

  const reposition = useCallback(() => {
    const el = controlRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 6;
    const EDGE = 12;
    const IDEAL = 340;
    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    // Flip up only when below is genuinely cramped AND above is roomier — a
    // list that changes sides on a keystroke is worse than a short one.
    const flip = below < 200 && above > below;
    const maxHeight = Math.max(120, Math.min(IDEAL, flip ? above : below));
    setPlace({
      left: r.left,
      width: r.width,
      maxHeight,
      ...(flip ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => reposition();
    // Capture, so a scroll in ANY ancestor container moves the list with it.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, reposition]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (controlRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, results]);

  function reveal() {
    setQuery("");
    // Start on what is already chosen, so ArrowDown steps on from *here*
    // rather than from the top of a 98-item list.
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function commit(option: SearchSelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery(null);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return reveal();
      if (results.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
      return;
    }

    // Closed: Enter belongs to the form and Escape to whatever wraps us.
    if (!open) return;

    if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      const step = e.key === "PageDown" ? 10 : -10;
      setActive((i) => Math.min(results.length - 1, Math.max(0, i + step)));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setActive(Math.max(0, results.length - 1));
      return;
    }
    if (e.key === "Enter") {
      // Always swallowed while open: an Enter meant to pick a category must
      // never reach the form and save a half-filled draft.
      e.preventDefault();
      const hit = results[active];
      if (hit) commit(hit.option);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Tab") {
      close(); // Not prevented — Tab must still move to the next field.
    }
  }

  const activeOption = results[active];

  return (
    <div ref={controlRef} className="relative">
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeOption ? `${uid}-opt-${activeOption.index}` : undefined
        }
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        required={required && !value}
        value={query ?? selectedLabel}
        // Open with the selection still legible: the box is empty so typing
        // filters from the first keystroke, and the placeholder says what is
        // currently chosen rather than losing it.
        placeholder={open && selectedLabel ? selectedLabel : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onMouseDown={() => {
          if (!open && !disabled) reveal();
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Only fires on a real focus loss: the list preventDefaults its own
          // mousedown, so clicking an option never blurs the input.
          if (open) close();
        }}
        className={cn(
          "cursor-pointer pr-9 disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      />

      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle",
          "transition-transform duration-fast",
          open && "-scale-y-100",
        )}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>

      {mounted &&
        open &&
        place &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              left: place.left,
              width: place.width,
              top: place.top,
              bottom: place.bottom,
              maxHeight: place.maxHeight,
            }}
            className={cn(
              "z-toast overflow-y-auto overscroll-contain rounded-md border border-line-strong",
              "bg-surface-0 py-1 shadow-e3",
            )}
            // Keeps focus — and therefore the caret and the keyboard — on the
            // input while the pointer is inside the list.
            onMouseDown={(e) => e.preventDefault()}
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-body-sm text-ink-muted">{emptyLabel}</li>
            ) : (
              results.map((r, i) => {
                const chosen = r.option.value === value;
                return (
                  <li
                    key={r.option.value || `__blank-${r.index}`}
                    id={`${uid}-opt-${r.index}`}
                    data-idx={i}
                    role="option"
                    aria-selected={chosen}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(r.option)}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 px-3 py-2 text-body-sm text-ink",
                      "transition-colors duration-fast",
                      i === active && "bg-surface-2",
                      chosen && "font-medium",
                    )}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      {renderLabel(r.option.label, r.ranges)}
                    </span>
                    {chosen && (
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="mt-0.5 shrink-0 text-brand"
                      >
                        <path d="m20 6-11 11-5-5" />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}

      {/* Announced to a screen reader as the list narrows; the visible list
          already says this to everyone else. */}
      <span role="status" aria-live="polite" className="sr-only">
        {open ? `${results.length} option${results.length === 1 ? "" : "s"}` : ""}
      </span>
    </div>
  );
}
