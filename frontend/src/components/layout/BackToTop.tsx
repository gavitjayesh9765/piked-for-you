"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * THE ASCENT DIAL — the site-wide "back to top" control.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A FLOATING ARROW CHIP
 *
 * The generic version of this control is a purple circle with a chevron in it.
 * It appears, it does one thing, and while it sits there it tells the reader
 * nothing. On a catalogue where a category page is four screens of grid and a
 * product page is nine, the question a reader actually has at the bottom of a
 * scroll is not "how do I get back" — it is "how much of this is left".
 *
 * So the control answers both. The ring around it IS the reading position: a
 * purple arc that fills as the document scrolls, with a lit head riding its
 * leading edge. Returning to the top drains it. One object, two jobs, and the
 * one it does passively is the one it does most of the time.
 *
 * Everything else here is in service of it not feeling like a widget:
 *
 *   GLASS, NOT FILL   The disc uses the same backdrop treatment as the nav
 *                     (`--c-glass` + blur/saturate), so it reads as chrome
 *                     floating over the page rather than a sticker dropped on
 *                     top of it. Over a photo grid it picks up the photos;
 *                     over the footer it goes quiet.
 *
 *   MAGNETISM         Within ~120px the disc leans toward the cursor, at most
 *                     ~9px, easing at `--d-fast`. This is the detail that makes
 *                     it feel like an object rather than a rectangle: the
 *                     target appears to want the click before it gets one.
 *                     Pointer-fine devices only, and off under reduced motion.
 *
 *   THE CONVEYOR      On hover the arrow travels up and out of a clipped box
 *                     while an identical arrow enters from below. The glyph
 *                     performs the verb.
 *
 *   DOCKING           It watches the footer (and anything marked
 *                     `data-dock-obstacle`) and lifts to sit above it instead
 *                     of covering it. A fixed control that hides the affiliate
 *                     disclosure or an admin save bar is a bug, not a flourish.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SCROLL WORK IS NOT IN REACT STATE
 *
 * Progress and dock offset change on every animation frame. Routing those
 * through `useState` would re-render a component on every frame of every
 * scroll, on every page of the site, forever. Instead the frame loop writes CSS
 * custom properties straight to the node — `--totop-p`, `--totop-lift`, and the
 * magnet's `--totop-x/y` — and CSS does the painting. React state holds exactly
 * one thing: the boolean "is it on screen", which changes twice per page visit.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SCROLL IS TWEENED BY HAND
 *
 * `scrollTo({ behavior: "smooth" })` exists, and it is wrong here for two
 * reasons. Its duration is UA-chosen and grows with distance, so from the
 * bottom of a long category page it is multiple seconds of nothing to do. And
 * its curve is not this site's curve — every other motion on the page is
 * `--ease`, `cubic-bezier(0.32, 0.72, 0, 1)`, which leaves fast and lands soft.
 *
 * The tween below uses that exact curve (solved in JS — see `ease`), with a
 * distance-scaled duration clamped to 420–900ms, and — the part the native
 * behaviour genuinely cannot do — **it aborts the moment the reader touches the
 * wheel, the screen, or a key.** Hijacking a scroll is only acceptable if the
 * reader can take it back instantly.
 */

/** Scrolled past this many viewport heights → the dial arrives. */
const REVEAL_AT = 0.9;
/** …and it does not leave until back under this. The gap is hysteresis: without
 *  it, a page parked exactly on the threshold flickers on every nudge. */
const HIDE_AT = 0.6;

/** Cursor distance, in px, at which the disc starts to lean. */
const MAGNET_RADIUS = 120;
/** Fraction of the cursor offset the disc travels. Peaks near ~9px. */
const MAGNET_PULL = 0.28;

/** Clearance kept between the dial and whatever it docks above. */
const DOCK_GAP = 12;
/** Obstacles it refuses to cover. `footer` is every public page; the attribute
 *  is for the fixed bars only some screens raise (the admin save bar). */
const OBSTACLES = "footer, [data-dock-obstacle]";
/** Re-scan interval for those, in ms. They come and go — a save bar appears
 *  when a form goes dirty — so a mount-time query would go stale. Three or four
 *  cheap selector queries a second is still far below one per frame. */
