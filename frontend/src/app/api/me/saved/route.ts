import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken } from "@/lib/supabase/server";

/**
 * Save / unsave proxy.
 *
 * Same reasoning as the preferences handler: the token is in an `httpOnly`
 * cookie the browser cannot read, so the client calls here and this forwards
 * it. The API scopes to the token's user id, so no user id crosses the wire.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function forward(
  method: "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<NextResponse> {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_URL}/me${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const { productId, note } = await request.json();
  return forward("POST", "/saved", { productId, note: note ?? null });
}

export async function DELETE(request: NextRequest) {
  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "missing_product" }, { status: 400 });
  }
  return forward("DELETE", `/saved/${productId}`);
}
