-- 0002_storage_buckets.sql
--
-- Two private storage buckets, both default-deny.
-- Source: docs/data-model.md §2 + docs/specs/photo-upload-and-retention.md.
-- The CRM never reads from these buckets directly — it mints 5-min signed URLs
-- via the agent service-role key (see apps/agent/src/app/api/v1/admin/photo-signed-url/route.ts).

begin;

-- ---------------------------------------------------------------------------
-- customer-photos: face reference photos for AI avatar generation.
-- Retention: 30 days from upload (abandoned) or 90 days from delivered_at.
-- Daily sweep at 03:00 WAT (supabase/functions/photo-retention-sweep/).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-photos',
  'customer-photos',
  false,
  10485760, -- 10 MiB per file (matches brief_photos.size_bytes CHECK)
  array['image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- customer-logos: brand logos uploaded in form step 4.
-- Retention: indefinite while customer record exists; deleted via NDPC procedure.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-logos',
  'customer-logos',
  false,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS: default-deny for anon and authenticated.
-- service_role bypasses these (used by agent for upload + signed-url generation).
-- ---------------------------------------------------------------------------

create policy "customer-photos: anon deny"
  on storage.objects as restrictive
  for all to anon
  using (bucket_id = 'customer-photos' and false)
  with check (bucket_id = 'customer-photos' and false);

create policy "customer-photos: authenticated deny direct read"
  on storage.objects as restrictive
  for select to authenticated
  using (bucket_id = 'customer-photos' and false);

create policy "customer-logos: anon deny"
  on storage.objects as restrictive
  for all to anon
  using (bucket_id = 'customer-logos' and false)
  with check (bucket_id = 'customer-logos' and false);

create policy "customer-logos: authenticated deny direct read"
  on storage.objects as restrictive
  for select to authenticated
  using (bucket_id = 'customer-logos' and false);

commit;
