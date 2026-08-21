import { type NextRequest } from "next/server";
import { forward, guard } from "@/lib/admin-guard";

/**
 * Record that an admin session started.
 *
 * Authentication happens in the browser against Supabase Auth, so the server
 * never observes a sign-in. The audit log could therefore say what an admin
 * changed but not when they arrived — and correlating our log with Supabase's
 * auth log by timestamp is exactly the work nobody wants to be doing during an
 * incident.
 *
 * `guard` means only a role-verified, aal2 admin can reach this, and the
 * actor written upstream comes from the token's signature rather than from
 * anything the caller sends. The endpoint is rate-limited on the API side so
 * it cannot be used to flood the log.
 *
 * Best-effort by design: the caller ignores the result. A failure to write an
 * arrival note must never be the thing that stops someone signing in.
 */
export async function POST(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  return forward(auth.token, "/auth/admin-sign-in", { method: "POST" });
}
