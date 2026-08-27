-- ============================================================================
-- Analytics: what people look at, and what they click through to buy.
--
-- ---------------------------------------------------------------------------
-- WHY THERE IS NO EVENT TABLE HERE
--
-- The obvious schema for this is one row per view and one row per click, with
-- a session id, a referrer, a user agent and a timestamp. That is what every
-- analytics tutorial writes, and it is the wrong shape for this system for two
-- independent reasons.
--
--   1. SIZE. An event table grows with TRAFFIC. At 100k pageviews a month it
--      adds roughly 18 MB a month and never stops, which on a 500 MB Supabase
--      tier makes analytics the largest thing in the database inside a year —
--      bigger than the catalogue it is describing. These three tables grow
--      with PRODUCTS x DAYS instead, which is a number we control: 500
--      products over a year is ~11 MB as an absolute ceiling, and far less in
--      practice because a row only exists for a day something actually
--      happened.
--
--   2. WHAT IT WOULD MAKE US. A session id plus a referrer plus a user agent
--      is a behavioural profile of a named-enough person, and holding one puts
--      this site inside a consent regime it is otherwise entirely outside of.
--      Nothing below identifies anybody. There is no session id, no IP, no
--      user id, no cookie, and no column that could be joined back to one.
--      That is not a limitation of the implementation, it is the design — and
--      it is what allows the site to run without a cookie banner.
--
-- The cost is real and worth stating plainly: individual journeys cannot be
-- reconstructed from this. You can see that 412 people looked at a product and
-- 38 of them clicked through to Amazon. You cannot see whether those 38 were
-- the same people who read the comparison page first. If that question ever
-- becomes worth a consent banner, it needs a different table, not a wider one.
--
-- ---------------------------------------------------------------------------
-- WHY `day` LEADS EVERY PRIMARY KEY
--
-- Every query this feeds is "the last N days" — the dashboard trend, the top
-- products, the CTR. With `day` first, that is a contiguous range scan on the
-- primary key index and the grouping happens over a handful of pages. With
-- `product_id` first it would be a full scan filtered by date, which is the
-- same answer arrived at by reading the whole table.
--
-- The write path is the reverse case and does not care: every write is a point
-- upsert on the full key.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Per-product, per-day: the two numbers that matter and their ratio
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_product_daily (
  day        date   not null,
  product_id uuid   not null references public.products(id) on delete cascade,
  views      integer not null default 0,
  clicks     integer not null default 0,

  constraint pk_analytics_product_daily primary key (day, product_id),

  -- Counters are incremented by an UPSERT that can only ever add. A negative
  -- value here would mean the write path has a bug, and it is cheaper to
  -- refuse the row than to explain a negative CTR six months later.
  constraint ck_analytics_product_daily_non_negative
    check (views >= 0 and clicks >= 0)
);

comment on table public.analytics_product_daily is
  'Daily view and outbound-click counts per product. Pre-aggregated at write '
  'time: one row per product per day it saw traffic, never one row per event. '
  'Contains nothing that identifies a visitor.';

comment on column public.analytics_product_daily.views is
  'Product page loads, counted once per page view from a client-side beacon. '
  'Bot user agents are filtered before the counter is touched, so this is '
  'closer to real readership than a server-side request count would be.';

comment on column public.analytics_product_daily.clicks is
  'Outbound clicks on a retailer link. The commercially meaningful event on '
  'this site: the moment a reader acts on a verdict.';


-- ---------------------------------------------------------------------------
-- 2. Clicks split by retailer
--
-- Separate from the table above rather than a column on it, because the
-- cardinality is different — a product has one view count per day and one
-- click count per retailer per day. Folding them together would either
-- duplicate the view count across retailer rows (and invite someone to SUM it)
-- or force a nullable retailer_id into the primary key, which Postgres will
-- not accept anyway.
--
-- This is the table that answers "which retailer is actually earning the
-- commission", which is a different question from "which product is popular"
-- and is the one that decides where affiliate effort goes.
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_retailer_daily (
  day         date    not null,
  product_id  uuid    not null references public.products(id)  on delete cascade,
  retailer_id uuid    not null references public.retailers(id) on delete cascade,
  clicks      integer not null default 0,

  constraint pk_analytics_retailer_daily primary key (day, product_id, retailer_id),
  constraint ck_analytics_retailer_daily_non_negative check (clicks >= 0)
);

comment on table public.analytics_retailer_daily is
  'Outbound clicks split by retailer. SUM(clicks) here for a product and day '
  'equals analytics_product_daily.clicks for the same product and day.';

-- Retailer-first lookups ("how is Amazon doing across the catalogue") do not
-- match the primary key's column order, and that is the second-most-asked
-- question of this table. One index rather than a sequential scan.
create index if not exists ix_analytics_retailer_daily_retailer
  on public.analytics_retailer_daily (retailer_id, day);


