"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { SearchSelect } from "@/components/ui/SearchSelect";

export interface Section {
  id: string;
  kind: string;
  title: string | null;
  subtitle: string | null;
  displayOrder: number;
  isActive: boolean;
  config: Record<string, unknown>;
}

const KIND_LABEL: Record<string, string> = {
  hero: "Hero",
  category_tiles: "Category tiles",
  top_picks: "Top Picks",
  featured_products: "Featured products",
  category_rail: "Category rail",
  featured_brands: "Featured brands",
  newsletter: "Newsletter signup",
  editorial: "Editorial block",
};

const KIND_NOTE: Record<string, string> = {
  hero: "The value proposition. One per homepage.",
  category_tiles: "Entry tiles, built from categories flagged as homepage tiles.",
  top_picks: "Your curated list, in the order set on the Top Picks screen.",
  featured_products: "Most recently published, automatically.",
  category_rail: "One category's products. Needs a categorySlug below.",
  featured_brands: "Brands flagged as pinned.",
  newsletter: "Email signup with the cadence choice.",
  editorial: "A free-form block.",
};

/**
 * Homepage composer (spec §39).
 *
 * The homepage is data, not a template — the order, titles and which rails
 * appear all live in the database, which is why adding a section here needs no
 * deploy. This screen is the editing surface over that.
 */
export function HomepageComposer({
  initial,
  kinds,
  categorySlugs,
}: {
  initial: Section[];
  kinds: string[];
  categorySlugs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(
    [...initial].sort((a, b) => a.displayOrder - b.displayOrder),
  );
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState(kinds[0] ?? "category_rail");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/admin/api/homepage");
    if (res.ok) {
      const d = await res.json();
      setSections([...d.items].sort((a: Section, b: Section) => a.displayOrder - b.displayOrder));
    }
    router.refresh();
  }

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "— Choose —" },
      ...categorySlugs.map((c) => ({ value: c.slug, label: c.name })),
    ],
    [categorySlugs],
  );

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/admin/api/homepage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError("Could not save that change.");
      return;
    }
    await refresh();
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(next);
    // Order is a plain integer per row — write them all so there are no gaps.
    await Promise.all(
      next.map((s, i) =>
        fetch(`/admin/api/homepage/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: i + 1 }),
        }),
      ),
    );
    await refresh();
  }

  async function add() {
    setError(null);
    const res = await fetch("/admin/api/homepage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: newKind,
        displayOrder: sections.length + 1,
        isActive: true,
        config: newKind === "category_rail" ? { categorySlug: categorySlugs[0]?.slug ?? "" } : {},
      }),
    });
    if (!res.ok) {
      setError("Could not add that section.");
      return;
    }
    setAdding(false);
    await refresh();
  }

  async function remove(id: string) {
    const previous = sections;
    setSections((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/admin/api/homepage/${id}`, { method: "DELETE" });
    if (!res.ok) setSections(previous);
    else await refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="tabular text-body-sm text-ink-subtle">
          {sections.length} sections · {sections.filter((s) => s.isActive).length} live
        </p>
        <div className="flex items-center gap-3">
          {adding && (
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
              className="h-10 rounded-md border border-line bg-surface-0 px-3 text-body-sm text-ink outline-none focus:border-brand-vivid"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k] ?? k}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => (adding ? void add() : setAdding(true))}
            className="inline-flex h-10 items-center rounded-full bg-brand-fill px-5 font-label
                       text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                       shadow-brand transition-all duration-fast hover:brightness-110"
          >
            {adding ? "Add section" : "+ New section"}
          </button>
          {adding && (
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-ink"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      <ul className="grid gap-3">
        {sections.map((s, i) => (
          <li
            key={s.id}
            className={cn("panel p-5", !s.isActive && "opacity-55")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="tabular font-mono text-label-xs text-brand">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-headline-sm text-ink">
                    {KIND_LABEL[s.kind] ?? s.kind}
                  </h3>
                  <p className="mt-0.5 text-label-xs text-ink-faint">{KIND_NOTE[s.kind] ?? ""}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <IconBtn label="Move up" onClick={() => void move(i, i - 1)} disabled={i === 0}>
                  ↑
                </IconBtn>
                <IconBtn
                  label="Move down"
                  onClick={() => void move(i, i + 1)}
                  disabled={i === sections.length - 1}
                >
                  ↓
                </IconBtn>
                <label className="ml-2 flex cursor-pointer items-center gap-2 text-label-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={s.isActive}
                    onChange={(e) => void patch(s.id, { isActive: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[var(--c-brand-fill)]"
                  />
                  Live
                </label>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  className="ml-3 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint hover:text-danger"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-eyebrow">Title</span>
                <input
                  defaultValue={s.title ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (s.title ?? "") &&
                    void patch(s.id, { title: e.target.value || null })
                  }
                  placeholder="Optional"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="t-eyebrow">Subtitle</span>
                <input
                  defaultValue={s.subtitle ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (s.subtitle ?? "") &&
                    void patch(s.id, { subtitle: e.target.value || null })
                  }
                  placeholder="Optional"
                  className={inputCls}
                />
              </label>

              {s.kind === "category_rail" && (
                <label className="block">
                  <span className="t-eyebrow">Category</span>
                  <RailCategory
                    value={String(s.config?.categorySlug ?? "")}
                    options={categoryOptions}
                    onChange={(v) =>
                      void patch(s.id, { config: { ...s.config, categorySlug: v } })
                    }
                  />
                </label>
              )}

              {["top_picks", "featured_products", "category_rail"].includes(s.kind) && (
                <label className="block">
                  <span className="t-eyebrow">Max products</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    defaultValue={Number(s.config?.limit ?? 8)}
                    onBlur={(e) =>
                      void patch(s.id, {
                        config: { ...s.config, limit: Number(e.target.value) || 8 },
                      })
                    }
                    className={cn(inputCls, "tabular")}
                  />
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The rail's category, held locally while the save is in flight.
 *
 * `patch` writes to the API and then re-reads the whole section list, so the
 * prop only catches up a round trip later. The native select this replaced
 * dodged that by being uncontrolled; a combobox has to be controlled, so the
 * chosen value is held here and handed back to the server's answer once it
 * arrives. Without this the field visibly snaps back to the old category for
 * as long as the request takes.
 */
function RailCategory({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <SearchSelect
      value={local}
      onChange={(v) => {
        setLocal(v);
        onChange(v);
      }}
      options={options}
      ariaLabel="Category"
      placeholder="Search categories…"
      emptyLabel="No category matches that."
      className={inputCls}
    />
  );
}

const inputCls =
  "mt-1.5 h-10 w-full rounded-md border border-line bg-surface-0 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast focus:border-brand-vivid";

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-xs text-ink-subtle transition-colors
                 duration-fast hover:bg-surface-2 hover:text-ink
                 disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
