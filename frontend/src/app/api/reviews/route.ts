import { NextResponse, type NextRequest } from "next/server";
import { badBody, readJson, userGuard, NO_STORE } from "@/lib/user-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Review submission proxy.
 *
 * The session token lives in an `httpOnly` cookie that client JS cannot read —
 * the property that stops an XSS bug stealing a session. So the form posts
 * here and this forwards the token server-side.
 *
 * No user id crosses the wire: the API derives it from the token.
 *
 * The `userGuard` call is what stops a cross-site page posting reviews in a
 * signed-in visitor's name. `request.json()` parses a body regardless of its
 * Content-Type, so the usual "JSON needs a preflight" reasoning does not hold
 * here — a plain HTML form with `enctype="text/plain"` was enough.
 */
export async function POST(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  try {
    const res = await fetch(`${API_URL}/reviews`, {
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
      { detail: "Could not post the review." },
      { status: 502, headers: NO_STORE },
    );
  }
}
