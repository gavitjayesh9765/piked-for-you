"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AdminNav, type NavGroup } from "./AdminNav";
import { BrandMark } from "@/components/layout/BrandMark";

/**
 * The admin navigation for viewports below `lg`.
 *
 * The sidebar is `hidden lg:flex` and had nothing behind it, so on a tablet or
 * a phone the panel carried no navigation at all — every screen was a dead end
 * reachable only by typing its URL. The admin stays desktop-first (spec §49);
 * this does not soften that, it stops a narrow viewport being a trap.
 *
 * Renders the same <AdminNav> tree as the persistent column, so there is one
 * source of navigation truth and the active-item logic cannot drift.
 *
 * Portalled to <body>: the admin header is a `backdrop-blur` surface, and
 * `backdrop-filter` makes an element the containing block for its
 * fixed-position descendants — rendered in place, the drawer would be measured
 * against a 64px bar instead of the viewport.
 */
export function AdminNavDrawer({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Navigating dismisses the drawer — including via the back button.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // The drawer is `lg:hidden`; widening past the breakpoint has to release the
  // scroll lock with it, or the canvas is frozen with no visible control left.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const close = () => mq.matches && setOpen(false);
    close();
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input, select, textarea",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const drawer = (
    <>
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-overlay bg-scrim transition-opacity duration-base ease-ease lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        ref={panelRef}
        id="admin-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={cn(
          "fixed left-0 top-0 z-modal flex h-[100dvh] w-[min(17rem,85vw)] flex-col",
          "border-r border-line bg-surface-0 shadow-e3",
          "transition-transform duration-base ease-ease lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        inert={!open}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-display text-body-lg font-black tracking-[-0.04em] text-ink"
          >
            <BrandMark size={22} priority={false} />
            SortedChoice
          </Link>
          <span className="rounded-xs border border-brand-line bg-brand-soft px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.12em] text-brand-on-soft">
            Admin
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="-mr-2 ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-sm text-ink-muted
                       transition-colors duration-fast hover:text-brand"
          >
            <CloseGlyph />
          </button>
        </div>

        <AdminNav groups={groups} />

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-body-sm text-ink-muted
                       transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
          >
            ← View public site
          </Link>
          {/* The header hides its theme control below `sm` to keep the bar from
              overflowing; this is where it goes, not away. */}
          <span className="sm:hidden">
            <ThemeToggle />
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin navigation"
        aria-expanded={open}
        aria-controls="admin-nav-drawer"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-line text-ink-muted
                   transition-colors duration-fast hover:border-brand hover:text-brand lg:hidden"
      >
        <MenuGlyph />
      </button>

      {mounted && createPortal(drawer, document.body)}
    </>
  );
}

function MenuGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
