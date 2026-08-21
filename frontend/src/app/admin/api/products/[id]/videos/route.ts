import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * Attach a YouTube/Vimeo link to a product (spec §19).
 *
 * The URL is parsed into a validated (provider, id) pair upstream and the embed
 * address rebuilt from those parts — nothing typed here reaches an iframe src.
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

  return forward(auth.token, `/admin/products/${id}/videos`, { method: "POST", body });
}
