import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/** Replace a product's retailer links (spec §26). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (!Array.isArray(body)) return badBody();

  // URL scheme validation stays upstream, where it is enforced for every
  // caller rather than only this one.
  return forward(auth.token, `/admin/products/${id}/retailers`, { method: "PUT", body });
}
