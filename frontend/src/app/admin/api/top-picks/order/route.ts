import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/** Explicit Top Picks ordering — editorial, not derived from score. */
export async function PUT(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, "/admin/top-picks/order", { method: "PUT", body });
}
