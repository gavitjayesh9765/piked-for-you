"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useRoutePending } from "@/lib/use-route-pending";
import { Shuttle } from "@/components/ui/Shuttle";

export type NavItem = {
  href: string;
  label: string;
  /** The index link behaves and reads differently from a category. */
  kind: "index" | "section";
  /** Every category slug filed under this section, including its own. */
  slugs?: string[];
  /** Whether anything has actually been published beneath it. */
  researched?: boolean;
};

/**
 * The category sub-nav (spec §13) — and the site's primary instrument for
 * making navigation feel instant.
 *
 * It renders inside the persistent site layout, so unlike before it is never
 * unmounted by a navigation. That single fact removes the flicker; everything
 * below is about removing the *wait*, and then about making the bar worth
 * looking at.
 *
 * WHAT it lists is decided by `navItems` in <SiteHeader>, which has the long
 * explanation. This file is about how the list behaves.
 *
 * ---------------------------------------------------------------------------
 * SPEED
 *
 * 1. **Intent-prefetch.** Pointing at an item is a strong predictor of clicking
 *    it, and the ~200ms between the two is free time. `router.prefetch` on
 *    pointer-enter and on focus spends it, so the common path is already in the
 *    router cache when the click lands and the navigation resolves in one frame.
 *    Debounced, because sweeping the pointer across the bar to reach the search
 *    field should not fetch nine routes.
 *
 * 2. **Optimistic ink.** The underline moves the instant a link is clicked, to
 *    the link that was clicked — not when the server answers. The interface
 *    commits to the reader's choice immediately, which is what a responsive
 *    interface actually is; the data catching up afterwards is an
 *    implementation detail nobody should have to watch.
 *
 * 3. **The shuttle**, and only if the wait earns it. It is deferred by 250ms in
 *    CSS, so a prefetched navigation displays no progress indicator whatsoever
 *    — because there was no progress to report.
 *
 * ---------------------------------------------------------------------------
 * LEGIBILITY
 *
 * **Three states, not one.** Every item used to be `text-ink-subtle` at the same
 * weight, including "All categories" — which is an index, a different kind of
 * link from a category. Now the index reads slightly stronger and is fenced off
 * by a hairline; a section with research reads normally; a section with nothing
 * published yet reads faintly. It stays clickable and reachable — the site's
 * position is that showing the gaps beats pretending they are not there (see
 * /c) — but the reader can see at a glance where the work actually is.
 *
 * **Real targets.** The items were bare text in a 44px bar: a 14px-tall hit area
 * with 28px of dead space between neighbours. Each is now a full-height box with
 * its own padding, so the entire strip is clickable and the gaps belong to
 * whichever label is nearer. The optical spacing is unchanged — the padding
 * replaces the gap rather than adding to it — and the first item pulls back by
 * its own padding so its text still aligns with the wordmark above it.
 *
 * **An edge that admits it is cut off.** The strip scrolls with its scrollbar
 * hidden, so an overflowing rail simply ended mid-word with no signal. It now
 * fades at whichever edge has more behind it.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS NO LONGER `md:block`
 *
 * The bar used to be desktop-only, on the reasoning that a 360px viewport
 * cannot hold nine items. It cannot hold them *at once* — but this has always
 * been a horizontal scroller, and a scroller does not need to fit. Hidden, the
 * only route to a category on a phone was the hamburger, so the site's primary
 * navigation cost two taps and a modal on the devices most likely to use it,
 * while the search field and the account menu — which genuinely have no
 * narrow-viewport form — kept the sheet to themselves.
 *
 * Everything the bar already does is what makes it work small: it scrolls, it
 * fades the edge that has more behind it, it keeps the active item in view, and
 * each item is a full-height box rather than bare text. The only additions for
 * touch are `overscroll-x-contain` (below) and `--subnav-h` finally being a
 * real height on mobile — see tokens.css, since every sticky offset on the site
 * measures the header stack through it.
 */
