-- ============================================================================
-- The buying decision, made explicit.
--
-- The product page already carried a verdict — but only as prose. A reader who
-- came to answer one question ("should I buy this?") had to read a paragraph
-- and infer the answer, and nothing in the schema stopped an editor from
-- publishing a verdict that never actually answered it.
--
-- Four columns and one table make the answer structured, so the page can lead
-- with it and the publish check can refuse a product that has not got one.
--
--   verdict_stance   — the recommendation itself, from a closed set.
--   verdict_summary  — the one-or-two-sentence WHY that sits beside it.
--   research_note    — how this particular product was researched, when the
--                      generic method statement is not the whole story.
--   hands_on_tested  — whether anyone actually held the thing. Defaults to
--                      false, so the page cannot claim hands-on testing by
--                      omission; claiming it is an explicit, auditable act
--                      (editorial policy §"Use of automated tools").
--   researched_at    — when the research was last done. A recommendation with
--                      no date is a rumour, same as a policy with no date.
--
-- `product_alternatives` is the curated counterpart to the price-band
-- heuristic in modules/products/repository.py. The heuristic can say "similar
-- product, similar price"; it cannot say "buy this one instead if you are on a
-- budget", which is the sentence a reader who has just been told to SKIP
-- actually needs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The verdict columns
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists verdict_stance  varchar(24),
  add column if not exists verdict_summary varchar(400),
  add column if not exists research_note   text,
  add column if not exists hands_on_tested boolean not null default false,
  add column if not exists researched_at   timestamptz;

comment on column public.products.verdict_stance is
  'The recommendation: buy_now | wait_for_sale | skip | consider_alternative. '
  'Null means the research is not finished — publishing is blocked until it is set.';

comment on column public.products.verdict_summary is
  'One or two sentences saying WHY the stance is what it is. Rendered directly '
  'beside the stance above the fold, so it must stand alone without the prose.';

comment on column public.products.hands_on_tested is
  'True ONLY where a person physically used the product. The page claims '
  'hands-on testing on the strength of this column and nothing else.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_verdict_stance_valid'
  ) then
    alter table public.products
      add constraint products_verdict_stance_valid
      check (
        verdict_stance is null
        or verdict_stance in ('buy_now', 'wait_for_sale', 'skip', 'consider_alternative')
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Curated alternatives
--
-- `reason` is a closed set rather than free text because it is rendered as a
-- label on a card. Free text would drift into sentences, and a card cannot
-- carry a sentence where a two-word chip belongs.
--
-- The self-reference guard is a check constraint, not an application rule: a
-- product listed as its own alternative renders an infinite invitation to
-- click through to the page you are already on.
-- ---------------------------------------------------------------------------
create table if not exists public.product_alternatives (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid        not null references public.products(id) on delete cascade,
  alternative_id uuid        not null references public.products(id) on delete cascade,
  reason         varchar(32) not null,
  note           varchar(200),
  display_order  integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint product_alternatives_unique_pair unique (product_id, alternative_id),
  constraint product_alternatives_not_self    check (product_id <> alternative_id),
  constraint product_alternatives_reason_valid check (
    reason in (
      'better_value',
      'better_performance',
      'better_budget',
      'better_for_professionals',
      'better_features',
      'closest_rival'
    )
  )
);

create index if not exists product_alternatives_product_idx
  on public.product_alternatives (product_id, display_order);

drop trigger if exists product_alternatives_set_updated_at on public.product_alternatives;
create trigger product_alternatives_set_updated_at
  before update on public.product_alternatives
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — the satellite inherits its parent's visibility, and additionally
--    hides rows pointing at a product that is not itself published.
--
--    That second half matters: an alternative row is a link to another page.
--    Surfacing one for a draft would leak both the draft's existence and its
--    title through a page that is public.
-- ---------------------------------------------------------------------------
alter table public.product_alternatives enable row level security;

drop policy if exists "product_alternatives: follows product visibility"
  on public.product_alternatives;
create policy "product_alternatives: follows product visibility"
  on public.product_alternatives for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and (p.status = 'published' or public.is_admin())
    )
    and exists (
      select 1 from public.products a
      where a.id = alternative_id and (a.status = 'published' or public.is_admin())
    )
  );

drop policy if exists "product_alternatives: admin write" on public.product_alternatives;
create policy "product_alternatives: admin write"
  on public.product_alternatives for all
  using (public.is_admin())
  with check (public.is_admin());

-- Belt and braces, in the spirit of 20260821000011: a browser holding the
-- public anon key has no business writing here at all, policy or no policy.
revoke insert, update, delete on public.product_alternatives from anon, authenticated;
