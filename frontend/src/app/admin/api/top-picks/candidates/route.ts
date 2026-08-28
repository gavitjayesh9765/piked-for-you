import { type NextRequest } from "next/server";
import { forward, guard } from "@/lib/admin-guard";

/**
 * Published products not already featured.
 *
 * The picker used to fetch this once on the server and filter the result in
 * the browser, which meant it was searching inside an arbitrary fifty rows —
 * so a product outside that window simply could not be found, and the screen
 * claimed there was nothing left to feature. The query goes upstream now, and
 * the ordering happens in SQL before the limit.
 */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const query = new URLSearchParams();
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q) query.set("q", q.slice(0, 200));

  return forward(auth.token, "/admin/top-picks/candidates", { query });
}
