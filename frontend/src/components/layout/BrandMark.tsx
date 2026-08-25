import Image from "next/image";

/**
 * The SortedChoice logo mark.
 *
 * ---------------------------------------------------------------------------
 * WHY BOTH CUTS ARE IN THE DOM
 *
 * The supplied artwork is monochrome on transparency: `mark-dark.png` is
 * near-black ink, `mark-light.png` near-white. Neither survives both palettes —
 * the dark cut disappears against the dark surface, the light cut against
 * paper — so both are rendered and globals.css shows exactly one.
 *
 * The obvious alternatives were both worse:
 *
 *   - `<picture>` with `<source media="(prefers-color-scheme: dark)">` reads the
 *     OS, and this site's theme is an attribute on <html> that the reader sets.
 *     Those two disagree constantly, and the browser wins an argument CSS
 *     cannot re-enter.
 *   - Swapping `src` on the client needs the resolved theme, which needs an
 *     effect, which means the mark is absent on the server render and pops in.
 *     The header is the first thing painted; it does not get to flicker.
 *
 * The cost is one extra request for an image that is never shown. next/image
 * resizes both to the display size and serves AVIF/WebP, so each cut lands
 * around a kilobyte — cheaper than the layout shift the alternatives buy.
 *
 * ---------------------------------------------------------------------------
 * `priority`
 *
 * On by default because every mount of this component is above the fold — the
 * header bar, and the footer's brand block on short documents. Lazy-loading a
 * logo is how you get a header that assembles itself in two stages.
 *
 * The alt text is empty on purpose. Both cuts sit inside a link that already
 * says "SortedChoice" in words; naming the image too makes a screen reader read
 * the brand twice for one control.
 */
export function BrandMark({
  size = 30,
  className = "",
  priority = true,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const common = {
    alt: "",
    width: size,
    height: size,
    priority,
    // Told explicitly, because the intrinsic asset is 512px square and next/image
    // would otherwise request a candidate sized for the layout column.
    sizes: `${size}px`,
    className: "h-full w-full object-contain",
  };

  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="brand-mark-dark h-full w-full">
        <Image src="/brand/mark-dark.png" {...common} />
      </span>
      <span className="brand-mark-light h-full w-full">
        <Image src="/brand/mark-light.png" {...common} />
      </span>
    </span>
  );
}
