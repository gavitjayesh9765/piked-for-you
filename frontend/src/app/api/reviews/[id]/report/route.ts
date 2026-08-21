import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Report a review for moderation (spec §30). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ detail: "Sign in to report." }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/reviews/${id}/report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Could not send the report." }, { status: 502 });
  }
}
