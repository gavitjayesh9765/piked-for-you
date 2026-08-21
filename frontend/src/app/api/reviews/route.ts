import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Review submission proxy.
 *
 * The session token lives in an `httpOnly` cookie that client JS cannot read —
 * the property that stops an XSS bug stealing a session. So the form posts
 * here and this forwards the token server-side.
 *
 * No user id crosses the wire: the API derives it from the token.
 */
export async function POST(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ detail: "Sign in to review." }, { status: 401 });

  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/reviews`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Could not post the review." }, { status: 502 });
  }
}
