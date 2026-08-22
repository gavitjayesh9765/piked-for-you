import { NotFoundBody } from "@/components/layout/NotFoundBody";

/**
 * The 404 for a public page that called `notFound()` — a category slug that
 * does not exist, an unpublished product, a retired brand.
 *
 * It exists so that case keeps the shell. Without this file the nearest
 * boundary would be `app/not-found.tsx`, which sits above the `(site)` layout:
 * reaching it unmounts the header, the sub-nav and the footer and renders a
 * second copy of them, so a mistyped slug would flash the entire chrome. Here,
 * one segment lower, the layout stays exactly where it is and only the content
 * region changes — the same transition as any other navigation.
 */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
