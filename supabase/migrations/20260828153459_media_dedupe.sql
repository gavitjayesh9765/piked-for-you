-- ============================================================================
-- Shared media: one file, many products.
--
-- What was wrong
-- --------------
-- `product_media.storage_path` was `{product_id}/{uuid}.{ext}` and every row
-- owned its object outright. Uploading the same photograph to five products
-- put five identical objects in the bucket, and there was no way to attach an
-- image that already existed — the only path to a product image was a fresh
-- upload. The library screen was a read-only wall of those duplicates.
--
-- What this does
-- --------------
--   1. `checksum` — the SHA-256 of the *stored* bytes, which is to say the
--      re-encoded, EXIF-stripped, resized image the API actually wrote, not
--      whatever arrived on the wire. Two uploads of the same source photo
--      produce the same object and therefore the same digest; two different
--      photos never do. Nullable, because the rows that already exist were
--      written before anything hashed them, and re-hashing a bucket in a
--      migration is not a migration. A NULL checksum simply never dedupes.
--
--   2. An index on `storage_path`. It is now read as a *reference count* on
--      every delete — "does any other row still point at this object?" — and
--      that question is asked on a table that had no index able to answer it.
--
-- What this deliberately does NOT do
-- ----------------------------------
-- It does not add a unique constraint on `checksum`, and it does not promote
-- the file to a table of its own. Sharing is expressed by two rows holding the
-- same `storage_path`, which means every existing read path — the product
-- page, the library, the signing helper — keeps working untouched, and the
-- only code that has to learn anything new is the code that DELETES. That is
-- the whole risk surface, and it is one function.
--
-- The corresponding rule in the API (backend/app/modules/admin/media.py): the
-- storage object is removed only when the row being deleted is the last one
-- referencing it. Without that rule this migration would be actively unsafe —
-- detaching an image from one product would delete it out from under every
-- other product using it.
-- ============================================================================

alter table public.product_media
  add column if not exists checksum text;

comment on column public.product_media.checksum is
  'SHA-256 (hex) of the stored object bytes. Drives upload de-duplication: an '
  'upload whose digest already exists reuses that object instead of writing a '
  'second copy. NULL on rows written before de-duplication existed.';

-- Answers "is anyone else using this object?" on delete, and "have we already
-- stored these exact bytes?" on upload.
create index if not exists product_media_storage_path_idx
  on public.product_media (storage_path)
  where storage_path is not null;

create index if not exists product_media_checksum_idx
  on public.product_media (checksum)
  where checksum is not null;
