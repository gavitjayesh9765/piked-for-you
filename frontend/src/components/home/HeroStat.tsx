"use client";

import { useEffect, useRef } from "react";

/**
 * One hero proof figure — "340+", "28", "0" — counted up on first paint.
 *
 * ---------------------------------------------------------------------------
 * WHY THE FINAL VALUE IS THE SERVER RENDER
 *
 * The element ships with the real string already in it. The count is applied
 * afterwards, from an effect, by writing to the node — so there is no state, no
 * hydration mismatch, and no version of this component that renders "0" to a
 * reader whose JavaScript never arrives. Turn the script off and the figure is
 * simply correct and still; that is the fallback, not a degraded one.
 *
 * The suffix is part of the value and is preserved: "340+" counts to 340 and
 * keeps its plus. Anything with no leading integer (a value an editor might
 * one day write as "—") is left exactly as authored rather than parsed into a
 * zero.
 *
 * ---------------------------------------------------------------------------
 * COST
 *
 * One rAF loop per figure, for 1.1s, once. It writes `textContent` on a node
 * whose width is already reserved by `tabular` figures, so the count cannot
 * reflow the row it sits in. `prefers-reduced-motion` skips the loop entirely
 * and leaves the server's string untouched.
 */
const DURATION_MS = 1100;

/** Ease-out cubic — fast to most of the value, then settling. */
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function HeroStat({ value, delayMs = 0 }: { value: string; delayMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const match = /^(\d+)(.*)$/.exec(value);
    if (!match) return;

    const target = Number(match[1]);
    const suffix = match[2];
    // Counting to zero is a one-frame animation that reads as a glitch. The
    // "0 paid placements" figure is also the one whose whole point is that it
    // has never moved, so it should not appear to.
    if (target === 0) return;

    let frame = 0;
    let start = 0;

    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION_MS);
      el.textContent = `${Math.round(easeOut(t) * target)}${suffix}`;
      if (t < 1) frame = requestAnimationFrame(step);
    };

    // Held back so the figure starts moving as its row finishes rising in,
    // rather than counting under a block that is still fading.
    const timer = window.setTimeout(() => {
      el.textContent = `0${suffix}`;
      frame = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      // Whatever the count reached, the authored value is what stays.
      el.textContent = value;
    };
  }, [value, delayMs]);

  return <span ref={ref}>{value}</span>;
}
