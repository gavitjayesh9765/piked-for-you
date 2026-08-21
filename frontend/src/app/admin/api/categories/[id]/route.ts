import { type NextRequest } from "next/server";
import { badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

const RESOURCE = "/admin/categories";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  // Validated before it reaches a URL template. Unchecked, `..%2f..%2fusers`
  // would reach an endpoint this route never meant to expose.
  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, `${RESOURCE}/${id}`, { method: "PATCH", body });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, `${RESOURCE}/${id}`, { method: "DELETE" });
}
