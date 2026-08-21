import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, badBody, badId, forward, guard, isId, readJson } from "@/lib/admin-guard";

/**
 * Set the PickD Score (spec §24).
 *
 * This route did not exist, and neither did any UI that reached it — while a
 * score is one of the six hard requirements `publish_blockers` checks
 * (backend/app/modules/admin/service.py). Every product in the panel was
 * therefore permanently unpublishable: the editor could fill in everything
 * else and the publish button would still refuse, naming a field with no
 * control anywhere in the interface.
 *
 * Criteria keys are validated upstream against the category's configured
 * `score_criteria` — a headphone cannot be scored on refresh rate. The checks
 * here are about shape, so malformed input is a 400 rather than an upstream
 * error the editor cannot read.
 */
const MAX = 10;
const MAX_CRITERIA = 24;

interface Criterion {
  key: string;
  label: string;
  value: number;
  weight?: number | null;
}

function isCriterion(v: unknown): v is Criterion {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.key === "string" &&
    c.key.length > 0 &&
    c.key.length <= 64 &&
    typeof c.label === "string" &&
    c.label.length <= 120 &&
    typeof c.value === "number" &&
    Number.isFinite(c.value) &&
    c.value >= 0 &&
    c.value <= MAX
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guard(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isId(id)) return badId();

  const body = await readJson(request);
  if (!body || typeof body !== "object") return badBody();

  const { overall, criteria } = body as { overall?: unknown; criteria?: unknown };

  if (typeof overall !== "number" || !Number.isFinite(overall) || overall < 0 || overall > MAX) {
    return NextResponse.json(
      { detail: `Overall score must be between 0 and ${MAX}.` },
      { status: 400, headers: NO_STORE },
    );
  }

  const list = criteria ?? [];
  if (!Array.isArray(list) || list.length > MAX_CRITERIA || !list.every(isCriterion)) {
    return NextResponse.json(
      { detail: "Each criterion needs a key, a label and a score from 0 to 10." },
      { status: 400, headers: NO_STORE },
    );
  }

  return forward(auth.token, `/admin/products/${id}/score`, {
    method: "PUT",
    body: {
      overall,
      criteria: list.map((c) => ({
        key: c.key,
        label: c.label,
        value: c.value,
        weight: typeof c.weight === "number" && Number.isFinite(c.weight) ? c.weight : null,
      })),
    },
  });
}
