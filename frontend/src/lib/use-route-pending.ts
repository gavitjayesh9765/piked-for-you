"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Is a client-side navigation currently in flight, and where to?
 *
 * The App Router does not expose a global pending signal. `useLinkStatus()`
 * exists but only inside a `<Link>` subtree, which answers "is THIS link
 * navigating" — not "is the page changing", which is what a piece of shared
 * chrome needs to know. So this reads the same event the router reads: a click
 * on an in-app anchor.
 *
 * ## Why the click listener is in the capture phase
 *
 * `<Link>` calls `preventDefault()` in its own React handler, so by the time a
 * bubble-phase document listener sees the event, `defaultPrevented` is true for
 * every real navigation — the signal and the noise become indistinguishable.
 * Capturing runs first, before any handler has had the chance. The cost is that
 * an anchor whose handler cancels the navigation would still register here; the
 * filters below reject every such anchor in this codebase (hash links, external
 * hosts, downloads, new tabs), and the safety timeout covers anything new.
 *
 * ## Why completion is detected by polling the URL
 *
 * The obvious clear is "when the route changes", but `usePathname()` alone does
 * not fire for a query-string change — and the category page's filters and sort
 * are query-string changes, so the indicator would latch on and never release.
 * The obvious fix, `useSearchParams()`, is worse than the problem: reading it
 * opts the nearest Suspense boundary out of static rendering, and this hook runs
 * inside the site layout — the one tree that must stay static for navigation to
 * be instant in the first place.
 *
 * So while (and only while) a navigation is in flight, a short interval compares
 * the live URL against the requested one. It costs nothing at rest, needs no
 * router internals, and is correct for both kinds of change.
 */
export function useRoutePending(): { pending: boolean; target: string | null } {
  const pathname = usePathname();
  const [target, setTarget] = useState<string | null>(null);
  const targetRef = useRef<string | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Anything but a plain primary click is the reader asking the browser to
      // do something else — open a tab, save the target, show a context menu.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // mailto:, tel:, and any other origin leave the app entirely.
      if (url.origin !== window.location.origin) return;

      const next = url.pathname + url.search;
      const current = window.location.pathname + window.location.search;
      // A bare `#anchor` scrolls; it does not navigate.
      if (next === current) return;

      targetRef.current = next;
      setTarget(next);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Arriving clears the signal. Two independent clears, because one of them
  // failing should degrade to a stale indicator for a moment, never forever:
  // the interval catches the normal case, the timeout catches a navigation that
  // was cancelled, redirected somewhere unexpected, or never started.
  useEffect(() => {
    if (target === null) return;

    const settle = () => {
      targetRef.current = null;
      setTarget(null);
    };

    const poll = window.setInterval(() => {
      if (window.location.pathname + window.location.search === targetRef.current) {
        settle();
      }
    }, 90);
    const bail = window.setTimeout(settle, 10_000);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(bail);
    };
  }, [target]);

  // A completed navigation to a different path is unambiguous — clear without
  // waiting for the next poll tick, so the chrome settles on the same frame the
  // new page paints.
  useEffect(() => {
    targetRef.current = null;
    setTarget(null);
  }, [pathname]);

  return { pending: target !== null, target };
}
