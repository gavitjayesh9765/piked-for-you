import { NextResponse, type NextRequest } from "next/server";
import { badBody, isId, readJson, userGuard, NO_STORE } from "@/lib/user-guard";

/**
 * Save / unsave proxy.
 *
 * The token is in an `httpOnly` cookie the browser cannot read, so the client
 * calls here and this forwards it. The API scopes to the token's user id, so
 * no user id crosses the wire.
 *
 * `userGuard` is the origin check these routes were missing: a cookie the
 * browser attaches automatically is the precondition for CSRF, and
 * `request.json()` parses a body whatever its Content-Type — so a cross-site
 * form posted as `text/plain` reached this handler as a valid request.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** A hung upstream should fail the request, not pin a server worker forever. */
const UPSTREAM_TIMEOUT_MS = 15_000;

async function forward(
  token: string,
  method: "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<NextResponse> {
  try {
    const res = await fetch(`${API_URL}/me${path}`, {
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

  const { productId, note } = body as { productId?: unknown; note?: unknown };
  // Validated before it reaches a URL template on the DELETE side, and before
  // it reaches the API at all here — same reason either way.
  if (!isId(typeof productId === "string" ? productId : null)) return badBody();

  return forward(auth.token, "POST", "/saved", {
    productId,
    note: typeof note === "string" ? note : null,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await userGuard(request);
  if (!auth.ok) return auth.response;

  const productId = new URL(request.url).searchParams.get("productId");
  // Was interpolated straight into the upstream path unvalidated. `..%2f..%2f`
  // in this value reached endpoints this route never meant to expose, with the
  // caller's own token attached.
  if (!isId(productId)) {
    return NextResponse.json({ error: "missing_product" }, { status: 400, headers: NO_STORE });
  }

  return forward(auth.token, "DELETE", `/saved/${productId}`);
}
