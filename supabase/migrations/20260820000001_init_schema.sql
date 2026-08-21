-- ============================================================================
-- PickDForYou — initial schema
--
-- Converted from the SQLAlchemy models in backend/app/models/, with two
-- changes for Supabase:
--
--   * `users`       -> `profiles`, keyed 1:1 to auth.users. Supabase Auth owns
--                      credentials; we never store a password.
--   * `admin_users` -> removed entirely. An admin is an auth.users row whose
--                      app_metadata.role = 'admin'. app_metadata is writable
--                      ONLY with the service_role key, so there is no code path
--                      by which a user grants themselves the role.
--
-- Design rules carried over from the spec:
--   * Normalised relational core; JSONB only where the shape is genuinely
--     category-dependent (spec §41).
--   * Every table carries created_at / updated_at.
--   * Constraints encode product rules so a bug in one layer cannot violate them.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";      -- trigram search (spec §33)
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The authorization primitive used by every RLS policy.
--
-- Reads the role from the *signed* JWT's app_metadata. Deliberately NOT
-- user_metadata: users can write that, so trusting it would hand out admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

comment on function public.is_admin() is
  'True when the caller''s JWT carries app_metadata.role = admin. app_metadata is '
  'writable only with the service_role key, never by the user.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — public user data, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text        not null,
  display_name  text        not null,
  avatar_url    text,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_len check (char_length(display_name) between 2 and 80)
);

create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Mirror new auth.users rows into profiles automatically.
-- SECURITY DEFINER because it runs from the auth schema's trigger context.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Taxonomy (spec §21–§23)
-- ---------------------------------------------------------------------------
create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  name              text        not null,
  slug              text        not null unique,
  description       text,
  icon              text,
  image_url         text,
  parent_id         uuid references public.categories(id) on delete set null,
  -- Denormalised ancestor slug chain: resolves /c/electronics/audio/headphones
  -- in one indexed query instead of a recursive walk. Rewritten on move.
  path              jsonb       not null default '[]'::jsonb,
  depth             integer     not null default 0,
  display_order     integer     not null default 0,
  is_active         boolean     not null default true,
  show_on_homepage  boolean     not null default false,
  -- Genuinely per-category, hence JSONB (spec §17, §24)
  filter_config     jsonb       not null default '{}'::jsonb,
  score_criteria    jsonb       not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index categories_parent_idx      on public.categories (parent_id);
create index categories_active_order_idx on public.categories (is_active, display_order);
create index categories_path_idx        on public.categories using gin (path);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create table public.brands (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  slug          text        not null unique,
  logo_url      text,
  description   text,
  website       text,
  is_active     boolean     not null default true,
  is_pinned     boolean     not null default false,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index brands_pinned_idx on public.brands (is_pinned, display_order);

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

-- `style` is a design-token name, not a colour: the admin picks from the
-- system's vocabulary so a new badge cannot introduce an off-palette hue.
create table public.badges (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  slug          text        not null unique,
  icon          text,
  style         text        not null default 'neutral',
  description   text,
  is_active     boolean     not null default true,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint badges_style_valid
    check (style in ('editorial', 'brand', 'value', 'warn', 'neutral'))
);

create trigger badges_set_updated_at
  before update on public.badges
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products (spec §18–§26)
-- ---------------------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  title              text        not null,
  slug               text        not null unique,
  brand_id           uuid        not null references public.brands(id)     on delete restrict,
  category_id        uuid        not null references public.categories(id) on delete restrict,

  -- The one-line reason this product is worth considering. Rendered on every
  -- card: a card without it is a listing, not a recommendation (spec §51).
  tagline            text        not null default '',
  short_description  text,
  description        text,

  -- Money is numeric, never float. Queried and sorted on, so real columns.
  currency           text        not null default 'INR',
  price_current      numeric(12,2),
  price_min          numeric(12,2),
  price_max          numeric(12,2),
  price_updated_at   timestamptz,

  -- PickD Verdict (spec §25) — ordered short strings, never queried individually
  verdict            text,
  best_for           jsonb       not null default '[]'::jsonb,
  not_ideal_for      jsonb       not null default '[]'::jsonb,
  pros               jsonb       not null default '[]'::jsonb,
  cons               jsonb       not null default '[]'::jsonb,
  specifications     jsonb       not null default '[]'::jsonb,

  -- Only 'published' is publicly visible (spec §38, §61)
  status             text        not null default 'draft',
  published_at       timestamptz,

  meta_title         text,
  meta_description   text,
  og_image_url       text,

  -- Denormalised community aggregates, recomputed on moderation, so no card
  -- ever needs an aggregate query (spec §48).
  rating_average     numeric(3,2),
  rating_count       integer     not null default 0,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint products_status_valid
    check (status in ('draft', 'published', 'archived')),
  constraint products_price_range_ordered
    check (price_min is null or price_max is null or price_min <= price_max),
  constraint products_rating_range
    check (rating_average is null or rating_average between 0 and 5)
);

