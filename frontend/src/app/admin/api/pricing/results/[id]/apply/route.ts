import { type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * Publish a price the tolerance check held back.
 *
 * The guard rail is deliberately conservative, so it will sometimes stop a
 * genuine 70%-off sale. This is the other half of that trade: a human reads
 * the held-back figure, agrees, and applies it. Upstream records the resulting
 * history row as `manual`, because a person decided it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/pricing/results/${id}/apply`, { method: "POST" });
}
