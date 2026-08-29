"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { saveError } from "@/lib/admin-errors";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { ScoreCriterionDef, SpecTemplateGroup } from "@/lib/types";
import {
  CategoryTemplateEditor,
  criteriaPayload,
  templatePayload,
  toCriterionRows,
  toGroupRows,
  type CriterionRow,
  type GroupRow,
} from "@/components/admin/CategoryTemplateEditor";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  path: string[];
  depth: number;
  displayOrder: number;
  isActive: boolean;
  showOnHomepage: boolean;
  productCount: number;
  /** Effective template — after inheritance. What products here actually get. */
  scoreCriteria?: ScoreCriterionDef[];
  specTemplate?: SpecTemplateGroup[];
  /** What this row itself defines. Empty means "inherit from my parent". */
  ownScoreCriteria?: ScoreCriterionDef[];
  ownSpecTemplate?: SpecTemplateGroup[];
  /** Which category an inherited template came from. */
  scoreCriteriaSource?: string | null;
  specTemplateSource?: string | null;
}

const ICONS = [
  "headphones", "laptop", "smartphone", "gamepad", "camera",
  "watch", "home", "cable", "monitor", "speaker",
];

/**
 * Category tree editor (spec §23).
 *
 * A real hierarchy, not a flat list — someone shopping for headphones wants
 * Electronics → Audio → Headphones, and the admin has to be able to see and
 * shape that.
 *
 * Reparenting is the operation that needs care: `path` is denormalised onto
 * every descendant so a URL resolves in one query, which means moving a branch
 * rewrites all of it. That happens in a single database function, so the UI
 * just calls it and re-reads.
 *
 * Deletion is refused while products or children still depend on a category.
 * Saying what is in the way beats silently orphaning content.
 */
