import { NextResponse, type NextRequest } from "next/server";
import { badBody, badId, isId, readJson, userGuard, NO_STORE } from "@/lib/user-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Edit / delete your own review.
 *
 * `id` is checked with `isId` before it reaches the template below. It used to
 * be interpolated raw, which is the shape the admin guard documents in full:
 * a path segment from the URL becomes part of an upstream path, so `..%2f..%2f`
 * reaches an endpoint this route was never meant to expose — carrying the
 * caller's own token.
 *
 * Ownership itself is not decided here. FastAPI checks it against the verified
 * token and RLS refuses the row at the database; this only stops a malformed
 * request from reaching either.
 */
async function forward(token: string, method: string, id: string, body?: unknown) {
  try {
    const res = await fetch(`${API_URL}/reviews/${id}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (res.status === 204) return new NextResponse(null, { status: 204, headers: NO_STORE });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch {
    return NextResponse.json({ detail: "Request failed" }, { status: 502, headers: NO_STORE });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  return forward(auth.token, "PATCH", id, body);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  return forward(auth.token, "DELETE", id);
}
