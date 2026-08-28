/**
 * One reader for every error body the admin API can produce.
 *
 * There are three shapes, and every admin screen used to handle only the
 * first — so a category whose template was refused, or a product whose
 * specification keys were rejected, showed "Could not save." and the editor
 * had no way to learn which field was at fault.
 *
 *   1. `{ detail: "Still in use by 3 products…" }` — a deliberate message.
 *   2. `{ detail: [ { loc, msg } ] }` — pydantic field validation.
 *   3. `{ detail: { message, unknown?, missing?, allowed? } }` — the structured
 *      refusals raised by `templates._reject`, `set_score` and `publish`.
 *
 * The third is the one worth the effort: it already names the offending keys,
 * and dropping them on the floor was the difference between a usable CMS and
 * one an editor has to guess at.
 */
export function readableError(body: unknown, fallback = "Could not save."): string {
  if (!body) return fallback;

  const detail = (body as { detail?: unknown }).detail ?? body;

  if (typeof detail === "string") return detail || fallback;

  if (Array.isArray(detail)) {
    // Pydantic. Surface the field, not the raw shape — `loc` is
    // ["body", "tagline"], and only the last segment means anything here.
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined;
    const field = first?.loc?.slice(-1)[0];
    const msg = first?.msg ?? fallback;
    const rest = detail.length > 1 ? ` (+${detail.length - 1} more)` : "";
    return (typeof field === "string" ? `${field}: ${msg}` : msg) + rest;
  }

  if (typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof d.message === "string") parts.push(d.message);

    // The lists are the actionable half. "Not specification fields for Mice"
    // is a shrug; "…: audio.driver, audio.impedance" is an instruction.
    for (const key of ["unknown", "missing", "duplicate"] as const) {
      const value = d[key];
      if (Array.isArray(value) && value.length > 0) {
        parts.push(`${key}: ${value.map(String).join(", ")}`);
      } else if (typeof value === "string" && value) {
        parts.push(`${key}: ${value}`);
      }
    }

    if (parts.length > 0) return parts.join(" — ");
  }

  return fallback;
}

/**
 * The message for an admin write that failed, given the status as well as the
 * body.
 *
 * Two statuses carry something no response body can, because our own proxy
 * produces them after the upstream call failed rather than the API describing
 * what it refused (`lib/admin-guard.ts`):
 *
 *   502 — the connection was refused. The request never reached the API, so
 *         nothing was written and trying again costs nothing.
 *   504 — the API accepted the request and never answered within the 15s
 *         budget. It may have finished the work regardless: FastAPI does not
 *         stop because the caller stopped listening, so a write can land
 *         *after* the browser has been told it failed.
 *
 * The 504 case is the one worth spelling out, and it is not hypothetical — it
 * is how this function came to exist. A bare "The API did not respond in time."
 * invites the obvious response, pressing the button again, and on a create that
 * is how one draft silently becomes two. Callers pass `idempotent` for writes
 * where repeating is harmless — an update, a delete — and those get the
 * shorter advice instead of a warning that does not apply to them.
 */
export function saveError(
  status: number,
  body: unknown,
  options: { idempotent?: boolean; fallback?: string } = {},
): string {
  const { idempotent = false, fallback } = options;

  if (status === 502) {
    return "The API is unreachable, so nothing was saved. Check that it is running, then try again.";
  }

  if (status === 504) {
    return idempotent
      ? "The API did not respond in time. This may have gone through anyway — reload to check before retrying."
      : "The API did not respond in time. It may have been saved anyway — check the list before trying again, or you may create a second copy.";
  }

  return readableError(body, fallback);
}
