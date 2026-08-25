import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions.
 *
 * Sessions live in `httpOnly` cookies, so client-side JavaScript cannot read
 * the token — an XSS bug cannot exfiltrate a session.
 */
/** True when Supabase credentials are present. */
export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function createClient() {
  if (!isConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies. Harmless: the proxy
            // refreshes the session on every request, so the write lands there.
          }
        },
      },
    },
  );
}

/**
 * The verified caller, or null.
 *
 * Always uses `getUser()`, never `getSession()`. `getSession()` reads the
 * cookie without validating it, so a tampered cookie would be believed —
 * `getUser()` verifies against the auth server.
 */
/*
 * Wrapped in `cache()` so the request pays for at most ONE `getUser()` round
 * trip however many callers ask. The site layout and the header both need the
 * caller now — the header via its own `identity()` cache, the layout to arm
 * <SessionExpiry> — and without this that is two network calls to the auth
 * server on every public page render, which is precisely the cost the header
 * was restructured to avoid (see the comment in SiteHeader.tsx).
 *
 * Per-render, not cross-request: React clears it between requests, so no
 * caller can ever be handed another visitor's session.
 */
export const getAuthedUser = cache(async function getAuthedUser() {
  // The public site must render without auth configured — browsing needs no
  // session. Returning null (rather than throwing) means "signed out", which
  // is the correct and safe interpretation: it grants nothing.
  if (!isConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return user;
  } catch {
    // Auth service unreachable. Treat as signed out — degrading to "no
    // session" is safe; degrading to "assume admin" would not be.
    return null;
  }
});

/**
 * The outcome of the admin gate.
 *
 * Three states, not two: "signed in with the role but no second factor" is a
 * different situation from "not an admin", and the caller must be able to tell
 * them apart — one gets routed to enrolment, the other gets nothing.
 */
export type AdminGate =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; reason: "anonymous" | "not_admin" }
  // Carries the identity too: this caller proved who they are, they just have
  // not proved it hard enough yet. The enrolment/challenge screen needs to
  // address them by name, and re-deriving that with a second round trip would
  // be reading the same token twice.
  | { ok: false; reason: "mfa_required"; userId: string; email: string | null };

/**
 * Resolve the caller against their **verified** token claims.
 *
 * Uses `getClaims()`, which checks the JWT signature against the project JWKS
 * (or round-trips to the auth server for legacy HS256 projects). Both `role`
 * and `aal` are read from those signed claims — the same two facts, from the
 * same source, that `AuthedUser.is_admin` checks in the API.
 *
 * Every failure path returns a refusal. "We could not determine the AAL" must
 * resolve to "denied", never to "allowed".
 */
export async function getAdminGate(): Promise<AdminGate> {
  if (!isConfigured()) return { ok: false, reason: "anonymous" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return { ok: false, reason: "anonymous" };

    const claims = data.claims;
    const role = (claims.app_metadata as Record<string, unknown> | undefined)?.role;
    if (role !== "admin") return { ok: false, reason: "not_admin" };

    // The `aal` claim is required by Supabase and signed. Anything other than
    // an explicit "aal2" is a password-only session.
    if (claims.aal !== "aal2") {
      return {
        ok: false,
        reason: "mfa_required",
        userId: claims.sub,
        email: typeof claims.email === "string" ? claims.email : null,
      };
    }

    return {
      ok: true,
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    };
  } catch {
    return { ok: false, reason: "anonymous" };
  }
}

/**
 * Whether the caller holds the admin role, ignoring MFA.
 *
 * For *navigation* only — deciding whether to render a link to /admin. Never
 * for gating an action; use `isAdmin()` for that.
 */
export async function hasAdminRole(): Promise<boolean> {
  const gate = await getAdminGate();
  return gate.ok || (!gate.ok && gate.reason === "mfa_required");
}

/**
 * Admin **and** MFA-verified. The gate for every `/admin/api/*` handler.
 *
 * Mirrors `AuthedUser.is_admin` in the API (`app/core/supabase.py`), which
 * re-checks the same claims on the request FastAPI actually serves. This one
 * exists so a password-only admin is refused here rather than being handed a
 * UI whose every button 403s.
 */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminGate()).ok;
}

/**
 * Any verified signed-in caller, plus their token — the shopper equivalent of
 * `getAdminSession`.
 *
 * Claims first, token second, and in that order for the same reason the admin
 * version gives: if this caller is not who the cookie claims, there is no
 * reason to go looking for a token to hand them.
 *
 * This replaces a bare `getAccessToken()` in every `/api/*` shopper handler.
 * That helper read the cookie with `getSession()` and never validated it,
 * which made it the one place in this codebase that relaxed its own rule —
 * stated two functions up — that `getSession()` believes a tampered cookie.
 * It was not exploitable, because FastAPI re-verifies the token it is handed
 * and would reject a forged one, but "the next layer catches it" is how a
 * check goes missing at the layer that eventually stops re-checking.
 *
 * A refusal never carries a token. That is the point of the union: there is no
 * shape of this value that says "denied" while still handing out a credential.
 */
export type UserSession =
  | { ok: true; token: string; userId: string; email: string | null }
  | { ok: false; reason: "anonymous" };

export async function getUserSession(): Promise<UserSession> {
  if (!isConfigured()) return { ok: false, reason: "anonymous" };

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return { ok: false, reason: "anonymous" };

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    // Verified caller, no token to forward. Refusing is the only honest
    // answer: a request with no credential cannot be made on their behalf.
    if (!token) return { ok: false, reason: "anonymous" };

    return {
      ok: true,
      token,
      userId: data.claims.sub,
      email: typeof data.claims.email === "string" ? data.claims.email : null,
    };
  } catch {
    return { ok: false, reason: "anonymous" };
  }
}

/**
 * The access token, for forwarding to the FastAPI backend.
 *
 * Server Components only. Route Handlers must use `getUserSession()` via
 * `lib/user-guard.ts` instead — they are the cookie-authenticated,
 * CSRF-reachable surface, and this function performs no origin check and no
 * claim verification.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * The gate and the token, from one client.
 *
 * Every `/admin/api/*` handler needs both, and calling `isAdmin()` then
 * `getAccessToken()` built the cookie-backed client twice and read the session
 * twice per request. Same two facts, same signed source, one pass.
 *
 * A refusal never carries a token. That is the point of the union: there is no
 * shape of this value that says "denied" while still handing out a credential.
 */
export type AdminSession =
  | { ok: true; token: string; userId: string; email: string | null }
  | { ok: false; reason: "anonymous" | "not_admin" | "mfa_required" };

export async function getAdminSession(): Promise<AdminSession> {
  if (!isConfigured()) return { ok: false, reason: "anonymous" };

  try {
    const supabase = await createClient();

    // Claims first: if this caller is not a verified admin there is no reason
    // to go looking for a token to hand them.
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return { ok: false, reason: "anonymous" };

    const claims = data.claims;
    const role = (claims.app_metadata as Record<string, unknown> | undefined)?.role;
    if (role !== "admin") return { ok: false, reason: "not_admin" };
    if (claims.aal !== "aal2") return { ok: false, reason: "mfa_required" };

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    // Verified admin, no token to forward. Refusing is the only honest answer:
    // a request with no credential cannot be made on their behalf.
    if (!token) return { ok: false, reason: "anonymous" };

    return {
      ok: true,
      token,
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    };
  } catch {
    return { ok: false, reason: "anonymous" };
  }
}
