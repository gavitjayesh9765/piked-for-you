import type { User } from "@supabase/supabase-js";

/**
 * The name to show for a signed-in user.
 *
 * Three screens resolved this independently — the account home, the settings
 * page and the header — and all three read exactly one key:
 *
 *     user.user_metadata.display_name
 *
 * That is *our* key. PublicAuthForm writes it from the signup form, so it is
 * correct for every password account and empty for every OAuth one: Google
 * sends `full_name` and `name`, and Supabase copies the provider's claims into
 * user_metadata verbatim. So a Google account greeted the header with nothing,
 * the account page with the front half of their email address, and the
 * settings page with the literal words "Not set" next to a field they had no
 * way to set.
 *
 * The order here is deliberately the same as `handle_new_user()` in
 * 20260823000015_oauth_profile_metadata.sql — display_name, full_name, name,
 * email local part. These are two copies of one rule (one in Postgres for the
 * `profiles` row, one here for the live session) and they must not drift: the
 * name on someone's reviews and the name in their own header being different
 * strings is a bug report we would struggle to reproduce.
 *
 * Nothing that reads this trusts it. user_metadata is user-writable and no
 * authorization decision anywhere in this codebase looks at it — this is
 * display text, and it is rendered as text.
 */
export function resolveDisplayName(user: User | null | undefined): string | null {
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  const fromMeta = (key: string): string | null => {
    const value = meta[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    // A provider that sends `"full_name": ""` should fall through to the next
    // candidate, not win the coalesce with nothing.
    return trimmed.length > 0 ? trimmed : null;
  };

  const local = user.email?.split("@")[0]?.trim() || null;

  return fromMeta("display_name") ?? fromMeta("full_name") ?? fromMeta("name") ?? local;
}

/**
 * The provider's avatar, if it gave us one and it is safe to point an `<img>`
 * at.
 *
 * Google sends `picture`; other providers use `avatar_url`. Both arrive inside
 * user-writable metadata, so the scheme is checked rather than assumed — a
 * `javascript:` or `data:` value here would otherwise be handed straight to an
 * attribute that will execute or render it. https only: an http avatar is a
 * mixed-content block in production and a passive downgrade everywhere else.
 */
export function resolveAvatarUrl(user: User | null | undefined): string | null {
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const raw = meta.avatar_url ?? meta.picture;
  if (typeof raw !== "string" || raw.trim() === "") return null;

  try {
    return new URL(raw.trim()).protocol === "https:" ? raw.trim() : null;
  } catch {
    return null;
  }
}

/**
 * How this person signs in, as a label — "Google", "Email and password",
 * "Google, Email and password".
 *
 * Reads `app_metadata.providers` (the full list) rather than
 * `app_metadata.provider` (whichever one was used most recently). Supabase
 * links a Google identity onto an existing password account when the provider
 * asserts the same verified email, so after linking, `provider` alone tells
 * someone they sign in with Google and quietly omits that their password still
 * works — on the one screen whose entire job is to answer that question.
 *
 * `app_metadata` is server-controlled and not writable by the client SDK,
 * which is why this reads it and why the admin role lives there too.
 */
export function resolveSignInMethods(user: User | null | undefined): string[] {
  const app = (user?.app_metadata ?? {}) as Record<string, unknown>;

  const list = Array.isArray(app.providers)
    ? app.providers
    : typeof app.provider === "string"
      ? [app.provider]
      : [];

  const labels = list
    .filter((p): p is string => typeof p === "string")
    .map((p) => (p === "email" ? "Email and password" : p.replace(/^\w/, (c) => c.toUpperCase())));

  return [...new Set(labels)];
}

/** True when the account has no password to reset — OAuth identities only. */
export function isOAuthOnly(user: User | null | undefined): boolean {
  const app = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const list = Array.isArray(app.providers) ? app.providers : [];
  return list.length > 0 && !list.includes("email");
}