export function CategoryNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pending, target } = useRoutePending();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);
  // Suppresses the transition for the first placement only: an underline that
  // slides in from x=0 on every hard load is an entrance nobody asked for.
  const [ready, setReady] = useState(false);
  const [edge, setEdge] = useState<"none" | "start" | "end" | "both">("none");

  // While a navigation to a known item is in flight, that item is the active
  // one as far as this bar is concerned.
  const optimistic = pending && target ? matchIndex(target, items) : -1;
  const settled = matchIndex(pathname ?? "", items);
  const active = optimistic !== -1 ? optimistic : settled;

  const measure = useCallback(() => {
    const el = itemRefs.current[active];
    if (!el) {
      setInk(null);
      return;
    }
    setInk({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);

  // Which edges have content behind them. Four pixels of slack because
  // fractional scroll offsets on trackpads never land exactly on the boundary.
  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const atStart = el.scrollLeft > 4;
    const atEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge(atStart && atEnd ? "both" : atStart ? "start" : atEnd ? "end" : "none");
  }, []);

  // Layout effect, not effect: the mark must be in place in the same frame the
  // items are, or the first paint shows it at the wrong offset.
  useLayoutEffect(() => {
    measure();
    syncEdges();
  }, [measure, syncEdges]);

  useEffect(() => {
    if (ink && !ready) {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    }
  }, [ink, ready]);

  // The bar reflows with the viewport and the underline is measured in pixels,
  // so it has to be re-measured too. Font loading counts as a reflow here — the
  // label widths change when the display face swaps in.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const ro = new ResizeObserver(() => {
      measure();
      syncEdges();
    });
    ro.observe(scroller);
    for (const el of itemRefs.current) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [measure, syncEdges]);

  // Keep the active item visible when the bar overflows — on a narrow desktop
  // window the current category is often the one scrolled off the right edge.
  // Scrolls the strip itself rather than calling scrollIntoView, which would
  // also scroll the page and yank the reader away from the content.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const el = itemRefs.current[active];
    if (!scroller || !el) return;

    const pad = 32;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left - pad < scroller.scrollLeft) {
      scroller.scrollTo({ left: Math.max(0, left - pad), behavior: "smooth" });
    } else if (right + pad > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({ left: right + pad - scroller.clientWidth, behavior: "smooth" });
    }
  }, [active]);

  // --- Intent prefetch -----------------------------------------------------
  const hoverTimer = useRef<number | null>(null);
  const prefetched = useRef(new Set<string>());

  const warm = useCallback(
    (href: string) => {
      if (prefetched.current.has(href)) return;
      prefetched.current.add(href);
      router.prefetch(href);
    },
    [router],
  );

  const onIntent = useCallback(
    (href: string) => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      // Long enough to ignore a pointer passing through, short enough to still
      // land well before the click.
      hoverTimer.current = window.setTimeout(() => warm(href), 70);
    },
    [warm],
  );

  const cancelIntent = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }, []);

  useEffect(() => cancelIntent, [cancelIntent]);

  return (
    <div className="relative overflow-hidden border-b border-line bg-bg/95 backdrop-blur-md">
      {/* `overscroll-x-contain`: without it, swiping the strip past its last
          item hands the gesture to the browser, which reads it as a back
          navigation. Losing the page because you scrolled the nav too far is
          not a trade any reader agreed to. */}
      <div
        ref={scrollerRef}
        onScroll={syncEdges}
        data-edge={edge}
        className="edge-fade shell relative flex h-subnav items-stretch gap-1 overflow-x-auto
                   overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <Fragment key={item.href}>
              <Link
                href={item.href}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                aria-current={i === settled ? "page" : undefined}
                onPointerEnter={() => onIntent(item.href)}
                onPointerLeave={cancelIntent}
                onFocus={() => warm(item.href)}
                className={cn(
                  "flex h-full shrink-0 items-center whitespace-nowrap px-3",
                  "font-label text-label uppercase tracking-[0.08em]",
                  "transition-colors duration-fast",
                  // The gutter is the page's left edge; the first label has to
                  // sit on it, not 12px inside it.
                  i === 0 && "-ml-3",
                  isActive
                    ? "text-ink"
                    : item.kind === "index"
                      ? "text-ink-muted hover:text-ink"
                      : item.researched === false
                        ? "text-ink-faint hover:text-ink-subtle"
                        : "text-ink-subtle hover:text-ink",
                )}
              >
                {item.label}
              </Link>

              {/* The index is not one of the categories, and a bar that reads
                  "ALL CATEGORIES AUDIO COMPUTERS…" in one undifferentiated run
                  invites you to read it as nine peers. `line-strong` rather
                  than `line`, because at 1px over a translucent bar the base
                  rule is invisible in the dark theme — a separator nobody can
                  see is not a separator. The extra margin does as much of the
                  work as the rule does: it makes the break wider than the gap
                  between two categories, so the grouping reads even before the
                  hairline registers. */}
              {item.kind === "index" ? (
                <span aria-hidden="true" className="my-2.5 mx-2 w-px shrink-0 bg-line-strong" />
              ) : null}
            </Fragment>
          );
        })}

        <span
          aria-hidden="true"
          className="ink"
          data-ready={ready ? "true" : "false"}
          style={
            {
              "--ink-x": `${ink?.x ?? 0}px`,
              "--ink-w": `${ink?.w ?? 0}px`,
              "--ink-o": ink ? 1 : 0,
            } as React.CSSProperties
          }
        />
      </div>

      {/* Progress, in the border rather than on top of the page. Mounted only
          while a navigation is in flight, and invisible for its own first
          250ms — see `.shuttle` in globals.css. */}
      {pending ? <Shuttle /> : null}
    </div>
  );
}

/**
 * Which nav item owns this URL.
 *
 * Longest match wins, so `/c/electronics/audio` selects Audio rather than the
 * `/c` catch-all that also prefixes it — and `/c/electronics/audio/headphones`
 * selects Audio too, because a leaf belongs to its section.
 *
 * Product URLs are the case that needs the slug list. They carry the LEAF
 * category as their first segment (`/p/headphones/{slug}`, see `productHref`),
 * which matches no item's href; without checking the section's descendants the
 * rail would go blank the moment a reader opened a product, silently
 * deselecting the category they were browsing.
 */
function matchIndex(url: string, items: NavItem[]): number {
  const path = url.split("?")[0];

  if (path.startsWith("/p/")) {
    const slug = path.split("/")[2];
    if (slug) {
      const i = items.findIndex((item) => item.slugs?.includes(slug));
      if (i !== -1) return i;
    }
  }

  let best = -1;
  let bestLength = -1;
  items.forEach((item, i) => {
    if (path === item.href || path.startsWith(`${item.href}/`)) {
      if (item.href.length > bestLength) {
        best = i;
        bestLength = item.href.length;
      }
    }
  });
  return best;
}
