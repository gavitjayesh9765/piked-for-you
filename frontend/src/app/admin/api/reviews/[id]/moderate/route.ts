import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * Moderate one review (spec §30).
 *
 * The action is checked against an allow-list here as well as upstream. It ends
 * up in an audit-log row and a status column, and "reject everything the client
 * felt like sending" is not a state this screen should be able to reach.
 */
const ACTIONS = new Set(["approve", "reject", "hide", "feature", "unfeature"]);

/** The note lands in the audit log; cap it so one request cannot bloat it. */
const MAX_NOTE = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object") return badBody();

  const { action, note } = body as { action?: unknown; note?: unknown };
  if (typeof action !== "string" || !ACTIONS.has(action)) {
    return NextResponse.json({ detail: "unknown_action" }, { status: 400, headers: NO_STORE });
  }
  if (note !== undefined && note !== null && typeof note !== "string") return badBody();
  if (typeof note === "string" && note.length > MAX_NOTE) {
    return NextResponse.json({ detail: "note too long" }, { status: 400, headers: NO_STORE });
  }

  return forward(auth.token, `/admin/reviews/${id}/moderate`, {
    method: "POST",
    body: { action, note: note ?? null },
  });
}
