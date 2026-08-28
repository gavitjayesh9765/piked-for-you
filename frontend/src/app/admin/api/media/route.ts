import { type NextRequest } from "next/server";
import { forward, guard } from "@/lib/admin-guard";

/** The filters the library screen and the picker actually offer. Anything
 *  else is an invented parameter, and becomes "all". */
const KINDS = new Set(["all", "image", "video_link"]);

/**
 * The media library, read from the client.
 *
 * The library page renders on the server; this exists for the two things that
 * cannot — the picker's search-as-you-type, and re-reading the grid after a
 * delete without a round trip through a full RSC render.
 *
 * Every value is rebuilt into a fresh URLSearchParams rather than the caller's
 * query string being passed through: `q` is bounded, `kind` is checked against
 * the tabs this screen offers, and `page` has to survive Number().
 */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const source = request.nextUrl.searchParams;
  const query = new URLSearchParams();

  const kind = source.get("kind") ?? "all";
  query.set("kind", KINDS.has(kind) ? kind : "all");

  const q = (source.get("q") ?? "").trim();
  if (q) query.set("q", q.slice(0, 200));

  const page = Number(source.get("page"));
  if (Number.isInteger(page) && page > 1) query.set("page", String(page));

  return forward(auth.token, "/admin/media", { query });
}
