import { type NextRequest } from "next/server";
import { badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/** Mark every open report on a review as handled. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  // A body is optional here — resolving with no note is a legitimate outcome.
  const body = await readJson(request);

  return forward(auth.token, `/admin/reports/${id}/resolve`, { method: "POST", body });
}
