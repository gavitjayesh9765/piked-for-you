import { type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * Delete a file from the library, everywhere it is used.
 *
 * A different verb from `DELETE /products/{id}/media`, which detaches one
 * image from one product and keeps the file if anything else still points at
 * it. This one is addressed at the file, so every attachment goes with it —
 * the UI is expected to have named the affected products first.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/media/library/${id}`, { method: "DELETE" });
}
