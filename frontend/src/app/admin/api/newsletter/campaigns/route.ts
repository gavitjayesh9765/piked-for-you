import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/** Newsletter campaigns — list drafts and sends, and start a new draft. */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;
  return forward(auth.token, "/admin/newsletter/campaigns");
}

export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, "/admin/newsletter/campaigns", { method: "POST", body });
}
