import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/**
 * Try one URL and report what we would have read. Writes nothing.
 *
 * Worth being clear about what this is: an endpoint that makes the *server*
 * fetch a URL the caller chose. That shape is SSRF, and the reasons it is
 * acceptable here are specific — the caller is an MFA-verified admin, the URL
 * is parsed as an `HttpUrl` upstream so only http/https survive, and the
 * response is never returned to the browser. Only the extracted price, the
 * strategy that found it, and the status code come back.
 */
export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, "/admin/pricing/preview", { method: "POST", body });
}
