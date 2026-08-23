-- ============================================================================
-- Keep the admin door and the shopper door genuinely separate.
--
-- The question this answers is not "can a Google user become an admin" — they
-- cannot, and that was never in doubt. The role lives in `app_metadata`,
-- writable only with the service_role key, and it is re-derived from the
-- signed JWT at every layer: `verify_token()` in the API, `is_admin()` in RLS,
-- the proxy's own check. Three independent gates, none of which the client SDK
-- can reach. `signInWithOAuth` is not an exception to any of them.
--
-- The real exposure runs the other way, and switching Google on creates it:
--
--   Supabase links a federated identity into an EXISTING account whenever the
--   provider asserts the same *verified* email. That is the desired behaviour
--   for shoppers — "sign up with Google" and "sign up with a password" on one
--   address should converge on one profile rather than fork into two.
--
--   Applied to an admin account it means something else entirely. This
--   project's admin is `gavitjayesh08@gmail.com` — a Gmail address. The moment
--   Google sign-in is enabled, control of that Google account becomes a way
--   into the admin user row that never touches the admin's password. The
--   password stops being a factor at all; it is simply routed around.
--
--   TOTP still stands in the way, because `is_admin()` and the API both demand
--   aal2. So this is not an open door. But it reduces two independent factors
--   to one, silently, as a side effect of enabling a sign-in button on the
--   shopper login page — and if that admin has not yet enrolled a factor,
--   `/admin/security` is reachable at aal1 by design so the enrolment can
--   happen, which closes the gap entirely.
--
-- So: an account holding the admin role has exactly one identity, `email`.
-- Enforced at the database, in both directions, because either order produces
-- the same end state.
--
--   1. BEFORE INSERT on auth.identities — refuse to attach a federated
--      identity to an account that is already an admin.
--   2. BEFORE UPDATE on auth.users — refuse to grant the admin role to an
--      account that already has a federated identity.
--
-- Neither trigger touches the shopper path: a password signup inserts a
-- `provider = 'email'` identity, a Google signup inserts `provider = 'google'`
-- against a non-admin row, and both pass straight through.
--
-- The documented admin-creation flow (docs/05-admin-setup.md — create the user
-- in the dashboard, then UPDATE the role) is unaffected: that user has only an
-- email identity at the point the role is granted.
--
-- These raise, and a raising trigger on an auth table fails the operation it
-- guards. That is the intent — an admin who tries to sign in with Google is
-- refused rather than quietly linked. `/login` surfaces it as a generic
-- failure, which is correct: the sign-in page is not the place to disclose
-- which addresses hold staff roles.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. No federated identity may attach to an admin account.
-- ---------------------------------------------------------------------------
create or replace function public.forbid_admin_federated_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Password identities are the admin door and always allowed.
  if new.provider = 'email' then
    return new;
  end if;

  if exists (
    select 1
    from auth.users u
    where u.id = new.user_id
      and coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
  ) then
    raise exception
      'federated sign-in is not available for this account'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists forbid_admin_federated_identity on auth.identities;
create trigger forbid_admin_federated_identity
  before insert on auth.identities
  for each row execute function public.forbid_admin_federated_identity();


-- ---------------------------------------------------------------------------
-- 2. The admin role may not be granted to an account that already has one.
--
-- The mirror of the above. Without it the guarantee holds only for accounts
-- that were admins first, and "promote this existing shopper" — which is how
-- a second admin would most naturally be created — would quietly produce the
-- exact account shape rule 1 exists to prevent.
--
-- Scoped to the transition INTO the role, not to every update of an admin row:
-- an admin's `last_sign_in_at`, tokens and metadata are written constantly and
-- none of that should be re-validated.
-- ---------------------------------------------------------------------------
create or replace function public.forbid_admin_role_on_federated_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') <> 'admin'
     or coalesce(old.raw_app_meta_data ->> 'role', '') = 'admin' then
    return new;
  end if;

  if exists (
    select 1 from auth.identities i
    where i.user_id = new.id and i.provider <> 'email'
  ) then
    raise exception
      'cannot grant the admin role to an account with a federated identity; '
      'remove the federated identity first (see docs/05-admin-setup.md)'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists forbid_admin_role_on_federated_account on auth.users;
create trigger forbid_admin_role_on_federated_account
  before update on auth.users
  for each row execute function public.forbid_admin_role_on_federated_account();


-- ---------------------------------------------------------------------------
-- 3. Same treatment as every other function in this schema.
--
-- Anything in `public` is reachable at /rest/v1/rpc/<name> by anon and
-- authenticated. These are trigger functions with definer rights — exactly the
-- shape 20260820000005_harden_functions.sql revoked, for the reason it gave
-- there. PostgreSQL checks EXECUTE at CREATE TRIGGER time, not per firing, so
-- the triggers are unaffected.
-- ---------------------------------------------------------------------------
revoke execute on function public.forbid_admin_federated_identity()      from anon, authenticated, public;
revoke execute on function public.forbid_admin_role_on_federated_account() from anon, authenticated, public;
