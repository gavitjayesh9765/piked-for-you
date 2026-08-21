-- ============================================================================
-- Function hardening — closes the WARN-level findings from the Supabase
-- database linter (`get_advisors --type security`).
--
-- Nothing here changes behaviour. It removes two classes of latent risk:
--
--   1. Mutable search_path. A function without a pinned search_path resolves
--      unqualified names against whatever the caller's search_path happens to
--      be. For is_admin() that is the whole ballgame: it is the primitive
--      every RLS policy calls, so a caller who can shadow a name it resolves
--      can influence the answer to "is this person an admin?".
--
--   2. SECURITY DEFINER functions exposed over PostgREST. Anything in `public`
--      is reachable at /rest/v1/rpc/<name> by anon and authenticated.
--      handle_new_user() and sync_helpful_count() are trigger functions: they
--      are meant to run only from their triggers, never as an RPC. They would
--      error out if called directly (no trigger context), but a definer-rights
--      function that strangers can invoke is not something to leave standing
--      on the basis that today's body happens to fail safely.
--
-- Triggers are unaffected by the REVOKEs: PostgreSQL checks EXECUTE on a
-- trigger function at CREATE TRIGGER time, not on each firing, and the
-- auth.users trigger runs as supabase_auth_admin regardless.
-- ============================================================================

-- --- 1. Pin search_path ----------------------------------------------------
alter function public.is_admin()       set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;

-- --- 2. Take the trigger functions off the public API ----------------------
revoke execute on function public.handle_new_user()    from anon, authenticated, public;
revoke execute on function public.sync_helpful_count() from anon, authenticated, public;

-- ============================================================================
-- Deliberately NOT addressed here
--
-- The linter also flags pg_trgm and unaccent as installed in `public`. Moving
-- them means dropping and rebuilding the gin_trgm_ops indexes on
-- products.title and products.tagline, and any operator reference that names
-- them unqualified. That is a real migration with a rebuild cost, not a
-- one-line ALTER, and the exposure is low (these extensions add no
-- privilege-bearing surface). Left for a dedicated change.
--
-- public.rls_auto_enable() is flagged too. It is Supabase platform-managed,
-- not ours, so we do not touch it here.
-- ============================================================================
