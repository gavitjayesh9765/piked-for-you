"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { saveError } from "@/lib/admin-errors";
import { Badge as BadgeChip } from "@/components/ui/Badge";
import type { BadgeStyle } from "@/lib/types";

/**
 * Config-driven CRUD table.
 *
 * Brands and badges are the same screen with different columns, so they share
 * one component rather than being two near-identical files that drift apart.
 * Categories get their own editor because a tree is genuinely a different
 * interaction.
 */
export type FieldType = "text" | "textarea" | "number" | "checkbox" | "select" | "url";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  span?: 2;
  /**
   * The value a *new* row starts with.
   *
   * Without it every checkbox on a create form began unchecked and was
   * submitted as an explicit `false`, which overrode the API's own default.
   * So every brand and badge created here was born inactive: absent from the
   * public site, absent from the product form's brand select, and absent from
   * its badge picker — which is why that section read "No badges defined yet"
   * however many badges existed.
   */
  default?: string | number | boolean;
}

export interface ColumnSpec {
  key: string;
  label: string;
  mono?: boolean;
  /**
   * How the cell draws itself, named rather than supplied.
   *
   * This was a `render?: (row) => ReactNode` callback. Both callers are Server
   * Components, and a function cannot cross the server/client prop boundary —
   * every render of /admin/brands and /admin/badges threw before it reached
   * the table. A token survives serialisation; a closure does not.
   */
  cell?: "badge" | "bool";
  /** Label `cell: "bool"` shows for a truthy value. */
  yes?: string;
  /** Label `cell: "bool"` shows for a falsy one. */
  no?: string;
}

function renderCell(c: ColumnSpec, row: Record<string, unknown>): React.ReactNode {
  if (c.cell === "badge") return badgePreview(row);
  if (c.cell === "bool") return boolCell(row[c.key], c.yes ?? "Yes", c.no);
  return String(row[c.key] ?? "—");
}

