import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/** Edit or discard one draft. Both are refused server-side once it has sent. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, `/admin/newsletter/campaigns/${id}`, { method: "PATCH", body });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/newsletter/campaigns/${id}`, { method: "DELETE" });
}
