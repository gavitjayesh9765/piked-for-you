-- ============================================================================
-- Tighten what a browser can write directly.
--
-- Everything in this file closes the same class of gap: a policy that checks
-- WHICH ROW you may touch, but not WHICH COLUMNS you may set in it.
--
-- That distinction matters here more than in most schemas, because
-- NEXT_PUBLIC_SUPABASE_URL and the anon key are public by design. Every table
-- below is reachable at /rest/v1/<table> with an ordinary user's token,
-- without passing through FastAPI at all. A row-scoped policy is not enough
-- on a table whose columns carry moderation state, storage keys, or an
-- account's active flag.
--
-- RLS `with check` handles the value-shaped rules (a path must start with your
-- own uid). Column-level GRANTs handle the "you may not touch this at all"
-- rules, because a `with check` clause cannot distinguish "unchanged" from
-- "set to the same value", and enumerating every immutable column in a policy
-- expression is a list that silently rots as columns are added.
--
-- Nothing here affects FastAPI: it connects as the table owner, which is
-- exempt from both RLS and column grants, and does its own authorization
-- (app/core/deps.py).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. review_media — the one that leaked across users
--
-- The old insert policy checked only that the parent review was yours:
--
--     with check (exists (select 1 from public.reviews r
--                         where r.id = review_id and r.user_id = auth.uid()))
--
-- `storage_path` was unconstrained. Storage RLS pins uploads to a folder named
-- after your uid, but this column is not storage — it is a *pointer*, and
-- app/modules/reviews/router.py signs whatever it finds here with the
-- service-role key, which is exempt from storage RLS. Pointing a row at
-- `<someone-else>/<their-review>/photo.jpg` and loading your own review page
-- returned a signed URL for their private media.
--
-- `moderation_status` was unconstrained too, so an uploader could ship their
-- own media straight to `approved` and skip the queue entirely.
--
-- Both are now pinned. Compare "reviews: insert own", which has always pinned
-- `status` and `is_featured` — this is the same rule, finally applied to the
-- table that needed it most.
-- ---------------------------------------------------------------------------
drop policy if exists "review_media: insert on own review" on public.review_media;

create policy "review_media: insert on own review"
  on public.review_media for insert
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = auth.uid()
    )
    -- Cannot self-approve. Moderation is the whole point of the column.
    and moderation_status = 'pending'
    -- Cannot point at another user's object. Mirrors the storage policy
    -- `(storage.foldername(name))[1] = auth.uid()::text`, so the row and the
    -- object it names agree about who owns it.
    and storage_path like (auth.uid()::text || '/%')
  );

-- Belt and braces: even inside the policy above, these columns are not the
-- client's to set. The API writes them from what it actually decoded.
revoke insert on public.review_media from anon, authenticated;
grant insert (review_id, kind, storage_path, mime_type, size_bytes,
              width, height, duration_seconds, moderation_status)
  on public.review_media to authenticated;


-- ---------------------------------------------------------------------------
-- 2. reviews — is_featured and helpful_count were writable on UPDATE
--
-- "reviews: insert own" pins `is_featured = false` on the way in. The update
-- policy pins only `status = 'pending'`, so the same user could edit their
-- review afterwards and set `is_featured = true` — self-promoting onto any
-- surface that reads that flag — or write `helpful_count = 99999`, which is
-- a denormalised counter the helpful-votes trigger owns.
--
-- Three columns are a review. The rest is state the system maintains.
-- ---------------------------------------------------------------------------
revoke update on public.reviews from anon, authenticated;
grant update (rating, title, body) on public.reviews to authenticated;

-- Insert still needs the columns the policy already validates.
revoke insert on public.reviews from anon, authenticated;
grant insert (product_id, user_id, rating, title, body, status)
  on public.reviews to authenticated;


-- ---------------------------------------------------------------------------
-- 3. profiles — is_active and email were self-writable
--
-- `using (auth.uid() = id)` scopes the row correctly and says nothing about
-- columns, so a user could PATCH their own row and:
--
--   * set is_active = true, undoing an admin deactivation; or
--   * set email to an address they do not control — which desynchronises this
--     column from auth.users.email, the value every admin screen and review
--     byline actually displays.
--
-- Email changes belong to Supabase Auth, which confirms both addresses.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- 4. saved_products — only the note is editable
--
-- Re-pointing an existing save at a different product_id is not an edit, it is
-- a way to hold a row whose id someone else has seen. Delete and re-save.
-- ---------------------------------------------------------------------------
revoke update on public.saved_products from anon, authenticated;
grant update (note) on public.saved_products to authenticated;


-- ---------------------------------------------------------------------------
-- 5. newsletter_subscribers / contact_messages — no direct client writes
--
-- Both carried `with check (true)`, which is genuinely "anyone may write
-- anything into any column": confirmation and unsubscribe tokens, confirmed_at,
-- signup_ip, and on contact_messages the whole handling side — status,
-- assigned_to, internal_note.
--
-- And because `email` is UNIQUE with no select policy, INSERT itself was an
-- enumeration oracle: a 409 means "already subscribed". That is exactly the
-- leak the login, register and reset forms are all carefully written to avoid.
--
-- Both now go through FastAPI (app/modules/newsletter, app/modules/contact),
-- which generates the tokens with `secrets`, records provenance server-side,
-- and answers identically for a new and an existing address.
-- ---------------------------------------------------------------------------
drop policy if exists "newsletter: public insert" on public.newsletter_subscribers;
drop policy if exists "contact: public insert"    on public.contact_messages;

revoke insert, update, delete on public.newsletter_subscribers from anon, authenticated;
revoke insert, update, delete on public.contact_messages        from anon, authenticated;

-- Admin *reads* stay: the moderation queues are built on them.
-- "newsletter: admin write" and "contact: admin write" are UPDATE policies and
-- are left in place, but the table-level revoke above means they now apply
-- only to the owner connection — i.e. to FastAPI, which checks the role
-- itself. An admin browsing PostgREST directly can read these queues and no
-- longer edit them by hand.


-- ---------------------------------------------------------------------------
-- 6. activity_logs — append-only, and not by hand
--
-- The file that created these policies says it plainly: "An audit log you can
-- rewrite is not an audit log." It then granted INSERT to any admin token,
-- which means an admin could write entries describing things that never
-- happened — forging the record is not meaningfully better than editing it.
--
-- Entries are written by app/core/audit.py inside the same transaction as the
-- mutation they describe, over the owner connection. There is no legitimate
-- caller for a hand-written entry.
-- ---------------------------------------------------------------------------
drop policy if exists "activity_logs: admin insert" on public.activity_logs;
revoke insert, update, delete on public.activity_logs from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 7. Stop future tables inheriting a blanket write grant
--
-- Supabase's default privileges hand anon and authenticated full DML on new
-- tables in `public`, which is why every table above needed an explicit
-- revoke. RLS is still the gate, but a table added without a policy should
-- fail closed at the grant, not depend on someone remembering.
-- ---------------------------------------------------------------------------
alter default privileges in schema public
  revoke insert, update, delete on tables from anon, authenticated;
