"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useRoutePending } from "@/lib/use-route-pending";

/**
 * Sidebar navigation.
 *
 * Split out of the layout because it needs the current pathname to mark the
 * active item, and a Server Component cannot see one. Nothing rendered here is
 * privileged — the layout decides whether this appears at all.
 *
 * It carries the same two instant-navigation behaviours as the public sub-nav,
 * for the same reasons and with more to gain: every admin page is
 * `force-dynamic` and most of them open with a paginated API query, so an
 * un-warmed click here is the slowest navigation in the product.
 *
 *   **Intent-prefetch** on pointer-enter and focus, debounced past an
 *   accidental sweep, so the destination is usually in the router cache before
 *   the click.
 *
 *   **Optimistic active state.** The pill moves to the item that was clicked
 *   immediately, rather than when the server answers. An admin working through
 *   a list of sections should never have to wonder whether their click landed.
 */
export interface NavGroup {
  label: string;
  items: { href: string; label: string }[];
}

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pending, target } = useRoutePending();

  /**
   * `/admin` is a prefix of every other admin route, so a plain `startsWith`
   * lights up Dashboard on every page. Exact for the root, prefix for the rest
   * so `/admin/products/<id>` still marks Products.
   */
  function matches(href: string, path: string): boolean {
    if (href === "/admin") return path === "/admin";
    return path === href || path.startsWith(`${href}/`);
  }

  // The destination of a navigation in flight wins over where we still are.
  const optimistic = pending && target ? target.split("?")[0] : null;
  const marked = optimistic ?? pathname;

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
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="px-2 pb-2 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = matches(item.href, marked);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    // Announced from where we actually are, not from where we
                    // are heading — the optimistic pill is a visual promise,
                    // and promising a screen reader a page that has not
                    // rendered yet would be a lie.
                    aria-current={matches(item.href, pathname) ? "page" : undefined}
                    onPointerEnter={() => onIntent(item.href)}
                    onPointerLeave={cancelIntent}
                    onFocus={() => warm(item.href)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-sm px-2.5 py-2 text-body-sm",
                      "transition-colors duration-fast",
                      active
                        ? "bg-brand-soft font-medium text-brand-on-soft"
                        : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
