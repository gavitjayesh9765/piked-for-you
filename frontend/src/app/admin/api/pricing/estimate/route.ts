import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/**
 * How many links the current scope covers, and roughly how long it would take.
 *
 * Called as the scope form changes, so the button says "Refresh 87 links
 * (~3m)" before anyone presses it. A refresh button with no idea whether it
 * means nine requests or nine hundred is not a control, it is a dare.
 */
export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, "/admin/pricing/runs/estimate", { method: "POST", body });
}
