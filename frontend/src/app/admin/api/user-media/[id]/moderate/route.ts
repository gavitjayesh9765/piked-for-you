import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/** Approve or reject one review attachment (spec §29). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  // Unlike resolving a report, this one carries the decision — without a body
  // there is nothing to act on.
  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, `/admin/user-media/${id}/moderate`, { method: "POST", body });
}