export function CategoryTree({ initial }: { initial: AdminCategory[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Nest the flat list, ordered by displayOrder then name. */
  const tree = useMemo(() => {
    const byParent = new Map<string | null, AdminCategory[]>();
    for (const c of items) {
      const key = c.parentId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    }
    const walk = (parent: string | null, depth: number): (AdminCategory & { _depth: number })[] =>
      (byParent.get(parent) ?? []).flatMap((c) => [
        { ...c, _depth: depth },
        ...(collapsed.has(c.id) ? [] : walk(c.id, depth + 1)),
      ]);
    return walk(null, 0);
  }, [items, collapsed]);

  const hasChildren = (id: string) => items.some((c) => c.parentId === id);

  async function refresh() {
    const res = await fetch("/admin/api/categories", { cache: "no-store" });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      // A 200 with an unexpected body would otherwise set `items` to
      // undefined and crash the whole tree on the next render.
      if (Array.isArray(body?.items)) setItems(body.items);
    }
    router.refresh();
  }

  async function save(body: Record<string, unknown>, id?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(id ? `/admin/api/categories/${id}` : "/admin/api/categories", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        // Template refusals arrive as an object naming the offending key —
        // "Duplicate group key: display", "Field x needs a label". Reading
        // only the string case turned every one of them into "Could not
        // save." and left the editor with no idea which row was wrong.
        setError(saveError(res.status, d, { idempotent: Boolean(id) }));
        return false;
      }
      await refresh();
      setEditing(null);
      setCreatingUnder(undefined);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: AdminCategory) {
    // Delete sat one unguarded click away from Edit, with no confirmation and
    // no undo — the same defect ResourceManager already fixed for brands and
    // badges. The API refuses a category that still has products or children,
    // but the ones it allows are gone for good, and a deleted category takes
    // its scoring criteria and specification template with it.
    if (
      !window.confirm(
        `Delete the category “${c.name}”? This cannot be undone, and its scoring criteria and specification template go with it.`,
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch(`/admin/api/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      // The API explains *what* is in the way — surface that, not a generic error.
      setError(saveError(res.status, d, { idempotent: true, fallback: "Could not delete." }));
      return;
    }
    await refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-body-sm text-ink-subtle">
          {items.length} categories · {items.filter((c) => c.depth === 0).length} top level
        </p>
        <button
          type="button"
          onClick={() => {
            setCreatingUnder(null);
            setEditing(null);
          }}
          className="inline-flex h-10 items-center rounded-full bg-brand-fill px-5 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110"
        >
          + Top-level category
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      {(creatingUnder !== undefined || editing) && (
        <CategoryEditor
          key={editing?.id ?? `new-${creatingUnder}`}
          category={editing}
          parentId={creatingUnder ?? null}
          parents={items}
          busy={busy}
          onCancel={() => {
            setEditing(null);
            setCreatingUnder(undefined);
            setError(null);
          }}
          onSave={save}
        />
      )}

      <ul className="panel divide-y divide-line overflow-hidden">
        {tree.map((c) => (
          <li
            key={c.id}
            className={cn(
              "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-surface-1",
              !c.isActive && "opacity-55",
            )}
            style={{ paddingLeft: `${c._depth * 24 + 16}px` }}
          >
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  return next;
                })
              }
              aria-label={collapsed.has(c.id) ? "Expand" : "Collapse"}
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-xs font-mono text-[10px]",
                hasChildren(c.id)
                  ? "text-ink-subtle hover:bg-surface-2 hover:text-ink"
                  : "invisible",
              )}
            >
              {collapsed.has(c.id) ? "▸" : "▾"}
            </button>

            <CategoryIcon name={c.icon} className="h-4 w-4 shrink-0 text-ink-subtle" />

            <span className={cn("min-w-0 flex-1", c._depth === 0 && "font-medium")}>
              <span className="text-body-sm text-ink">{c.name}</span>
              <span className="ml-2 font-mono text-label-xs text-ink-faint">/{c.slug}</span>
            </span>

            <span className="flex shrink-0 items-center gap-3">
              {c.showOnHomepage && (
                <span className="rounded-xs border border-brand-line bg-brand-soft px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-brand-on-soft">
                  Tile
                </span>
              )}
              {!c.isActive && (
                <span className="font-label text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                  Hidden
                </span>
              )}
              <span className="tabular w-10 text-right font-mono text-label-xs text-ink-faint">
                {c.productCount || "—"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCreatingUnder(c.id);
                  setEditing(null);
                }}
                className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
              >
                + Sub
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(c);
                  setCreatingUnder(undefined);
                }}
                className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove(c)}
                className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint hover:text-danger"
              >
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryEditor({
  category,
  parentId,
  parents,
  busy,
  onCancel,
  onSave,
}: {
  category: AdminCategory | null;
  parentId: string | null;
  parents: AdminCategory[];
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>, id?: string) => Promise<boolean>;
}) {
  const [f, setF] = useState({
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? "",
    icon: category?.icon ?? "",
    parentId: category?.parentId ?? parentId ?? "",
    displayOrder: String(category?.displayOrder ?? 0),
    isActive: category?.isActive ?? true,
    showOnHomepage: category?.showOnHomepage ?? false,
  });

  // Seeded from what this category *owns*, never from what it inherits — see
  // the note in CategoryTemplateEditor. A new category starts empty, which is
  // the same thing as "inherit from my parent".
  const [criteria, setCriteria] = useState<CriterionRow[]>(() =>
    toCriterionRows(category?.ownScoreCriteria),
  );
  const [groups, setGroups] = useState<GroupRow[]>(() =>
    toGroupRows(category?.ownSpecTemplate),
  );

  // What a new sub-category will inherit is its parent's effective template,
  // not the whole tree's — resolve that from the currently selected parent so
  // the summary stays honest while the parent select is being changed.
  const inheritedFrom = useMemo(
    () => (category ? category : parents.find((p) => p.id === f.parentId) ?? null),
    [category, parents, f.parentId],
  );

  // A category cannot be moved under itself or its own descendant — the
  // database refuses it, but offering the option would be a trap.
  const descendantIds = useMemo(() => {
    if (!category) return new Set<string>();
    const out = new Set<string>([category.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of parents) {
        if (c.parentId && out.has(c.parentId) && !out.has(c.id)) {
          out.add(c.id);
          grew = true;
        }
      }
    }
    return out;
  }, [category, parents]);

  /**
   * Every category this one may be filed under, as a full name path.
   *
   * The select used to indent each row by its depth and show the bare name,
   * which reads correctly only while the list is in tree order. This one can
   * be filtered, and a filtered list is not a tree: two rows called
   * "Accessories" three indents deep say nothing about which branch they are
   * on. The full path says it, and it is also what the editor is typing
   * against — the search matches any segment of it.
   */
  const parentOptions = useMemo(() => {
    const byId = new Map(parents.map((p) => [p.id, p]));
    const pathLabel = (c: AdminCategory): string => {
      const names: string[] = [];
      const seen = new Set<string>();
      let node: AdminCategory | undefined = c;
      while (node && !seen.has(node.id)) {
        seen.add(node.id);
        names.unshift(node.name);
        node = node.parentId ? byId.get(node.parentId) : undefined;
      }
      return names.join(" › ");
    };
    return [
      { value: "", label: "— Top level —" },
      ...parents
        .filter((p) => !descendantIds.has(p.id))
        .map((p) => ({ value: p.id, label: pathLabel(p) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [parents, descendantIds]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(
          {
            name: f.name.trim(),
            slug: f.slug.trim() || undefined,
            description: f.description.trim() || null,
            icon: f.icon || null,
            parentId: f.parentId || null,
            displayOrder: Number(f.displayOrder) || 0,
            isActive: f.isActive,
            showOnHomepage: f.showOnHomepage,
            // Sent as [] when cleared, which the API reads as "go back to
            // inheriting" rather than "no template at all".
            scoreCriteria: criteriaPayload(criteria),
            specTemplate: templatePayload(groups),
          },
          category?.id,
        );
      }}
      className="panel mb-4 border-brand-line p-5"
    >
      <h3 className="mb-4 font-display text-headline-sm text-ink">
        {category ? `Edit ${category.name}` : "New category"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <input
            required
            autoFocus
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className={input}
          />
        </Field>
        <Field label="Slug" hint="Blank generates one from the name.">
          <input
            value={f.slug}
            onChange={(e) => setF({ ...f, slug: e.target.value })}
            className={cn(input, "font-mono")}
          />
        </Field>
        <Field label="Parent" hint="Type to filter — matches anywhere in the path.">
          <SearchSelect
            value={f.parentId}
            onChange={(v) => setF({ ...f, parentId: v })}
            options={parentOptions}
            ariaLabel="Parent"
            placeholder="Search categories…"
            emptyLabel="No category matches that."
            className={input}
          />
        </Field>
        <Field label="Icon">
          <select
            value={f.icon}
            onChange={(e) => setF({ ...f, icon: e.target.value })}
            className={input}
          >
            <option value="">— None —</option>
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" span={2}>
          <input
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            placeholder="Shown at the top of the category page."
            className={input}
          />
        </Field>
        <Field label="Order">
          <input
            type="number"
            value={f.displayOrder}
            onChange={(e) => setF({ ...f, displayOrder: e.target.value })}
            className={cn(input, "tabular")}
          />
        </Field>
        <div className="flex items-end gap-5 pb-1">
          <Check
            label="Active"
            checked={f.isActive}
            onChange={(v) => setF({ ...f, isActive: v })}
          />
          <Check
            label="Homepage tile"
            checked={f.showOnHomepage}
            onChange={(v) => setF({ ...f, showOnHomepage: v })}
          />
        </div>
      </div>

      <CategoryTemplateEditor
        criteria={criteria}
        onCriteriaChange={setCriteria}
        groups={groups}
        onGroupsChange={setGroups}
        inheritedCriteria={inheritedFrom?.scoreCriteria ?? []}
        inheritedGroups={inheritedFrom?.specTemplate ?? []}
        criteriaSource={
          category ? category.scoreCriteriaSource : inheritedFrom?.scoreCriteriaSource ?? inheritedFrom?.name
        }
        groupsSource={
          category ? category.specTemplateSource : inheritedFrom?.specTemplateSource ?? inheritedFrom?.name
        }
        categoryName={category?.name}
      />

      <div className="mt-5 flex items-center gap-4">
        <button
          type="submit"
          disabled={busy || !f.name.trim()}
          className="inline-flex h-10 items-center rounded-full bg-brand-fill px-6 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Saving…" : category ? "Save" : "Create"}
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

const input =
  "mt-1.5 h-10 w-full rounded-md border border-line bg-surface-0 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast focus:border-brand-vivid";

function Field({
  label,
  hint,
  required,
  span,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  span?: 2;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      <span className="t-eyebrow">
        {label}
        {required && <span className="ml-1 text-brand">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-label-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--c-brand-fill)]"
      />
      {label}
    </label>
  );
}
