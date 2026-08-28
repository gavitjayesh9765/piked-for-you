"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ScoreCriterionDef, SpecTemplateField, SpecTemplateGroup } from "@/lib/types";

/**
 * Category template editor (spec §24, §41).
 *
 * A category owns the vocabulary its products are described in: which criteria
 * the SortedChoice Score is broken down by, and which specification fields the
 * product page may list. Before this existed, criteria were seeded onto eight
 * categories and specifications had no schema at all, so a mouse was scored on
 * noise cancellation and listed a frequency response.
 *
 * The important behaviour here is **inheritance, and not breaking it by
 * accident**. An empty template means "use my parent's", which is what a new
 * sub-category should do. So an inherited template is shown as a read-only
 * summary, not pre-loaded into the fields: an editor who opens Mice to rename
 * it must not silently freeze a copy of the Computers template onto it. Taking
 * ownership is an explicit button, and giving it back is Clear.
 *
 * Keys are generated from labels and then left alone. They are the contract
 * with stored product data — renaming "Max DPI" is a label change, but editing
 * its key orphans every value already saved under the old one. Editing is
 * possible, because sometimes it is genuinely needed, but it is not the
 * default path and the UI says why.
 */

/** Labels are prose; keys are identifiers. Derive one from the other. */
function toKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "_")
    .slice(0, 60);
}

const uid = () => Math.random().toString(36).slice(2, 9);

/* ------------------------------------------------------------------ */
/* Rows carry a client id so React keys survive an edit to the key     */
/* field itself — keying on the value would remount the input mid-type */
/* ------------------------------------------------------------------ */

export interface CriterionRow extends ScoreCriterionDef {
  _id: string;
}
export interface FieldRow extends SpecTemplateField {
  _id: string;
}
export interface GroupRow extends Omit<SpecTemplateGroup, "fields"> {
  _id: string;
  fields: FieldRow[];
}

export const toCriterionRows = (list: ScoreCriterionDef[] | null | undefined): CriterionRow[] =>
  (list ?? []).map((c) => ({ ...c, _id: uid() }));

export const toGroupRows = (list: SpecTemplateGroup[] | null | undefined): GroupRow[] =>
  (list ?? []).map((g) => ({
    ...g,
    _id: uid(),
    fields: (g.fields ?? []).map((f) => ({ ...f, _id: uid() })),
  }));

/** Strip client ids and empties for the API. */
export function criteriaPayload(rows: CriterionRow[]): ScoreCriterionDef[] {
  return rows
    .filter((r) => r.label.trim() !== "")
    .map((r) => {
      const out: ScoreCriterionDef = {
        key: (r.key || toKey(r.label)).trim(),
        label: r.label.trim(),
      };
      if (r.weight != null && String(r.weight) !== "") out.weight = Number(r.weight);
      return out;
    });
}

export function templatePayload(rows: GroupRow[]): SpecTemplateGroup[] {
  return rows
    .filter((g) => g.label.trim() !== "")
    .map((g) => ({
      key: (g.key || toKey(g.label)).trim(),
      label: g.label.trim(),
      fields: g.fields
        .filter((f) => f.label.trim() !== "")
        .map((f) => {
          const out: SpecTemplateField = {
            key: (f.key || toKey(f.label)).trim(),
            label: f.label.trim(),
          };
          if (f.unit?.trim()) out.unit = f.unit.trim();
          if (f.placeholder?.trim()) out.placeholder = f.placeholder.trim();
          return out;
        }),
    }));
}

/* ------------------------------------------------------------------ */

