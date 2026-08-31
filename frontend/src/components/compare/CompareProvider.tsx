"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { MAX_COMPARE, type CompareItem } from "@/lib/compare";

/**
 * The comparison shortlist, held for the tab.
 *
 * ---------------------------------------------------------------------------
 * WHY SESSION STORAGE AND NOT LOCAL STORAGE
 *
 * Comparing three pairs of headphones is a task with an end. `localStorage`
 * would meet the reader three weeks later with a half-built comparison of
 * products they have already bought, and the shelf would be sitting across the
 * bottom of the homepage to tell them so. `sessionStorage` scopes the shortlist
 * to the visit that started it, which is the actual lifetime of the intent.
 *
 * It is also per-tab, which is the right answer for a reader who opens three
 * categories in three tabs: each one builds its own comparison instead of all
 * three fighting over one.
 *
 * ---------------------------------------------------------------------------
 * WHY THE FIRST RENDER IS ALWAYS EMPTY
 *
 * Storage does not exist on the server, so seeding state from it during render
 * would make the server and client markup disagree. The read happens in an
 * effect and the shelf animates in afterwards — which is honest anyway, since
 * a shelf that is already on screen at first paint has no arrival to describe.
 */

const KEY = "sc:compare";

/**
 * Picking across categories is not a mistake to swallow.
 *
 * /compare refuses a mixed comparison, and correctly — our rubric is
 * per-category, so a 9.0 laptop and a 9.0 pair of earbuds are not the same
 * number. But the refusal used to arrive at the END, after the reader had built
 * the thing. Holding the conflict here lets the shelf say it at the moment of
 * the pick, while the reader still has the two options in mind: keep what you
 * have, or start again on the new category.
 */
export interface CompareConflict {
  incoming: CompareItem;
  /** The category the shortlist is already committed to. */
  heldCategoryName: string;
}

interface CompareState {
  items: CompareItem[];
  /** Whether the shortlist has been read back from storage yet. Until it has,
   *  every control renders its inactive state, so nothing flickers. */
  ready: boolean;
  conflict: CompareConflict | null;
  has: (key: string) => boolean;
  /** Adds, removes if already present, or raises a conflict. */
  toggle: (item: CompareItem) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Discard the held shortlist and start again from the conflicting pick. */
  resolveConflict: (action: "replace" | "dismiss") => void;
}

const Ctx = createContext<CompareState | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [ready, setReady] = useState(false);
  const [conflict, setConflict] = useState<CompareConflict | null>(null);

  /**
   * The shortlist as of the last mutation, not as of the last render.
   *
   * `toggle` has to make a decision — add, remove, refuse, or raise a conflict —
   * and only one of those four outcomes is a state update. That rules out doing
   * the work inside a `setItems(prev => …)` updater: an updater must be pure,
   * and calling `setConflict` from inside one makes it not. React runs updaters
   * twice in development to catch exactly that, which would have raised the
   * same conflict twice.
   *
   * Reading `items` from the closure instead would be correct for a person —
   * nobody clicks two compare controls inside one tick — but wrong for anything
   * that does, since both calls would decide against the same stale array and
   * the second would overwrite the first. Writing the ref as part of the
   * mutation keeps the decision and the state in step either way.
   */
  const itemsRef = useRef<CompareItem[]>(items);

  /** Every write goes through here, so the ref can never fall behind. */
  const commit = useCallback((next: CompareItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        // Anything in storage is attacker-adjacent input as far as this
        // component is concerned — it survives across navigations and nothing
        // guarantees the shape a previous release wrote. Validate, do not cast.
        if (Array.isArray(parsed)) {
          commit(
            parsed
              .filter(
                (i): i is CompareItem =>
                  typeof i === "object" &&
                  i !== null &&
                  typeof (i as CompareItem).key === "string" &&
                  /^[a-z0-9-]+\/[a-z0-9-]+$/i.test((i as CompareItem).key) &&
                  typeof (i as CompareItem).title === "string" &&
                  typeof (i as CompareItem).categorySlug === "string",
              )
              .slice(0, MAX_COMPARE),
          );
        }
      }
    } catch {
      // A private window, a storage quota, a browser set to block site data.
      // The shortlist is a convenience; losing it costs the reader two clicks.
    }
    setReady(true);
  }, []);

  // Writes are skipped until the initial read has happened, or the empty first
  // render would erase a shortlist before it was ever loaded.
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* see above */
    }
  }, [items, ready]);

  const has = useCallback((key: string) => items.some((i) => i.key === key), [items]);

  const remove = useCallback(
    (key: string) => commit(itemsRef.current.filter((i) => i.key !== key)),
    [commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  const toggle = useCallback(
    (item: CompareItem) => {
      const current = itemsRef.current;
      setConflict(null);

      if (current.some((i) => i.key === item.key)) {
        commit(current.filter((i) => i.key !== item.key));
        return;
      }

      const held = current[0];
      if (held && held.categorySlug !== item.categorySlug) {
        setConflict({ incoming: item, heldCategoryName: held.categoryName });
        return;
      }

      // The ceiling is announced by the shelf and enforced here. Silently
      // dropping the oldest pick would be worse than refusing: the reader chose
      // three things and would leave with two of them plus a stranger.
      if (current.length >= MAX_COMPARE) return;

      commit([...current, item]);
    },
    [commit],
  );

  const resolveConflict = useCallback(
    (action: "replace" | "dismiss") => {
      if (action === "replace" && conflict) commit([conflict.incoming]);
      setConflict(null);
    },
    [commit, conflict],
  );

  const value = useMemo<CompareState>(
    () => ({ items, ready, conflict, has, toggle, remove, clear, resolveConflict }),
    [items, ready, conflict, has, toggle, remove, clear, resolveConflict],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Returns `null` outside the provider rather than throwing.
 *
 * The compare control is rendered by `ProductCard`, and `ProductCard` is used
 * by the styleguide and by admin previews that do not mount the site shell.
 * A throwing hook would turn "this surface has no shelf" into a crashed page.
 */
export function useCompare(): CompareState | null {
  return useContext(Ctx);
}
