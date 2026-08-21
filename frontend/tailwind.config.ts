import type { Config } from "tailwindcss";

/**
 * Tailwind is a *bridge* to the token layer, not a second source of truth.
 * Every colour here resolves to a CSS variable defined in src/styles/tokens.css,
 * so switching themes is a single attribute flip on <html> with no class churn.
 *
 * Never add a literal hex value to this file.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    // Deliberately NOT extending the default container — this project uses the
    // fluid `.shell` primitives instead. See docs/01-design-brainstorm.md §3.2.
    extend: {
      colors: {
        bg: "var(--c-bg)",
        surface: {
          0: "var(--c-surface-0)",
          1: "var(--c-surface-1)",
          2: "var(--c-surface-2)",
          3: "var(--c-surface-3)",
          inverse: "var(--c-surface-inverse)",
        },
        ink: {
          DEFAULT: "var(--c-ink)",
          muted: "var(--c-ink-muted)",
          subtle: "var(--c-ink-subtle)",
          faint: "var(--c-ink-faint)",
          inverse: "var(--c-on-surface-inverse)",
        },
        line: {
          DEFAULT: "var(--c-line)",
          strong: "var(--c-line-strong)",
          faint: "var(--c-line-faint)",
        },

        // DECIDING — our intelligence
        brand: {
          DEFAULT: "var(--c-brand)",
          vivid: "var(--c-brand-vivid)",
          fill: "var(--c-brand-fill)",
          on: "var(--c-brand-on-fill)",
          soft: "var(--c-brand-soft)",
          "on-soft": "var(--c-brand-on-soft)",
          line: "var(--c-brand-line)",
        },
        // GETTING — outbound to a retailer, and nothing else
        retail: {
          DEFAULT: "var(--c-retail)",
          vivid: "var(--c-retail-vivid)",
          fill: "var(--c-retail-fill)",
          on: "var(--c-retail-on-fill)",
          soft: "var(--c-retail-soft)",
          "on-soft": "var(--c-retail-on-soft)",
          line: "var(--c-retail-line)",
        },
        // VALUE — worth-it signals
        value: {
          DEFAULT: "var(--c-value)",
          vivid: "var(--c-value-vivid)",
          fill: "var(--c-value-fill)",
          on: "var(--c-value-on-fill)",
          soft: "var(--c-value-soft)",
          "on-soft": "var(--c-value-on-soft)",
          line: "var(--c-value-line)",
        },

        danger: {
          DEFAULT: "var(--c-danger)",
          fill: "var(--c-danger-fill)",
          on: "var(--c-danger-on-fill)",
          soft: "var(--c-danger-soft)",
          "on-soft": "var(--c-danger-on-soft)",
        },
        warn: {
          DEFAULT: "var(--c-warn)",
          soft: "var(--c-warn-soft)",
          "on-soft": "var(--c-warn-on-soft)",
        },

        editorial: {
          bg: "var(--c-editorial-bg)",
          fg: "var(--c-editorial-fg)",
        },
        star: "var(--c-star)",
        plate: "var(--c-plate)",
        scrim: "var(--c-scrim)",
      },

      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        label: "var(--font-label)",
        mono: "var(--font-mono)",
      },

      fontSize: {
        "display-xl": ["var(--t-display-xl)", { lineHeight: "1.05", letterSpacing: "-0.04em", fontWeight: "700" }],
        "display-lg": ["var(--t-display-lg)", { lineHeight: "1.08", letterSpacing: "-0.035em", fontWeight: "700" }],
        "headline-lg": ["var(--t-headline-lg)", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["var(--t-headline-md)", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-sm": ["var(--t-headline-sm)", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["var(--t-body-lg)", { lineHeight: "1.65" }],
        "body-md": ["var(--t-body-md)", { lineHeight: "1.55" }],
        "body-sm": ["var(--t-body-sm)", { lineHeight: "1.5" }],
        label: ["var(--t-label)", { lineHeight: "1.35", letterSpacing: "0.08em" }],
        "label-xs": ["var(--t-label-xs)", { lineHeight: "1.3", letterSpacing: "0.14em" }],
      },

      borderRadius: {
        xs: "var(--r-xs)",
        sm: "var(--r-sm)",
        DEFAULT: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        "2xl": "var(--r-2xl)",
        full: "var(--r-full)",
      },

      boxShadow: {
        e1: "var(--e-1)",
        e2: "var(--e-2)",
        e3: "var(--e-3)",
        brand: "var(--e-brand)",
      },

      spacing: {
        gutter: "var(--gutter)",
        section: "var(--section-gap)",
        nav: "var(--nav-h)",
        subnav: "var(--subnav-h)",
      },

      maxWidth: {
        wide: "var(--shell-wide)",
        content: "var(--shell-content)",
        prose: "var(--shell-prose)",
      },

      transitionTimingFunction: { ease: "var(--ease)" },
      transitionDuration: { fast: "160ms", base: "240ms", slow: "320ms" },

      zIndex: {
        sticky: "var(--z-sticky)",
        subnav: "var(--z-subnav)",
        nav: "var(--z-nav)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        toast: "var(--z-toast)",
      },
    },
  },
  plugins: [],
};

export default config;
