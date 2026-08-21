import { type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/products/videos/${id}`, { method: "DELETE" });
}
