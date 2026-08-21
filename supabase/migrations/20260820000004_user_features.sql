-- ============================================================================
-- User personalisation: saved products, preferences, helpful votes.
--
-- These are the features that make an account worth creating. Everything here
-- is private to its owner by default — RLS below is written so that one user
-- can never see, count, or infer another user's saves or interests.
--
-- Note what is deliberately NOT here: no "cart", no "order". Saving is a
-- research shortlist, not a basket (spec §56).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- saved_products — the user's shortlist
-- ---------------------------------------------------------------------------
create table public.saved_products (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  product_id uuid        not null references public.products(id) on delete cascade,
  -- Optional private note: "for the office" / "wait for a sale".
  note       text,
  created_at timestamptz not null default now(),

  constraint saved_products_once unique (user_id, product_id),
  constraint saved_products_note_len check (note is null or char_length(note) <= 280)
);

create index saved_products_user_idx on public.saved_products (user_id, created_at desc);
create index saved_products_product_idx on public.saved_products (product_id);

-- ---------------------------------------------------------------------------
-- user_preferences — what this person is actually shopping for
--
-- Drives a personalised homepage rail and, later, the "what should I buy?"
-- engine (spec §57–§58). Categories and brands are stored as id arrays rather
-- than join tables: they are always read as a whole set, never queried
-- individually, and the set is small and bounded.
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  category_ids       jsonb       not null default '[]'::jsonb,
  brand_ids          jsonb       not null default '[]'::jsonb,
  -- Budget band, so recommendations are realistic rather than aspirational.
  budget_min         numeric(12,2),
  budget_max         numeric(12,2),
  -- Free-text: "I take a lot of calls", "I need something for travel".
  use_case           text,
  -- Notification opt-ins, off by default. Consent is given, never assumed.
  notify_price_drops boolean     not null default false,
  notify_new_picks   boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint user_preferences_budget_ordered
    check (budget_min is null or budget_max is null or budget_min <= budget_max),
  constraint user_preferences_use_case_len
    check (use_case is null or char_length(use_case) <= 1000),
  -- Bound the arrays: an unbounded JSONB array is a denial-of-service vector
  -- and a preference set of 200 categories is not a preference.
  constraint user_preferences_categories_bounded
    check (jsonb_array_length(category_ids) <= 12),
  constraint user_preferences_brands_bounded
    check (jsonb_array_length(brand_ids) <= 20)
);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- review_helpful_votes — "was this review useful?"
--
-- A join table rather than an increment on reviews.helpful_count, because a
-- bare counter can be clicked repeatedly. The unique constraint makes one vote
-- per person per review a database guarantee.
-- ---------------------------------------------------------------------------
create table public.review_helpful_votes (
  review_id  uuid        not null references public.reviews(id)  on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index review_helpful_votes_review_idx on public.review_helpful_votes (review_id);

-- Keep the denormalised counter on reviews in step, so the product page never
-- needs an aggregate query (spec §48).
create or replace function public.sync_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
  elsif tg_op = 'DELETE' then
    update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  end if;
  return null;
end;
$$;

create trigger review_helpful_votes_sync
  after insert or delete on public.review_helpful_votes
  for each row execute function public.sync_helpful_count();

-- ============================================================================
-- Row Level Security
--
-- The governing rule for this whole file: a user's saves and interests are
-- private. Not "hard to guess" — unreadable.
-- ============================================================================

alter table public.saved_products       enable row level security;
alter table public.user_preferences     enable row level security;
alter table public.review_helpful_votes enable row level security;

-- --- saved_products -------------------------------------------------------
-- Note there is no admin read policy. An admin has no business browsing an
-- individual's shortlist, and aggregate reporting can be done with the
-- service-role key under explicit, audited code rather than by ambient access.
create policy "saved_products: read own"
  on public.saved_products for select
  using (auth.uid() = user_id);

create policy "saved_products: insert own"
  on public.saved_products for insert
  with check (auth.uid() = user_id);

create policy "saved_products: update own"
  on public.saved_products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_products: delete own"
  on public.saved_products for delete
  using (auth.uid() = user_id);

-- --- user_preferences -----------------------------------------------------
create policy "user_preferences: read own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences: insert own"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user_preferences: update own"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_preferences: delete own"
  on public.user_preferences for delete
  using (auth.uid() = user_id);

-- --- review_helpful_votes -------------------------------------------------
-- Read is limited to your own vote: you can see whether *you* marked something
-- helpful, so the button renders correctly. The public total lives in
-- reviews.helpful_count; who voted is nobody's business.
create policy "review_helpful_votes: read own"
  on public.review_helpful_votes for select
  using (auth.uid() = user_id);

create policy "review_helpful_votes: insert own"
  on public.review_helpful_votes for insert
  with check (auth.uid() = user_id);

create policy "review_helpful_votes: delete own"
  on public.review_helpful_votes for delete
  using (auth.uid() = user_id);
