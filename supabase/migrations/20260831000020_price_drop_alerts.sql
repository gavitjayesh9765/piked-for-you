-- ============================================================================
-- Price-drop alerts
--
-- WHY THESE COLUMNS AND NOT A NEW TABLE
--
-- A shortlist already means "I am interested in this, at this price". Watching
-- it for a drop is not a second relationship between a person and a product, it
-- is the same one with a memory — so the memory lives on the row that already
-- exists rather than in a parallel table that would have to be kept in step
-- with every save and unsave.
--
-- WHY THE BASELINE IS THE PRICE AT SAVE
--
-- "Tell me if it drops" means dropped FROM WHAT. The only figure a reader has
-- in mind when they press Save is the one they were looking at, so that is the
-- number we keep. Alerting against the all-time high would fire on a price they
-- already declined; alerting against the last observation would fire on noise.
--
-- WHY `alerted_price` IS SEPARATE FROM `price_at_save`
--
-- Once an alert has gone out, the baseline has to move down to what we told
-- them — otherwise every subsequent price run re-sends the same news, and a
-- product that sits below its save price becomes a subscription to one email
-- per run. `price_at_save` is left alone so the row still records what the
-- reader originally saw.
--
-- WHAT DOES NOT CHANGE
--
-- Nothing here checks a price. There is no timer, no cron and no trigger that
-- fetches anything: these columns are read after an admin has applied a price
-- run, by the same request that applied it. A price is still only ever checked
-- because a human pressed the button.
-- ============================================================================

alter table public.saved_products
  add column if not exists price_at_save  numeric(12,2),
  add column if not exists alerted_price  numeric(12,2),
  add column if not exists alerted_at     timestamptz;

comment on column public.saved_products.price_at_save is
  'The product price when this was saved — the baseline a drop is measured '
  'against. Null for rows saved before alerts existed, which are baselined on '
  'the first run that sees them rather than alerted retroactively.';

comment on column public.saved_products.alerted_price is
  'The price the last alert quoted. The baseline moves down to this so a '
  'second run does not re-send the same drop.';

-- Backfill the baseline for rows saved before this migration, so an existing
-- shortlist starts watching from today rather than from nothing. Deliberately
-- NOT alerting on the difference: we never observed those readers at an earlier
-- price, and inventing a saving we cannot evidence is the one thing this whole
-- feature must not do.
update public.saved_products s
   set price_at_save = p.price_current
  from public.products p
 where p.id = s.product_id
   and s.price_at_save is null
   and p.price_current is not null;

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- Unchanged in shape: the existing "read own / insert own / update own"
-- policies on saved_products already cover these columns, and a user editing
-- their own `alerted_at` can only cost themselves an email.
--
-- What is deliberately absent is any new grant. The alert path runs in FastAPI
-- on its own connection and needs no policy, which keeps this table exactly as
-- private as it was — an admin still has no read path to anyone's shortlist.
-- ----------------------------------------------------------------------------

-- The alert query is "saved rows for these products, whose owner wants
-- notifying". It filters on product_id across many users, which the existing
-- per-user index does not serve.
create index if not exists saved_products_product_idx
  on public.saved_products (product_id);