export function ResourceManager({
  endpoint,
  initial,
  fields,
  columns,
  singular,
  /** Value shown when a row cannot be deleted — the API explains why. */
  deletable = true,
}: {
  endpoint: string;
  initial: Record<string, unknown>[];
  fields: FieldSpec[];
  columns: ColumnSpec[];
  singular: string;
  deletable?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch(`/admin/api/${endpoint}`, { cache: "no-store" });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      // A 200 with an unexpected body would otherwise set `rows` to undefined
      // and crash the table on the next render.
      if (Array.isArray(body?.items)) setRows(body.items);
    }
    router.refresh();
  }

  async function save(values: Record<string, unknown>, id?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/${endpoint}${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        // Named fields, not "Could not save." — a 422 already says which key
        // was refused, and throwing that away sends the editor hunting.
        setError(saveError(res.status, d, { idempotent: Boolean(id) }));
        return;
      }
      await refresh();
      setEditing(null);
      setCreating(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    // Delete sat one unguarded click away from Edit, with no confirmation and
    // no undo. The API refuses rows that still have dependants, but the ones it
    // allows are gone for good.
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setError(null);
    const res = await fetch(`/admin/api/${endpoint}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      // The API says exactly what still depends on this row — show that.
      setError(saveError(res.status, d, { idempotent: true, fallback: "Could not delete." }));
      return;
    }
    await refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-body-sm text-ink-subtle">
          {rows.length} {rows.length === 1 ? singular : `${singular}s`}
        </p>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
            setError(null);
          }}
          className="inline-flex h-10 items-center rounded-full bg-brand-fill px-5 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110"
        >
          + New {singular}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      {(creating || editing) && (
        <ResourceForm
          key={(editing?.id as string) ?? "new"}
          fields={fields}
          initial={editing}
          singular={singular}
          busy={busy}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
            setError(null);
          }}
          onSave={(v) => save(v, editing?.id as string | undefined)}
        />
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-4 py-3 font-label text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint"
                  >
                    {c.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr
                  key={r.id as string}
                  className={cn(
                    "transition-colors duration-fast hover:bg-surface-1",
                    r.isActive === false && "opacity-55",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn("px-4 py-3 text-body-sm text-ink", c.mono && "font-mono")}
                    >
                      {renderCell(c, r)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(r);
                        setCreating(false);
                        setError(null);
                      }}
                      className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
                    >
                      Edit
                    </button>
                    {deletable && (
                      <button
                        type="button"
                        onClick={() =>
                          void remove(
                            r.id as string,
                            String(r.name ?? `this ${singular}`),
                          )
                        }
                        className="ml-3 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint hover:text-danger"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="dot-matrix border-t border-line py-14 text-center">
            <p className="text-body-md text-ink-muted">Nothing here yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResourceForm({
  fields,
  initial,
  singular,
  busy,
  onCancel,
  onSave,
}: {
  fields: FieldSpec[];
  initial: Record<string, unknown> | null;
  singular: string;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      // Editing reads the stored value — including a stored `false`. Creating
      // has no row to read, so the field's declared default applies.
      const v = initial ? initial[f.key] : f.default;
      out[f.key] = f.type === "checkbox" ? Boolean(v ?? false) : (v ?? "");
    }
    return out;
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const payload: Record<string, unknown> = {};
        for (const f of fields) {
          const v = values[f.key];
          if (f.type === "checkbox") payload[f.key] = Boolean(v);
          else if (f.type === "number") payload[f.key] = Number(v) || 0;
          // A select is a closed set the API declares non-nullable — badge
          // style is `str = "neutral"`, not `str | None`. Falling through to
          // the null branch below sent `style: null` on every create, which
          // pydantic refused, which surfaced as "Could not save.": creating a
          // badge was impossible. Fall back to the first option instead.
          else if (f.type === "select") payload[f.key] = String(v ?? "") || f.options?.[0] || "";
          else payload[f.key] = String(v ?? "").trim() || (f.required ? "" : null);
        }
        onSave(payload);
      }}
      className="panel mb-4 border-brand-line p-5"
    >
      <h3 className="mb-4 font-display text-headline-sm text-ink">
        {initial ? `Edit ${initial.name ?? singular}` : `New ${singular}`}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label
            key={f.key}
            className={cn(
              f.span === 2 && "sm:col-span-2",
              f.type === "checkbox" ? "flex items-start gap-2 pt-6" : "block",
            )}
          >
            {f.type === "checkbox" ? (
              <>
                <input
                  type="checkbox"
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-brand-fill)]"
                />
                <span className="min-w-0">
                  <span className="block text-body-sm text-ink">{f.label}</span>
                  {f.hint && (
                    <span className="mt-0.5 block text-label-xs leading-relaxed text-ink-faint">
                      {f.hint}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="t-eyebrow">
                  {f.label}
                  {f.required && <span className="ml-1 text-brand">*</span>}
                </span>
                {f.type === "textarea" ? (
                  <textarea
                    rows={3}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={cn(inputCls, "mt-1.5 h-auto min-h-[80px] resize-y py-2")}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className={cn(inputCls, "mt-1.5")}
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                    required={f.required}
                    value={String(values[f.key] ?? "")}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={cn(inputCls, "mt-1.5", f.type === "number" && "tabular")}
                  />
                )}
                {f.hint && <span className="mt-1 block text-label-xs text-ink-faint">{f.hint}</span>}
              </>
            )}
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-full bg-brand-fill px-6 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Saving…" : initial ? "Save" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "h-10 w-full rounded-md border border-line bg-surface-0 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast focus:border-brand-vivid";

/** Live preview of a badge, so the style token's effect is visible while editing. */
function badgePreview(row: Record<string, unknown>) {
  return (
    <BadgeChip
      badge={{
        name: String(row.name ?? ""),
        style: (row.style as BadgeStyle) ?? "neutral",
        icon: (row.icon as string) ?? null,
      }}
      size="sm"
    />
  );
}

function boolCell(value: unknown, yes: string, no = "—") {
  return value ? (
    <span className="font-label text-label-xs uppercase tracking-[0.1em] text-value">{yes}</span>
  ) : (
    <span className="text-ink-faint">{no}</span>
  );
}
