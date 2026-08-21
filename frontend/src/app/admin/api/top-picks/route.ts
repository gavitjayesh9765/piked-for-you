import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/** Curated Top Picks — list and add. */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;
  return forward(auth.token, "/admin/top-picks");
}

export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, "/admin/top-picks", { method: "POST", body });
}
