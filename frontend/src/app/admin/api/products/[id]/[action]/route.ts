import { after, type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";
import { submitToIndexNow } from "@/lib/indexnow";
import { brandHref, categoryHref, productHref } from "@/lib/format";
import type { Product } from "@/lib/types";

/**
 * Product state changes.
 *
 * An allow-list, not a pass-through: without it the path segment would be
 * interpolated straight into an upstream URL, and `[action]` matches anything.
 */
const ALLOWED = new Set(["publish", "unpublish", "archive"]);

/**
 * Every public URL whose content a state change alters.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS MORE THAN THE PRODUCT PAGE
 *
 * The product page is the URL that appeared or vanished, but it is not the only
 * one that now renders differently. Publishing adds a card to the category grid
 * and to every ancestor of that category, adds a row to the brand page, and can
 * change what the homepage rails show. A crawler told only about the product
 * learns that the product exists and keeps serving a stale category listing
 * that does not link to it — which is the listing most "best <category>"
 * queries actually land on.
 *
 * ---------------------------------------------------------------------------
 * WHY ANCESTORS, NOT JUST THE LEAF CATEGORY
 *
 * `category.path` is the full chain — ["electronics", "audio"] — and
 * app/(site)/c/[...path] renders a real grid at every depth, so /c/electronics
 * lists the product too. Submitting only the leaf leaves the broader, and
 * usually higher-ranking, page stale.
 */
function changedUrls(product: Product): string[] {
  const segments = product.category.path?.length
    ? product.category.path
    : [product.category.slug];

  return [
    productHref(product),
    // Progressively deeper category URLs: /c/electronics, /c/electronics/audio.
    // Built from the same segments categoryHref uses so the two cannot disagree
    // about how a path is spelled.
    ...segments.map((_, i) => categoryHref({ slug: segments[i], path: segments.slice(0, i + 1) })),
    brandHref(product.brand.slug),
    // Section-driven and product-fed (spec §73), so a publish can change it.
    // Cheap to include and it is the highest-authority URL we have.
    "/",
  ];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id, action } = await params;
  if (!isId(id) || !ALLOWED.has(action)) return badId();

  // The API answers publish failures with the list of fields still missing
  // (spec §62); `forward` passes that body through untouched so the editor can
  // see which.
  const response = await forward(auth.token, `/admin/products/${id}/${action}`, { method: "POST" });

  /**
   * Announce the change to IndexNow — see lib/indexnow.ts for what that does
   * and, importantly, which engines it does not reach.
   *
   * ⚠ ONLY ON A RESPONSE THE API ACCEPTED. A failed publish returns 422 with
   * the missing fields and changes nothing; announcing it would ask Bing to
   * crawl a URL that still 404s, and repeated submissions of URLs that do not
   * resolve is how a host's submissions get throttled.
   *
   * `unpublish` and `archive` are submitted too, and deliberately so. IndexNow
   * is a "this URL changed" signal, not a "this URL is new" one — announcing a
   * removal is how a delisted product gets dropped from the index in days
   * rather than waiting for the next organic recrawl to find the 404.
   *
   * The body is read from a CLONE. `response` is what we return to the editor,
   * and a Response body is a stream that can only be consumed once — reading
   * the original here would hand the admin panel an empty response and make a
   * successful publish look like a failure.
   */
  if (response.ok) {
    const product = (await response
      .clone()
      .json()
      .catch(() => null)) as Product | null;

    // Guarded rather than assumed: the endpoint is typed to return ProductOut,
    // but a 204 or a shape change upstream should degrade to "no announcement"
    // instead of throwing inside a request that has already succeeded.
    if (product?.slug && product.category?.slug && product.brand?.slug) {
      /**
       * `after()` rather than a bare floating promise.
       *
       * This runs on a serverless function, where the runtime is entitled to
       * freeze or discard the instance the moment the response is returned. A
       * `void submitToIndexNow(...)` would therefore be a coin flip: it works
       * on a warm instance that happens to stay alive and silently never sends
       * on one that does not — the worst kind of bug, because the publish looks
       * identical either way and the only symptom is search traffic that never
       * arrives.
       *
       * `after` hands the work to the platform's keep-alive (waitUntil), which
       * is the contract that says "finish this before you reclaim me". The
       * editor still does not wait: the response goes back immediately.
       */
      after(() => submitToIndexNow(changedUrls(product)));
    }
  }

  return response;
}
