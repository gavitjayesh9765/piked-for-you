import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The default social card (spec §47).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS GENERATED RATHER THAN A FILE
 *
 * The alternative was shipping nothing, which is what was happening: the root
 * metadata declared `openGraph` with a type, a site name and a locale but no
 * `images`, so every share of this site on WhatsApp, Slack, X or LinkedIn
 * rendered a grey placeholder box.
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
 *     colour for the typography instead. The logo is read off disk and inlined
 *     as a data URI for the same reason: an <img> pointing at our own /brand/
 *     path would make the card depend on the deployment being up to render the
 *     deployment's own card.
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

/**
 * The mark, inlined once per cold start rather than once per request.
 *
 * The dark-ink cut, because this card is always the light palette — see above.
 *
 * ⚠ WRAPPED IN try/catch ON PURPOSE, and the fallback is not decoration.
 * `process.cwd()` is reliable in dev and during the build, but this file also
 * has to survive being traced into a serverless bundle, and a `public/` asset
 * arriving there is a property of the deploy platform rather than of this code.
 * If the read ever fails, the card should lose its logo and keep its text —
 * a share preview with no mark is a cosmetic problem, a route that throws is a
 * grey box on every shared link, which is the exact failure this file exists to
 * fix.
 */
function inlinePublicImage(...segments: string[]): string | null {
  const file = segments[segments.length - 1];
  const mime = file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  try {
    const bytes = readFileSync(join(process.cwd(), "public", ...segments));
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

const markDataUri = inlinePublicImage("brand", "mark-dark.png");

/**
 * THE COVER PLATE — the artwork behind the card, and the only part of this file
 * meant to be changed by dropping in a file rather than editing code.
 *
 * Put a 1200×630 image at `public/brand/og-cover.png` (or `.jpg`) and it
 * becomes the backdrop of every site-level share preview. Remove it and the
 * card silently reverts to the flat brand-cream background it had before. That
 * is deliberate: the artwork is an upgrade to this card, never a dependency of
 * it, and a missing or unreadable file must not turn a share preview into a
 * grey box — the exact failure this whole route exists to prevent.
 *
 * ⚠ THE ARTWORK CARRIES NO TEXT. Everything readable on this card — the
 * wordmark, the tagline, the trust line — is drawn in JSX below, on top of the
 * plate. Two reasons, and both bite in practice:
 *
 *   1. The tagline and title live in `lib/site.ts` and get rewritten as the
 *      positioning sharpens. Text baked into a raster is text that silently
 *      goes stale, and nobody re-exports a PNG to fix a comma.
 *   2. Image generators render lettering as convincing gibberish at this size.
 *      A card is read at thumbnail scale in a chat client; broken glyphs in the
 *      brand name is worse than no card at all.
 *
 * The plate is composed for this: quiet on the left, subject weighted right,
 * with the scrim below carrying the left half back to near-solid cream so the
 * type sits on flat colour regardless of what the artwork does underneath.
 *
 * Export at exactly 1200×630 and keep it under ~500KB. The file is read and
 * base64-inlined once per cold start, so its bytes are paid for in cold-start
 * latency and in resident memory on every instance — a 6MB export is not a
 * bigger picture at this size, it is a slower route rendering the same card.
 * `.jpg` is the right format for photography here; `.png` for flat artwork.
 */
const coverDataUri =
  inlinePublicImage("brand", "og-cover.png") ?? inlinePublicImage("brand", "og-cover.jpg");

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // Stays underneath the plate as the matte for any transparency, and
          // becomes the whole background when there is no plate.
          backgroundColor: BG,
          padding: "72px 80px",
        }}
      >
        {/* An ARRAY, not a fragment. Satori's tree walker is not React's — it
            handles arrays of children, and `<>…</>` is the kind of thing that
            either renders nothing or throws depending on the version. Two keyed
            siblings cost a line and cannot surprise anyone.

            Also note these are the plate and its scrim as two elements rather
            than one div with a stacked `backgroundImage`. The stacked version
            is tempting and is a trap: CSS splits background layers on commas,
            and a base64 data URI carries a comma right after `;base64`, so the
            layer parser tears the image in half. */}
        {coverDataUri
          ? [
              // Full-bleed, and `cover` rather than a stretch — a plate exported
              // at the wrong aspect should crop, not distort.
              // eslint-disable-next-line @next/next/no-img-element -- Satori raster; next/image is meaningless here.
              <img
                key="plate"
                src={coverDataUri}
                alt=""
                width={size.width}
                height={size.height}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: size.width,
                  height: size.height,
                  objectFit: "cover",
                }}
              />,
              // The scrim, and the reason this card stays legible against
              // artwork nobody has reviewed yet. Solid cream across the left
              // where the type sits, then a long ramp to clear so the right of
              // the plate is untouched. Ramped over ~44% of the width because a
              // short gradient reads as a hard seam down the middle.
              <div
                key="scrim"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: size.width,
                  height: size.height,
                  backgroundImage: `linear-gradient(90deg, ${BG} 0%, ${BG} 44%, rgba(244,241,237,0.82) 62%, rgba(244,241,237,0) 88%)`,
                }}
              />,
            ]
          : null}

        {/* The lockup: mark + wordmark, which is the one place on this card the
            brand is stated as itself rather than described. */}
        {/* `position: relative` on all three content blocks below is not
            layout — it is paint order. Absolutely positioned siblings otherwise
            sit above in-flow ones, which would put the scrim over the type. */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 26 }}>
          {markDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders
            // this to a raster; next/image has no meaning inside ImageResponse.
            <img src={markDataUri} width={96} height={96} alt="" />
          ) : (
            // The three brand hues as a rule. Cheap, recognisable, and it holds
            // the lockup's shape when the artwork could not be read.
            <div style={{ display: "flex", height: 10, width: 220 }}>
              <div style={{ flex: 2, backgroundColor: BRAND }} />
              <div style={{ flex: 1, backgroundColor: RETAIL }} />
              <div style={{ flex: 1, backgroundColor: VALUE }} />
            </div>
          )}
          <div
            style={{
              fontSize: 62,
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
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            fontSize: coverDataUri ? 52 : 58,
            fontWeight: 700,
            color: INK,
            letterSpacing: "-0.025em",
            lineHeight: 1.18,
            // Held short of the full width so the line breaks where the
            // sentence does, not where the canvas ends — and held far shorter
            // when there is a plate, so the tagline stays inside the opaque
            // stretch of the scrim instead of running out over the artwork.
            maxWidth: coverDataUri ? 620 : 940,
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

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 20,
            // The rule is drawn only as wide as the trust line needs when a
            // plate is present. A full-bleed 2px rule laid across photography
            // reads as a rendering artefact rather than as typography.
            // 840 is measured, not chosen: the two labels plus the separator
            // and gaps come to ~790px at this size and tracking, and anything
            // tighter wraps "NO SPONSORED VERDICTS" onto a second line.
            width: coverDataUri ? 840 : "100%",
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
