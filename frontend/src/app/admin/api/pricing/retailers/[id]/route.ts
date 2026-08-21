import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * A retailer's engine and selectors.
 *
 * This is what makes a retailer's markup change a five-minute fix instead of a
 * deploy: the selectors are a column, and this route is how an editor edits it.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, `/admin/pricing/retailers/${id}`, { method: "PUT", body });
}
