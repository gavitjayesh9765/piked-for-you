"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import type { ProductSummary } from "@/lib/types";

/**
 * Compose and send a newsletter digest.
 *
 * ---------------------------------------------------------------------------
 * WHY SEND IS A BUTTON YOU PRESS MORE THAN ONCE
 *
 * Brevo's free plan is 300 emails a day, shared with every transactional mail
 * the site sends. A list larger than the remaining headroom cannot go out in
 * one pass, so the backend sends in batches and records each delivery — and
 * this screen makes that visible rather than hiding it behind a spinner that
 * means "and now hope".
 *
 * The counter is the honest version of a progress bar: it says how many have
 * gone, how many remain, and when the day's budget is spent. Pressing Send
 * again continues; it cannot double-send, because the per-subscriber record is
 * the primary key of the send log.
 *
 * ---------------------------------------------------------------------------
 * WHY A DRAFT LOCKS ON FIRST SEND
 *
 * Once the first batch has left, some subscribers hold that copy. Editing after
 * that would produce one campaign that said two different things, so the API
 * refuses it and the form goes read-only to match.
 */

type Audience = "all" | "daily" | "weekly" | "deals_only";

interface Campaign {
  id: string;
  subject: string;
  intro: string | null;
  audience: Audience;
  productIds: string[];
  status: "draft" | "sending" | "paused" | "sent" | "failed";
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  audienceSize?: number;
  error?: string | null;
}

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "deals_only", label: "Deals only" },
  // Last, and named for what it does rather than "All": a send to everyone
  // ignores the cadence each person chose, which is a decision worth reading
  // before selecting it.
  { value: "all", label: "Everyone, whatever their cadence" },
];

