import { type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * Product state changes.
 *
 * An allow-list, not a pass-through: without it the path segment would be
 * interpolated straight into an upstream URL, and `[action]` matches anything.
 */
const ALLOWED = new Set(["publish", "unpublish", "archive"]);

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
  return forward(auth.token, `/admin/products/${id}/${action}`, { method: "POST" });
}
