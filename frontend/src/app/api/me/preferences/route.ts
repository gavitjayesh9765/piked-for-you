import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken } from "@/lib/supabase/server";

/**
 * Preferences proxy.
 *
 * The session token lives in an `httpOnly` cookie that client JavaScript
 * cannot read — that is what stops an XSS bug stealing a session. So the
 * client component posts here, and this reads the cookie server-side and
 * forwards the token.
 *
 * No user id is passed: the API derives it from the token, so there is no
 * parameter to tamper with.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function PUT(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/me/preferences`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
