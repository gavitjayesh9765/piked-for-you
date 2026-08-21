import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Review media proxy.
 *
 * The multipart body is streamed straight through. All validation — decode,
 * size, EXIF strip, and the 30-second video duration check read from the
 * container header — happens in FastAPI. Nothing is trusted here.
 */
export async function POST(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ detail: "Sign in to upload." }, { status: 401 });

  try {
    const form = await request.formData();
    const res = await fetch(`${API_URL}/media/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Upload failed" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ detail: "Not signed in" }, { status: 401 });

  const mediaId = new URL(request.url).searchParams.get("mediaId");
  if (!mediaId) return NextResponse.json({ detail: "missing mediaId" }, { status: 400 });

  try {
    const res = await fetch(`${API_URL}/media/review/${mediaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ detail: "Delete failed" }, { status: 502 });
  }
}
