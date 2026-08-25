import { NextResponse, type NextRequest } from "next/server";
import { forward, guard, NO_STORE } from "@/lib/admin-guard";

/**
 * Product lookup for the alternatives picker.
 *
 * A thin, deliberately narrow view of `/admin/products`: a query string and
 * nothing else. The picker needs to search the whole catalogue including
 * drafts — an editor lines up an alternative before its page goes live — and
 * that is exactly what the admin list already returns, so this forwards rather
 * than duplicating the query.
 *
 * The parameters are rebuilt here instead of being passed through. Forwarding
 * the caller's whole query string would let this route reach filters the
 * picker has no business setting, and would make the upstream contract
 * something a client could quietly widen.
 */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  // Two characters is the point where the result set stops being "the entire
  // catalogue in title order" and starts being a search.
  if (q.length < 2) return NextResponse.json({ items: [] }, { headers: NO_STORE });

  const query = new URLSearchParams({ q: q.slice(0, 200), pageSize: "12", sort: "newest" });
  return forward(auth.token, "/admin/products", { query });
}
