import { type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * Re-check one product's prices now.
 *
 * The same machinery as the bulk button, scoped to a single product — and it
 * runs whatever the product's status is, because a draft is exactly when an
 * editor wants to know whether the price they typed is still right.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/products/${id}/refresh-price`, { method: "POST" });
}
