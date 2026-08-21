import { cn } from "@/lib/cn";

/**
 * Icon registry. Categories store an icon *name*, not markup, so the admin can
 * pick one from a list and the frontend stays in control of the drawing.
 *
 * Linear, 2px stroke, rounded terminals — matching the type (design system
 * "Shapes" guidance). An unknown name falls back to a neutral glyph rather than
 * rendering nothing, so a new category is never invisible.
 */
const paths: Record<string, React.ReactNode> = {
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 1 1 16 0v2" />
      <rect x="2.5" y="13.5" width="4.5" height="7" rx="2" />
      <rect x="17" y="13.5" width="4.5" height="7" rx="2" />
    </>
  ),
  laptop: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M1.5 19.5h21" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 8h9a5.5 5.5 0 0 1 5 7.8l-.8 2A2.6 2.6 0 0 1 16.4 18L15 16H9l-1.4 2a2.6 2.6 0 0 1-4.3-.2l-.8-2A5.5 5.5 0 0 1 7.5 8Z" />
      <path d="M8 11v2.5M6.75 12.25h2.5M15.5 11.5h.01M17.5 13.5h.01" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.5h3l1.5-2.5h9L18 8.5h3v11H3z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  watch: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="3" />
      <path d="M9 7V4h6v3M9 17v3h6v-3" />
    </>
  ),
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5v11h13v-11" />
    </>
  ),
  cable: (
    <>
      <path d="M5 3v5a4 4 0 0 0 8 0V3" />
      <path d="M7 3v2M11 3v2" />
      <path d="M9 12v4a4 4 0 0 0 8 0v-3" />
      <rect x="15" y="18" width="4" height="3" rx="1" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M9 20.5h6M12 17v3.5" />
    </>
  ),
  speaker: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <circle cx="12" cy="15" r="3.5" />
      <circle cx="12" cy="7" r="1.2" />
    </>
  ),
  fallback: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8.5 12h7" />
    </>
  ),
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      {paths[name ?? ""] ?? paths.fallback}
    </svg>
  );
}
