"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * End a shopper's session once it has gone stale.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 *
 * `[auth.sessions]` in supabase/config.toml gives shoppers two bounds — 14 days
 * unused, 30 days absolute — and those are the right numbers. They are also
 * **local-stack only**. The hosted equivalent (Time-box / Inactivity timeout in
 * the dashboard) is gated behind the Pro plan, and on Free it reads `0`, which
 * means never.
 *
 * So in production a shopper session did not expire. Ever. The access token
 * turns over hourly, but refresh rotation renews it indefinitely, and nothing
 * else was watching — a session on a shared or lost device stayed live until
 * someone thought to sign out. The admin console was covered (its own 30-minute
 * bound, components/admin/IdleLogout.tsx); the shopper surface was not.
 *
 * This closes that gap from the client until the plan changes.
 *
 * ## ⚠ What this is, and what it is not
 *
 * NOT a security boundary, for the same reason the proxy is not one: it runs
 * in a browser, and anyone holding a stolen refresh token can use it from curl
 * without ever loading this page. It cannot fire for a session it never sees.
 *
 * But when it *does* fire it is a real revocation, not a UI trick —
 * `signOut({ scope: "global" })` revokes at Supabase, so the tokens die
 * everywhere rather than being hidden behind a redirect. That distinction is
 * the whole reason this is worth shipping rather than waiting for Pro: the
 * common case this actually covers is the honest one — a device someone walked
 * away from and came back to weeks later.
 *
 * Delete this component the day `sessions_timebox` is set on the hosted
 * project. Two mechanisms enforcing the same rule is how they drift.
 *
 * ## Why deadlines and not timers
 *
 * Same reasoning as the admin bound, and it matters more here because the
 * window is measured in days: `setTimeout` is throttled in background tabs,
 * suspended outright by a sleeping laptop, and private to the tab that set it.
 * The deadline is instead a wall-clock timestamp in `localStorage`, shared
 * across tabs by origin, and every check only *compares* against it — so a
 * late tick, a skipped tick, or a tab that was asleep for a week can never
 * extend a session, only discover that it is over.
 */

/** Mirrors `inactivity_timeout = "336h"` in supabase/config.toml. */
const IDLE_MS = 14 * 24 * 60 * 60 * 1000;

/** Deliberately unhurried. The deadline is days away, so this interval exists
 *  only for the tab that is left open across it — every other case is caught
 *  by the mount, focus and storage checks below, which are free. */
const TICK_MS = 5 * 60 * 1000;

const DEADLINE_KEY = "pdfy.session.idle-deadline";

/** Activity that counts as "someone is still here".
 *
 *  Deliberately not `mousemove`, matching the admin bound: a trackpad drift or
 *  a page animating under the cursor would hold a session open forever, and a
 *  timeout that never fires is worse than no timeout because it is trusted. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function SessionExpiry({
  /**
   * `last_sign_in_at + 30 days`, resolved on the server from the verified user.
   *
   * The absolute bound is read from Supabase rather than kept in
   * `localStorage` next to the idle one, because those two bounds exist to
   * catch different things and a client-owned timebox catches neither. Idle
   * alone never stops a stolen token that IS being used — that is the case the
   * timebox is for — so anchoring it to a value the browser cannot rewrite is
   * the only version worth having. Null when Supabase did not report a
   * sign-in time; the idle bound still applies.
   */
  hardDeadline,
}: {
  hardDeadline: number | null;
}) {
  const router = useRouter();
  // Survives re-renders and guarantees the sign-out runs once even if a tick,
  // a focus event and a storage event all land together.
  const signingOut = useRef(false);

  /** localStorage throws in some privacy modes. A thrown read must not take
   *  the whole site down, so it degrades to a per-tab deadline — weaker, but
   *  still bounded, which is the safe direction. */
  const memoryDeadline = useRef<number>(Date.now() + IDLE_MS);

  const readDeadline = useCallback((): number => {
    try {
      const raw = window.localStorage.getItem(DEADLINE_KEY);
      const value = raw ? Number(raw) : NaN;
      return Number.isFinite(value) ? value : memoryDeadline.current;
    } catch {
      return memoryDeadline.current;
    }
  }, []);

  const extend = useCallback(() => {
    const next = Date.now() + IDLE_MS;
    memoryDeadline.current = next;
    try {
      window.localStorage.setItem(DEADLINE_KEY, String(next));
    } catch {
      // Private mode. The in-memory deadline above still applies.
    }
  }, []);

  const signOutNow = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;

    try {
      window.localStorage.removeItem(DEADLINE_KEY);
    } catch {
      /* nothing to clean up */
    }

    try {
      await createClient().auth.signOut({ scope: "global" });
    } catch {
      // supabase-js clears the local session before it calls the server, so
      // the browser is signed out either way. The refresh below is still the
      // right outcome; leaving a signed-in header on screen would not be.
    }

    // No redirect, on purpose. Unlike the admin bound — which throws you off a
    // dashboard you can no longer use — everything here is public. Someone who
    // left a product page open for a fortnight should find that same page when
    // they come back, just signed out. `refresh()` re-runs the server render,
    // which is what swaps the account menu back to "Log in".
    router.refresh();
  }, [router]);

  useEffect(() => {
    // The absolute bound is checked before the idle one is even armed: a
    // session past its timebox is over no matter how active this person is,
    // and extending it first would hand back the exact case it exists for.
    if (hardDeadline !== null && Date.now() >= hardDeadline) {
      void signOutNow();
      return;
    }

    extend();

    // Passive listeners so none of this can delay a scroll or a tap.
    const onActivity = () => {
      if (signingOut.current) return;
      extend();
    };
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    const check = () => {
      if (signingOut.current) return;
      if (hardDeadline !== null && Date.now() >= hardDeadline) {
        void signOutNow();
        return;
      }
      if (readDeadline() - Date.now() <= 0) void signOutNow();
    };

    const id = window.setInterval(check, TICK_MS);

    // A tab returning to the foreground is the moment it discovers how long it
    // was away, and for a bound this long it is the check that does nearly all
    // the work — the interval only matters for a tab nobody ever left.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Another tab extended or cleared the deadline: re-evaluate against the
    // shared value rather than this tab's stale view of it.
    const onStorage = (e: StorageEvent) => {
      if (e.key === DEADLINE_KEY) check();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(id);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [extend, hardDeadline, readDeadline, signOutNow]);

  // Renders nothing, ever. There is no countdown dialog here on purpose: the
  // admin bound warns because 30 minutes can elapse while you are reading, and
  // being thrown out mid-edit loses work. Two weeks cannot pass while someone
  // is looking at the screen, so a warning would only ever interrupt a person
  // who is by definition not there.
  return null;
}
