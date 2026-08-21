import { NextResponse, type NextRequest } from "next/server";
import { badBody, readJson, userGuard, NO_STORE } from "@/lib/user-guard";

/**
 * Preferences proxy.
 *
 * The session token lives in an `httpOnly` cookie that client JavaScript
 * cannot read — that is what stops an XSS bug stealing a session. So the
 * client component posts here, and this reads the cookie server-side and
 * forwards the token.
 *
 * No user id is passed: the API derives it from the token, so there is no
 * parameter to tamper with. `userGuard` adds the origin check — without it, a
 * cross-site page could quietly rewrite a signed-in visitor's preferences.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const UPSTREAM_TIMEOUT_MS = 15_000;

export async function PUT(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  try {
    const res = await fetch(`${API_URL}/me/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "upstream_unavailable" },
      { status: 502, headers: NO_STORE },
    );
  }
}
