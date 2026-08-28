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
  tv: (
    <>
      <rect x="2.5" y="5" width="19" height="13" rx="2" />
      <path d="M8.5 2.5 12 5l3.5-2.5" />
      <path d="M8 21h8" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9a13.5 13.5 0 0 1 19 0" />
      <path d="M6 12.5a8.5 8.5 0 0 1 12 0" />
      <path d="M9.4 16a3.8 3.8 0 0 1 5.2 0" />
      <path d="M12 19.5h.01" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5M9 21.5h6" />
    </>
  ),
  cpu: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 2.5v2M15 2.5v2M9 19.5v2M15 19.5v2M2.5 9h2M2.5 15h2M19.5 9h2M19.5 15h2" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5v-5h10v5" />
      <rect x="2.5" y="8.5" width="19" height="7" rx="2" />
      <path d="M7 15.5h10v5H7z" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 12.5h.01M9.5 12.5h.01M16.5 12.5h.01" />
      <path d="M12 12.5h4" />
    </>
  ),
  mouse: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="6" />
      <path d="M12 6.5v4" />
    </>
  ),
  chair: (
    <>
      <path d="M6.5 3.5h11v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" />
      <path d="M12 12.5v4M7 16.5h10" />
      <path d="M9 20.5 12 16.5l3 4" />
    </>
  ),
  vr: (
    <>
      <path d="M2.5 9.5a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3.6a2 2 0 0 1-1.5-.7L12 12.5l-2.4 2.3a2 2 0 0 1-1.5.7H4.5a2 2 0 0 1-2-2z" />
      <path d="M6.5 7.5V6M17.5 7.5V6" />
    </>
  ),
  drone: (
    <>
      <circle cx="5" cy="6" r="2.5" />
      <circle cx="19" cy="6" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <rect x="9" y="10" width="6" height="4" rx="1" />
      <path d="M6.8 7.8 9.4 10.3M17.2 7.8 14.6 10.3M6.8 16.2 9.4 13.7M17.2 16.2 14.6 13.7" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </>
  ),
  "chef-hat": (
    <>
      <path d="M6.5 12.5a4 4 0 1 1 1.4-7.7 4.2 4.2 0 0 1 8.2 0 4 4 0 1 1 1.4 7.7z" />
      <path d="M6.5 12.5v8h11v-8" />
      <path d="M6.5 16.5h11" />
    </>
  ),
  oven: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <rect x="5.5" y="7.5" width="10" height="9" rx="1" />
      <path d="M18.5 8v3.5M18.5 15h.01" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 8.5h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 2.5v3M12 2.5v3" />
    </>
  ),
  blender: (
    <>
      <path d="M7 3.5h10l-1.2 10.6a2 2 0 0 1-2 1.8h-3.6a2 2 0 0 1-2-1.8z" />
      <path d="M10 15.9v2.6M14 15.9v2.6" />
      <path d="M7.5 18.5h9v3h-9z" />
    </>
  ),
  pot: (
    <>
      <path d="M4 9h16v6.5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M2 9h20" />
      <path d="M7 6.5V5M12 6.5V3.5M17 6.5V5" />
    </>
  ),
  fridge: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <path d="M5 9.5h14" />
      <path d="M8 5.5v2M8 12.5v3" />
    </>
  ),
  washer: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <circle cx="12" cy="14" r="4.5" />
      <path d="M7 6h.01M10 6h.01" />
    </>
  ),
  fan: (
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h15a3 3 0 1 1-3 3" />
      <path d="M3 16h9" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 2.8c3.2 3.6 6 6.6 6 9.7a6 6 0 0 1-12 0c0-3.1 2.8-6.1 6-9.7Z" />
      <path d="M9.5 14.6a2.6 2.6 0 0 0 2.5 2.4" />
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
