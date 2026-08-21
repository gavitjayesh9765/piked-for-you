"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaAsset } from "@/lib/types";

const ZOOM = 2.4;

/**
 * Product gallery (spec §18, §19).
 *
 * Images and linked videos share one filmstrip, because to a reader deciding
 * what to buy they are the same thing: another look at the product. A video
 * tile carries a play badge and the provider's poster frame.
 *
 * Videos are **embeds, not uploads** — the iframe src is built server-side from
 * a validated (provider, id) pair, and the CSP `frame-src` lists only YouTube
 * and Vimeo, so an injected iframe pointing anywhere else is blocked.
 *
 * Interactions:
 *  - **Cursor-tracked zoom** on images. Fine pointers only — on touch there is
 *    no hover to leave, and a magnified image you cannot pan out of is a trap.
 *  - **Prev / next** with wrap-around, plus arrow keys when focused and a
 *    horizontal swipe on touch.
 */
export function Gallery({ images, title }: { images: MediaAsset[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [canZoom, setCanZoom] = useState(false);

  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = images.length;
  const current = images[active];
  const isVideo = current?.kind === "video_link" || current?.kind === "video";

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setCanZoom(mq.matches && !reduce.matches);
    sync();
    mq.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setZooming(false);
      setPlaying(false);
      setActive((i) => (i + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    thumbRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!canZoom || isVideo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  /**
   * Horizontal swipe on touch.
   *
   * The arrows are always visible below `md`, but a gallery that does not
   * respond to a swipe reads as broken on a phone regardless of what else is
   * on screen. Pointer Events rather than Touch Events so a stylus and a
   * trackpad drag work too.
   *
   * The gesture is claimed only once it is unambiguously horizontal: a swipe
   * that has travelled further vertically is the reader scrolling the page
   * past the gallery, and stealing it would trap them on the image.
   */
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const SWIPE_MIN = 44;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  }

  if (!count) {
    return (
      <div className="plate dot-matrix grid aspect-[4/3] w-full place-items-center rounded-lg border border-line">
        <div className="text-center">
          <ImageGlyph />
          <p className="mt-3 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
            No images yet
          </p>
        </div>
      </div>
    );
  }

  return (
    // `min-w-0`: as a grid item this column defaults to `min-width: auto`, so
    // the filmstrip's intrinsic width (one 96px thumbnail per image) would set
    // the column's floor and push the whole product page wider than a phone.
    //
    // From `lg` the filmstrip becomes a vertical rail beside the frame rather
    // than a strip under it (the Amazon/Flipkart pattern): every alternate view
    // is then visible without a scroll, and the frame keeps the height it was
    // going to have anyway. `flex-row-reverse` puts the rail on the left while
    // leaving the frame first in the DOM, so reading and tab order still reach
    // the product before the list of other angles at it.
    //
    // `sticky` is the other half of this. The decision column beside it is
    // usually the taller of the two, and a product image that scrolls away
    // while you are still reading the price is the thing that left dead space
    // under the gallery in the first place. Capped to the visible area below
    // the nav, because an element taller than the viewport cannot stick.
    <div
      className="flex min-w-0 flex-col gap-3 lg:sticky lg:flex-row-reverse lg:items-start
                 lg:self-start lg:top-[calc(var(--nav-h)_+_var(--subnav-h)_+_1.5rem)]"
    >
      {/* --- Main frame --- */}
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`${title} media`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        className="plate group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   lg:min-w-0 lg:flex-1
                   lg:max-h-[calc(100vh_-_var(--nav-h)_-_var(--subnav-h)_-_5rem)]"
        style={{ outlineColor: "var(--c-focus)" }}
      >
        {isVideo && playing && current.embedUrl ? (
          <iframe
            src={`${current.embedUrl}?autoplay=1&rel=0`}
            title={current.title || `${title} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : isVideo ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${current.title || "video"}`}
            className="absolute inset-0 grid place-items-center"
          >
            {current.thumbnailUrl ? (
              <Image
                src={current.thumbnailUrl}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
              />
            ) : (
              <div className="dot-matrix absolute inset-0" />
            )}
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-surface-0/90 shadow-e3 backdrop-blur-sm transition-transform duration-fast group-hover:scale-105">
              <PlayGlyph />
            </span>
            {current.title && (
              <span className="absolute bottom-3 left-3 max-w-[70%] truncate rounded-full border border-line bg-surface-0/85 px-3 py-1 text-label-xs text-ink backdrop-blur-sm">
                {current.title}
              </span>
            )}
          </button>
        ) : (
          <div
            className={cn("absolute inset-0", canZoom && "cursor-zoom-in")}
            onMouseEnter={() => canZoom && setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={onMove}
          >
            <Image
              key={current.id}
              src={current.url}
              alt={current.alt ?? `${title} — image ${active + 1} of ${count}`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-contain p-5 transition-transform duration-slow ease-ease will-change-transform sm:p-8"
              style={{
                transformOrigin: `${origin.x}% ${origin.y}%`,
                transform: zooming ? `scale(${ZOOM})` : "scale(1)",
              }}
            />
          </div>
        )}

        {canZoom && !zooming && !isVideo && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full
                       border border-line bg-surface-0/85 px-2.5 py-1 font-label text-label-xs uppercase
                       tracking-[0.1em] text-ink-subtle opacity-0 backdrop-blur-sm transition-opacity
                       duration-fast group-hover:opacity-100"
          >
            <ZoomGlyph /> Hover to zoom
          </span>
        )}

        {count > 1 && !playing && (
          <>
            <ArrowButton side="left" onClick={() => go(-1)} />
            <ArrowButton side="right" onClick={() => go(1)} />
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-line bg-surface-0/85 px-2.5 py-1 font-mono text-label-xs tabular-nums text-ink-muted backdrop-blur-sm">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>

      {/* --- Filmstrip: images and videos together. Horizontal under the frame
             on a phone, a vertical rail beside it from `lg`. --- */}
      {count > 1 && (
        <div
          className="flex gap-3 overflow-x-auto pb-1 lg:w-[4.5rem] lg:shrink-0 lg:flex-col
                     lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0
                     lg:max-h-[calc(100vh_-_var(--nav-h)_-_var(--subnav-h)_-_5rem)]
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((m, i) => {
            const video = m.kind === "video_link" || m.kind === "video";
            const src = video ? m.thumbnailUrl : m.url;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setZooming(false);
                  setActive(i);
                }}
                aria-label={
                  video ? `Video ${m.title ?? i + 1}` : `View image ${i + 1} of ${count}`
                }
                aria-current={i === active}
                className={cn(
                  "plate relative h-20 w-24 shrink-0 overflow-hidden rounded-sm border-2 transition-colors duration-fast lg:h-[4.5rem] lg:w-full",
                  i === active ? "border-brand-vivid" : "border-line hover:border-line-strong",
                )}
              >
                {src ? (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 72px, 96px"
                    className={video ? "object-cover" : "object-contain p-2"}
                  />
                ) : (
                  <span className="dot-matrix absolute inset-0" />
                )}
                {video && (
                  <span className="absolute inset-0 grid place-items-center bg-scrim/30">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-0/90">
                      <PlayGlyph small />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArrowButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full",
        "border border-line bg-surface-0/90 text-ink shadow-e2 backdrop-blur-sm",
        "transition-all duration-fast ease-ease hover:border-brand hover:text-brand",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {side === "left" ? <path d="m15 5-7 7 7 7" /> : <path d="m9 5 7 7-7 7" />}
      </svg>
    </button>
  );
}

function PlayGlyph({ small }: { small?: boolean }) {
  const s = small ? 12 : 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-0.5 text-ink">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function ZoomGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.7-4.7M10.5 8v5M8 10.5h5" />
    </svg>
  );
}

function ImageGlyph() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mx-auto text-ink-faint"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m3 16.5 4.5-4.5 4 4 3-3L21 18" />
    </svg>
  );
}
