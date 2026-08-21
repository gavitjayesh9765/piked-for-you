"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary, for a throw in the ROOT LAYOUT itself.
 *
 * `error.tsx` renders inside the layout, so it cannot catch a layout that
 * failed. This replaces the whole document instead — which is why it has to
 * ship its own <html> and <body>, and why it cannot use the design system:
 * `globals.css` is imported by the layout that just died.
 *
 * Every colour here is therefore inlined and theme-aware by media query
 * rather than by token. Do not "tidy" this to use Tailwind classes; on the
 * path where this file renders, the stylesheet may not exist.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error.digest ?? error.message, error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#f4f1ed",
          color: "#16161a",
        }}
      >
        {/* The token layer is unavailable here, so dark mode is a raw media
            query. Matches --c-bg / --c-ink from styles/tokens.css. */}
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #0a0a0a !important; color: #f5f3f2 !important; }
            a, button { border-color: #2a2a2a !important; }
          }
        `}</style>

        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Something went badly wrong.
        </h1>

        <p style={{ maxWidth: "32rem", lineHeight: 1.6, opacity: 0.75, margin: 0 }}>
          The site failed to start. This is on us, not you — please try again in
          a moment.
        </p>

        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "9999px",
            border: "none",
            background: "#6c5ce7",
            color: "#ffffff",
            fontSize: "0.8125rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Try again
        </button>

        {error.digest && (
          <p style={{ marginTop: "1.5rem", fontSize: "0.6875rem", opacity: 0.5, fontFamily: "ui-monospace, monospace" }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
