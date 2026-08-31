import { NextResponse, type NextRequest } from "next/server";
import { badBody, isId, readJson, userGuard, NO_STORE } from "@/lib/user-guard";

/**
 * "Was this review helpful?" — cast and withdraw.
 *
 * The same shape as `/api/me/saved`, for the same reasons: the access token
 * lives in an `httpOnly` cookie the browser cannot read, so the client calls
 * here and this forwards it; and because that cookie is attached automatically,
 * `userGuard` runs the origin check that is the whole CSRF precondition.
 *
 * The stakes are lower here than on a review or a report — the worst a forged
 * request achieves is one vote the victim did not mean to cast — but the guard
 * is not applied per-stake. A handler that authenticates by cookie gets the
 * check, or the next one written by copying this file quietly does not.
 *
 * The upstream is idempotent in both directions (`ON CONFLICT DO NOTHING` on
 * the way in, a `DELETE` that matches nothing on the way out), so a retry after
 * a dropped response cannot double-count. The counter on `reviews` is
 * maintained by a database trigger, so it cannot drift from the votes either.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** A hung upstream should fail the request, not pin a server worker forever. */
const UPSTREAM_TIMEOUT_MS = 15_000;

async function forward(
  token: string,
  method: "POST" | "DELETE",
  reviewId: string,
): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_URL}/me/reviews/${reviewId}/helpful`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (res.status === 204) return new NextResponse(null, { status: 204, headers: NO_STORE });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: "upstream_unavailable" },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === undefined || typeof body !== "object" || body === null) return badBody();

  const { reviewId } = body as { reviewId?: unknown };
  // Validated before it reaches a URL template. `..%2f..%2f` in this value
  // would otherwise reach endpoints this route never meant to expose, with the
  // caller's own token attached.
  if (!isId(typeof reviewId === "string" ? reviewId : null)) return badBody();

  return forward(auth.token, "POST", reviewId as string);
}

export async function DELETE(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const reviewId = new URL(request.url).searchParams.get("reviewId");
  if (!isId(reviewId)) {
    return NextResponse.json({ error: "missing_review" }, { status: 400, headers: NO_STORE });
  }

  return forward(auth.token, "DELETE", reviewId);
}
