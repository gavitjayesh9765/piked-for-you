"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Who the viewer is, and what they have already saved.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `SaveButton` takes `isAuthed` and `isSaved` as props, and both default to
 * false. No grid on the site passed either one — not the category page, not the
 * homepage rails, not Top Picks, not the alternatives row. So for a signed-in
 * reader every Save control on every card was rendered hollow and, on click,
 * sent them to the login page they were already past. The one feature the
 * account section is built around could not be used from the catalogue at all.
 *
 * The obvious repair is to thread two more props through eight call sites. This
 * is the other one: resolve it once, above all of them, and let the control ask.
 * `savedIds` already exists in lib/me-api.ts for exactly this — "just the ids,
 * so a grid can render save-state without N queries" — and had no caller.
 *
 * ---------------------------------------------------------------------------
 * WHY THE STATE ARRIVES LATE
 *
 * Knowing the answer costs a round trip to the auth server plus one to the API,
 * and the site layout is explicit that the chrome must not wait on that (see
 * the note on `SessionGuard`). So the provider mounts empty, the page renders
 * immediately with every control in its signed-out state, and `<SavedState>`
 * streams the real answer in behind its own Suspense boundary.
 *
 * The failure mode of arriving late is a control that briefly offers to save
 * something already saved. The failure mode of waiting would be a blank page on
 * every route this layout wraps, including the ones with no products on them.
 */

interface SavedState {
  /** False until the viewer resolves — so the control never claims a session
   *  the page has not confirmed. */
  isAuthed: boolean;
  has: (productId: string) => boolean;
  /** Called by the control after a successful toggle, so a second card showing
   *  the same product agrees with the first without a refetch. */
  setSaved: (productId: string, saved: boolean) => void;
}

const Ctx = createContext<SavedState | null>(null);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());

  const has = useCallback((productId: string) => ids.has(productId), [ids]);

  const setSaved = useCallback((productId: string, saved: boolean) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const hydrate = useCallback((authed: boolean, savedIds: string[]) => {
    setIsAuthed(authed);
    setIds(new Set(savedIds));
  }, []);

  const value = useMemo<SavedState>(
    () => ({ isAuthed, has, setSaved }),
    [isAuthed, has, setSaved],
  );

  return (
    <Ctx.Provider value={value}>
      <HydrateCtx.Provider value={hydrate}>{children}</HydrateCtx.Provider>
    </Ctx.Provider>
  );
}

/**
 * Separate from the read context on purpose.
 *
 * `hydrate` is stable for the life of the provider, so the hydrator never
 * re-renders when the saved set changes — and, more usefully, a card
 * re-rendering because the set changed does not drag the hydrator with it.
 */
const HydrateCtx = createContext<((authed: boolean, ids: string[]) => void) | null>(null);

/**
 * Pushes the server's answer into the provider. Renders nothing.
 *
 * A component rather than a prop on `SavedProvider` because the provider has to
 * wrap the whole tree synchronously, and this value is not known synchronously.
 * Mounted inside a Suspense boundary by the site layout, it streams in whenever
 * the auth and API calls land, without any of the page waiting on it.
 */
export function SavedHydrator({ isAuthed, savedIds }: { isAuthed: boolean; savedIds: string[] }) {
  const hydrate = useContext(HydrateCtx);
  const key = savedIds.join(",");

  useEffect(() => {
    hydrate?.(isAuthed, key ? key.split(",") : []);
    // `key` rather than the array: a new array identity on every server render
    // would re-run this forever.
  }, [hydrate, isAuthed, key]);

  return null;
}

/**
 * Returns `null` outside the provider rather than throwing — the styleguide and
 * the admin previews render product cards without the site shell, and a
 * throwing hook would turn "no session here" into a crashed page.
 */
export function useSaved(): SavedState | null {
  return useContext(Ctx);
}