create index products_category_status_idx on public.products (category_id, status);
create index products_status_published_idx on public.products (status, published_at desc);
create index products_brand_idx            on public.products (brand_id);
create index products_price_idx            on public.products (price_current);
-- Search (spec §33)
create index products_title_trgm_idx       on public.products using gin (title gin_trgm_ops);
create index products_tagline_trgm_idx     on public.products using gin (tagline gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Files live in Supabase Storage; these rows hold metadata and a path only.
create table public.product_media (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid        not null references public.products(id) on delete cascade,
  kind             text        not null,
  storage_path     text        not null,
  thumbnail_path   text,
  alt              text,
  mime_type        text,
  size_bytes       integer,
  width            integer,
  height           integer,
  duration_seconds integer,
  -- Drives drag-and-drop ordering; position 0 is the primary image (spec §19)
  display_order    integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint product_media_kind_valid check (kind in ('image', 'video'))
);

create index product_media_product_order_idx
  on public.product_media (product_id, display_order);

create trigger product_media_set_updated_at
  before update on public.product_media
  for each row execute function public.set_updated_at();

-- `overall` is a real column because it is sorted and filtered on; `criteria`
-- is JSONB because the criteria themselves are per-category (spec §24).
create table public.product_scores (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid        not null unique references public.products(id) on delete cascade,
  overall    numeric(3,1) not null,
  criteria   jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_scores_range check (overall >= 0 and overall <= 10)
);

create index product_scores_overall_idx on public.product_scores (overall desc);

create trigger product_scores_set_updated_at
  before update on public.product_scores
  for each row execute function public.set_updated_at();

create table public.product_badges (
  product_id    uuid    not null references public.products(id) on delete cascade,
  badge_id      uuid    not null references public.badges(id)   on delete cascade,
  display_order integer not null default 0,
  primary key (product_id, badge_id)
);

create table public.retailers (
  id                 uuid primary key default gen_random_uuid(),
  name               text        not null,
  slug               text        not null unique,
  logo_url           text,
  is_active          boolean     not null default true,
  display_order      integer     not null default 0,
  -- Affiliate tag template, kept server-side so tracking parameters are never
  -- assembled in the browser.
  affiliate_template text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger retailers_set_updated_at
  before update on public.retailers
  for each row execute function public.set_updated_at();

create table public.product_retailers (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid        not null references public.products(id)  on delete cascade,
  retailer_id      uuid        not null references public.retailers(id) on delete cascade,
  url              text        not null,
  display_price    numeric(12,2),
  is_active        boolean     not null default true,
  price_checked_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint product_retailers_one_per_retailer unique (product_id, retailer_id)
);

create index product_retailers_product_idx on public.product_retailers (product_id);

create trigger product_retailers_set_updated_at
  before update on public.product_retailers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reviews (spec §28–§31)
--
-- Note the absence of an is_verified_buyer column: there is no purchase
-- verification mechanism, so the schema offers no place to claim one (§31).
-- ---------------------------------------------------------------------------
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid        not null references public.products(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  rating          integer     not null,
  title           text,
  body            text        not null,
  status          text        not null default 'pending',
  moderated_by    uuid references auth.users(id) on delete set null,
  moderated_at    timestamptz,
  moderation_note text,
  is_featured     boolean     not null default false,
  helpful_count   integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_status_valid
    check (status in ('pending', 'approved', 'rejected', 'hidden', 'reported')),
  constraint reviews_body_len check (char_length(body) between 10 and 5000),
  -- One review per user per product, or the community average is trivially gameable
  constraint reviews_one_per_user unique (product_id, user_id)
);

create index reviews_product_status_idx on public.reviews (product_id, status);
create index reviews_user_idx           on public.reviews (user_id);
create index reviews_moderation_idx     on public.reviews (status, created_at);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create table public.review_media (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid        not null references public.reviews(id) on delete cascade,
  kind              text        not null,
  storage_path      text        not null,
  thumbnail_path    text,
  mime_type         text        not null,
  size_bytes        integer     not null,
  width             integer,
  height            integer,
  duration_seconds  integer,
  moderation_status text        not null default 'pending',
  display_order     integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint review_media_kind_valid check (kind in ('image', 'video')),
  -- The 30-second cap from spec §29, enforced by the database so a bug in the
  -- upload handler cannot let a long video through.
  constraint review_media_video_max_30s
    check (kind <> 'video' or (duration_seconds is not null and duration_seconds <= 30))
);

create index review_media_review_idx on public.review_media (review_id);

create trigger review_media_set_updated_at
  before update on public.review_media
  for each row execute function public.set_updated_at();

create table public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid        not null references public.reviews(id)  on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason      text        not null,
  detail      text,
  resolved    boolean     not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint review_reports_reason_valid
    check (reason in ('spam', 'fake', 'offensive', 'irrelevant', 'promotional', 'inappropriate_media')),
  constraint review_reports_one_per_user unique (review_id, reporter_id)
);

create index review_reports_open_idx on public.review_reports (resolved, created_at);

create trigger review_reports_set_updated_at
  before update on public.review_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Curated content (spec §15, §39)
-- ---------------------------------------------------------------------------
create table public.top_picks (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid        not null references public.products(id) on delete cascade,
  -- Null collection = the global homepage list. A named collection lets a
  -- category or campaign have its own curated set.
  collection    text,
  title         text,
  subtitle      text,
  display_order integer     not null default 0,
  is_active     boolean     not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Partial unique index: NULL collection would otherwise not conflict
create unique index top_picks_one_per_collection
  on public.top_picks (product_id, coalesce(collection, ''));
create index top_picks_active_order_idx on public.top_picks (is_active, display_order);

create trigger top_picks_set_updated_at
  before update on public.top_picks
  for each row execute function public.set_updated_at();

-- The homepage is data, not a template (spec §39). `kind` selects the
-- renderer; `config` holds that renderer's parameters.
create table public.homepage_sections (
  id            uuid primary key default gen_random_uuid(),
  kind          text        not null,
  title         text,
  subtitle      text,
  display_order integer     not null default 0,
  is_active     boolean     not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  config        jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint homepage_sections_kind_valid
    check (kind in ('hero', 'category_tiles', 'top_picks', 'featured_products',
                    'category_rail', 'featured_brands', 'newsletter', 'editorial'))
);

create index homepage_sections_active_order_idx
  on public.homepage_sections (is_active, display_order);

create trigger homepage_sections_set_updated_at
  before update on public.homepage_sections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit trail (spec §60)
--
-- Append-only: no updated_at, and no RLS policy grants update or delete.
-- An audit log you can rewrite is not an audit log.
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  action       text        not null,
  entity_type  text        not null,
  entity_id    uuid,
  summary      text,
  meta         jsonb       not null default '{}'::jsonb,
  ip_address   inet,
  created_at   timestamptz not null default now()
);

create index activity_logs_actor_idx  on public.activity_logs (actor_id, created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Newsletter (double opt-in)
-- ---------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id                   uuid primary key default gen_random_uuid(),
  email                text        not null unique,
  -- Cadence is the column the send job filters on, so it is queryable and
  -- indexed rather than a preference blob.
  frequency            text        not null default 'deals_only',
  confirmed_at         timestamptz,
  confirmation_token   text unique,
  confirmation_sent_at timestamptz,
  -- Persistent, so every email can carry a real one-click unsubscribe link
  unsubscribe_token    text        not null unique,
  unsubscribed_at      timestamptz,
  is_active            boolean     not null default true,
  source               text,
  signup_ip            inet,
  last_sent_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint newsletter_frequency_valid
    check (frequency in ('daily', 'weekly', 'deals_only'))
);

create index newsletter_send_idx
  on public.newsletter_subscribers (frequency, is_active, confirmed_at);

create trigger newsletter_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contact / research requests
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id            uuid primary key default gen_random_uuid(),
  -- Short human-quotable handle so a reply can reference the request without
  -- exposing the UUID.
  reference     text        not null unique,
  topic         text        not null,
  -- Slugs rather than FKs: a request may name a category that is later renamed
  -- or removed, and the captured intent should survive that.
  category_slugs jsonb      not null default '[]'::jsonb,
  name          text,
  email         text        not null,
  message       text        not null,
  budget_range  text,
  product_url   text,
  organisation  text,
  status        text        not null default 'new',
  assigned_to   uuid references auth.users(id) on delete set null,
  answered_at   timestamptz,
  internal_note text,
  source_ip     inet,
  user_agent    text,
  spam_score    integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint contact_topic_valid
    check (topic in ('research_request', 'correction', 'press', 'general')),
  constraint contact_status_valid
    check (status in ('new', 'in_progress', 'answered', 'closed')),
  constraint contact_message_len check (char_length(message) between 10 and 5000)
);

create index contact_queue_idx on public.contact_messages (status, topic, created_at);

create trigger contact_set_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();