export function CampaignComposer({
  initial,
  headroom,
  dailyCeiling,
}: {
  initial: Campaign[];
  headroom: number;
  dailyCeiling: number;
}) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initial);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [room, setRoom] = useState(headroom);

  const active = campaigns.find((c) => c.id === open);

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="t-eyebrow">Campaigns</h2>
          <p className="mt-2 text-body-sm text-ink-muted">
            {/* The ceiling is stated up front, not discovered when a send
                stops. It is the single most surprising thing about this
                screen. */}
            {room} of {dailyCeiling} emails left today — the rest is held back for
            confirmations, password resets and price alerts.
          </p>
        </div>
        {open !== "new" && (
          <button
            type="button"
            onClick={() => setOpen("new")}
            className="inline-flex h-11 items-center rounded-full bg-brand-fill px-5 font-label
                       text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on-fill
                       transition-opacity duration-fast hover:opacity-90"
          >
            Compose a digest
          </button>
        )}
      </div>

      {open === "new" && (
        <Editor
          onCancel={() => setOpen(null)}
          onSaved={(c) => {
            setCampaigns((prev) => [c, ...prev]);
            setOpen(c.id);
            router.refresh();
          }}
        />
      )}

      {active && (
        <Editor
          key={active.id}
          campaign={active}
          onCancel={() => setOpen(null)}
          onSaved={(c) => setCampaigns((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
          onSent={(c, nextRoom) => {
            setCampaigns((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            setRoom(nextRoom);
          }}
        />
      )}

      {campaigns.length === 0 && open === null && (
        <p className="mt-6 text-body-sm text-ink-subtle">
          Nothing sent yet. The list has been collecting confirmed addresses — this is where
          they finally get something.
        </p>
      )}

      {campaigns.length > 0 && (
        <ul className="mt-4">
          {campaigns.map((c) => (
            <li key={c.id} className="border-b border-line-faint last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
              >
                <span className="flex min-w-0 items-baseline gap-3">
                  <StatusChip status={c.status} />
                  <span className="truncate text-body-md text-ink">{c.subject}</span>
                </span>
                <span className="tabular shrink-0 font-mono text-label-xs text-ink-muted">
                  {c.status === "draft"
                    ? AUDIENCES.find((a) => a.value === c.audience)?.label
                    : `${c.sentCount}/${c.recipientCount}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Editor({
  campaign,
  onCancel,
  onSaved,
  onSent,
}: {
  campaign?: Campaign;
  onCancel: () => void;
  onSaved: (c: Campaign) => void;
  onSent?: (c: Campaign, headroom: number) => void;
}) {
  const locked = campaign != null && campaign.status !== "draft";

  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [intro, setIntro] = useState(campaign?.intro ?? "");
  const [audience, setAudience] = useState<Audience>(campaign?.audience ?? "weekly");
  const [picks, setPicks] = useState<ProductSummary[]>([]);
  const [pickIds, setPickIds] = useState<string[]>(campaign?.productIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const body = { subject, intro, audience, productIds: pickIds };
      const res = await fetch(
        campaign ? `/admin/api/newsletter/campaigns/${campaign.id}` : "/admin/api/newsletter/campaigns",
        {
          method: campaign ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail ?? "That did not save.");
        return;
      }
      onSaved(data as Campaign);
    } catch {
      setError("That did not save.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!campaign) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/admin/api/newsletter/campaigns/${campaign.id}/send`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.detail ?? "The send did not start.");
        return;
      }
      // Reported plainly, including the reasons a send stops early. "Sent 50,
      // 340 to go" is a fact someone can act on; a green tick is not.
      const reason =
        data.reason === "daily_ceiling"
          ? " Today's budget is spent — continue tomorrow."
          : data.reason === "mail_disabled"
            ? " Mail is switched off (MAIL_PROVIDER)."
            : "";
      setProgress(`Sent ${data.sent}. ${data.remaining} still to go.${reason}`);
      onSent?.(data as Campaign, data.headroom ?? 0);
    } catch {
      setError("The send did not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-line bg-surface-0 p-5 lg:p-6">
      <div className="grid gap-5">
        <Field label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={locked}
            placeholder="What landed this week"
            className={INPUT}
          />
        </Field>

        <Field label="Intro" hint="One or two sentences above the picks. Optional.">
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            disabled={locked}
            rows={3}
            className={cn(INPUT, "resize-y leading-relaxed")}
          />
        </Field>

        <Field label="Send to">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
            disabled={locked}
            className={INPUT}
          >
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Picks" hint="In the order they appear in the email.">
          <PickList
            ids={pickIds}
            picks={picks}
            locked={locked}
            onChange={(ids, list) => {
              setPickIds(ids);
              setPicks(list);
            }}
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-body-sm text-danger">{error}</p>}
      {progress && <p className="mt-4 text-body-sm text-ink">{progress}</p>}
      {campaign?.error && <p className="mt-4 text-body-sm text-danger">{campaign.error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {!locked && (
          <button
            type="button"
            onClick={save}
            disabled={busy || subject.trim().length === 0}
            className="inline-flex h-11 items-center rounded-full border border-line-strong px-5
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink
                       transition-colors duration-fast hover:border-brand hover:text-brand
                       disabled:opacity-50"
          >
            {campaign ? "Save draft" : "Create draft"}
          </button>
        )}

        {campaign && (
          <a
            href={`/admin/api/newsletter/campaigns/${campaign.id}/preview`}
            target="_blank"
            rel="noreferrer"
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle
                       transition-colors duration-fast hover:text-brand"
          >
            Preview
          </a>
        )}

        {campaign && campaign.status !== "sent" && (
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="ml-auto inline-flex h-11 items-center rounded-full bg-brand-fill px-6
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                       text-brand-on-fill transition-opacity duration-fast hover:opacity-90
                       disabled:opacity-50"
          >
            {/* Never just "Send". The label says which of the two things this
                press does, because after the first batch it is a different
                action with the same button. */}
            {campaign.status === "draft" ? "Send first batch" : "Send next batch"}
          </button>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint
                     transition-colors duration-fast hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Search the catalogue, add in order, remove.
 *
 * The same shape as the alternatives picker, which is the established way to
 * choose products in this admin — an editor who has curated Top Picks or an
 * alternatives row already knows how this behaves.
 */
function PickList({
  ids,
  picks,
  locked,
  onChange,
}: {
  ids: string[];
  picks: ProductSummary[];
  locked: boolean;
  onChange: (ids: string[], picks: ProductSummary[]) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const abort = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    abort.current?.abort();
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch(`/admin/api/products/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const body = await res.json();
      setResults((body?.items ?? []) as ProductSummary[]);
    } catch {
      // An aborted request is the normal case here, not a failure.
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void search(term), 220);
    return () => clearTimeout(t);
  }, [term, search]);

  const chosen = ids
    .map((id) => picks.find((p) => p.id === id))
    .filter((p): p is ProductSummary => p != null);

  return (
    <div>
      {chosen.length > 0 && (
        <ul className="mb-3">
          {chosen.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 border-b border-line-faint py-2.5 last:border-b-0"
            >
              <span className="flex min-w-0 items-baseline gap-3">
                <span className="tabular font-mono text-label-xs text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="t-eyebrow shrink-0">{p.brand.name}</span>
                <span className="truncate text-body-sm text-ink">{p.title}</span>
              </span>
              {!locked && (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      ids.filter((x) => x !== p.id),
                      picks.filter((x) => x.id !== p.id),
                    )
                  }
                  className="shrink-0 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint
                             transition-colors duration-fast hover:text-danger"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Ids without a loaded product: a saved draft reopened in a new session
          knows what it picked but has not fetched them yet. Stated rather than
          silently showing a shorter list than the editor chose. */}
      {ids.length > chosen.length && (
        <p className="mb-3 text-body-sm text-ink-subtle">
          {ids.length - chosen.length} more already picked — search to see them, or press Preview
          for the real thing.
        </p>
      )}

      {!locked && (
        <>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search the catalogue by title or brand…"
            className={INPUT}
          />
          {results.length > 0 && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-sm border border-line">
              {results
                .filter((r) => !ids.includes(r.id))
                .map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange([...ids, r.id], [...picks, r]);
                        setTerm("");
                        setResults([]);
                      }}
                      className="flex w-full items-baseline gap-3 border-b border-line-faint px-3 py-2.5
                                 text-left transition-colors duration-fast last:border-b-0 hover:bg-surface-1"
                    >
                      <span className="t-eyebrow shrink-0">{r.brand.name}</span>
                      <span className="truncate text-body-sm text-ink">{r.title}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const INPUT =
  "w-full rounded-sm border border-line bg-surface-0 px-3 py-2.5 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint " +
  "focus:border-brand-vivid disabled:opacity-60";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="t-eyebrow">{label}</span>
      {hint && <span className="mt-1 block text-body-sm text-ink-subtle">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function StatusChip({ status }: { status: Campaign["status"] }) {
  const tone =
    status === "sent"
      ? "border-value-line bg-value-soft text-value-on-soft"
      : status === "failed"
        ? "border-danger-line bg-danger-soft text-danger-on-soft"
        : status === "paused"
          ? "border-warn bg-warn-soft text-warn-on-soft"
          : status === "sending"
            ? "border-brand-line bg-brand-soft text-brand-on-soft"
            : "border-line text-ink-subtle";

  return (
    <span
      className={cn(
        "shrink-0 rounded-xs border px-2 py-0.5 font-label text-label-xs font-semibold uppercase tracking-[0.1em]",
        tone,
      )}
    >
      {status}
    </span>
  );
}
