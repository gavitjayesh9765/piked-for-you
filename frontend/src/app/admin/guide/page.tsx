import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { adminGet } from "@/lib/admin-api";
import { AdminPage } from "@/components/admin/Shell";
import { CopyBlock, CopyButton } from "@/components/admin/CopyButton";
import {
  BADGE_FIELDS,
  BADGE_STYLES,
  BRAND_FIELDS,
  CATEGORY_FIELDS,
  FIELD_PROMPTS,
  NEED_LABEL,
  PRODUCT_FIELDS,
  PRODUCT_SECTIONS,
  PUBLISH_CHECKLIST,
  REVIEW_PROMPT,
  STANCES,
  buildFieldSchema,
  buildProductPrompt,
  type FieldDoc,
} from "@/lib/admin-guide";
import type { ScoreCriterionDef, SpecTemplateGroup } from "@/lib/types";

export const metadata: Metadata = { title: "Guide", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The authoring guide (this screen).
 *
 * Two jobs, and the second is the one that earns the page:
 *
 *   **Say what every field is for.** The forms carry hints, but a hint is read
 *   while you are already typing. This is the thing you read once, and come
 *   back to when you cannot remember whether the tagline or the summary is the
 *   one above the fold.
 *
 *   **Hand you a prompt you can paste.** The bottleneck in writing a product
 *   page is not the form, it is the prose. So the prompts here are generated
 *   from the same field list the form enforces — including, per category, the
 *   REAL specification keys and scoring criteria that category resolves to.
 *   A model told to invent field names produces a draft the API rejects; a
 *   model handed the actual keys produces one that pastes straight in.
 */
export default function AdminGuidePage() {
  return (
    <AdminPage
      title="How to add things"
      eyebrow="Reference"
      description="What every field on every form is for, what publishing demands, and prompts you can hand to an AI to draft the writing."
      refreshable={false}
    >
      <div className="grid gap-8 xl:grid-cols-[210px_minmax(0,1fr)]">
        <Contents />

        <div className="min-w-0 space-y-6">
          <Order />
          <ProductFields />
          <PublishChecklist />
          <VerdictStances />
          <Taxonomy />
          <Prompts />
          <Suspense fallback={<SectionShell id="briefs" n="07" title="Category briefs" />}>
            <CategoryBriefs />
          </Suspense>
          <Troubleshooting />
          <Automation />
        </div>
      </div>
    </AdminPage>
  );
}

/* ------------------------------------------------------------------ */

const TOC = [
  ["order", "01 · Order of work"],
  ["products", "02 · Product fields"],
  ["publish", "03 · Publishing"],
  ["stances", "04 · The four verdicts"],
  ["taxonomy", "05 · Categories, brands, badges"],
  ["prompts", "06 · AI prompts"],
  ["briefs", "07 · Category briefs"],
  ["trouble", "08 · When it will not save"],
  ["automation", "09 · Automating this"],
] as const;

function Contents() {
  return (
    <nav aria-label="Guide contents" className="hidden xl:block">
      <div className="sticky top-24">
        <p className="t-eyebrow mb-3">Contents</p>
        <ul className="space-y-1.5">
          {TOC.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block text-body-sm text-ink-muted transition-colors duration-fast hover:text-brand"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function SectionShell({
  id,
  n,
  title,
  hint,
  children,
}: {
  id: string;
  n: string;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="panel scroll-mt-24 p-6 lg:p-8">
      <div className="mb-6 flex items-baseline gap-4 border-b border-line pb-4">
        <span className="font-mono text-label-xs tabular-nums text-brand">{n}</span>
        <div className="min-w-0">
          <h2 className="font-display text-headline-sm text-ink">{title}</h2>
          {hint && <p className="mt-1 max-w-2xl text-body-sm text-ink-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 01 — order of work                                                  */
/* ------------------------------------------------------------------ */

const STEPS: { title: string; body: string; href?: string; hrefLabel?: string }[] = [
  {
    title: "The category first",
    body: "A product cannot exist without one, and the category decides which specification fields and scoring criteria that product may use. Adding those to the category afterwards is fine; discovering mid-write that the field you need does not exist is not.",
    href: "/admin/categories",
    hrefLabel: "Categories",
  },
  {
    title: "Then the brand",
    body: "Same reason. New brands are created active — if one you made is missing from the product form, open it here and check the Active box.",
    href: "/admin/brands",
    hrefLabel: "Brands",
  },
  {
    title: "Badges, if you want any",
    body: "Optional, and better decided before you start writing than bolted on. Only active badges can be attached.",
    href: "/admin/badges",
    hrefLabel: "Badges",
  },
  {
    title: "Save the product as a draft",
    body: "Sections 01–07. Saving never publishes — that is a separate, audited action, so nothing half-written can go live by accident. You land on the edit screen straight afterwards.",
    href: "/admin/products/new",
    hrefLabel: "New product",
  },
  {
    title: "Then everything that needs an id",
    body: "Images, videos, retailer links, the price history and the PickD Score all attach to a product that has to exist first, so they are sections 08–13 on the edit screen and are not on the create form at all.",
  },
  {
    title: "Publish",
    body: "The edit screen tells you what is still missing before you press anything. Publishing with a gap in it is refused, and it names the gap.",
  },
];

function Order() {
  return (
    <SectionShell
      id="order"
      n="01"
      title="The order to do things in"
      hint="Products depend on categories and brands, and half the product form depends on the product already existing. Out of order, you will hit a wall."
    >
      <ol className="grid gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line font-mono text-[10px] tabular-nums text-ink-subtle">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-medium text-ink">
                {s.title}
                {s.href && (
                  <Link
                    href={s.href}
                    className="ml-2 font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
                  >
                    {s.hrefLabel} →
                  </Link>
                )}
              </p>
              <p className="mt-1 max-w-2xl text-body-sm text-ink-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 02 — product fields                                                 */
/* ------------------------------------------------------------------ */

function NeedChip({ need }: { need: FieldDoc["need"] }) {
  const styles =
    need === "save"
      ? "border-brand-line bg-brand-soft text-brand-on-soft"
      : need === "publish"
        ? "border-warn bg-warn-soft text-warn-on-soft"
        : "border-line text-ink-faint";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-xs border px-1.5 py-px font-label text-[9px] font-bold uppercase tracking-[0.08em] ${styles}`}
    >
      {NEED_LABEL[need]}
    </span>
  );
}

function ProductFields() {
  return (
    <SectionShell
      id="products"
      n="02"
      title="Every field on the product form"
      hint="Sections 01–07 are on the create form. 08–13 appear once the draft is saved, because each of them attaches to a product id."
    >
      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line bg-surface-1 px-4 py-3 text-label-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <NeedChip need="save" /> the form will not submit without it
        </span>
        <span className="flex items-center gap-2">
          <NeedChip need="publish" /> saves as a draft; publishing is refused without it
        </span>
        <span className="flex items-center gap-2">
          <NeedChip need="optional" /> genuinely optional
        </span>
      </div>

      <div className="space-y-8">
        {PRODUCT_SECTIONS.map((section) => (
          <div key={section}>
            <h3 className="t-eyebrow mb-3 border-b border-line pb-2">{section}</h3>
            <dl className="grid gap-5">
              {PRODUCT_FIELDS.filter((f) => f.section === section).map((f) => (
                <div key={f.key} className="grid gap-1.5 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-5">
                  <dt className="min-w-0">
                    <span className="block text-body-sm font-medium text-ink">{f.label}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <NeedChip need={f.need} />
                      {f.limit && (
                        <span className="font-mono text-[10px] text-ink-faint">{f.limit}</span>
                      )}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] text-ink-faint">{f.key}</span>
                  </dt>
                  <dd className="min-w-0">
                    <p className="text-body-sm text-ink-muted">{f.what}</p>
                    <p className="mt-1 text-label-xs text-ink-faint">
                      <span className="text-ink-subtle">Appears:</span> {f.where}
                    </p>
                    {f.example && (
                      <p className="mt-1.5 whitespace-pre-line rounded-xs border border-line bg-surface-1 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-ink-muted">
                        {f.example}
                      </p>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-md border border-line bg-surface-1 px-4 py-3">
        <p className="text-body-sm text-ink-muted">
          <strong className="text-ink">Sections 08–13, on the edit screen:</strong> Images ·
          Videos · Where to buy (the Amazon / Flipkart / official links, each with its own price)
          · Price history · PickD Score · Better alternatives. None of them can exist before the
          draft does, which is why the create form has no room for a retailer price.
        </p>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 03 — publish checklist                                              */
/* ------------------------------------------------------------------ */

function PublishChecklist() {
  return (
    <SectionShell
      id="publish"
      n="03"
      title="What publishing demands"
      hint="Ten things. The edit screen lists whichever of them you are still missing, before you press publish rather than after."
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {PUBLISH_CHECKLIST.map((c) => (
          <li key={c.label} className="flex gap-3 rounded-md border border-line px-3.5 py-2.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
            <span className="min-w-0">
              <span className="block text-body-sm text-ink">{c.label}</span>
              <span className="mt-0.5 block text-label-xs text-ink-faint">{c.where}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-2xl text-body-sm text-ink-muted">
        Publishing is separate from saving on purpose, and it is audited. Unpublishing puts a
        product straight back to draft and it is unreachable publicly the moment you do.
        Archiving keeps it and its reviews; deleting removes it and everything filed under it,
        permanently, and asks you to type the name back first.
      </p>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 04 — stances                                                        */
/* ------------------------------------------------------------------ */

function VerdictStances() {
  return (
    <SectionShell
      id="stances"
      n="04"
      title="The four verdicts"
      hint="A closed set, because the product page leads with this value and styles itself from it. Decide it before writing the verdict."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {STANCES.map((s) => (
          <div key={s.value} className="rounded-md border border-line p-4">
            <p className="text-body-sm font-medium text-ink">{s.label}</p>
            <p className="mt-0.5 font-mono text-[10px] text-ink-faint">{s.value}</p>
            <p className="mt-2 text-body-sm text-ink-muted">{s.what}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 05 — taxonomy                                                       */
/* ------------------------------------------------------------------ */

function FieldList({ fields }: { fields: { label: string; key: string; what: string }[] }) {
  return (
    <dl className="grid gap-3">
      {fields.map((f) => (
        <div key={f.key} className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-5">
          <dt className="min-w-0">
            <span className="block text-body-sm text-ink">{f.label}</span>
            <span className="font-mono text-[10px] text-ink-faint">{f.key}</span>
          </dt>
          <dd className="text-body-sm text-ink-muted">{f.what}</dd>
        </div>
      ))}
    </dl>
  );
}

function Taxonomy() {
  return (
    <SectionShell
      id="taxonomy"
      n="05"
      title="Categories, brands and badges"
      hint="Everything a product depends on. All three are content, none of them are hard-coded."
    >
      <div className="space-y-8">
        <div>
          <h3 className="t-eyebrow mb-3 border-b border-line pb-2">Categories</h3>
          <FieldList fields={CATEGORY_FIELDS} />
          <div className="mt-4 rounded-md border border-line bg-surface-1 px-4 py-3 text-body-sm text-ink-muted">
            <p>
              <strong className="text-ink">Templates inherit upward.</strong> Leave a
              category&apos;s scoring criteria or specification template empty and it uses its
              parent&apos;s — which is what you want for a new sub-category. Filling one in stops
              that branch tracking the parent from then on. The editor shows you what is inherited
              and from where, and never pre-fills an inherited template into the edit fields,
              because saving that would silently copy it and freeze it.
            </p>
            <p className="mt-2">
              <strong className="text-ink">Moving a branch</strong> rewrites the URL path of every
              category beneath it, in one transaction. Old links to a moved category will 404.
            </p>
            <p className="mt-2">
              <strong className="text-ink">Deleting</strong> is refused while products or
              sub-categories still depend on it, and the refusal says how many of each. Deactivate
              instead if you only want it hidden — the delete takes the scoring criteria and
              specification template with it.
            </p>
          </div>
        </div>

        <div>
          <h3 className="t-eyebrow mb-3 border-b border-line pb-2">Brands</h3>
          <FieldList fields={BRAND_FIELDS} />
        </div>

        <div>
          <h3 className="t-eyebrow mb-3 border-b border-line pb-2">Badges</h3>
          <FieldList fields={BADGE_FIELDS} />
          <p className="t-eyebrow mb-2 mt-5">Style tokens</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {BADGE_STYLES.map((s) => (
              <li key={s.token} className="rounded-md border border-line px-3.5 py-2.5">
                <span className="font-mono text-[11px] text-ink">{s.token}</span>
                <span className="mt-0.5 block text-body-sm text-ink-muted">{s.what}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 06 — prompts                                                        */
/* ------------------------------------------------------------------ */

function Prompts() {
  return (
    <SectionShell
      id="prompts"
      n="06"
      title="Prompts to draft the writing"
      hint="Copy one, fill in the angle brackets, paste it into whichever assistant you use, then paste the answers back field by field. Every prompt is built from the same field list the form enforces, so the lengths and the required fields are always the real ones."
    >
      <div className="mb-6 rounded-md border border-warn bg-warn-soft px-4 py-3 text-body-sm text-warn-on-soft">
        <strong>Three things no model may decide.</strong> The price — you read that off a live
        listing. The PickD Score — that is your judgement and the API checks it against the
        category. And the hands-on checkbox — a claim that somebody used the product is only ever
        true because a person ticked it.
      </div>

      <div className="space-y-5">
        <CopyBlock
          title="The full draft — start here"
          hint="Produces every written field at once, each under its own heading so you can copy them one at a time. Section 07 below has a version of this with your real specification fields already filled in."
          value={buildProductPrompt()}
        />

        <div>
          <h3 className="t-eyebrow mb-3">One field at a time</h3>
          <div className="space-y-4">
            {FIELD_PROMPTS.map((p) => (
              <CopyBlock key={p.id} title={p.title} hint={p.when} value={p.prompt} tone="quiet" />
            ))}
          </div>
        </div>

        <div>
          <h3 className="t-eyebrow mb-3">Before you publish</h3>
          <CopyBlock
            title="Critique the draft"
            hint="Paste your filled-in fields back and have them pulled apart before a reader does it for you."
            value={REVIEW_PROMPT}
            tone="quiet"
          />
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 07 — per-category briefs, from the live templates                   */
/* ------------------------------------------------------------------ */

interface CategoryRow {
  id: string;
  name: string;
  path?: string[];
  depth?: number;
  specTemplate?: SpecTemplateGroup[] | null;
  scoreCriteria?: ScoreCriterionDef[] | null;
}

async function CategoryBriefs() {
  const { items = [] } = await adminGet<{ items: CategoryRow[] }>("/categories", { items: [] });

  // Only categories that resolve to something. One with neither a template nor
  // criteria has nothing to tell a model that the generic prompt does not.
  const useful = items
    .filter((c) => (c.specTemplate?.length ?? 0) > 0 || (c.scoreCriteria?.length ?? 0) > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SectionShell
      id="briefs"
      n="07"
      title="Category briefs"
      hint="The same prompt as above, but with this category's actual specification fields and scoring criteria written into it. A model told to invent field names produces a draft the API refuses; one handed the real keys produces a draft that pastes straight in."
    >
      {useful.length === 0 ? (
        <p className="text-body-sm text-ink-muted">
          No category defines a specification template or scoring criteria yet. Add one under{" "}
          <Link href="/admin/categories" className="text-brand hover:underline">
            Content → Categories
          </Link>{" "}
          and its brief will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {useful.map((c) => {
            const specFields = (c.specTemplate ?? []).flatMap((g) =>
              g.fields.map((f) => `${g.label} — ${f.label}${f.unit ? ` (${f.unit})` : ""}`),
            );
            const criteria = (c.scoreCriteria ?? []).map((k) => k.label);

            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-body-sm text-ink">{c.name}</p>
                  <p className="mt-0.5 text-label-xs text-ink-faint">
                    {specFields.length} specification{specFields.length === 1 ? " field" : " fields"}
                    {" · "}
                    {criteria.length} scoring criteri{criteria.length === 1 ? "on" : "a"}
                  </p>
                </div>
                <CopyButton
                  label="Copy brief"
                  value={buildProductPrompt({
                    categoryName: c.name,
                    specFields,
                    criteria,
                  })}
                />
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 08 — troubleshooting                                                */
/* ------------------------------------------------------------------ */

const TROUBLE: { q: string; a: string }[] = [
  {
    q: "The brand I just created is not in the product form.",
    a: "Open it under Content → Brands and check Active. New brands are created active now; anything made before that fix was saved inactive, and the product form only offers active brands.",
  },
  {
    q: "The Badges section says “No badges defined yet” but I made some.",
    a: "Same cause. Only active badges are offered. Open each under Content → Badges and tick Active.",
  },
  {
    q: "“You need a category and a brand first”, and I have both.",
    a: "At least one of each has to be ACTIVE. That screen counts what the public endpoints return, and both filter on it.",
  },
  {
    q: "Section 05 says this category has no specification template.",
    a: "It has none, and neither does anything above it. Add one on the category — it then covers every product in that category and everything beneath it.",
  },
  {
    q: "A specification I typed vanished after saving.",
    a: "It was not a field this category's template defines. The editor warns you before you save, listing exactly which rows will be dropped — add the field to the category template first if you want to keep it.",
  },
  {
    q: "The product page 404s even though it saved.",
    a: "Almost always a hand-typed slug. Leave the Slug field blank and let it generate one. Slugs are now cleaned on save, but a product created before that fix may still carry a broken one — open it, retype the slug in lower-case-with-hyphens, and save.",
  },
  {
    q: "The price range renders backwards on the page.",
    a: "Range — low was above Range — high. The form now refuses that on save, and refuses a current price that sits outside the range you gave.",
  },
  {
    q: "Publishing was refused.",
    a: "The message names what is missing, and the same list sits at the top of the edit screen the whole time you are working. Section 03 above has all ten.",
  },
  {
    q: "Deleting a category or brand was refused.",
    a: "Something still depends on it, and the message says how many products or sub-categories. Move them first, or just deactivate it if you only want it hidden.",
  },
  {
    q: "The category select on an existing product looks blank or says “deactivated”.",
    a: "Its category or brand was deactivated after the product was filed. The value is still correct and still saved — do not pick a different one unless you actually mean to refile the product.",
  },
];

function Troubleshooting() {
  return (
    <SectionShell
      id="trouble"
      n="08"
      title="When it will not save, or will not appear"
      hint="The failures that are not obvious from the message on screen."
    >
      <dl className="grid gap-4">
        {TROUBLE.map((t) => (
          <div key={t.q} className="rounded-md border border-line px-4 py-3">
            <dt className="text-body-sm font-medium text-ink">{t.q}</dt>
            <dd className="mt-1.5 text-body-sm text-ink-muted">{t.a}</dd>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* 09 — automation / MCP                                               */
/* ------------------------------------------------------------------ */

function Automation() {
  return (
    <SectionShell
      id="automation"
      n="09"
      title="Automating this"
      hint="What exists today, and what it would take to let a tool write drafts directly."
    >
      <div className="space-y-5">
        <p className="max-w-2xl text-body-sm text-ink-muted">
          Everything on the product form is a plain JSON field on{" "}
          <code className="font-mono text-ink">POST /api/v1/admin/products</code>, which always
          creates a draft — the schema makes publishing impossible from a create call, so a tool
          writing drafts cannot put anything in front of a reader. The field list below is
          generated from the same source as the table in section 02.
        </p>

        <CopyBlock
          title="Field schema"
          hint="Hand this to a tool, or to a model you want emitting JSON rather than prose."
          value={buildFieldSchema()}
          tone="quiet"
        />

        <div className="rounded-md border border-line bg-surface-1 px-4 py-3">
          <p className="t-eyebrow mb-2">An MCP server for this</p>
          <p className="max-w-2xl text-body-sm text-ink-muted">
            Worth doing, and not built yet. The API is the hard half and it already exists: create
            a draft, attach badges, set the score, list the categories with their resolved
            templates. What is missing is a thin MCP wrapper over those endpoints plus a token to
            call them with — an admin bearer token with the same role and MFA the panel requires,
            because the API checks both on every request and would refuse a service key.
          </p>
          <p className="mt-2 max-w-2xl text-body-sm text-ink-muted">
            Until then, the briefs in section 07 do the same job with one more copy and paste:
            they carry the real specification keys, so what comes back fits the form without
            editing.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}
