import { NextResponse, type NextRequest } from "next/server";
import { badId, forward, guard, isId } from "@/lib/admin-guard";

/**
 * The two verbs that are not CRUD: `preview` renders what a subscriber would
 * receive, `send` delivers one batch.
 *
 * `action` is checked against a fixed set rather than interpolated. It reaches
 * an upstream path, and an unvalidated segment there is how `..%2f..%2f` gets
 * to an endpoint this route never meant to expose with an admin token attached.
 */
const ACTIONS = { preview: "GET", send: "POST" } as const;

async function handle(request: NextRequest, params: Promise<{ id: string; action: string }>) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id, action } = await params;
  if (!isId(id)) return badId();

  const method = ACTIONS[action as keyof typeof ACTIONS];
  if (!method || method !== request.method) {
    return NextResponse.json({ detail: "Unknown action." }, { status: 404 });
  }

  return forward(auth.token, `/admin/newsletter/campaigns/${id}/${action}`, { method });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  return handle(request, ctx.params);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  return handle(request, ctx.params);
}