-- ---------------------------------------------------------------------------
-- 3. Everything that is not a product: paths, referrers, devices
--
-- One generic table rather than three narrow ones. The alternative was
-- `analytics_path_daily`, `analytics_referrer_daily` and
-- `analytics_device_daily`, which are the same two columns three times with
-- three sets of policies to keep in step.
--
-- ⚠ `key` IS BOUNDED BY THE WRITER, NOT BY THIS TABLE, and that is the one
-- thing that can make this table grow without limit. A path is normalised to a
-- route shape before it arrives (`/p/headphones/[slug]`, not the 4,000 distinct
-- slugs underneath it) and a referrer is reduced to its host. If a future
-- writer ever inserts a raw URL with a query string, the row count stops being
-- bounded by "number of routes" and starts being bounded by "number of
-- distinct URLs anyone has ever visited", which is the event table this file
-- exists to avoid. The length cap below is a backstop, not the rule.
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_daily (
  day       date    not null,
  dimension text    not null,
  key       text    not null,
  count     integer not null default 0,

  constraint pk_analytics_daily primary key (day, dimension, key),
  constraint ck_analytics_daily_non_negative check (count >= 0),
  constraint ck_analytics_daily_dimension
    check (dimension in ('path', 'referrer', 'device')),
  -- Backstop against an unnormalised key. See the ⚠ note above.
  constraint ck_analytics_daily_key_bounded
    check (length(key) between 1 and 180)
);

comment on table public.analytics_daily is
  'Daily counts for non-product dimensions. `dimension` says what `key` means: '
  'path (a normalised route shape, never a raw URL), referrer (a host, never a '
  'full URL), device (desktop | mobile | tablet). Nothing here identifies a '
  'visitor and nothing joins back to one.';


-- ---------------------------------------------------------------------------
-- 4. Row-level security
--
-- Identical posture to price_history: admin SELECT, and no INSERT, UPDATE or
-- DELETE policy for anyone.
--
-- The missing write policies are not an oversight to be corrected later. The
-- API writes these tables over its own pooled connection as the database
-- owner, which is not subject to RLS; the anon and authenticated roles reach
-- this schema through PostgREST, and for them "no policy" means no write path
-- exists at all. A counter that any visitor could increment directly is not a
-- metric, it is a poll — and the whole value of the click number is that it is
-- hard to inflate.
-- ---------------------------------------------------------------------------
alter table public.analytics_product_daily  enable row level security;
alter table public.analytics_retailer_daily enable row level security;
alter table public.analytics_daily          enable row level security;

drop policy if exists "analytics_product_daily: admin read"  on public.analytics_product_daily;
drop policy if exists "analytics_retailer_daily: admin read" on public.analytics_retailer_daily;
drop policy if exists "analytics_daily: admin read"          on public.analytics_daily;

create policy "analytics_product_daily: admin read"
  on public.analytics_product_daily for select using (public.is_admin());

create policy "analytics_retailer_daily: admin read"
  on public.analytics_retailer_daily for select using (public.is_admin());

create policy "analytics_daily: admin read"
  on public.analytics_daily for select using (public.is_admin());


-- ---------------------------------------------------------------------------
-- 5. Retention
--
-- The tables are bounded by products x days, but days accumulate forever, so
-- "bounded" is only true with a horizon. 400 days is deliberate: it keeps a
-- full year of history plus a month, so a year-on-year comparison in the last
-- week of December still has last December to compare against.
--
-- ⚠ THIS FUNCTION IS NOT SCHEDULED BY THIS MIGRATION. pg_cron is not enabled
-- on this project, and enabling an extension is a decision for whoever owns
-- the database rather than a side effect of adding a feature. Until it is
-- scheduled the tables simply keep growing at the rate described at the top of
-- this file, which is slow enough that this is a real choice and not a
-- deferred emergency. To schedule it:
--
--     create extension if not exists pg_cron;
--     select cron.schedule('analytics-prune', '17 3 * * 0',
--                          $$select public.prune_analytics()$$);
--
-- `security definer` with a pinned search_path, matching the convention set in
-- 20260820000005_harden_functions.sql: callable by a scheduler that is not the
-- table owner, and immune to a search_path attack from whatever role invokes
-- it.
-- ---------------------------------------------------------------------------
create or replace function public.prune_analytics(horizon_days integer default 400)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cutoff  date := current_date - horizon_days;
  removed integer := 0;
  n       integer;
begin
  delete from public.analytics_product_daily  where day < cutoff;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.analytics_retailer_daily where day < cutoff;
  get diagnostics n = row_count; removed := removed + n;

  delete from public.analytics_daily          where day < cutoff;
  get diagnostics n = row_count; removed := removed + n;

  return removed;
end;
$$;

comment on function public.prune_analytics(integer) is
  'Deletes analytics rows older than horizon_days (default 400: a full year '
  'plus a month, so year-on-year comparisons always have a counterpart). '
  'Returns the number of rows removed. Not scheduled by default — see the '
  'note in 20260827180440_analytics_daily.sql for the pg_cron incantation.';

-- The anon and authenticated roles have no business calling this, and
-- `security definer` means a grant to them would be a privilege escalation
-- with a friendly name.
revoke all on function public.prune_analytics(integer) from public, anon, authenticated;