const OBSTACLE_RESCAN_MS = 300;

export function BackToTop() {
  const gradientId = useId();
  const rootRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  /** Abort handle for an in-flight glide, so unmount and re-click can stop it. */
  const glideRef = useRef<(() => void) | null>(null);

  /* ---------------------------------------------------------------------
     THE FRAME LOOP — progress, arrival, docking.
     One `requestAnimationFrame` coalesces however many scroll events the
     browser fires between paints; `frame` doubles as the "already queued" flag.
     --------------------------------------------------------------------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    let shown = false;
    let lift = 0;
    let obstacles: Element[] = [];
    let scannedAt = -Infinity;

    const read = () => {
      frame = 0;

      const vh = window.innerHeight;
      const y = window.scrollY;
      const travel = document.documentElement.scrollHeight - vh;

      // Progress, 0–100. A page shorter than the viewport has no travel and
      // must not divide by zero into a NaN that poisons the dash array.
      const pct = travel > 0 ? Math.min(100, Math.max(0, (y / travel) * 100)) : 0;
      root.style.setProperty("--totop-p", pct.toFixed(2));

      const next = shown ? y > vh * HIDE_AT : y > vh * REVEAL_AT;
      if (next !== shown) {
        shown = next;
        setVisible(next);
      }

      const now = performance.now();
      if (now - scannedAt > OBSTACLE_RESCAN_MS) {
        scannedAt = now;
        obstacles = Array.from(document.querySelectorAll(OBSTACLES));
      }

      // The resting bottom edge, in viewport coordinates. Derived from the
      // node's own rect plus the lift currently applied to it, rather than from
      // a hardcoded offset — that way `env(safe-area-inset-bottom)` and the
      // responsive size are accounted for without this file knowing them.
      const floor = root.getBoundingClientRect().bottom + lift;

      let want = 0;
      for (const el of obstacles) {
        const top = el.getBoundingClientRect().top;
        if (top < floor) want = Math.max(want, floor - top + DOCK_GAP);
      }
      // Capped: a full-height obstacle must not launch the dial off the top.
      lift = Math.min(want, vh * 0.5);
      root.style.setProperty("--totop-lift", `${lift.toFixed(1)}px`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* ---------------------------------------------------------------------
     MAGNETISM — only while the dial is on screen, only where a cursor exists,
     and never against a stated preference for less motion.
     --------------------------------------------------------------------- */
  useEffect(() => {
    const root = rootRef.current;
    if (!visible || !root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = 0;
      const r = root.getBoundingClientRect();
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      // Falls off linearly to zero at the radius, so the disc settles rather
      // than snapping back when the cursor leaves.
      const near = dist < MAGNET_RADIUS ? 1 - dist / MAGNET_RADIUS : 0;

      root.style.setProperty("--totop-near", near.toFixed(3));
      root.style.setProperty("--totop-x", `${(dx * MAGNET_PULL * near).toFixed(2)}px`);
      root.style.setProperty("--totop-y", `${(dy * MAGNET_PULL * near).toFixed(2)}px`);
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      root.style.setProperty("--totop-near", "0");
      root.style.setProperty("--totop-x", "0px");
      root.style.setProperty("--totop-y", "0px");
    };
  }, [visible]);

  /** Stop any glide left running when the component goes away. */
  useEffect(() => () => glideRef.current?.(), []);

  const glide = useCallback(() => {
    // Cancel a glide already in flight rather than racing two tweens for the
    // same scroll position.
    glideRef.current?.();

    const from = window.scrollY;
    if (from <= 0) return;

    /**
     * Move focus to the top of the DOCUMENT, not just the viewport.
     *
     * Without this the reader is looking at the masthead while their focus is
     * still on a button pinned to the bottom corner, so the next Tab resumes
     * from the footer — the scroll happened and the keyboard did not follow.
     * `#main` is the skip-link target that already exists on every page;
     * `preventScroll` stops the focus call from re-scrolling.
     */
    const focusTop = () => {
      const main = document.getElementById("main");
      if (!main) return;
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      focusTop();
      return;
    }

    // ~0.35ms per pixel, so a short page snaps and a long one still lands
    // inside a second.
    const duration = Math.min(900, Math.max(420, from * 0.35));
    const started = performance.now();
    let cancelled = false;

    const stop = () => {
      cancelled = true;
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      glideRef.current = null;
    };
    glideRef.current = stop;

    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });

    const step = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - started) / duration);
      // `instant` is load-bearing: <html> carries `scroll-behavior: smooth`, so
      // a default scrollTo would smooth-animate toward each frame's target and
      // the two curves would fight.
      window.scrollTo({ top: from * (1 - ease(t)), behavior: "instant" as ScrollBehavior });
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        stop();
        focusTop();
      }
    };

    requestAnimationFrame(step);
  }, []);

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={glide}
      // Not `visible ? render : null` — the dial has an exit as well as an
      // entrance, and an unmounted node cannot play one. `inert` is what makes
      // the parked state honest: no tab stop, no pointer target, nothing
      // announced, while the element stays around to animate.
      inert={!visible}
      data-visible={visible}
      aria-label="Back to top"
      className="totop"
    >
      <span className="totop__body">
        <svg className="totop__ring" viewBox="0 0 36 36" aria-hidden="true">
          <defs>
            {/* Two stops of the SAME brand hue. The palette reserves orange for
                outbound-to-retailer and green for value, and this control is
                neither — it is chrome. Depth comes from luminance, not from a
                second colour. */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--c-brand)" />
              <stop offset="100%" stopColor="var(--c-brand-vivid)" />
            </linearGradient>
          </defs>
          <circle className="totop__track" cx="18" cy="18" r="15.5" pathLength={100} />
          {/* `pathLength={100}` renormalises the circumference so the dash
              figures in CSS are a plain 0–100 percentage — the same trick the
              SortedChoice score ring uses, kept identical on purpose. */}
          <circle
            className="totop__arc"
            cx="18"
            cy="18"
            r="15.5"
            pathLength={100}
            stroke={`url(#${gradientId})`}
          />
        </svg>

        {/* The lit head of the arc. A rotation of the whole layer, so its
            position is `progress × 3.6°` and needs no trigonometry in JS. */}
        <span className="totop__comet" aria-hidden="true" />

        <span className="totop__glyph" aria-hidden="true">
          <span className="totop__glyphTrack">
            <Arrow />
            <Arrow />
          </span>
        </span>

        <span className="totop__pill" aria-hidden="true">
          Back to top
        </span>
      </span>
    </button>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

