-- ============================================================================
-- Price history is admin-only
--
-- The previous migration gave price_history a SELECT policy that followed the
-- product: readable whenever the product was published. That was written in
-- anticipation of a public price chart on the product page.
--
-- There is no such chart, and until there is, the policy was wider than the
-- feature. Supabase exposes `public` through PostgREST and the anon key is
-- public by design, so "readable when the product is published" meant anyone
-- could pull the full price series for the whole published catalogue straight
-- from the REST endpoint — a thing no screen offers and nobody asked for.
--
-- A permission granted for a feature that does not exist yet is not
-- forward-thinking, it is an unattended door. When the public chart is built,
-- re-opening this is one policy.
--
-- Unchanged, and worth restating because it is the property that matters:
-- there is still no UPDATE and no DELETE policy on this table. Append-only is
-- enforced by the database, not by convention.
-- ============================================================================

drop policy if exists "price_history: follows product visibility" on public.price_history;
drop policy if exists "price_history: admin read" on public.price_history;

create policy "price_history: admin read"
  on public.price_history for select
  using (public.is_admin());

comment on table public.price_history is
  'Append-only record of observed prices. Written when a price actually changes, '
  'not on every scrape — an unchanged price is a fact about the scrape, and lives '
  'in price_scrape_results instead. Admin-only: no public read path exists, and '
  'no UPDATE or DELETE policy exists for anyone.';
