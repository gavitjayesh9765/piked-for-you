/**
 * Cache tags for public content, and the one place that decides them.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *
 * Every public read in `lib/api.ts` is cached with `next: { revalidate: 300 }`.
 * That is right for load, and it was wrong for editing: a product published in
 * the admin panel did not appear on the homepage or in its category for up to
 * five minutes, because the cached fetch for `/homepage` and for
 * `/products?category=…&page=1&page_size=24` was still inside its window.
 *
 * The symptom that made it look like a rendering bug rather than a caching one
 * is worth writing down, because it is the thing that identifies this problem
 * next time: *changing a filter made the product appear immediately*. A filter
 * change alters the query string, which alters the fetch cache KEY, so that
 * request had no entry at all and went straight to the API. Reverting the
 * filter went back to the stale entry and the product vanished again.
 *
 * Time-based expiry alone cannot fix that — shortening the window only makes
 * the wait shorter. What the editor actually needs is for *their own write* to
 * invalidate the reads it affects. So every public fetch carries these tags,
 * and `forward()` in lib/admin-guard.ts revalidates them after any successful
 * admin mutation. The 300s window stays as the backstop for changes that did
 * not come through the admin panel (a price run, a direct database edit).
 */

/** Carried by every cached public read. Revalidating it clears all of them. */
export const CONTENT_TAG = "content";

/**
 * Tags for one upstream path.
 *
 * The resource tag is the first path segment — `/products?…` and
 * `/products/audio/sony-wh-1000xm5` are both `content:products` — so a caller
 * that knows it only touched one resource can say so. Nothing derives a tag
 * from the query string: two filtered views of the same list are the same
 * content, and giving them separate tags would recreate exactly the bug above.
 */
export function tagsFor(path: string): string[] {
  const resource = path.replace(/^\/+/, "").split(/[/?#]/)[0];
  return resource ? [CONTENT_TAG, `${CONTENT_TAG}:${resource}`] : [CONTENT_TAG];
}
