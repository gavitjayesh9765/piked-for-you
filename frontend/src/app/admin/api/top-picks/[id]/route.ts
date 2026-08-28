import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * Pause or resume a pick without losing its position.
 *
 * The public homepage has always filtered on `is_active`; nothing in the admin
 * could set it, so the only way to take something off the homepage was to
 * remove it and throw away where it sat.
 */
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

  const isActive = (body as { isActive?: unknown }).isActive;
  if (typeof isActive !== "boolean") return badBody();

  return forward(auth.token, `/admin/top-picks/${id}`, {
    method: "PATCH",
    body: { isActive },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/top-picks/${id}`, { method: "DELETE" });
}
