import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/**
 * Create a product. Always a draft — publishing is a separate audited action,
 * so this cannot push half-written content live (spec §38).
 */
export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, "/admin/products", { method: "POST", body });
}
