import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/** Drag-and-drop ordering (spec §19). Index 0 becomes the primary image. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object") return badBody();

  // Every entry is an id going into a database statement upstream. Checking the
  // shape here means a malformed list is a 400 rather than an upstream 500.
  const { mediaIds } = body as { mediaIds?: unknown };
  if (!Array.isArray(mediaIds) || !mediaIds.every(isId)) {
    return NextResponse.json({ detail: "invalid mediaIds" }, { status: 400, headers: NO_STORE });
  }

  return forward(auth.token, `/admin/products/${id}/media/order`, {
    method: "PUT",
    body: { mediaIds },
  });
}
