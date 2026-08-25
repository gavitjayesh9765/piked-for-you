# SortedChoice — Design Brainstorm & Direction

> Grounded in: `SortedChoice_Master_Product_Architecture_Specification.md` (§50, §51),
> the Stitch design system **PickD Visual Identity** (`assets/b24f8bb197aa4a248de46ff47576f6c1`),
> and the five generated Stitch screens in `stitch_sortedchoice_design_system/`.

---

## 1. The product in one line

> **The decision layer between the user and the marketplace.**

Everything in the design has to serve one job: take a person who is *overwhelmed by
choice* and hand them a *defensible decision* in minutes. Not a catalog. Not a store.
A verdict.

This has a direct design consequence, and it is the single most important one:

**The interface must never look like it is selling. It must look like it is reporting.**

Amazon and Flipkart are dense, loud, and optimized for listing. SortedChoice is the
opposite: an *editorial research desk* that happens to link out to retailers. Think
The Wirecutter, rendered with the industrial design language of Nothing and the spatial
generosity of Apple.

---

## 2. Reading the Stitch direction

The Stitch system nailed the personality. Distilled, it is:

| Ingredient | Share | What it actually contributes |
|---|---|---|
| Apple minimalism | 70% | Air, hairlines instead of shadows, one idea per screen region |
| Nothing technicality | 20% | Mono labels, dot-matrix, exposed structure, tabular numerals |
| Utility commerce | 10% | Explicit CTAs, price clarity, comparison density where it earns it |

The emotional target is **effortless authority** — the machinery behind a
recommendation is complex, the presentation is not.

### The one idea worth protecting above all others

The Stitch guidelines encode a **color-as-grammar** rule, and it is genuinely good:

```
PURPLE  #6C5CE7   ->  DECIDING.  Our intelligence. Scores, verdicts, PickD moments.
ORANGE  #FF6B35   ->  GETTING.   Leaving for a retailer. Amazon / Flipkart. Nothing else.
GREEN   #16A34A   ->  VALUE.     Worth-it markers, in-stock, good-price signals.
BLACK   #0A0A0A   ->  EDITORIAL. Badges, structure, authority.
```

A user should be able to learn, without being told, that **purple is us thinking and
orange is them selling**. That mental model is a trust feature, not a decoration.
Every component below inherits it.

**Rule:** orange never appears on an internal navigation control. Purple never appears
on an outbound retailer button. If this rule bends, the grammar dies.

---

## 3. What I changed, and why

The Stitch output is a strong start but has three gaps against the spec and this brief.
Each is fixed in the implementation.

### 3.1 It is light-only — we need a real dark theme

`PickD Visual Identity` ships a single light palette. A dark theme derived by naive
inversion would break the color grammar: green at `#16A34A` on black goes muddy, and
the `#474554` muted ink becomes unreadable.

**Approach — semantic tokens, two themes, one contract.** Components never name a
colour. They name a *role*: `--c-ink-muted`, `--c-retail-fill`, `--c-line`. Both themes
fill those roles independently, so each is tuned rather than computed.

Two tunings that matter:

- **Accent luminance lifts in dark.** Purple `#6C5CE7` to `#8B7BF0`, green `#15803D` to
  `#4ADE80`. Brand hue is preserved; legibility is not sacrificed to it.
- **Fill and accent are separate tokens.** `#FF6B35` with white text is roughly 2.6:1 —
  it fails WCAG as a button. So orange splits into `--c-retail` (the accent you *see*, on
  borders, labels, icons) and `--c-retail-fill` (the accessible solid: `#B8410F` in light,
  the vivid `#FF6B35` with near-black text in dark). The brand still reads as orange; the
  button is still readable. Same split for purple and green.

Dark is **not** a courtesy mode. Product photography on `#0A0A0A` is how premium
consumer-tech brands present hardware, and it makes the purple score ring glow. For a
product-research site read at night, it is arguably the primary theme.

### 3.2 It is boxed at 1280px — the brief says use the whole width

The Stitch tokens set `container-max: 1280px`. On a 2560px display that leaves half the
screen unused, with a four-card grid marooned in the middle. The product research page
screenshot shows exactly this problem.

**Approach — a fluid shell with a graduated gutter, and content-aware maximums.**

```
FULL      edge-to-edge, gutter only       hero, media strips, sticky bars
WIDE      fluid, soft cap 1920px          product grids, dashboards, tables
CONTENT   max 1100px                      forms, settings, focused panels
PROSE     max 72ch                        verdicts, reviews, editorial body
```

Product grids become `repeat(auto-fill, minmax(280px, 1fr))` rather than a fixed column
count — a 1440px screen gets 5 cards, a 2560px screen gets 8, with no breakpoint churn.

**Width is used; line length is still controlled.** Those are different problems and they
get different tools. A full-bleed grid is good. A full-bleed paragraph is not.

The gutter scales `16 -> 24 -> 40 -> 64 -> 80px`, so full-bleed never means cramped.

### 3.3 It renders a catalog — the spec asks for a decision layer

The generated homepage leads with a grid of products. The spec (§14) is explicit that the
hero communicates the value proposition, and (§51) that cards prioritize
**decision-making**, not listing.

**Approach — every product card carries a reason, not just a price.**

