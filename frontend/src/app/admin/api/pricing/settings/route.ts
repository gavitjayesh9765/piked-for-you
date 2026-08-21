import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/** The run's knobs. Bounds are enforced upstream by Pydantic and again by a
 *  CHECK constraint on the table, so nothing is validated twice here. */
export async function PUT(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, "/admin/pricing/settings", { method: "PUT", body });
}

export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;
  return forward(auth.token, "/admin/pricing/settings");
}
