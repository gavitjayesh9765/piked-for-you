import { type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

/** The statuses the results table may be filtered to. Anything else is dropped
 *  rather than forwarded — the value lands in an upstream query string. */
const RESULT_FILTERS = new Set([
  "all",
  "problems",
  "updated",
  "unchanged",
  "rejected",
  "not_found",
  "blocked",
  "error",
  "skipped",
]);

/**
 * One run, with its results.
 *
 * This is the endpoint the progress panel polls while a run is in flight, so
 * it stays deliberately small: the result list is capped upstream, and the
 * panel asks for `problems` once a run finishes rather than pulling four
 * hundred successes it will not render.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const query = new URLSearchParams();
  const status = request.nextUrl.searchParams.get("status");
  if (status && RESULT_FILTERS.has(status)) query.set("status", status);

  const limit = request.nextUrl.searchParams.get("limit");
  if (limit && /^\d{1,3}$/.test(limit)) query.set("limit", limit);

  return forward(auth.token, `/admin/pricing/runs/${id}`, { query });
}
