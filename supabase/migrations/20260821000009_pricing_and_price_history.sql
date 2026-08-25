-- ============================================================================
-- Price tracking: a third retailer, a scrape pipeline, and price history
--
-- Three things happen here.
--
--   1. A third retailer — "Official" (the brand's own store). Nothing in the
--      frontend hard-codes a retailer list (spec §26), so a row is all it
--      takes: the product page renders whatever active links exist, and the
--      admin form grows a third field on its own.
--
--   2. Scrape configuration. Selectors, engine and throttle live in the
--      database rather than in Python, because a retailer changing its markup
--      is a Tuesday, and a redeploy is not an acceptable answer to it.
--
--   3. Price history — an append-only record of every observed price. The
--      current price is a column on product_retailers because it is read on
--      every page; the history is a separate table because it grows forever
--      and is read only when someone asks for a chart.
--
-- Deliberately NOT here: any scheduling. There is no pg_cron job and no
-- trigger that starts a scrape. A run begins when an admin presses the button
-- and a row lands in price_scrape_jobs — nothing else can start one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The third retailer
-- ---------------------------------------------------------------------------
insert into public.retailers (name, slug, display_order, affiliate_template)
values ('Official', 'official', 3, null)
on conflict (slug) do nothing;

comment on table public.retailers is
  'Storefronts a product can be bought from: Amazon, Flipkart, and the brand''s '
  'own Official store. Adding a fourth is an INSERT, not a deploy.';

-- ---------------------------------------------------------------------------
-- 2. Scrape configuration, per retailer
--
-- scrape_config is JSONB because its shape is genuinely per-retailer: a list
-- of CSS selectors, a currency hint, header overrides. Nothing in it is
-- queried or filtered on, which is exactly when JSONB is the right call
-- (spec §41).
-- ---------------------------------------------------------------------------
alter table public.retailers
  add column if not exists scrape_enabled boolean not null default true,
  add column if not exists scrape_engine  text    not null default 'http',
  add column if not exists scrape_config  jsonb   not null default '{}'::jsonb;

alter table public.retailers
  drop constraint if exists retailers_scrape_engine_valid;
alter table public.retailers
  add constraint retailers_scrape_engine_valid
  check (scrape_engine in ('http', 'browser'));

comment on column public.retailers.scrape_engine is
  'http = plain request (fast, cheap). browser = headless render, for storefronts '
  'that build the price in JavaScript. Chosen per retailer in the admin panel.';

-- ---------------------------------------------------------------------------
-- 3. Per-link scrape state
--
-- Kept on product_retailers rather than derived from the latest history row:
-- the product page needs "is this price stale?" on every render, and that must
-- not cost a correlated subquery over an ever-growing table.
-- ---------------------------------------------------------------------------
alter table public.product_retailers
  add column if not exists scrape_enabled     boolean not null default true,
  add column if not exists currency           text,
  add column if not exists in_stock           boolean,
  add column if not exists last_scrape_status text,
  add column if not exists last_scrape_error  text,
  add column if not exists last_scraped_at    timestamptz;

alter table public.product_retailers
  drop constraint if exists product_retailers_scrape_status_valid;
alter table public.product_retailers
  add constraint product_retailers_scrape_status_valid
  check (
    last_scrape_status is null
    or last_scrape_status in
       ('updated', 'unchanged', 'not_found', 'blocked', 'rejected', 'error', 'skipped')
  );

comment on column public.product_retailers.last_scrape_error is
  'Why the last attempt failed, in words an editor can act on. Cleared on success.';

-- ---------------------------------------------------------------------------
-- 4. Runs
--
-- A run is a row. That is what makes the admin button honest: pressing it
-- creates a queued job, the worker moves it to running, and the panel polls
-- this table rather than holding an HTTP request open for four minutes.
--
-- cancel_requested is a flag the worker reads between items, not a signal —
-- the worker may be in another process entirely.
-- ---------------------------------------------------------------------------
create table if not exists public.price_scrape_jobs (
  id               uuid primary key default gen_random_uuid(),
  status           text        not null default 'queued',
  trigger          text        not null default 'manual',
  -- What was asked for: product ids, category, retailer, staleness. Replayable.
  scope            jsonb       not null default '{}'::jsonb,
  triggered_by     uuid        references auth.users(id) on delete set null,

  total            integer     not null default 0,
  processed        integer     not null default 0,
  updated_count    integer     not null default 0,
  unchanged_count  integer     not null default 0,
  failed_count     integer     not null default 0,
  skipped_count    integer     not null default 0,

  cancel_requested boolean     not null default false,
  error            text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint price_scrape_jobs_status_valid check (
    status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
  ),
  constraint price_scrape_jobs_trigger_valid check (
    trigger in ('manual', 'single_product', 'api')
  )
);

create index if not exists price_scrape_jobs_created_idx
  on public.price_scrape_jobs (created_at desc);

-- At most one run in flight. Two concurrent runs would hammer the same hosts
-- from the same IP and race each other's writes, so the database refuses the
-- second one rather than trusting the UI to keep a button disabled.
-- The indexed expression is constant-true by construction; the WHERE clause is
-- doing the real work, restricting the index to in-flight rows so a second one
-- collides with the first.
create unique index if not exists price_scrape_jobs_one_active_idx
  on public.price_scrape_jobs ((status is not null))
  where status in ('queued', 'running');

drop trigger if exists price_scrape_jobs_set_updated_at on public.price_scrape_jobs;
create trigger price_scrape_jobs_set_updated_at
  before update on public.price_scrape_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Per-link outcome within a run
--
-- Separate from price_history because most outcomes are not a price: blocked,
-- selector missed, 404. Those are the rows an editor actually needs to see,
-- and mixing them into the history table would corrupt every chart.
-- ---------------------------------------------------------------------------
create table if not exists public.price_scrape_results (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid        not null references public.price_scrape_jobs(id)   on delete cascade,
  product_id          uuid        references public.products(id)                     on delete cascade,
  retailer_id         uuid        references public.retailers(id)                    on delete set null,
  product_retailer_id uuid        references public.product_retailers(id)            on delete set null,

  status              text        not null,
  old_price           numeric(12,2),
  new_price           numeric(12,2),
  currency            text,
  in_stock            boolean,
  message             text,
  http_status         integer,
  duration_ms         integer,
  created_at          timestamptz not null default now(),

  constraint price_scrape_results_status_valid check (
    status in ('updated', 'unchanged', 'not_found', 'blocked', 'rejected', 'error', 'skipped')
  )
);

create index if not exists price_scrape_results_job_idx
  on public.price_scrape_results (job_id, created_at);
create index if not exists price_scrape_results_product_idx
  on public.price_scrape_results (product_id);

-- ---------------------------------------------------------------------------
-- 6. Price history — append only
--
-- No updated_at and no update path: a past observation is a fact about a
-- moment, and editing it would make every chart a lie. Corrections are new
-- rows with source = 'manual'.
-- ---------------------------------------------------------------------------
create table if not exists public.price_history (
  id                  uuid          primary key default gen_random_uuid(),
  product_id          uuid          not null references public.products(id)         on delete cascade,
  retailer_id         uuid          references public.retailers(id)                 on delete set null,
  product_retailer_id uuid          references public.product_retailers(id)         on delete set null,
  job_id              uuid          references public.price_scrape_jobs(id)         on delete set null,

  price               numeric(12,2) not null,
  currency            text          not null default 'INR',
  in_stock            boolean,
  source              text          not null default 'scrape',
  captured_at         timestamptz   not null default now(),

  constraint price_history_price_positive check (price >= 0),
  constraint price_history_source_valid check (source in ('scrape', 'manual', 'import'))
);

-- The chart query: one product, newest first.
create index if not exists price_history_product_captured_idx
  on public.price_history (product_id, captured_at desc);
create index if not exists price_history_link_captured_idx
  on public.price_history (product_retailer_id, captured_at desc);

comment on table public.price_history is
  'Append-only record of observed prices. Written when a price actually changes, '
  'not on every scrape — an unchanged price is a fact about the scrape, and lives '
  'in price_scrape_results instead.';

-- ---------------------------------------------------------------------------
-- 7. Run settings — one row, edited in the admin panel
--
-- A singleton table rather than environment variables: these are operational
-- knobs an editor turns while watching a run fail, and an editor cannot deploy.
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_settings (
  id                     boolean      primary key default true,

  -- Politeness. Defaults are deliberately gentle; the retailers are not ours.
  concurrency            integer      not null default 4,
  delay_ms               integer      not null default 1500,
  timeout_seconds        integer      not null default 20,
  max_retries            integer      not null default 2,
  respect_robots         boolean      not null default true,
  user_agent             text         not null default
    'SortedChoiceBot/1.0 (+https://sortedchoice.com/about; price accuracy check)',

  -- Scope defaults for the button.
  stale_after_hours      integer      not null default 24,
  default_engine         text         not null default 'http',

  -- Guard rail: a "price" 90% off usually means the selector matched an
  -- unrelated number, not a sale. Anything beyond this is recorded as
  -- 'rejected' and left for a human rather than published to the site.
  max_change_percent     numeric(5,2) not null default 60.00,

  -- Whether a successful scrape writes through to the live link and to
  -- products.price_current, or only records what it saw.
  auto_apply             boolean      not null default true,
  update_product_price   boolean      not null default true,

  history_retention_days integer      not null default 730,

  created_at             timestamptz  not null default now(),
  updated_at             timestamptz  not null default now(),

  constraint pricing_settings_singleton check (id),
  constraint pricing_settings_ranges check (
    concurrency between 1 and 16
    and delay_ms between 0 and 60000
    and timeout_seconds between 5 and 120
    and max_retries between 0 and 5
    and stale_after_hours between 0 and 8760
    and max_change_percent between 1 and 100
    and history_retention_days between 30 and 3650
  ),
  constraint pricing_settings_engine_valid check (default_engine in ('http', 'browser'))
);

insert into public.pricing_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists pricing_settings_set_updated_at on public.pricing_settings;
create trigger pricing_settings_set_updated_at
  before update on public.pricing_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
--
-- price_history follows the product: visible when the product is published,
-- because the price chart is public content. Everything operational — runs,
-- results, settings — is admin-only, and none of it has a public read policy
-- at all. A scrape log names the URLs we watch and how often we fail to read
-- them; that is nobody else's business.
-- ---------------------------------------------------------------------------
alter table public.price_history        enable row level security;
alter table public.price_scrape_jobs    enable row level security;
alter table public.price_scrape_results enable row level security;
alter table public.pricing_settings     enable row level security;

drop policy if exists "price_history: follows product visibility" on public.price_history;
create policy "price_history: follows product visibility"
  on public.price_history for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.status = 'published' or public.is_admin())
    )
  );

