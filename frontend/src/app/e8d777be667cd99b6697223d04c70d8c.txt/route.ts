import { INDEXNOW_KEY } from "@/lib/indexnow";

/**
 * The IndexNow key file.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PROVES
 *
 * Ownership, and only ownership. When we POST a list of changed URLs to
 * api.indexnow.org, the engine does not take our word for it — it fetches this
 * path and checks the body equals the key we submitted. Anyone can claim a
 * hostname; only whoever can deploy to it can make this route answer.
 *
 * That is why the file is public, and why lib/indexnow.ts keeps the key as a
 * literal rather than a secret: serving it to the world IS the mechanism.
 *
 * ---------------------------------------------------------------------------
 * ⚠ THE DIRECTORY NAME IS LOAD-BEARING
 *
 * `app/<key>.txt/` maps to the URL `/<key>.txt`, which is the path the
 * protocol looks for. So the directory name and the INDEXNOW_KEY constant have
 * to be the same 32 characters, and nothing in the type system enforces that.
 * The route asserts it at request time instead — see below — because a
 * mismatch is otherwise invisible: submissions simply start failing 403 and no
 * page on the site looks any different.
 *
 * ---------------------------------------------------------------------------
 * WHY ROOT LEVEL, WHICH IS THE PART PEOPLE GET WRONG
 *
 * The key file's location scopes what may be submitted. At the root, it
 * authorises every URL on the host. In a subdirectory — `/seo/<key>.txt`, say
 * — it authorises only URLs under `/seo/`, and every product submission would
 * be silently refused. There is no reason to move this file, and one very
 * quiet reason not to.
 */

/**
 * Static. The body is a compile-time constant, so there is nothing to
 * revalidate and no reason to wake a server for it — this should be a file on
 * a CDN edge, which is what prerendering it makes it.
 */
export const dynamic = "force-static";

/**
 * The directory name, restated as a value so the two halves can be compared.
 *
 * Changing INDEXNOW_KEY without renaming the directory leaves this route
 * answering at the OLD path while submissions name the NEW key — the engine
 * fetches `/<new-key>.txt`, gets our 404, and rejects every submission. This
 * turns that into a build failure, because `force-static` prerenders the
 * route: the throw happens during `next build`, not on a request nobody makes.
 */
const KEY_IN_ROUTE_PATH = "e8d777be667cd99b6697223d04c70d8c";

export function GET(): Response {
  if (INDEXNOW_KEY !== KEY_IN_ROUTE_PATH) {
    throw new Error(
      `IndexNow key mismatch: lib/indexnow.ts exports "${INDEXNOW_KEY}" but this ` +
        `route is served at /${KEY_IN_ROUTE_PATH}.txt. Rename the directory in ` +
        `app/ to match the constant.`,
    );
  }

  return new Response(INDEXNOW_KEY, {
    headers: {
      // text/plain is what the spec says to serve. Next would otherwise guess
      // from the route, and the route has no extension it can guess from.
      "Content-Type": "text/plain; charset=utf-8",
      // Verification happens on every submission. The value never changes for
      // the life of the key, so let the edge answer it.
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
