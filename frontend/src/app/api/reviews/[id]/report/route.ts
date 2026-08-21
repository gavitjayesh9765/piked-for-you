import { NextResponse, type NextRequest } from "next/server";
import { badBody, badId, isId, readJson, userGuard, NO_STORE } from "@/lib/user-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Report a review for moderation (spec §30).
 *
 * Guarded for origin like every other cookie-authenticated write: without it a
 * cross-site page could file reports in a signed-in visitor's name, and enough
 * of those auto-flag a review (`reviews/router.py` moves one to `reported` at
 * three open reports). That turns a CSRF into a way to take content down.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  try {
    const res = await fetch(`${API_URL}/reviews/${id}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { detail: "Could not send the report." },
      { status: 502, headers: NO_STORE },
    );
  }
}
