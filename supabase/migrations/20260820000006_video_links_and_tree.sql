-- ============================================================================
-- Video links + category tree helpers
--
-- Two changes:
--
-- 1. **Video by link, not by upload.** Hosting product video means paying for
--    storage and egress, building a transcode pipeline, and moderating it.
--    A YouTube/Vimeo URL costs nothing, streams adaptively, and already has a
--    poster frame. So `product_media` gains a `video_link` kind that stores a
--    URL instead of an object key.
--
--    Review video stays an upload — a shopper filming their own unboxing has
--    nowhere to host it, and the 30-second cap keeps that affordable.
--
-- 2. **Category tree helpers.** Reparenting has to rewrite the denormalised
--    `path` on every descendant. Doing that in application code invites a
--    half-finished tree if the request dies midway, so it lives in a function
--    that runs inside one transaction.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- product_media: allow a linked video
-- ---------------------------------------------------------------------------

-- An uploaded file has an object key; a linked video has a URL. Neither is
-- required in isolation, so the column stops being NOT NULL and a CHECK
-- enforces "exactly one of the two" instead.
alter table public.product_media
  alter column storage_path drop not null;

alter table public.product_media
  add column if not exists source_url  text,
  add column if not exists provider    text,
  add column if not exists external_id text,
  add column if not exists title       text;

alter table public.product_media
  drop constraint if exists product_media_kind_valid;

alter table public.product_media
  add constraint product_media_kind_valid
  check (kind in ('image', 'video', 'video_link'));

alter table public.product_media
  add constraint product_media_source_present
  check (
    (kind = 'video_link' and source_url is not null and storage_path is null)
    or (kind <> 'video_link' and storage_path is not null)
  );

alter table public.product_media
  add constraint product_media_provider_valid
  check (provider is null or provider in ('youtube', 'vimeo'));

comment on column public.product_media.source_url is
  'External video URL. Set only when kind = video_link; uploads use storage_path.';

-- ---------------------------------------------------------------------------
-- Category tree: rewrite descendant paths on reparent
-- ---------------------------------------------------------------------------

-- Recomputes `path` and `depth` for a category and everything beneath it.
-- SECURITY DEFINER so the API can call it without granting broad table rights,
-- with search_path pinned — an unpinned search_path on a definer function is a
-- privilege-escalation vector.
create or replace function public.rebuild_category_paths(root_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with recursive tree as (
    -- Roots: either the whole forest, or the subtree the caller named.
    select c.id,
           c.parent_id,
           array[c.slug]::text[] as path_arr,
           0 as depth
    from public.categories c
    where (root_id is null and c.parent_id is null)
       or (root_id is not null and c.id = root_id)

    union all

    select child.id,
           child.parent_id,
           parent.path_arr || child.slug,
           parent.depth + 1
    from public.categories child
    join tree parent on child.parent_id = parent.id
  )
  update public.categories c
  set path = to_jsonb(t.path_arr),
      depth = t.depth
  from tree t
  where c.id = t.id;
end;
$$;

comment on function public.rebuild_category_paths(uuid) is
  'Recompute path/depth for a subtree. Call after any parent_id or slug change.';

-- Refuse a cycle. Without this, setting a category as its own descendant makes
-- rebuild_category_paths recurse until the server gives up.
create or replace function public.check_category_cycle()
returns trigger
language plpgsql
as $$
declare
  ancestor uuid := new.parent_id;
  hops int := 0;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent';
  end if;

  while ancestor is not null and hops < 64 loop
    if ancestor = new.id then
      raise exception 'That move would create a cycle in the category tree';
    end if;
    select parent_id into ancestor from public.categories where id = ancestor;
    hops := hops + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists categories_no_cycle on public.categories;
create trigger categories_no_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.check_category_cycle();
