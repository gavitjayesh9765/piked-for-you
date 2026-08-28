import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * Attach an image the library already holds to this product.
 *
 * The sibling `../route.ts` uploads bytes; this one uploads nothing at all. It
 * points a new row at an object that already exists, which is why the media
 * library can be used as a source instead of re-uploading the same photograph
 * onto every product that shows it.
 *
 * Both ids are checked here before either reaches the upstream URL, for the
 * same reason the upload route checks its own: `forward` appends the path
 * without escaping, by design.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined) return badBody();

  const mediaId = (body as { mediaId?: unknown }).mediaId;
  if (!isId(typeof mediaId === "string" ? mediaId : null)) return badId();

  return forward(auth.token, `/admin/media/product/${id}/attach`, {
    method: "POST",
    body: { mediaId },
  });
}