-- Insert only, and only as an admin. No update and no delete policy exists,
-- so the append-only property is enforced by the database, not by convention.
drop policy if exists "price_history: admin append" on public.price_history;
create policy "price_history: admin append"
  on public.price_history for insert
  with check (public.is_admin());

drop policy if exists "price_scrape_jobs: admin only" on public.price_scrape_jobs;
create policy "price_scrape_jobs: admin only"
  on public.price_scrape_jobs for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "price_scrape_results: admin only" on public.price_scrape_results;
create policy "price_scrape_results: admin only"
  on public.price_scrape_results for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "pricing_settings: admin only" on public.pricing_settings;
create policy "pricing_settings: admin only"
  on public.pricing_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 9. Seed the two selector sets we ship with
--
-- These are starting points, not truth. Every one of them is editable in the
-- admin panel, which is the whole reason they live in a column.
-- 'official' is left with an empty config on purpose: it is a different
-- storefront per brand, so it falls through to the generic extractor
-- (JSON-LD → OpenGraph → itemprop → currency-symbol scan).
-- ---------------------------------------------------------------------------
update public.retailers
set scrape_config = jsonb_build_object(
      'priceSelectors', jsonb_build_array(
        'span.a-price[data-a-color="price"] span.a-offscreen',
        '#corePriceDisplay_desktop_feature_div span.a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        'span.a-price span.a-offscreen'
      ),
      'outOfStockSelectors', jsonb_build_array('#outOfStock', '#availability .a-color-price'),
      'currency', 'INR'
    )
where slug = 'amazon' and scrape_config = '{}'::jsonb;

update public.retailers
set scrape_config = jsonb_build_object(
      'priceSelectors', jsonb_build_array(
        'div._30jeq3._16Jk6d',
        'div._30jeq3',
        'div.Nx9bqj.CxhGGd',
        'div[class*="_30jeq3"]'
      ),
      'outOfStockSelectors', jsonb_build_array('div._16FRp0', 'div[class*="soldOut"]'),
      'currency', 'INR'
    )
where slug = 'flipkart' and scrape_config = '{}'::jsonb;
