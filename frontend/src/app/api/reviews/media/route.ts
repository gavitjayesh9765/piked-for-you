import { NextResponse, type NextRequest } from "next/server";
import { isId, userGuard, NO_STORE } from "@/lib/user-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Uploads are slow by nature; this ceiling is generous, not absent. */
const UPSTREAM_TIMEOUT_MS = 60_000;

/**
 * Review media proxy.
 *
 * The multipart body is streamed straight through. All validation — decode,
 * size, EXIF strip, and the 30-second video duration check read from the
 * container header — happens in FastAPI. Nothing is trusted here.
 *
 * This handler was the sharpest CSRF on the site and worth being explicit
 * about: `request.formData()` accepts `multipart/form-data`, which is a
 * CORS-*simple* content type. No preflight is sent, so the browser's own
 * cross-origin protections never engage — a hidden auto-submitting form on any
 * page could upload a file to a signed-in visitor's review, in their name,
 * with their cookie. `userGuard` is the check that stops it.
 */
export async function POST(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const res = await fetch(`${API_URL}/media/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ detail: "Upload failed" }, { status: 502, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const mediaId = new URL(request.url).searchParams.get("mediaId");
  // Validated before it reaches the upstream path template.
  if (!isId(mediaId)) {
    return NextResponse.json({ detail: "missing mediaId" }, { status: 400, headers: NO_STORE });
  }

  try {
    const res = await fetch(`${API_URL}/media/review/${mediaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (res.status === 204) return new NextResponse(null, { status: 204, headers: NO_STORE });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ detail: "Delete failed" }, { status: 502, headers: NO_STORE });
  }
}
