# SortedChoice — Design System Reference

> Source of truth: `frontend/src/styles/tokens.css`
> Live preview: `/styleguide` (run the frontend, flip the theme toggle)
> Rationale: `docs/01-design-brainstorm.md`

---

## 1. The one rule

**Components reference roles, never colours.**

```css
/* NO  */  color: #6c5ce7;
/* NO  */  color: var(--brand-purple);
/* YES */  color: var(--c-brand);
```

Every role is filled independently by each theme, so light and dark are each
*tuned* rather than one being computed from the other. Adding a hex value to a
component is the one change that breaks the system.

---

## 2. Colour grammar

The palette carries meaning. A user learns it without being told.

| Role | Meaning | Where it may appear |
|---|---|---|
| **Purple** | **Deciding** — our intelligence | SortedChoice Score, verdict rule, internal CTAs, brand moments |
| **Orange** | **Getting** — leaving for a retailer | `RetailButton` only. Nothing else, ever. |
| **Green** | **Value** — worth-it signal | Value chips, pros, in-stock, price-drop markers |
| **Obsidian** | **Editorial** — curatorial authority | Editorial badges, structural type |

Orange never appears on an internal navigation control. Purple never appears on
an outbound retailer button. If that bends, the grammar dies and the interface
starts reading like a store.

### Accent tokens come in threes

`#FF6B35` on white is ~2.6:1 — fine as an accent, unusable as a button. So each
accent splits:

| Token | Use |
|---|---|
| `--c-retail` | The accent you *see* — text, icons, borders. Contrast-safe on the page background. |
| `--c-retail-fill` / `--c-retail-on-fill` | A solid button and the text that sits on it. Always a passing pair. |
| `--c-retail-soft` / `--c-retail-on-soft` / `--c-retail-line` | Tinted container, its text, its border. |

Same shape for `--c-brand-*` and `--c-value-*`.

### Measured contrast

| Pair | Light | Dark |
|---|---|---|
| `--c-ink` on `--c-bg` | 19.4:1 | 17.1:1 |
| `--c-ink-muted` on `--c-bg` | 8.9:1 | 7.2:1 |
| `--c-ink-subtle` on `--c-bg` | 4.9:1 | 4.6:1 |
| `--c-brand` on `--c-bg` | 6.2:1 | 7.4:1 |
| `--c-retail` on `--c-bg` | 5.4:1 | 6.9:1 |
| `--c-value` on `--c-bg` | 4.8:1 | 9.1:1 |
| `--c-brand-on-fill` on `--c-brand-fill` | 5.1:1 | 5.1:1 |
| `--c-retail-on-fill` on `--c-retail-fill` | 6.0:1 | 13.1:1 |

`--c-ink-faint` is for disabled states only and is not expected to pass.

### What changes in dark, and why

- **Accents lift in luminance.** Purple `#6C5CE7 → #A394FF`, green
  `#15803D → #4ADE80`. The hue survives; legibility is not traded for it.
- **Orange finally works as a fill.** In dark, `--c-retail-fill` becomes the
  vivid brand `#FF6B35` with near-black text — 13.1:1, and it looks like the
  brand rather than a compromise.
- **The editorial badge inverts.** Black-on-black has no authority, so on a dark
  page the badge takes the light surface with obsidian text.
- **Elevation stops using shadow.** Shadows are invisible on `#0A0A0A`, so
  `.panel-raise` brightens the border instead.

---

## 3. Layout — the full-bleed system

The shell is **fluid**. Maximums apply per content type, not globally.

| Class | Max width | Use |
|---|---|---|
| `.shell` | none — gutter only | Hero, sticky bars, full-bleed media |
| `.shell-wide` | 1920px soft cap | Product grids, dashboards, tables |
| `.shell-content` | 1100px | Forms, settings, focused panels |
| `.shell-prose` | 72ch | Verdicts, reviews, editorial body |
| `.bleed` | escapes the gutter | Rails that must touch the viewport edge |

`.shell` is the **only** horizontal-padding authority. Nothing else sets
left/right page padding, or the rhythm drifts.

### Gutter scale

| Viewport | Gutter |
|---|---|
| < 640px | 16px |
| ≥ 640px | 24px |
| ≥ 1024px | 40px |
| ≥ 1536px | 64px |
| ≥ 1920px | 80px |

Edge-to-edge never means edge-to-cramped.

### The product grid

```css
.grid-products {
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
}
```

`--card-min` is 260px → 280px → 300px across breakpoints. The **column count
follows the available width** — 4 across at 1280px, 5 at 1440px, 7–8 at 2560px —
with no breakpoint table to maintain.

Width is used; line length is still controlled. Different problems, different tools.

---

## 4. Typography

| Face | Role | Notes |
|---|---|---|
| Hanken Grotesk | Display, headline | `-0.04em` at display sizes |
| Inter | Body | Verdicts, reviews, descriptions |
| Geist | Label | Uppercase, `0.08em`–`0.14em` tracked |
| Geist Mono | Data | Scores, prices, specs — **tabular** |

Loaded via `next/font` (self-hosted, no layout shift).

### Scale

All display and headline sizes are `clamp()`-fluid, so they scale with the
viewport rather than stepping at breakpoints.

