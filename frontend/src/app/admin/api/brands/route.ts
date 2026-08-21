import { type NextRequest } from "next/server";
import { badBody, forward, guard, readJson } from "@/lib/admin-guard";

/**
 * List and create brands.
 *
 * Exists because the session token is in an httpOnly cookie the browser cannot
 * read. `guard()` checks origin, admin role and MFA; FastAPI re-verifies the
 * signed token and RLS refuses the row — this is the first of three gates, not
 * the only one.
 */
const RESOURCE = "/admin/brands";

export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;
  return forward(auth.token, RESOURCE);
}

export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  // Read the body only after the caller is authorised: parsing untrusted input
  // for a request we are about to refuse is work done on an attacker's behalf.
  const body = await readJson(request);
  if (body === undefined) return badBody();

  return forward(auth.token, RESOURCE, { method: "POST", body });
}
