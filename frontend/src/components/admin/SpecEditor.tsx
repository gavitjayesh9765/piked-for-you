"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { SpecGroup, SpecTemplateGroup } from "@/lib/types";

/**
 * The specifications editor (spec §41).
 *
 * Fields come from the **category**, not from here. A mouse has a sensor and a
 * polling rate; a headphone has a driver and a frequency response; neither has
 * the other's. The API resolves the template up the category tree and rejects
 * any key outside it, so this renders that template and offers no way to
 * invent a field — a form that let you type something the server will refuse
 * is a form that lies. Same contract as ScoreEditor, for the same reason.
 *
 * Values are strings, deliberately. "30 hours", "3 min → 3 hours" and
 * "1/4000 – 30 s" are all real answers, and a numeric input would reject two
 * of the three. The `unit` on a field is a hint next to the input, not
 * something appended to what gets stored — the editor writes the value a
 * reader should see.
 */

/** `groupKey.fieldKey` → value. Flat, because that is what a form wants. */
export type SpecValues = Record<string, string>;

export const specFieldId = (groupKey: string, fieldKey: string) => `${groupKey}.${fieldKey}`;

/** Seed the editor from what a product already has stored. */
export function specValuesFrom(groups: SpecGroup[] | undefined): SpecValues {
  const out: SpecValues = {};
  for (const group of groups ?? []) {
    if (!group.key) continue;
    for (const item of group.items) {
      if (item.key) out[specFieldId(group.key, item.key)] = item.value;
    }
  }
  return out;
}

/**
 * Stored rows the template has no field for.
 *
 * Free-form specs written before templates existed carry no keys, and a
 * product moved between categories keeps the old category's keys. Either way
 * those rows cannot be edited here and will not survive the next save, so the
 * editor is told rather than finding out afterwards.
 */
export function unmappedSpecs(
  groups: SpecGroup[] | undefined,
  template: SpecTemplateGroup[],
): string[] {
  const allowed = new Set(
    template.flatMap((g) => g.fields.map((f) => specFieldId(g.key, f.key))),
  );
  const out: string[] = [];
  for (const group of groups ?? []) {
    for (const item of group.items) {
      const id = group.key && item.key ? specFieldId(group.key, item.key) : null;
      if (!id || !allowed.has(id)) out.push(`${group.label} → ${item.label}`);
    }
  }
  return out;
}

/** Build the API payload: template order, blanks dropped, empty groups gone. */
export function specPayload(
  template: SpecTemplateGroup[],
  values: SpecValues,
): SpecGroup[] {
  const out: SpecGroup[] = [];
  for (const group of template) {
    const items = group.fields
      .map((f) => ({ key: f.key, label: f.label, value: (values[specFieldId(group.key, f.key)] ?? "").trim() }))
      .filter((item) => item.value !== "");
    // An empty "Battery & power" heading on a product page is worse than no
    // heading, so a group nobody filled in is simply not sent.
    if (items.length > 0) out.push({ key: group.key, label: group.label, items });
  }
  return out;
}

export function SpecEditor({
  template,
  values,
  onChange,
  templateSource,
  categoryName,
  unmapped = [],
}: {
  template: SpecTemplateGroup[];
  values: SpecValues;
  onChange: (next: SpecValues) => void;
  /** Category the template came from, when it is not this product's own. */
  templateSource?: string | null;
  categoryName?: string;
  /** Stored rows this template cannot represent. */
  unmapped?: string[];
}) {
  const filled = useMemo(
    () =>
      template.reduce(
        (n, g) => n + g.fields.filter((f) => (values[specFieldId(g.key, f.key)] ?? "").trim() !== "").length,
        0,
      ),
    [template, values],
  );
  const total = useMemo(
    () => template.reduce((n, g) => n + g.fields.length, 0),
    [template],
  );

  if (template.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface-1 px-4 py-3 text-body-sm text-ink-muted">
        This category has no specification template, so this product cannot list
        specifications yet. Add one under{" "}
        <span className="text-ink">Content → Categories</span> — a template
        there covers every product in the category and everything beneath it.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
        <span className="tabular">
          {filled} of {total} fields filled
        </span>
        {templateSource && templateSource !== categoryName && (
          <span className="text-ink-faint">
            · template inherited from{" "}
            <span className="text-ink-subtle">{templateSource}</span>
          </span>
        )}
      </p>

      {unmapped.length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-md border border-warn bg-warn-soft px-4 py-3 text-body-sm text-warn-on-soft"
        >
          <p className="font-medium">
            {unmapped.length} stored{" "}
            {unmapped.length === 1 ? "row is" : "rows are"} not in this
            category&apos;s template and will be dropped when you save:
          </p>
          <p className="mt-1.5 text-warn-on-soft/85">{unmapped.join(" · ")}</p>
          <p className="mt-1.5 text-warn-on-soft/85">
            Copy anything worth keeping into the fields below, or add the field
            to the category template first.
          </p>
        </div>
      )}

      <div className="grid gap-5">
        {template.map((group) => (
          <fieldset key={group.key} className="rounded-lg border border-line bg-surface-1 p-5">
            <legend className="t-eyebrow px-1">{group.label}</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.fields.map((field) => {
                const id = specFieldId(group.key, field.key);
                return (
                  <label key={field.key} className="block min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-body-sm text-ink">{field.label}</span>
                      {field.unit && (
                        <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                          {field.unit}
                        </span>
                      )}
                    </span>
                    <input
                      value={values[id] ?? ""}
                      onChange={(e) => onChange({ ...values, [id]: e.target.value })}
                      placeholder={field.placeholder ?? ""}
                      className={cn(
                        "mt-1.5 h-10 w-full rounded-md border border-line bg-surface-0 px-3",
                        "text-body-sm text-ink outline-none transition-colors duration-fast",
                        "placeholder:text-ink-faint focus:border-brand-vivid",
                      )}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <p className="mt-4 text-label-xs text-ink-faint">
        Blank fields are left off the product page entirely — there is no value
        in a row that says “—”.
      </p>
    </div>
  );
}