| Token | Range |
|---|---|
| `--t-display-xl` | 44 → 72px |
| `--t-display-lg` | 36 → 56px |
| `--t-headline-lg` | 28 → 40px |
| `--t-headline-md` | 22 → 28px |
| `--t-headline-sm` | 20px |
| `--t-body-lg` / `md` / `sm` | 18 / 16 / 14px |
| `--t-label` / `--t-label-xs` | 12 / 11px |

### Tabular numerals

Anything numeric gets `.tabular` or `data-numeric`:

```html
<span class="tabular">₹24,990</span>
```

In a comparison table, digits must sit in columns. This one detail is what makes
the system feel engineered rather than styled.

### Type helper classes

`.t-display` · `.t-headline` · `.t-label` · `.t-eyebrow`

---

## 5. Components

| Component | File | Notes |
|---|---|---|
| `Button` | `ui/Button.tsx` | Variants: brand, editorial, outline, subtle, ghost |
| `RetailButton` | `ui/Button.tsx` | **The only orange control.** Always `rel="sponsored noopener"`, always external glyph. |
| `Badge` | `ui/Badge.tsx` | Style token from the API, never a colour |
| `ValueChip` | `ui/Badge.tsx` | Outline + tint, never solid — value supports, it doesn't shout |
| `CommunityRating` | `ui/Badge.tsx` | Grey/gold, always carries its count |
| `StatusPill` | `ui/Badge.tsx` | Admin publication states |
| `SearchField` | `ui/SearchField.tsx` | Rule only; hairline draws purple on focus |
| `CategoryIcon` | `ui/CategoryIcon.tsx` | Name-keyed registry, safe fallback |
| `ScoreRing` | `product/ScoreRing.tsx` | 3px purple arc, Geist Mono, draws once |
| `ScoreBreakdown` | `product/ScoreRing.tsx` | Per-criterion bars |
| `ProductCard` | `product/ProductCard.tsx` | Tagline is load-bearing |
| `Gallery` | `product/Gallery.tsx` | Admin-ordered, index 0 is primary |
| `VerdictBlock` | `product/Verdict.tsx` | Purple rule, prose measure |
| `AudienceFit` / `ProsCons` / `SpecTable` | `product/Verdict.tsx` | Paired panels, never merged lists |
| `ReviewList` | `product/ReviewList.tsx` | "User review" — never "Verified buyer" |
| `SiteHeader` / `SiteFooter` | `layout/` | Glass nav, data-driven sub-nav, affiliate disclosure |
| `ThemeToggle` | `layout/ThemeToggle.tsx` | Three states: light / dark / system |
| `FilterRail` / `SortSelect` | `category/` | URL-driven, shareable, back-button safe |

### Surface treatments

| Class | Effect |
|---|---|
| `.panel` | `surface-0` + 1px hairline + `--r-lg` |
| `.panel-raise` | Hover: border strengthens, diffuse shadow (light) / brighter border (dark) |
| `.glass` | `backdrop-filter: blur(20px) saturate(180%)` |
| `.dot-matrix` | 1px radial at 16px pitch — the "Nothing" tell |
| `.plate` | Neutral stage for product photography |

---

## 6. Theming

Three states, because "system" must stay reachable:

```
data-theme absent      → follows prefers-color-scheme
data-theme="light"     → explicit light
data-theme="dark"      → explicit dark
```

Two mechanisms cooperate:

1. `@media (prefers-color-scheme: dark)` scoped to `:root:not([data-theme="light"])`
   — handles the default, and never overrides an explicit light choice.
2. `[data-theme="dark"]` — an explicit choice, wins in both directions.

`themeInitScript` runs inline and blocking in `<head>` before first paint, so
there is no flash. Moving it into a component would be too late.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--d-fast` | 160ms | Hover, focus, colour |
| `--d-base` | 240ms | Shadow, transform |
| `--d-slow` | 320ms | Entry, image scale |
| `--ease` | `cubic-bezier(0.32, 0.72, 0, 1)` | Everything |

The entire motion budget: card image scales to 1.03 on hover, the score ring
draws its arc once, links nudge 1px on hover. All of it behind
`prefers-reduced-motion`.

---

## 8. Accessibility floor

- Every interactive element has a visible `:focus-visible` ring (2px `--c-focus`, 2px offset).
- Skip-to-content link in the root layout.
- `ScoreRing` carries `role="img"` and a full `aria-label` — the number is not the only channel.
- Star ratings are `aria-hidden`; the numeric value and count carry the meaning.
- Filters are real `<fieldset>` / `<legend>` / `<input>`, so they work without JS enhancement.
- Search is a real `<form role="search">`.
- Icons are `aria-hidden` with adjacent text labels.
- Colour is never the sole carrier: pros/cons pair colour with ✓/✕, status pills with text.

---

## 9. Adding to the system

1. **New colour?** Add a role to *both* theme blocks in `tokens.css`, plus the
   `prefers-color-scheme` block. Then map it in `tailwind.config.ts`. Never a
   literal hex in a component.
2. **New badge?** Nothing to do — the admin creates it, picks a `style` token,
   and it renders. That is the point (spec §21).
3. **New category?** Nothing to do, provided the icon name exists in
   `CategoryIcon`. Unknown names fall back to a neutral glyph, so a new category
   is never invisible.
4. **New page?** Pick a shell (`.shell` / `.shell-wide` / `.shell-content`) and
   use `<Section>` for vertical rhythm. Do not set page padding yourself.
5. **Check both themes.** `/styleguide` renders every component; the toggle is
   in the header.
