"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Mail delivery, switchable without a deploy.
 *
 * ---------------------------------------------------------------------------
 * WHY "FOLLOW THE ENVIRONMENT" IS AN OPTION AND NOT A BLANK
 *
 * The provider has three states, not two. Leaving this alone means the API's
 * own `MAIL_PROVIDER` decides, which is what every existing deploy already
 * does; choosing Off means a person decided, and it overrides the environment.
 * Collapsing those into one would make opening this screen and pressing Save
 * silently change how a server behaves.
 *
 * So the form always shows what is ACTUALLY in force alongside what is stored
 * here, and says which of the two is deciding. Editing a field that is not the
 * one taking effect is the mistake this screen exists to prevent.
 *
 * ---------------------------------------------------------------------------
 * THE KEY ONLY EVER TRAVELS ONE WAY
 *
 * It is sent, never returned. The API answers with whether one is stored and
 * its last four characters — enough to tell two keys apart, not enough to use
 * one. So the input is always empty on load, and leaving it empty keeps the
 * stored key: saving the from-name must not be able to wipe a working key.
 */

interface Effective {
  provider: string;
  fromEmail: string;
  fromName: string;
  delivers: boolean;
  source: "database" | "environment";
  keyMissing: boolean;
}

interface MailSettings {
  provider: string | null;
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
  apiKeySet: boolean;
  apiKeyLast4: string | null;
  effective: Effective;
  envProvider: string;
}

const PROVIDERS = [
  { value: "", label: "Follow the environment" },
  { value: "brevo", label: "Brevo — send for real" },
  { value: "disabled", label: "Off — accept and drop" },
];

export function MailSettingsForm() {
  const [data, setData] = useState<MailSettings | null>(null);
  const [provider, setProvider] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function hydrate(d: MailSettings) {
    setData(d);
    setProvider(d.provider ?? "");
    setFromEmail(d.fromEmail ?? "");
    setFromName(d.fromName ?? "");
    setReplyTo(d.replyTo ?? "");
    // Never populated from the server, because the server never sends it.
    setApiKey("");
  }

  useEffect(() => {
    let alive = true;
    fetch("/admin/api/mail-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && hydrate(d as MailSettings))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/admin/api/mail-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider || null,
          fromEmail,
          fromName,
          replyTo,
          // Omitted when empty, so a save that is not about the key leaves it be.
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.detail ?? "That did not save.");
        return;
      }
      hydrate(body as MailSettings);
      setSaved(true);
    } catch {
      setError("That did not save.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-body-sm text-ink-subtle">Loading mail settings…</p>;
  }

  const eff = data.effective;

  return (
    <div>
      {/* --- What is actually happening right now ---
          First, and before any input. Someone arriving here during an incident
          needs the current state more than they need the form. */}
      <div
        className={cn(
          "rounded-lg border px-4 py-3.5",
          eff.keyMissing
            ? "border-danger-line bg-danger-soft"
            : eff.delivers
              ? "border-value-line bg-value-soft"
              : "border-line bg-surface-1",
        )}
      >
        <p
          className={cn(
            "font-label text-label-xs font-bold uppercase tracking-[0.12em]",
            eff.keyMissing
              ? "text-danger-on-soft"
              : eff.delivers
                ? "text-value-on-soft"
                : "text-ink-muted",
          )}
        >
          {eff.keyMissing
            ? "Set to send, but no key"
            : eff.delivers
              ? "Mail is going out"
              : "Nothing is being sent"}
        </p>
        <p className="mt-1.5 text-body-sm text-ink-muted">
          Provider <strong className="font-semibold text-ink">{eff.provider}</strong>, decided by
          the {eff.source === "database" ? "setting below" : "API environment"}
          {eff.source === "environment" && (
            <> (<code className="font-mono text-label-xs">MAIL_PROVIDER={data.envProvider}</code>)</>
          )}
          . Sending as <strong className="font-semibold text-ink">{eff.fromEmail}</strong>.
          {eff.keyMissing && (
            <>
              {" "}
              <strong className="font-semibold text-danger-on-soft">
                Every send will fail until a key is saved below.
              </strong>
            </>
          )}
        </p>
      </div>

      <div className="mt-6 grid gap-5">
        <Field
          label="Provider"
          hint="Leave on “Follow the environment” unless you are deliberately overriding it — for an incident, or to switch sending on without a deploy."
        >
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setSaved(false);
            }}
            className={INPUT}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Brevo API key"
          hint={
            data.apiKeySet
              ? `A key ending ${data.apiKeyLast4} is stored. Leave this empty to keep it.`
              : "No key stored — the one in the API environment is being used, if any."
          }
        >
          <input
            type="password"
            value={apiKey}
            autoComplete="off"
            onChange={(e) => {
              setApiKey(e.target.value);
              setSaved(false);
            }}
            placeholder={data.apiKeySet ? "•••••••••• (unchanged)" : "Paste a new key"}
            className={cn(INPUT, "font-mono")}
          />
        </Field>

        <Field
          label="From address"
          hint="Must be on a domain authenticated in Brevo (SPF + DKIM), or every send is rejected at the API."
        >
          <input
            value={fromEmail}
            onChange={(e) => {
              setFromEmail(e.target.value);
              setSaved(false);
            }}
            placeholder={eff.fromEmail}
            className={INPUT}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="From name">
            <input
              value={fromName}
              onChange={(e) => {
                setFromName(e.target.value);
                setSaved(false);
              }}
              placeholder={eff.fromName}
              className={INPUT}
            />
          </Field>
          <Field label="Reply-to" hint="Optional.">
            <input
              value={replyTo}
              onChange={(e) => {
                setReplyTo(e.target.value);
                setSaved(false);
              }}
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      {error && <p className="mt-4 text-body-sm text-danger">{error}</p>}

      <div className="mt-6 flex items-center gap-4 border-t border-line pt-5">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-11 items-center rounded-full bg-brand-fill px-6 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on-fill
                     transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
        >
          Save mail settings
        </button>
        {saved && <span className="text-body-sm text-value">Saved. It takes effect immediately.</span>}
      </div>
    </div>
  );
}

const INPUT =
  "w-full rounded-sm border border-line bg-surface-0 px-3 py-2.5 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

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
      {hint && <span className="mt-1 block max-w-prose text-body-sm text-ink-subtle">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
