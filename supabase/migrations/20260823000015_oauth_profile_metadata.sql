-- ============================================================================
-- Teach handle_new_user() to read an OAuth provider's metadata.
--
-- The trigger was written when email+password was the only door, so it reads
-- exactly one key:
--
--     coalesce(new.raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
--
-- `display_name` is *our* key — PublicAuthForm puts it there from the signup
-- form. Google does not send it. It sends `full_name` and `name` (identical in
-- practice, but both are documented and neither is guaranteed), plus `picture`
-- for the avatar, and Supabase copies the provider's claims into
-- raw_user_meta_data verbatim. So every Google signup fell through to the
-- fallback and landed with a display name of "jayesh.gavit08" — the local part
-- of their address, published on every review they write. The avatar the
-- provider handed us was dropped on the floor at the same time.
--
-- Three things this fixes, in order of how badly they bite:
--
--   1. Read the provider's name. `display_name` still wins, so the password
--      signup path is untouched and a user who later edits their name in the
--      account area is not overwritten (the trigger is INSERT-only anyway).
--
--   2. Clamp to the CHECK constraint. profiles_display_name_len requires 2–80
--      characters. A Google display name is not bounded by our constraint and
--      a long one would raise inside a trigger on auth.users — which fails the
--      *signup itself*, with an opaque 500 and no account created. `left(…,80)`
--      makes that impossible rather than unlikely.
--
--      The lower bound needs the same care from the other direction: an
--      address like `jo@example.com` yields "jo" (fine), but `j@example.com`
--      yields "j" and violates the constraint. nullif() on the too-short value
--      drops through to a literal so no one is ever blocked from signing up by
--      the length of their own email address.
--
--   3. Carry the avatar over, **https only**. `picture` from Google,
--      `avatar_url` for providers that use that key. Nothing here trusts these
--      values: raw_user_meta_data is user-writable and no authorization
--      decision reads it. But this column is served to every reader of a
--      review as the author's avatar, so it ends up in an image URL in someone
--      else's browser — `javascript:` and `data:` have no business in it, and
--      the 500-char column is worth respecting before INSERT rather than
--      during. The API's PATCH /me/profile applies the identical rule; this is
--      the same check on the other door into the same column.
--
-- Definer rights, pinned search_path and the REVOKEs from
-- 20260820000005_harden_functions.sql all survive CREATE OR REPLACE (it keeps
-- the existing ACL and settings), and the trigger keeps pointing at the same
-- function — no CREATE TRIGGER needed, and none wanted: dropping and recreating
-- a trigger on auth.users during a deploy leaves a window where a signup makes
-- no profile at all.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text;
  avatar text;
begin
  -- Our own key first, then what the OAuth providers actually send, then the
  -- email local part. Every branch is nullif'd on the empty string: a provider
  -- that sends `"full_name": ""` should fall through, not win with nothing.
  name := coalesce(
    nullif(trim(meta ->> 'display_name'), ''),
    nullif(trim(meta ->> 'full_name'),    ''),
    nullif(trim(meta ->> 'name'),         ''),
    nullif(trim(split_part(new.email, '@', 1)), '')
  );

  -- Now make it fit profiles_display_name_len (2–80) whatever it turned out
  -- to be. A trigger on auth.users that can raise is a trigger that can break
  -- signup, so this cannot be left to chance.
  name := left(name, 80);
  if name is null or char_length(name) < 2 then
    name := 'Shopper';
  end if;

  avatar := nullif(trim(coalesce(meta ->> 'avatar_url', meta ->> 'picture')), '');
  -- Drop anything that is not a plain https URL of a length the column can
  -- hold. A dropped avatar is a grey circle; a kept one is an attribute value
  -- in another shopper's browser.
  if avatar is not null and (avatar !~ '^https://' or char_length(avatar) > 500) then
    avatar := null;
  end if;

  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email, name, avatar)
  on conflict (id) do nothing;

  return new;
end;
$$;
