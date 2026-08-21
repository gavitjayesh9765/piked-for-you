import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/**
 * Start a price run — the button.
 *
 * Returns 202 with a job id as soon as the row exists upstream; the work
 * happens in the API's background. The panel polls `runs/[id]` for progress
 * rather than holding this request open for the minutes a full catalogue takes.
 *
 * The scope is forwarded as-is: it is validated by a strict Pydantic model
 * upstream (`extra="forbid"`), so an unknown field is a 422 there rather than a
 * silently-dropped filter here.
 */
export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, "/admin/pricing/runs", { method: "POST", body });
}

/** Run history, newest first. */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const query = new URLSearchParams();
  const page = request.nextUrl.searchParams.get("page");
  if (page && /^\d{1,4}$/.test(page)) query.set("page", page);

  return forward(auth.token, "/admin/pricing/runs", { query });
}
