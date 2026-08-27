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
