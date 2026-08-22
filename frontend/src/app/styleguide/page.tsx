import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Style guide", robots: { index: false } };

/**
 * Same rule as src/lib/env.ts, restated where the compiler can fold it — see
 * the long note in src/lib/api.ts for why it cannot simply be imported.
 */
const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "1" ||
  process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/**
 * Living style guide — the surface for reviewing the token system in both
 * themes at once. Gated on NEXT_PUBLIC_USE_MOCKS, and 404s without it.
 *
 * This route is not merely *decorated* with fixtures; its card, badge and score
 * sections ARE fixtures. That made it the one page that rendered fabricated
 * products no matter what the flag said. `robots: { index: false }` kept it out
 * of search results, which is not the same as keeping it off the internet.
 *
 * A 404 rather than a degraded page: with no fixtures there is nothing here to
 * review, and an empty style guide would be a worse answer than an absent one.
 *
 * The shape below matters. Written the obvious way —
 *
 *     if (!USE_MOCKS) notFound();
 *     const { StyleGuideBody } = await import("./StyleGuideBody");
 *
 * — the import is unconditional as far as the bundler can tell, because
 * `notFound()` throws at runtime and nothing about its type says so. That
 * version still shipped the entire fixture module into `.next/server`; the
 * postbuild check caught it. Putting the import inside the branch is what lets
 * the whole subtree be eliminated.
 */
export default async function StyleGuide() {
  if (USE_MOCKS) {
    const { StyleGuideBody } = await import("./StyleGuideBody");
    return <StyleGuideBody />;
  }

  notFound();
}
