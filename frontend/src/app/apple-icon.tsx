import { ImageResponse } from "next/og";

/**
 * Apple touch icon — the tile iOS uses for "Add to Home Screen".
 *
 * A separate file rather than a second size on app/icon.tsx, because the two
 * have genuinely different constraints. iOS composites this at 180px onto a
 * rounded rect of its own and does NOT honour transparency, so the artwork must
 * bleed to the edges with no rounding of its own — rounding here would show as
 * a visible light halo inside Apple's own corner radius.
 *
 * At 180px the monogram can also carry more weight than the 32px favicon does,
 * so it is scaled up proportionally rather than reused.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#6c5ce7",
          color: "#ffffff",
          fontSize: 118,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        S
      </div>
    ),
    size,
  );
}
