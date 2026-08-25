import { ImageResponse } from "next/og";

/**
 * Favicon (spec §47 — the "clean, complete public surface" end of it).
 *
 * Generated for the same reason the OG card is: there is no `public/` directory
 * and no exported brand asset. Before this, every tab showed the browser's
 * blank-page glyph, and a bookmarked page was indistinguishable from any other.
 *
 * The mark is the wordmark's initial in the brand purple — a monogram, because
 * at 32px nothing else survives. Do NOT add the tri-colour rule from the OG
 * card here; three stripes across 32 pixels reads as noise, not as a brand.
 *
 * Next serves this at /icon and emits the <link rel="icon"> automatically, so
 * nothing in app/layout.tsx needs to reference it.
 *
 * `/icon.png` is also what the Organization JSON-LD on the homepage points its
 * `logo` at. If this file is ever replaced with a static asset, that reference
 * in app/(site)/page.tsx has to move with it.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // The vivid brand hue, not the text-safe one: this is a fill, and it
          // is never asked to carry text contrast against the page.
          backgroundColor: "#6c5ce7",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          // Squircle-ish. A full circle loses too much of the glyph's corner
          // weight once the browser downsamples to 16px.
          borderRadius: 7,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
