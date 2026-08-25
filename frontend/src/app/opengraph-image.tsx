import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The default social card (spec §47).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS GENERATED RATHER THAN A FILE
 *
 * There is no `public/` directory in this project and no exported brand asset
 * to put in one. The alternative to generating the card was shipping nothing,
 * which is what was happening: the root metadata declared `openGraph` with a
 * type, a site name and a locale but no `images`, so every share of this site
 * on WhatsApp, Slack, X or LinkedIn rendered a grey placeholder box.
 *
 * That is a ranking-adjacent problem rather than a ranking one — no crawler
 * scores you on it — but it is the single highest-leverage fix for click-through
 * on shared links, and a product-research site is shared by definition.
 *
 * ---------------------------------------------------------------------------
 * SCOPE
 *
 * Living at the app root, this is inherited by every route that does not define
 * its own. Product pages DO define their own — they set `openGraph.images` to
 * the product photograph in `generateMetadata`, which is strictly better than a
 * generic card, and an explicit `images` array overrides this file.
 *
 * So this is the card for the homepage, the category and brand indexes, and the
 * trust documents: everything whose subject is the site itself.
 *
 * ---------------------------------------------------------------------------
 * CONSTRAINTS THIS FILE WORKS UNDER
 *
 *   - Satori (what `ImageResponse` renders with) supports a deliberate subset
 *     of CSS. Flexbox works; grid, floats and most shorthand do not. Every
 *     element with more than one child needs an explicit `display: "flex"`.
 *   - No external requests. Fonts are the usual trap here — pulling a webfont
 *     would add a network dependency to a route that must never fail — so this
 *     uses the renderer's built-in font stack and leans on weight, scale and
 *     colour for the typography instead.
 *   - Colours are hardcoded hex, copied from styles/tokens.css. CSS custom
 *     properties do not resolve in this renderer, and the card has no theme to
 *     follow — it is always the light brand palette, wherever it is unfurled.
 */


/** The OG standard. 1.91:1 — every consumer crops to roughly this. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

/* Tokens, resolved by hand. See the note above on why these are literals. */
const BG = "#f4f1ed";
const INK = "#16161a";
const INK_MUTED = "#4a4856";
const BRAND = "#6c5ce7";
const RETAIL = "#ff6b35";
const VALUE = "#16a34a";
const LINE = "#e0dad3";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          padding: "72px 80px",
        }}
      >
        {/* The three brand hues as a rule across the top. Cheap, recognisable,
            and it does the job a logo would do without inventing one. */}
        <div style={{ display: "flex", height: 10, width: 220 }}>
          <div style={{ flex: 2, backgroundColor: BRAND }} />
          <div style={{ flex: 1, backgroundColor: RETAIL }} />
          <div style={{ flex: 1, backgroundColor: VALUE }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              color: INK,
              // Tight tracking is the display voice from the type system
              // (docs/01-design-brainstorm.md §5). Satori honours this.
              letterSpacing: "-0.035em",
              lineHeight: 1,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 38,
              color: INK_MUTED,
              letterSpacing: "-0.01em",
              lineHeight: 1.3,
              // Held short of the full width so the line breaks where the
              // sentence does, not where the canvas ends.
              maxWidth: 820,
            }}
          >
            {/* One interpolation, not `{SITE_TAGLINE}.` — that is an expression
                AND a text node, so Satori sees a div with two children and
                refuses to lay it out without an explicit `display`. It fails
                the whole image with "Expected <div> to have explicit display:
                flex ... if it has more than one child node", which reads like a
                CSS problem and is actually a JSX one. */}
            {`${SITE_TAGLINE}.`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            borderTop: `2px solid ${LINE}`,
            paddingTop: 28,
            fontSize: 24,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: INK_MUTED,
            fontWeight: 600,
          }}
        >
          <span>Independent research</span>
          <span style={{ color: LINE }}>/</span>
          <span>No sponsored verdicts</span>
        </div>
      </div>
    ),
    size,
  );
}
