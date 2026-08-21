-- ============================================================================
-- Row Level Security
--
-- This is the third and last wall (see docs/03-architecture.md):
--
--   1. Next.js middleware  — fast redirect. UX only, NEVER a security boundary.
--   2. FastAPI             — verifies the JWT, enforces business rules. The control.
--   3. RLS (this file)     — the database itself refuses the row.
--
-- The point of layer 3 is that a bug in layer 2 cannot leak data. A draft
-- product is unreachable publicly even by direct database access with the
-- anon key — which matters, because the anon key is *designed* to be public.
--
-- Every policy authorises admins via public.is_admin(), which reads
-- app_metadata.role from the signed JWT. app_metadata is writable only with
-- the service_role key, so a user cannot grant themselves the role.
--
-- NOTE: the service_role key bypasses RLS entirely by design. FastAPI holds it
-- and is responsible for its own authorization — RLS backstops everything else.
-- ============================================================================

alter table public.profiles               enable row level security;
alter table public.categories             enable row level security;
alter table public.brands                 enable row level security;
alter table public.badges                 enable row level security;
alter table public.products               enable row level security;
alter table public.product_media          enable row level security;
alter table public.product_scores         enable row level security;
alter table public.product_badges         enable row level security;
alter table public.retailers              enable row level security;
alter table public.product_retailers      enable row level security;
alter table public.reviews                enable row level security;
alter table public.review_media           enable row level security;
alter table public.review_reports         enable row level security;
alter table public.top_picks              enable row level security;
alter table public.homepage_sections      enable row level security;
alter table public.activity_logs          enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — you can read and edit yourself, and nobody else
-- ---------------------------------------------------------------------------
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert policy: rows are created by the on_auth_user_created trigger.
-- No delete policy: profiles cascade from auth.users.

-- ---------------------------------------------------------------------------
-- Taxonomy — public reads active rows, only admins write
-- ---------------------------------------------------------------------------
create policy "categories: public read active"
  on public.categories for select
  using (is_active or public.is_admin());

create policy "categories: admin write"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "brands: public read active"
  on public.brands for select
  using (is_active or public.is_admin());

create policy "brands: admin write"
  on public.brands for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "badges: public read active"
  on public.badges for select
  using (is_active or public.is_admin());

create policy "badges: admin write"
  on public.badges for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "retailers: public read active"
  on public.retailers for select
  using (is_active or public.is_admin());

create policy "retailers: admin write"
  on public.retailers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Products — THE critical policy.
--
-- Drafts and archived products are invisible to everyone except admins,
-- enforced by the database. Spec §38, §61.
-- ---------------------------------------------------------------------------
create policy "products: public read published only"
  on public.products for select
  using (status = 'published' or public.is_admin());

create policy "products: admin write"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- Satellites inherit their parent's visibility, so media/scores/badges/links
-- for a draft product are equally unreachable.
create policy "product_media: follows product visibility"
  on public.product_media for select
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.status = 'published' or public.is_admin())
  ));

create policy "product_media: admin write"
  on public.product_media for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_scores: follows product visibility"
  on public.product_scores for select
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.status = 'published' or public.is_admin())
  ));

create policy "product_scores: admin write"
  on public.product_scores for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_badges: follows product visibility"
  on public.product_badges for select
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.status = 'published' or public.is_admin())
  ));

create policy "product_badges: admin write"
  on public.product_badges for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_retailers: follows product visibility"
  on public.product_retailers for select
  using (
    is_active
    and exists (
      select 1 from public.products p
      where p.id = product_id and (p.status = 'published' or public.is_admin())
    )
  );

create policy "product_retailers: admin write"
  on public.product_retailers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reviews — the IDOR surface. Ownership is enforced here, not just in the API.
-- ---------------------------------------------------------------------------
create policy "reviews: read approved or own"
  on public.reviews for select
  using (status = 'approved' or auth.uid() = user_id or public.is_admin());

-- A user may only insert a review AS THEMSELVES. Passing someone else's
-- user_id is refused by the database.
create policy "reviews: insert own"
  on public.reviews for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'          -- cannot self-approve
    and is_featured = false          -- cannot self-feature
  );

-- Editing returns a review to pending, so an approved review cannot be
-- swapped for different content after the fact.
create policy "reviews: update own"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status = 'pending');

create policy "reviews: delete own"
  on public.reviews for delete
  using (auth.uid() = user_id or public.is_admin());

create policy "reviews: admin moderate"
  on public.reviews for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "review_media: follows review visibility"
  on public.review_media for select
  using (exists (
    select 1 from public.reviews r
    where r.id = review_id
      and (
        (r.status = 'approved' and review_media.moderation_status = 'approved')
        or r.user_id = auth.uid()
        or public.is_admin()
      )
  ));

create policy "review_media: insert on own review"
  on public.review_media for insert
  with check (exists (
    select 1 from public.reviews r
    where r.id = review_id and r.user_id = auth.uid()
  ));

create policy "review_media: delete own"
  on public.review_media for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = auth.uid()
    )
  );

create policy "review_media: admin moderate"
  on public.review_media for update
  using (public.is_admin())
  with check (public.is_admin());

-- Reports are write-only for users: you may file one, but you cannot read
-- other people's reports or see how they were resolved.
create policy "review_reports: insert own"
  on public.review_reports for insert
  with check (auth.uid() = reporter_id);

create policy "review_reports: admin read"
  on public.review_reports for select
  using (public.is_admin());

create policy "review_reports: admin write"
  on public.review_reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Curated content
-- ---------------------------------------------------------------------------
create policy "top_picks: public read active"
  on public.top_picks for select
  using (
    (is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now()))
    or public.is_admin()
  );

create policy "top_picks: admin write"
  on public.top_picks for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "homepage_sections: public read active"
  on public.homepage_sections for select
  using (
    (is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now()))
    or public.is_admin()
  );

create policy "homepage_sections: admin write"
  on public.homepage_sections for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit log — APPEND ONLY.
--
-- There is deliberately no update or delete policy. Without one, RLS denies
-- those operations outright: not even an admin can rewrite history through
-- the API. Spec §60.
-- ---------------------------------------------------------------------------
create policy "activity_logs: admin read"
  on public.activity_logs for select
  using (public.is_admin());

create policy "activity_logs: admin insert"
  on public.activity_logs for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Newsletter & contact — anyone may submit, only admins may read.
--
-- Public insert with no select policy means a submitter cannot enumerate the
-- subscriber list or read anyone else's message.
-- ---------------------------------------------------------------------------
create policy "newsletter: public insert"
  on public.newsletter_subscribers for insert
  with check (true);

create policy "newsletter: admin read"
  on public.newsletter_subscribers for select
  using (public.is_admin());

create policy "newsletter: admin write"
  on public.newsletter_subscribers for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "contact: public insert"
  on public.contact_messages for insert
  with check (true);

create policy "contact: admin read"
  on public.contact_messages for select
  using (public.is_admin());

create policy "contact: admin write"
  on public.contact_messages for update
  using (public.is_admin())
  with check (public.is_admin());
