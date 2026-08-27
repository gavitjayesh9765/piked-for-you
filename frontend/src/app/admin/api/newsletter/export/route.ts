import { NextResponse, type NextRequest } from "next/server";
import { guard, NO_STORE } from "@/lib/admin-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const UPSTREAM_TIMEOUT_MS = 30_000;

/** The four states the API understands. Anything else is not passed through —
 *  an unrecognised value would otherwise reach the upstream query string. */
const STATES = new Set(["all", "pending", "confirmed", "unsubscribed"]);

/**
 * Download the subscriber list as CSV.
 *
 * Its own handler rather than `forward()`, because `forward()` parses the
 * upstream body as JSON and re-serialises it — which would turn a CSV file
 * into a JSON string and drop the `Content-Disposition` that makes a browser
 * save it rather than render it. The body is passed through as text and the
 * two headers that matter are rebuilt here.
 *
 * This is the piece that keeps the "our list stays ours" claim in
 * docs/10-newsletter-email.md true. The subscribers live in our database, so
 * handing them to Brevo — or to anything else, later — has to be a click.
 */
export async function GET(request: NextRequest) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const requested = request.nextUrl.searchParams.get("state") ?? "confirmed";
  const state = STATES.has(requested) ? requested : "confirmed";

  try {
    const res = await fetch(`${API_URL}/admin/newsletter/export?state=${state}`, {
      headers: { Authorization: `Bearer ${auth.token}`, Accept: "text/csv" },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      return NextResponse.json(
        { detail: "Could not build the export." },
        { status: res.status, headers: NO_STORE },
      );
    }

    return new NextResponse(await res.text(), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sortedchoice-newsletter-${state}.csv"`,
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Upstream unavailable" },
      { status: 502, headers: NO_STORE },
    );
  }
}
