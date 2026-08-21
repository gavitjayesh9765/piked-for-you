"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "pickd-theme";

/**
 * Theme control. Three states, not two: "system" is the default and must stay
 * reachable, so a user who follows their OS schedule isn't locked to whichever
 * mode they last tapped.
 *
 * The initial paint is handled by the inline script in app/layout.tsx — this
 * component only ever *changes* the theme, so there is no flash on load.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem(STORAGE_KEY) as Theme) ?? "system");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
      root.removeAttribute("data-theme");
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      root.setAttribute("data-theme", next);
    }
  }

  function cycle() {
    apply(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }

  const label = theme === "system" ? "Theme: system" : `Theme: ${theme}`;

  return (
    <button
      type="button"
      onClick={cycle}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-muted
                 transition-colors duration-fast ease-ease hover:border-brand hover:text-brand"
    >
      {/* Render a stable glyph until mounted so SSR and client markup agree */}
      {!mounted || theme === "system" ? <SystemIcon /> : theme === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 20.5h7" />
    </svg>
  );
}

/**
 * Runs before first paint to avoid a flash of the wrong theme.
 * Injected via dangerouslySetInnerHTML in the root layout.
 */
export const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;
