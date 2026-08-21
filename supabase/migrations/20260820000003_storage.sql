-- ============================================================================
-- Storage buckets
--
-- Both buckets are PRIVATE. Nothing is world-readable and there is no public
-- listing; files are served through signed URLs minted by FastAPI.
--
-- Why private even for product images: a public bucket leaks the full object
-- namespace, which means draft-product imagery would be reachable by URL
-- before the product is published. Signed URLs keep §38 honest.
--
-- MIME allow-lists here are a backstop only. Real validation happens in
-- FastAPI (spec §46): declared MIME -> magic bytes -> size -> EXIF strip ->
-- re-encode. Supabase does not inspect file contents, and a declared
-- Content-Type is a claim, not evidence.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-media',
    'product-media',
    false,
    52428800,  -- 50 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif',
          'video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'review-media',
    'review-media',
    false,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp',
          'video/mp4', 'video/webm', 'video/quicktime']
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- product-media — admins only.
--
-- Public reads happen exclusively through signed URLs, which bypass these
-- policies by design, so no public select policy is needed or wanted.
-- ---------------------------------------------------------------------------
create policy "product-media: admin read"
  on storage.objects for select
  using (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin insert"
  on storage.objects for insert
  with check (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin update"
  on storage.objects for update
  using (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin delete"
  on storage.objects for delete
  using (bucket_id = 'product-media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- review-media — a user owns the folder named after their uid.
--
-- Path convention: review-media/{user_id}/{review_id}/{file}
--
-- storage.foldername(name) splits the object path, so [1] is the first
-- segment. Comparing it to auth.uid() means a user can only ever write into
-- their own folder — they cannot upload into someone else's namespace or
-- overwrite another user's evidence.
-- ---------------------------------------------------------------------------
create policy "review-media: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'review-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "review-media: owner read"
  on storage.objects for select
  using (
    bucket_id = 'review-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "review-media: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'review-media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "review-media: admin update"
  on storage.objects for update
  using (bucket_id = 'review-media' and public.is_admin());
