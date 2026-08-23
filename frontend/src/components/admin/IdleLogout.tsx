"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign an idle admin out.
 *
 * Supabase now caps sessions project-wide (`[auth.sessions]` in config.toml),
 * but those bounds are measured in days — right for a shopper who expects to
 * stay signed in between visits, far too generous for a console that can
 * unpublish products, read the moderation queue and change prices. An admin
 * laptop left open in a shared office stays fully authenticated all day.
 *
 * So the admin surface gets its own, much shorter idle bound on top. This is
 * genuinely a sign-out and not a screen lock: `signOut({ scope: "global" })`
 * revokes the session at Supabase, so the tokens are dead everywhere rather
 * than merely hidden behind a redirect.
 *
 * ## Why deadlines, not timers
 *
 * The obvious implementation — `setTimeout(signOut, THIRTY_MINUTES)` — does
 * not survive contact with a real browser:
 *
 *   * Background tabs have their timers throttled to roughly once a minute,
 *     so the fire time drifts arbitrarily late.
 *   * A closed laptop suspends timers entirely. Six hours asleep and the
 *     timeout fires six hours late, which is the one case where it needed to
 *     have fired.
 *   * Two admin tabs each keep their own timer, so activity in one does not
 *     reset the other and whichever is quieter signs both out.
 *
 * Instead the deadline is a wall-clock timestamp in `localStorage`, shared
 * across tabs by origin. The interval only *compares* against it, so a late or
 * skipped tick cannot extend the session. Waking from sleep is checked
 * explicitly on `visibilitychange`, which is when a suspended tab first learns
 * that time has passed.
 */
const IDLE_MS = 30 * 60 * 1000; // 30 minutes of no interaction
const WARN_MS = 2 * 60 * 1000; // last 2 minutes are spent warning
const TICK_MS = 5 * 1000;

const DEADLINE_KEY = "pdfy.admin.idle-deadline";

/** Activity that counts as "someone is still here".
 *
 *  Deliberately not `mousemove`: a sleeping cat, a trackpad drift, or a page
 *  that animates under the cursor would hold a session open indefinitely, and
 *  a timeout that never fires is worse than none because it is trusted. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function IdleLogout() {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  // Survives re-renders and guarantees the sign-out runs once even if several
  // ticks overlap.
  const signingOut = useRef(false);

  /** localStorage throws in some privacy modes; a thrown read must not take
   *  the admin shell down with it. Falling back to an in-memory deadline keeps
   *  the timeout working per-tab, which is the safe direction to degrade. */
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
      // The local cookie is cleared regardless and the proxy refuses the next
      // admin request, so the redirect below is still the right outcome.
      // Staying on a dashboard that looks signed in would be worse.
    }

    // `replace`, not `push`: Back must not return to the dashboard shell.
    router.replace("/admin/login?error=timeout");
    router.refresh();
  }, [router]);

  useEffect(() => {
    extend();

    // Activity resets the shared deadline. Passive listeners so none of this
    // can delay a scroll or a tap.
    const onActivity = () => {
      if (signingOut.current) return;
      extend();
      setRemaining(null);
    };
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    const check = () => {
      if (signingOut.current) return;
      const left = readDeadline() - Date.now();

      if (left <= 0) {
        void signOutNow();
        return;
      }
      // Only render the warning inside the final window; the rest of the time
      // this component draws nothing at all.
      setRemaining(left <= WARN_MS ? left : null);
    };

    const id = window.setInterval(check, TICK_MS);

    // A tab returning to the foreground is the moment it discovers how long it
    // was asleep. Check immediately rather than waiting up to TICK_MS.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Another tab extended or cleared the deadline: re-evaluate against the
    // new shared value instead of this tab's stale view of it.
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
  }, [extend, readDeadline, signOutNow]);

  if (remaining === null) return null;

  const seconds = Math.max(0, Math.ceil(remaining / 1000));

  return (
    // `alertdialog`, not `dialog`: this interrupts to report something that is
    // about to happen on its own, which is exactly the distinction the role
    // exists to draw. Screen readers announce it without the admin having to
    // go looking.
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-body"
      className="fixed inset-0 z-modal grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <div className="panel w-full max-w-sm p-7">
        <h2 id="idle-title" className="font-display text-headline-sm text-ink">
          Still there?
        </h2>
        <p id="idle-body" className="mt-3 text-body-md text-ink-muted">
          You have been inactive for a while. For security, you will be signed out in{" "}
          {/* aria-live so the countdown is announced as it changes rather than
              only when the dialog first opens. */}
          <span aria-live="polite" className="font-medium tabular-nums text-ink">
            {seconds}s
          </span>
          .
        </p>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            autoFocus
            onClick={() => {
              extend();
              setRemaining(null);
            }}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full
                       bg-brand-fill font-label text-label font-semibold uppercase
                       tracking-[0.08em] text-brand-on shadow-brand transition-all
                       duration-fast ease-ease hover:brightness-110"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => void signOutNow()}
            className="inline-flex h-11 items-center justify-center rounded-full border
                       border-line px-5 text-body-md text-ink transition-colors
                       duration-fast hover:border-ink-faint"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
