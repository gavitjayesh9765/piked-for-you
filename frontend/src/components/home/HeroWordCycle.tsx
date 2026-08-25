"use client";

import { useEffect, useRef } from "react";

/**
 * The second word of the hero headline: "Start deciding / choosing / shopping."
 *
 * "Start" is static — only this word swaps, and it swaps through the same
 * dot-matrix halftone the headline already wears, so the effect reads as the
 * type dissolving into the page's own texture rather than as a new decoration.
 *
 * COST: the whole cycle is three CSS animations on three spans (plus two dot
 * layers each, as pseudo-elements — no extra DOM). Only `opacity` and
 * `transform` move, so it stays on the compositor: no canvas, no particles, no
 * per-frame JavaScript, nothing that touches layout or the main thread.
 *
 * The only JavaScript is the listener below. Animations on a background tab
 * still burn frames in some engines, so visibility flips one attribute and CSS
 * parks every keyframe on `animation-play-state: paused`. It fires on tab
 * switches only — it is not a loop.
 *
 * ACCESSIBILITY: assistive tech gets one stable sentence; the rotating stack is
 * hidden from it. `prefers-reduced-motion` drops straight to the first word with
 * no dots and no movement (see globals.css).
 */
const WORDS = ["deciding.", "choosing.", "shopping."];

export function HeroWordCycle() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      el.dataset.paused = document.hidden ? "true" : "false";
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <span className="word-cycle" ref={ref}>
      {/* Read once, and read as the line the page was written around. */}
      <span className="sr-only">deciding.</span>
      <span className="word-cycle__stack" aria-hidden="true">
        {WORDS.map((word) => (
          <span className="word-cycle__word" key={word}>
            {word}
          </span>
        ))}
      </span>
    </span>
  );
}
