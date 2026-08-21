---
name: PickD Visual Identity
colors:
  surface: '#fcf8f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0edec'
  surface-container-high: '#ebe7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#474554'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#787586'
  outline-variant: '#c8c4d7'
  surface-tint: '#5847d2'
  primary: '#5341cd'
  on-primary: '#ffffff'
  primary-container: '#6c5ce7'
  on-primary-container: '#faf6ff'
  inverse-primary: '#c6bfff'
  secondary: '#ab3500'
  on-secondary: '#ffffff'
  secondary-container: '#fe6a34'
  on-secondary-container: '#5d1900'
  tertiary: '#00672a'
  on-tertiary: '#ffffff'
  tertiary-container: '#008338'
  on-tertiary-container: '#e1ffdf'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4dfff'
  primary-fixed-dim: '#c6bfff'
  on-primary-fixed: '#160066'
  on-primary-fixed-variant: '#4029ba'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390c00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#fcf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-xl:
    fontFamily: Hanken Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.04em
  display-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-mono:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  section-gap: 80px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system embodies a "Technical Premium" aesthetic, blending the precision of high-end consumer electronics with the frictionless experience of luxury retail. It is defined by 70% Apple-inspired minimalism (generous negative space, clarity, and subtle motion), 20% Nothing-inspired technicality (monospaced accents, structural transparency, and dot-matrix patterns), and 10% high-utility e-commerce (explicit calls-to-action and information density where critical).

The emotional response should be one of **effortless authority**. Users should feel that the intelligence behind the recommendations is complex, but the presentation is remarkably simple. The interface uses a systematic approach to hierarchy, ensuring that product data never feels overwhelming, even when it is comprehensive.

## Colors
The palette is rooted in a monochromatic base to allow product imagery and intelligence signals to command attention.

- **Obsidian Black (#0A0A0A)**: Used for primary text and high-contrast structural elements.
- **Pure White (#FFFFFF)**: The canvas for the entire experience, maximizing the feeling of "air."
- **PickD Purple (#6C5CE7)**: The signature of intelligence. Used for proprietary scores, "PickD" branded moments, and internal logic flows.
- **PickD Orange (#FF6B35)**: Reserved exclusively for external transactional actions (e.g., "Buy at Retailer"). This creates a clear mental model: Purple is for *deciding*, Orange is for *getting*.
- **PickD Green (#16A34A)**: A high-utility signal used for positive recommendation markers, "In Stock" status, and value-for-money indicators.

## Typography
The typographic system uses a three-tier approach to balance modern editorial feel with technical precision.

- **Headlines (Hanken Grotesk)**: Chosen for its sharp, contemporary geometry. Use tight letter-spacing for large displays to create a "confident" hero presence.
- **Body (Inter)**: The workhorse for readability. Used for product descriptions and reviews where legibility is paramount.
- **Labels (Geist)**: The technical accent. Used for metadata, "PickD Scores," and technical specifications. It should often be paired with all-caps or tabular figures to lean into the technical aesthetic.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. The layout philosophy is "spacious by default," using large margins to prevent information density from becoming cognitive load.

- **Vertical Rhythm**: Utilize a base-8 spacing scale. Section headers should have significant top-margin (80px+) to allow the eye to rest between product categories.
- **Horizontal Alignment**: Product grids should utilize a "masonry-lite" or strictly aligned grid depending on the content type. Editorial content uses a centered 8-column column-span for focused reading, while product listings use the full 12 columns.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows.

- **Surface Levels**: The base layer is always `#FFFFFF`. Primary containers (like product cards) sit on `#F5F5F5` or use a 1px border of `#E5E5E5`.
- **Active States**: Use subtle, extra-diffused shadows (0px 4px 20px rgba(0,0,0,0.04)) only when a user interacts with a card.
- **Glassmorphism**: Apply a heavy backdrop blur (20px) to navigation bars and floating action buttons to maintain context of the content beneath while providing a premium, "Apple-like" feel.

## Shapes
The shape language is controlled and sophisticated. 

- **Containers**: Product cards and main UI blocks use a consistent 0.5rem (8px) radius. 
- **Buttons**: Use 0.5rem for standard actions, but "Pill" shapes are reserved exclusively for the "PickD Score" badges and category filters to distinguish them as interactive data points.
- **Icons**: Icons should be linear, 2px stroke width, with slightly rounded terminals to match the typography.

## Components
- **Product Cards**: A white or soft gray surface with a 1px `#E5E5E5` border. Images should be high-resolution with removed backgrounds where possible. The "PickD Score" is a 40px purple ring in the top-right corner using a monospaced Geist font.
- **Buttons**: 
  - *Primary (Intelligence)*: Purple background, white text. For internal platform actions.
  - *Secondary (Retail)*: Orange background, white text. Specifically for "Check Price" or "Buy Now."
  - *Ghost*: Border Gray outline, Black text. For secondary navigation.
- **Editorial Badges**: Small, Geist-font labels with a `#0A0A0A` background and white text (e.g., "BEST OVERALL"). These should be placed at the very top of cards.
- **Search Bar**: A minimalist, full-width input with no background, only a bottom border of `#E5E5E5`. Focus state expands the border to PickD Purple.
- **PickD Score Ring**: A circular SVG progress bar in Purple (#6C5CE7). The thickness should be 3px, with the score centered in Geist Mono.