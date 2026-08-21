import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * Actions on a run: cancel, or reap.
 *
 * An allow-list, not a passthrough. `action` is interpolated into an upstream
 * path, so anything not named here must never reach it — a bare
 * `/admin/pricing/runs/<id>/<action>` template with an unchecked segment is a
 * request-forgery primitive carrying the caller's own admin token.
 */
const ACTIONS = new Set(["cancel", "reap"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id, action } = await params;
  if (!isId(id)) return badId();
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ detail: "unknown action" }, { status: 400, headers: NO_STORE });
  }

  return forward(auth.token, `/admin/pricing/runs/${id}/${action}`, { method: "POST" });
}
