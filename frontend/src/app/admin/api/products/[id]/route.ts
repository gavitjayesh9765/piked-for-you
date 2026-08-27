import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, `/admin/products/${id}`, { method: "PATCH", body });
}

/**
 * Permanent delete.
 *
 * Separate from `POST /admin/api/products/<id>/archive`, and deliberately so:
 * archiving hides a product and keeps its reviews, while this removes the row
 * and everything cascading from it. The UI states that difference at the point
 * of clicking and asks for the product's name back before it will call this —
 * see components/admin/ProductRowActions.tsx.
 *
 * The guard above is what makes a bare `<img src="/admin/api/products/…">` or a
 * cross-site form useless here: DELETE is in UNSAFE_METHODS, so it needs a
 * same-origin request carrying an admin session that has cleared MFA.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/products/${id}`, { method: "DELETE" });
}