```
+-------------------------------------+
| . TOP RECOMMENDATION          ,---. |   editorial badge (obsidian)
|                               |8.8| |   PickD Score ring (purple)
|                               `---' |
|            [ product ]              |   image, background removed
|                                     |
+-------------------------------------+   hairline, not shadow
| SONY                                |   brand, mono, tracked
| WH-1000XM5                          |   headline
| Class-leading ANC with the best     |   <- THE VERDICT LINE.
| call quality in its class.          |    Non-negotiable. This is the product.
|                                     |
| + WORTH IT              Rs 24,990   |   green value signal    price
|                      Rs 22k-27k     |   range (§20)
| * 4.6 . 128 reviews                 |   community, separate from score (§32)
+-------------------------------------+
```

The verdict line is what separates this from a marketplace tile. A card without one is a
listing; a card with one is a recommendation.

**PickD Score and community rating are never merged** (§32). They sit in different places,
in different type, in different colours: the score is a purple ring (ours), the rating is a
grey star line (theirs). Merging them into one number would be the most damaging trust
mistake this product could make.

---

## 4. Component grammar

| Component | Role | Signature |
|---|---|---|
| **Score Ring** | Our verdict, quantified | 3px purple arc, Geist Mono numeral, tabular |
| **Editorial Badge** | Curatorial authority | Obsidian fill, Geist, uppercase, 0.14em tracking |
| **Verdict Block** | The core content unit | Purple rule at left, prose column, 72ch |
| **Retail Button** | Exit to marketplace | Orange fill, retailer name, external-link glyph |
| **Value Chip** | Worth-it signal | Green hairline outline plus tint, never a solid |
| **Spec Table** | Structured comparison | Geist Mono values, right-aligned, tabular-nums |
| **Pros / Cons** | Fast scan | Paired panels, never a single mixed list |
| **Search** | The front door (§33) | Bottom-rule only; focus draws it purple and widens it |
| **Glass Nav** | Persistent context | `backdrop-filter: blur(20px)`, hairline base |
| **Dot Matrix** | The "Nothing" tell | 1px radial at 16px pitch, on canvas and empty states |

### Depth is tonal, not dropped

Elevation comes from surface layering (`surface-0` through `surface-3`) plus a 1px line.
Shadows appear only on *interaction*, and only as a very diffuse
`0 8px 30px rgba(0,0,0,0.06)` in light — in dark, elevation raises the border instead,
because shadows are invisible on black. Nothing here should look like it floats over the
page; it should look milled into it.

### Motion

Restrained and physical. `160ms` for state, `320ms` for entry,
`cubic-bezier(0.32, 0.72, 0, 1)`. Product images scale to `1.03` on card hover, the score
ring draws its arc once on first view, and that is close to the entire motion budget. All
of it sits behind `prefers-reduced-motion`.

---

## 5. Typography

Three tiers, each with a job — the system doing real work, not providing variety.

```
Hanken Grotesk   DISPLAY / HEADLINE   tight tracking (-0.04em at 72px), confident
Inter            BODY                 verdicts, reviews, descriptions
Geist            LABEL                metadata, nav, eyebrows - uppercase and tracked
Geist Mono       DATA                 scores, prices, specs - tabular figures
```

Prices and scores use `font-variant-numeric: tabular-nums`. In a comparison table, digits
must sit in columns. This is the detail that makes the whole thing feel engineered rather
than styled.

---

## 6. Screen priorities

1. **Home** — the discovery surface. Hero, categories, Top Picks, featured, per-category rails, brands, footer (§11).
2. **Product** — the payload. Gallery, score breakdown, verdict, best-for / not-ideal-for, pros and cons, specs, reviews, alternatives, retailer exits (§18).
3. **Category** — fluid grid, faceted filters, sort. Full width earns its keep here (§17).
4. **Search** — instant, grouped by products / brands / categories (§33).
5. **Admin** — dense, desktop-first, dot-matrix canvas, sidebar shell (§34–37).

Admin deliberately inverts the public spacing rules. It is a *tool*, so it is dense,
tabular, and keyboard-shaped: same tokens, a tighter density scale.

---

## 7. Non-negotiables

- Never imply SortedChoice sells or fulfils anything (§4.5). No cart, no basket glyph, no "Add to".
- PickD Score is not the community rating is not the marketplace rating. Three sources, three treatments (§32).
- No "Verified Buyer" until a real verification mechanism exists. Say "User Review" (§31).
- Affiliate disclosure is visible on any page carrying a retailer link (§59).
- No product-specific logic in the frontend. Data in, layout out (§54).
- Draft products are unreachable from the public surface (§38, §61).

---

## 8. Stitch: current state and next prompts

Existing screens (project `8176740819530801633`, design system
`assets/b24f8bb197aa4a248de46ff47576f6c1`):

Homepage with Fixed Sections · Product Research Page · Search Experience ·
Admin Dashboard · Newsletter Signup

Worth generating next, to pressure-test the decisions above:

1. **Product page, dark theme, full-bleed** — validates the dark accent lifts against real product photography.
2. **Category page, ultrawide** — validates `auto-fill` grids and the filter rail at 2560px.
3. **Comparison table** (§53) — the densest screen in the product; the tabular type system either holds or it does not.
4. **Review submission with media upload** (§29) — the 30-second video cap needs a designed affordance, not an error message.

`frontend/src/styles/tokens.css` is the source of truth. If Stitch and the code disagree,
the code wins and the Stitch design system is updated to match.