/**
 * `cubic-bezier(0.32, 0.72, 0, 1)` — the value of `--ease` in tokens.css,
 * evaluated in JavaScript so the tweened scroll matches every CSS transition on
 * the site instead of merely resembling one.
 *
 * A CSS timing function is a Bézier curve whose x axis is time, so you cannot
 * read y off it directly: you first have to find the parameter u at which x(u)
 * equals the elapsed fraction. Newton converges in a handful of steps because
 * the curve is monotonic in x; the derivative guard catches the flat spot near
 * u = 1 that would otherwise divide by ~0.
 */
function ease(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const x1 = 0.32;
  const y1 = 0.72;
  const x2 = 0;
  const y2 = 1;

  // B(u) and B'(u), with the endpoints fixed at P0 = 0 and P3 = 1.
  const bez = (u: number, p1: number, p2: number) =>
    3 * (1 - u) * (1 - u) * u * p1 + 3 * (1 - u) * u * u * p2 + u * u * u;
  const slope = (u: number, p1: number, p2: number) =>
    3 * (1 - u) * (1 - u) * p1 + 6 * (1 - u) * u * (p2 - p1) + 3 * u * u * (1 - p2);

  let u = t;
  for (let i = 0; i < 6; i++) {
    const dx = bez(u, x1, x2) - t;
    if (Math.abs(dx) < 1e-5) break;
    const d = slope(u, x1, x2);
    if (Math.abs(d) < 1e-6) break;
    u -= dx / d;
  }

  return bez(Math.min(1, Math.max(0, u)), y1, y2);
}
