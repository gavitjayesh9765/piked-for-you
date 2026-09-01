-- ============================================================================
-- New-pick alerts
--
-- `user_preferences.notify_new_picks` has existed since the user-features
-- migration and saved faithfully to a column nothing read. This is the record
-- that lets it finally be kept.
--
-- WHY THE PRIMARY KEY IS THE WHOLE FEATURE
--
-- A product gets unpublished to fix a typo and republished ten minutes later.
-- Without a per-person record that is a second email about the same product,
-- and the second email is the one that loses a subscriber — a correction is not
-- news. One row per person per product makes re-publishing silent.
--
-- WHAT STILL DOES NOT EXIST HERE
--
-- No timer, no trigger, no queue. This is written by the request that handled
-- an editor pressing Publish, the same way a price alert is written by the
-- request that applied a price.
-- ============================================================================

create table if not exists public.new_pick_sends (
  product_id uuid        not null references public.products(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  sent_at    timestamptz not null default now(),

  primary key (product_id, user_id)
);

-- "How much of the provider's daily budget have we spent?" — this table shares
-- one ceiling with the newsletter, so both are counted together.
create index if not exists new_pick_sends_day_idx on public.new_pick_sends (sent_at);

-- Admin-only by omission, like the campaign send log: RLS on, no policies, so
-- PostgREST has no read path. FastAPI holds its own connection.
alter table public.new_pick_sends enable row level security;

comment on table public.new_pick_sends is
  'One row per person per product. The primary key is what stops a product that '
  'is unpublished and republished from mailing the same people twice — a '
  'correction is not news.';
