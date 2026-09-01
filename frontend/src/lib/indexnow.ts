import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * IndexNow — telling search engines a URL changed, instead of waiting to be asked.
 *
 * ---------------------------------------------------------------------------
 * WHAT PROBLEM THIS SOLVES
 *
 * Everything else in this codebase's SEO surface is *passive*: app/sitemap.ts
 * lists what exists, app/robots.ts says where to look, and then we wait. The
 * waiting is the problem. Publishing a product is a CMS action (spec §73), the
 * sitemap revalidates hourly, and a crawler re-reads that sitemap on its own
 * schedule — which for a young domain with little authority is measured in
 * days, not hours.
 *
 * That delay is not neutral for this catalogue. A verdict is most valuable in
 * the window where the product is new and nobody else has written about it
 * yet; arriving in the index a week late means arriving after the sites that
 * were already trusted enough to be crawled daily.
 *
 * IndexNow inverts it. One HTTP POST naming the changed URLs, and the engines
 * that participate fetch them on their own initiative — typically within
 * minutes rather than days.
 *
 * ---------------------------------------------------------------------------
 * ⚠ WHICH ENGINES THIS ACTUALLY REACHES — AND WHICH IT DOES NOT
 *
 * Bing, Yandex, Seznam, Naver and Yep share one IndexNow pool: submitting to
 * any endpoint propagates to all of them. That is the entire benefit.
 *
 * **GOOGLE DOES NOT PARTICIPATE.** Google evaluated IndexNow and has never
 * adopted it. Nothing in this file speeds up Googlebot by one second, and
 * anyone reading a traffic graph after deploying it should not expect it to.
 * Google discovery here remains the sitemap plus Search Console, and the
 * `verification.google` token in app/layout.tsx is what makes the latter
 * available.
 *
 * So the honest framing is: this captures the ~4% of Indian search that is not
 * Google, plus — and this is the part that is becoming the real argument —
 * Bing's index is what backs Copilot and, historically, several other answer
 * engines. Being in Bing quickly is increasingly a way of being *citable*
 * quickly, which is exactly the traffic app/robots.ts already goes out of its
 * way to court.
 *
 * ---------------------------------------------------------------------------
 * WHY THE KEY IS A LITERAL IN THE REPO AND NOT AN ENVIRONMENT VARIABLE
 *
 * Because it is not a secret, and treating it as one produces a worse system.
 *
 * An IndexNow key proves one thing: that whoever submits a URL can also write
 * files to that host. It proves it by being *published* at a fixed path on the
 * host — see app/<key>.txt/route.ts, which serves exactly this string to
 * anyone who asks, because the protocol requires it to. A value that the
 * protocol obliges us to serve to the public cannot be made confidential by
 * putting it in an env var; it can only be made *harder to keep in sync*.
 *
 * And the sync is the actual failure mode. The submitted key and the served
 * key must match, or every submission is rejected with a 403 that nothing
 * surfaces — a silent no-op that looks exactly like success. One constant,
 * read by both the submitter and the route that publishes it, makes that
 * class of bug unrepresentable.
 *
 * ⚠ IF THIS VALUE IS EVER CHANGED, RENAME THE ROUTE DIRECTORY TO MATCH.
 * The directory name IS the URL path, and the protocol wants the key file at
 * `/<key>.txt`. They are two halves of one fact and the compiler cannot check
 * that they agree.
 */
export const INDEXNOW_KEY = "e8d777be667cd99b6697223d04c70d8c";

/** Where the key above is published. Root-level, which is what scopes a
 *  submission to the whole host rather than to one subdirectory. */
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

/**
 * The shared endpoint. api.indexnow.org fans a submission out to every
 * participating engine, so submitting to bing.com/indexnow as well would not
 * reach one extra crawler — it would just double our request count against a
 * rate limit we share.
 */
const ENDPOINT = "https://api.indexnow.org/indexnow";

/** A submission is a nice-to-have. It must never delay the write that caused it. */
const TIMEOUT_MS = 5_000;

/**
 * The protocol caps a batch at 10,000 URLs. Nothing here comes close — a
 * publish submits single digits — so this is a guard against a future caller
 * that loops over the catalogue, not a limit anyone should be hitting.
 */
const MAX_URLS = 10_000;

/**
 * Submit changed URLs. Site-relative paths in, nothing out.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS RESOLVES, RETURNS VOID AND SWALLOWS EVERYTHING
 *
 * Every caller is a code path that has ALREADY SUCCEEDED — a product is
 * published, the database says so, the reader will see it. This is the
 * announcement afterwards. If the announcement fails, the correct behaviour is
 * the old behaviour: the URL is discovered from the sitemap instead, an hour
 * or a day later. What is absolutely not correct is turning a successful
 * publish into a 502 because a third-party endpoint was down, which is what
 * letting this throw would eventually do.
 *
 * So: no return value worth branching on, no rejection to forget to catch.
 */
export async function submitToIndexNow(paths: readonly string[]): Promise<void> {
  /**
   * Never submit from anywhere but production.
   *
   * A preview deploy or a dev machine that announced its URLs would be asking
   * Bing to crawl a host that either does not serve the key file or is not
   * meant to be indexed at all. Both outcomes are worse than silence: repeated
   * key-verification failures are the documented way to get a host's
   * submissions throttled, and the host being throttled would be production's.
   *
   * Keyed off SITE_URL rather than NODE_ENV because SITE_URL is the thing that
   * is actually wrong on a preview — `next build` runs in production mode for
   * every deploy, preview ones included.
   */
  if (!SITE_URL.startsWith("https://")) return;

  // De-duplicated: a publish naturally touches the same category page twice if
  // two of its products move at once, and the endpoint counts duplicates
  // against the rate limit.
  const urlList = [...new Set(paths)].slice(0, MAX_URLS).map((p) => absoluteUrl(p));
  if (urlList.length === 0) return;

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        // Bare hostname, no scheme and no path — the field is `host`, and
        // sending an origin here is the most common reason a submission is
        // rejected as malformed.
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        // Optional per the spec, and sent anyway. Without it the engine infers
        // `/<key>.txt` and would be right — but stating it means a future move
        // of the key file is a one-line change here rather than a silent
        // verification failure nobody is watching for.
        keyLocation: absoluteUrl(INDEXNOW_KEY_PATH),
        urlList,
      }),
      // This is an announcement, not a fetch of anything we render. Caching it
      // would mean the second publish in a row is never sent.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Deliberately empty. See the note above the function: the write already
    // succeeded and the sitemap remains the fallback discovery path.
  }
}
