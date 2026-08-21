/** Minimal class joiner. Kept dependency-free on purpose — this project has
 *  no need for the tailwind-merge/clsx pair at its current size. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
