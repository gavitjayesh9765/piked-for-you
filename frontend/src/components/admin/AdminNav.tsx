"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Sidebar navigation.
 *
 * Split out of the layout because it needs the current pathname to mark the
 * active item, and a Server Component cannot see one. Nothing rendered here is
 * privileged — the layout decides whether this appears at all.
 */
export interface NavGroup {
  label: string;
  items: { href: string; label: string }[];
}

export function AdminNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  /**
   * `/admin` is a prefix of every other admin route, so a plain `startsWith`
   * lights up Dashboard on every page. Exact for the root, prefix for the rest
   * so `/admin/products/<id>` still marks Products.
   */
  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="px-2 pb-2 font-label text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
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
