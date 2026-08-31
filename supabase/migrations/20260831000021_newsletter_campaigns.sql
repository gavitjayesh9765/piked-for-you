-- ============================================================================
-- Newsletter campaigns
--
-- The list has been collecting addresses, with a cadence choice, since the
-- signup form shipped. Nothing has ever been sent to it. This is the table that
-- closes that gap.
--
-- ---------------------------------------------------------------------------
-- WHY A CAMPAIGN IS COMPOSED AND NOT GENERATED
--
-- The obvious build is a nightly job that assembles "this week's picks" and
-- mails it. This site does not work that way anywhere else: a price run exists
-- because an admin pressed the button, and the reason is that an unattended
-- process that acts in our name can be wrong in our name. A digest is a
-- stronger version of the same argument — it is editorial, it goes to a real
-- person's inbox, and it cannot be recalled.
--
-- So a campaign is a draft an editor writes, reviews, and sends. `product_ids`
-- is an ordered, hand-picked list, not a query.
--
-- ---------------------------------------------------------------------------
-- WHY THERE IS A PER-SUBSCRIBER SEND LOG
--
-- Brevo's free plan is 300 emails a day, SHARED with every transactional mail
-- the site sends — confirmations, password resets, price-drop alerts. A list
-- larger than the remaining headroom therefore cannot go out in one pass, which
-- means sending is inherently resumable, which means it must be idempotent.
--
-- `newsletter_campaign_sends` is what makes it so. A campaign that stops at 180
-- of 400 resumes at 181 tomorrow, and a retry after a crashed process cannot
-- mail anyone twice. Without this table the safe options are "send nothing on
-- retry" or "send everything again", and the second one is the kind of mistake
-- that costs a list.
-- ============================================================================

create table if not exists public.newsletter_campaigns (
  id               uuid        primary key default gen_random_uuid(),

  subject          text        not null,
  -- The editorial standfirst above the picks. Optional: some sends are just
  -- the list, and a mandatory field would be filled with filler.
  intro            text,

  -- Which cadence this is for. 'all' ignores the choice; the three specific
  -- values match `newsletter_subscribers.frequency` exactly, because a segment
  -- that does not correspond to something a subscriber actually chose is a
  -- segment we have no consent for.
  audience         text        not null default 'weekly',

  -- Ordered and hand-picked. An array rather than a join table: the order is
  -- the editor's argument, arrays preserve it for free, and nothing ever
  -- queries "which campaigns featured this product".
  product_ids      uuid[]      not null default '{}',

  status           text        not null default 'draft',

  -- Progress. `recipient_count` is fixed when sending starts, so a subscriber
  -- who joins mid-send is not silently added to a campaign they never saw the
  -- beginning of — they get the next one.
  recipient_count  integer     not null default 0,
  sent_count       integer     not null default 0,
  failed_count     integer     not null default 0,

  created_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz,
  error            text,

  constraint newsletter_campaigns_audience_valid
    check (audience in ('all', 'daily', 'weekly', 'deals_only')),
  constraint newsletter_campaigns_status_valid
    check (status in ('draft', 'sending', 'paused', 'sent', 'failed')),
  constraint newsletter_campaigns_subject_present
    check (length(btrim(subject)) > 0)
);

create index if not exists newsletter_campaigns_status_idx
  on public.newsletter_campaigns (status, created_at desc);

-- ----------------------------------------------------------------------------
-- The send log
--
-- The primary key IS the guarantee: one row per subscriber per campaign, so a
-- second attempt to mail the same person conflicts instead of arriving.
-- ----------------------------------------------------------------------------
create table if not exists public.newsletter_campaign_sends (
  campaign_id   uuid        not null references public.newsletter_campaigns(id) on delete cascade,
  subscriber_id uuid        not null references public.newsletter_subscribers(id) on delete cascade,
  sent_at       timestamptz not null default now(),

  primary key (campaign_id, subscriber_id)
);

-- "How many did we send today?" against the shared daily ceiling.
create index if not exists newsletter_campaign_sends_day_idx
  on public.newsletter_campaign_sends (sent_at);

-- ============================================================================
-- Row Level Security
--
-- Both tables are admin-only, and neither has an UPDATE or DELETE policy on the
-- send log: a record that we mailed someone is a fact about a message that has
-- already left, and editing it would only ever be used to hide a mistake.
--
-- The send path itself runs in FastAPI on its own connection and needs no
-- policy. These exist so that the anon key — which PostgREST honours and which
-- is public by design — gets nothing.
-- ============================================================================

alter table public.newsletter_campaigns      enable row level security;
alter table public.newsletter_campaign_sends enable row level security;

create policy "newsletter_campaigns: admin read"
  on public.newsletter_campaigns for select
  using (public.is_admin());

create policy "newsletter_campaign_sends: admin read"
  on public.newsletter_campaign_sends for select
  using (public.is_admin());

comment on table public.newsletter_campaigns is
  'Editor-composed digests. Never generated on a schedule — a campaign is sent '
  'because a person pressed the button, for the same reason a price run is.';

comment on table public.newsletter_campaign_sends is
  'Append-only proof of delivery attempts. The primary key is what makes a '
  'resumed or retried send unable to mail anyone twice.';