export function CategoryTemplateEditor({
  criteria,
  onCriteriaChange,
  groups,
  onGroupsChange,
  inheritedCriteria,
  inheritedGroups,
  criteriaSource,
  groupsSource,
  categoryName,
}: {
  criteria: CriterionRow[];
  onCriteriaChange: (next: CriterionRow[]) => void;
  groups: GroupRow[];
  onGroupsChange: (next: GroupRow[]) => void;
  /** The effective template, for the "inheriting from X" summary. */
  inheritedCriteria: ScoreCriterionDef[];
  inheritedGroups: SpecTemplateGroup[];
  criteriaSource?: string | null;
  groupsSource?: string | null;
  categoryName?: string;
}) {
  const [open, setOpen] = useState(false);

  const ownsCriteria = criteria.length > 0;
  const ownsGroups = groups.length > 0;
  const criteriaInherited = !ownsCriteria && criteriaSource && criteriaSource !== categoryName;
  const groupsInherited = !ownsGroups && groupsSource && groupsSource !== categoryName;

  return (
    <div className="mt-5 border-t border-line pt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="font-mono text-[10px] text-ink-subtle">{open ? "▾" : "▸"}</span>
        <span className="t-eyebrow">Scoring & specification template</span>
        <span className="ml-auto text-label-xs text-ink-faint">
          {ownsCriteria ? `${criteria.length} criteria` : "criteria inherited"} ·{" "}
          {ownsGroups
            ? `${groups.reduce((n, g) => n + g.fields.length, 0)} spec fields`
            : "specs inherited"}
        </span>
      </button>

      {!open && (
        <p className="mt-2 pl-6 text-body-sm text-ink-muted">
          What products in this category are scored on, and which specifications
          they may list.
        </p>
      )}

      {open && (
        <div className="mt-5 grid gap-6">
          {/* ---------------- Scoring criteria ---------------- */}
          <Block
            title="SortedChoice Score criteria"
            hint="The breakdown shown under the score. The API rejects any criterion not listed here."
            inherited={Boolean(criteriaInherited)}
            source={criteriaSource}
            summary={inheritedCriteria.map((c) => c.label)}
            onAdopt={() => onCriteriaChange(toCriterionRows(inheritedCriteria))}
            onClear={() => onCriteriaChange([])}
            owns={ownsCriteria}
          >
            <div className="grid gap-2">
              {criteria.map((row, i) => (
                <div key={row._id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)_70px_auto] items-center gap-2">
                  <input
                    value={row.label}
                    placeholder="Sensor accuracy"
                    onChange={(e) => {
                      const label = e.target.value;
                      const next = [...criteria];
                      // Follow the label until someone edits the key by hand —
                      // after that the key is theirs and we stop touching it.
                      const autoKey = !row.key || row.key === toKey(row.label);
                      next[i] = { ...row, label, key: autoKey ? toKey(label) : row.key };
                      onCriteriaChange(next);
                    }}
                    className={rowInput}
                  />
                  <input
                    value={row.key}
                    placeholder="sensor"
                    onChange={(e) => {
                      const next = [...criteria];
                      next[i] = { ...row, key: e.target.value };
                      onCriteriaChange(next);
                    }}
                    className={cn(rowInput, "font-mono text-label-xs")}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={row.weight ?? ""}
                    placeholder="1"
                    aria-label="Weight"
                    onChange={(e) => {
                      const next = [...criteria];
                      next[i] = { ...row, weight: e.target.value === "" ? null : Number(e.target.value) };
                      onCriteriaChange(next);
                    }}
                    className={cn(rowInput, "tabular text-center")}
                  />
                  <RemoveButton
                    label={`Remove ${row.label || "criterion"}`}
                    onClick={() => onCriteriaChange(criteria.filter((_, n) => n !== i))}
                  />
                </div>
              ))}
            </div>

            {criteria.length > 0 && (
              <p className="mt-2 text-label-xs text-ink-faint">
                Label · key · weight. Blank weight counts as 1.
              </p>
            )}

            <AddButton
              label="+ Criterion"
              onClick={() =>
                onCriteriaChange([...criteria, { _id: uid(), key: "", label: "", weight: null }])
              }
            />
          </Block>

          {/* ---------------- Specification template ---------------- */}
          <Block
            title="Specification fields"
            hint="Grouped exactly as they appear on the product page. Products may only fill these in."
            inherited={Boolean(groupsInherited)}
            source={groupsSource}
            summary={inheritedGroups.map(
              (g) => `${g.label} (${g.fields.length})`,
            )}
            onAdopt={() => onGroupsChange(toGroupRows(inheritedGroups))}
            onClear={() => onGroupsChange([])}
            owns={ownsGroups}
          >
            <div className="grid gap-4">
              {groups.map((group, gi) => (
                <div key={group._id} className="rounded-md border border-line bg-surface-0 p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)_auto] items-center gap-2">
                    <input
                      value={group.label}
                      placeholder="Sensor & tracking"
                      onChange={(e) => {
                        const label = e.target.value;
                        const next = [...groups];
                        const autoKey = !group.key || group.key === toKey(group.label);
                        next[gi] = { ...group, label, key: autoKey ? toKey(label) : group.key };
                        onGroupsChange(next);
                      }}
                      className={cn(rowInput, "font-medium")}
                    />
                    <input
                      value={group.key}
                      placeholder="sensor"
                      onChange={(e) => {
                        const next = [...groups];
                        next[gi] = { ...group, key: e.target.value };
                        onGroupsChange(next);
                      }}
                      className={cn(rowInput, "font-mono text-label-xs")}
                    />
                    <RemoveButton
                      label={`Remove group ${group.label || ""}`}
                      onClick={() => onGroupsChange(groups.filter((_, n) => n !== gi))}
                    />
                  </div>

                  <div className="mt-2 grid gap-2 border-l border-line-faint pl-3">
                    {group.fields.map((field, fi) => (
                      <div
                        key={field._id}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,120px)_minmax(0,70px)_minmax(0,1fr)_auto] items-center gap-2"
                      >
                        <input
                          value={field.label}
                          placeholder="Max DPI"
                          onChange={(e) => {
                            const label = e.target.value;
                            const next = [...groups];
                            const fields = [...group.fields];
                            const autoKey = !field.key || field.key === toKey(field.label);
                            fields[fi] = { ...field, label, key: autoKey ? toKey(label) : field.key };
                            next[gi] = { ...group, fields };
                            onGroupsChange(next);
                          }}
                          className={rowInput}
                        />
                        <input
                          value={field.key}
                          placeholder="max_dpi"
                          onChange={(e) => {
                            const next = [...groups];
                            const fields = [...group.fields];
                            fields[fi] = { ...field, key: e.target.value };
                            next[gi] = { ...group, fields };
                            onGroupsChange(next);
                          }}
                          className={cn(rowInput, "font-mono text-label-xs")}
                        />
                        <input
                          value={field.unit ?? ""}
                          placeholder="DPI"
                          aria-label="Unit"
                          onChange={(e) => {
                            const next = [...groups];
                            const fields = [...group.fields];
                            fields[fi] = { ...field, unit: e.target.value };
                            next[gi] = { ...group, fields };
                            onGroupsChange(next);
                          }}
                          className={cn(rowInput, "text-center")}
                        />
                        <input
                          value={field.placeholder ?? ""}
                          placeholder="25,600"
                          aria-label="Example value"
                          onChange={(e) => {
                            const next = [...groups];
                            const fields = [...group.fields];
                            fields[fi] = { ...field, placeholder: e.target.value };
                            next[gi] = { ...group, fields };
                            onGroupsChange(next);
                          }}
                          className={cn(rowInput, "text-ink-muted")}
                        />
                        <RemoveButton
                          label={`Remove field ${field.label || ""}`}
                          onClick={() => {
                            const next = [...groups];
                            next[gi] = { ...group, fields: group.fields.filter((_, n) => n !== fi) };
                            onGroupsChange(next);
                          }}
                        />
                      </div>
                    ))}

                    <AddButton
                      label="+ Field"
                      onClick={() => {
                        const next = [...groups];
                        next[gi] = {
                          ...group,
                          fields: [
                            ...group.fields,
                            { _id: uid(), key: "", label: "", unit: "", placeholder: "" },
                          ],
                        };
                        onGroupsChange(next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {groups.length > 0 && (
              <p className="mt-2 text-label-xs text-ink-faint">
                Field row: label · key · unit · example. The unit is a hint beside
                the input, not appended to the saved value.
              </p>
            )}

            <AddButton
              label="+ Group"
              onClick={() => onGroupsChange([...groups, { _id: uid(), key: "", label: "", fields: [] }])}
            />
          </Block>

          <p className="text-label-xs text-ink-faint">
            Keys are the contract with data already saved. Renaming a{" "}
            <em className="not-italic text-ink-subtle">label</em> is safe; changing a{" "}
            <em className="not-italic text-ink-subtle">key</em> orphans values stored
            under the old one.
          </p>
        </div>
      )}
    </div>
  );
}

function Block({
  title,
  hint,
  inherited,
  source,
  summary,
  onAdopt,
  onClear,
  owns,
  children,
}: {
  title: string;
  hint: string;
  inherited: boolean;
  source?: string | null;
  summary: string[];
  onAdopt: () => void;
  onClear: () => void;
  owns: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="font-display text-body-md text-ink">{title}</h4>
        {owns && (
          <button
            type="button"
            onClick={onClear}
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint hover:text-danger"
          >
            Clear & inherit
          </button>
        )}
      </div>
      <p className="mb-3 text-body-sm text-ink-muted">{hint}</p>

      {inherited ? (
        <div className="rounded-md border border-dashed border-line bg-surface-0 px-4 py-3">
          <p className="text-body-sm text-ink-muted">
            Inherited from <span className="text-ink">{source}</span>
            {summary.length > 0 && (
              <>
                : <span className="text-ink-subtle">{summary.join(" · ")}</span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onAdopt}
            className="mt-3 font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
          >
            Override for this category
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 justify-self-start font-label text-label-xs uppercase tracking-[0.1em]
                 text-ink-subtle transition-colors duration-fast hover:text-brand"
    >
      {label}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-xs text-ink-faint
                 transition-colors duration-fast hover:bg-danger-soft hover:text-danger"
    >
      ×
    </button>
  );
}

const rowInput =
  "h-9 w-full min-w-0 rounded-md border border-line bg-surface-0 px-2.5 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";
