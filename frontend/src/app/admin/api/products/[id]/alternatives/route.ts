import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/** The curated alternatives currently attached to this product (spec §52). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `/admin/products/${id}/alternatives`);
}

/**
 * Replace the curated set.
 *
 * Whole-set semantics, like retailer links: the form submits everything it has
 * and the API stores exactly that. Validation of the ids, the reasons, and the
 * self-reference guard all stay upstream, where they apply to every caller
 * rather than only to this one.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, `/admin/products/${id}/alternatives`, { method: "PUT", body });
}
