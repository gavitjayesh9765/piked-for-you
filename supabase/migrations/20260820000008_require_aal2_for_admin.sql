-- ============================================================================
-- Require a second factor for admin authority at the database layer.
--
-- public.is_admin() answered on role alone. FastAPI (app/core/deps.py) and the
-- Next proxy (src/proxy.ts) both additionally require aal2 — RLS did not, so
-- the three layers disagreed about what "admin" means, and the database held
-- the most permissive definition.
--
-- That gap was reachable, not theoretical. NEXT_PUBLIC_SUPABASE_URL and the
-- anon key are public by design, so a password-only (aal1) admin token could
-- be sent straight to PostgREST:
--
--     GET https://<project>.supabase.co/rest/v1/products?status=eq.draft
--     Authorization: Bearer <aal1 admin token>
--
-- ...and every admin-visible row — draft products, all of profiles,
-- activity_logs, contact_messages — was readable and writable without anyone
-- ever entering a TOTP code. REQUIRE_ADMIN_MFA guarded the API and the UI
-- while the database let the same token walk past both.
--
-- All three layers now agree: admin == app_metadata.role 'admin' AND aal2.
--
-- Nothing legitimate regresses. Every admin read and write in this application
-- goes through FastAPI, which holds the service_role key and bypasses RLS
-- outright. RLS is the backstop for direct PostgREST access, which is exactly
-- the path this closes.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
-- Re-pinned deliberately. CREATE OR REPLACE drops the SET clause applied in
-- 20260820000005_harden_functions.sql, so omitting it here would silently
-- un-harden the function this migration exists to harden.
set search_path = public, pg_temp
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      -- Absent claim reads as aal1. "We could not establish the assurance
      -- level" must resolve to "not an admin", never to "allowed".
      and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2',
    false
  );
$$;

comment on function public.is_admin() is
  'True when the caller''s JWT carries app_metadata.role = admin AND has '
  'completed a second factor (aal2). app_metadata is writable only with the '
  'service_role key, and aal is set by the auth server — neither is forgeable '
  'by the user. Mirrors AuthedUser.is_admin in the API.';
