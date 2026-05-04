# Spec: photo upload and retention

The most NDPC-sensitive part of Phase 1. Customers upload up to 3 face photos for use as references in a Phase 2 custom AI avatar. This document covers the full lifecycle: consent, upload, storage, quality checks, retention, deletion, and what happens in every failure mode.

If you're touching any code path that reads, writes, or deletes a customer photo, read this whole document first.

## What we are doing and why

We collect face photos at form step 5 — optionally — so that Phase 2 production has everything it needs to create a custom HeyGen avatar that appears in the customer's UGC videos. Collecting at brief-time means no second customer interruption when production starts.

We do this with explicit, hashed consent. We retain the photos only as long as we need them (90 days post-delivery, or 30 days if no order materialises). We delete on request within 72 hours. We never share photos with third parties.

The customer can skip the upload entirely; in that case we use a stock AI presenter for their UGC videos.

## State machine

```
[no photos]
    |
    | customer reaches form step 5
    | customer chooses to upload
    v
[photos selected client-side]
    |
    | quality check runs (browser)
    | passing photos and/or override-flagged photos go through
    v
[consent checkbox required]
    |
    | customer ticks the consent box
    v
[photos POST to /v1/brief/upload-photo]
    |
    | service-role write to Supabase Storage
    | brief_photos and brief_consent rows inserted
    | scheduled_delete_at = uploaded_at + 30 days
    v
[uploaded, awaiting brief submission]
    |
    | customer submits brief at step 7
    v
[uploaded and linked to a brief]
    |
    | (optional) AI brief analysis runs with vision blocks
    v
[uploaded, brief in pending_founder_review]
    |
    | (optional) founder approves, customer pays
    v
[paid] → photos remain available for Phase 2
    |
    | (Phase 2) production renders avatars from photos
    | (Phase 2) order delivered_at is set
    v
[delivered] → scheduled_delete_at moves to delivered_at + 90 days
    |
    | (90 days pass)
    v
[scheduled for deletion]
    |
    | daily cron runs photo-retention-sweep at 03:00 WAT
    v
[deleted]

Side branches:
- Customer can request deletion at any state — manually handled, 72h SLA.
- If brief is never submitted, photos are orphaned and auto-deleted at 30 days from upload.
- If order is never paid, photos are auto-deleted at 30 days from upload.
- If founder discards the brief, photos are auto-deleted at 30 days from upload.
```

## The consent text (canonical version)

Exact wording. This is what the customer sees:

```
I understand and agree that the photos I upload will be used by Operscale to create
a personalised AI avatar that appears in my video ads. The photos are stored
privately, never shared with third parties, and are automatically deleted 90 days
after my final delivery. I can request earlier deletion at any time by emailing
privacy@operscale.cloud. I confirm that I am the person in these photos, or have
explicit permission from the person shown.
```

The text is constant — version 1 of the consent. If we ever change this text, we bump the version (`consent_text_version: 'v1'` → `'v2'`) and store the new canonical text plus its SHA-256 hash. Existing customers continue under their original version; new customers see the new version.

We compute the SHA-256 hash of the canonical text (UTF-8, exact bytes including newlines) and store the hash alongside each consent. This lets us prove the customer agreed to a specific version, even if we modify the displayed text in the future.

```typescript
// apps/web/src/lib/consent.ts
export const PHOTO_CONSENT_V1 = `I understand and agree that the photos I upload...`;
export const PHOTO_CONSENT_V1_HASH = 'sha256:...computed once and committed...';
```

## Form step 5 UI

### Layout

- Header: "Want your face in your videos?"
- Subheader: "Upload up to 3 photos and we'll create a custom AI version of you that appears in your UGC videos."
- Body: explanation that this step is optional. "Skip" button is prominent.
- Photo upload zone: drag-and-drop or click-to-select. Max 3 files. Max 10MB each. JPEG or PNG.
- Photo guidance: "For best results: front-facing, clear lighting, no sunglasses, no group photos, neutral or smiling expression. Different angles help."
- Live thumbnails of uploaded photos with delete-and-replace control.
- Consent checkbox below the upload zone (mandatory if any photo is uploaded).
- Skip link: "Skip this step — use a stock AI presenter instead."

### Quality check (client-side, advisory only)

Three checks run in the browser when a photo is selected:

1. **Face detection.** Using `@tensorflow-models/blazeface`. Pass = exactly 1 face detected with confidence > 0.7. Fail modes: 0 faces ("we couldn't find a face — try a clearer photo"), 2+ faces ("looks like more than one person — please use a solo photo").

2. **Sharpness.** Using a Laplacian variance filter on a downsized version of the image. Pass threshold: variance > 100 on a normalised image. Fail = "this photo looks a bit blurry — a sharper one will give better results."

3. **Brightness.** Average luminance computed from grayscale conversion. Pass: 50 < avg_luminance < 200 (on 0-255 scale). Fail: "this photo is too dark / too bright — natural daylight gives best results."

All three are **advisory**. The customer can override and proceed even if a check fails. We log the override and pass the photo through to upload. Founder will see the flag in the CRM and can decide whether to ask for a re-upload.

### What we don't check

We do NOT do face recognition (we're not trying to identify the person). We do NOT do age estimation (NDPC concerns and unreliable anyway). We do NOT do anything that would imply we're "approving" the customer.

## Upload flow

### Endpoint

`POST /v1/brief/upload-photo`

### Request

`multipart/form-data` with:

- `file`: the photo binary
- `brief_id`: the brief this photo belongs to (if a brief exists yet, otherwise NULL — we link later)
- `customer_id`: the customer (derived from save token if no auth yet)
- `photo_index`: 1, 2, or 3
- `quality_check`: JSON with the client-side check results
- `consent_signed_at`: ISO timestamp from the moment the customer ticked the box
- `consent_text_version`: 'v1'
- `consent_text_hash`: the canonical SHA-256

### Server-side validation

1. Verify the consent_text_hash matches the canonical version we have on file. If not, reject (400) — someone is messing with the form.
2. Verify the file is under 10MB. Reject otherwise.
3. Verify MIME type is `image/jpeg` or `image/png`. Reject otherwise.
4. Verify the actual file is what its MIME type claims (using `file-type` npm package to read magic bytes).
5. Verify the customer_id is a real customer (or create one if save token implies a new customer).
6. Apply rate limiting: max 10 photo uploads per IP per 5 minutes. Hard.

### Storage write

- Bucket: `customer-photos` (private, RLS denies anon)
- Path: `{customer_id}/{brief_id_or_null}/photo_{photo_index}.jpg`
- If MIME is `image/png`, we still extension as `.jpg` — we re-encode to JPEG server-side. Reasons: (a) consistent format for Phase 2 pipeline, (b) JPEG is smaller, (c) avoids PNG's exif metadata edge cases.
- Re-encoding parameters: quality 92, progressive, no exif passthrough, max dimension 2048px on the long edge.

### Database writes

In a single transaction:

```sql
-- Insert the photo record
INSERT INTO brief_photos (
  customer_id, brief_id, photo_index, storage_path,
  mime_type, size_bytes, face_detected, sharpness_score,
  brightness_score, quality_check_passed, uploaded_at,
  scheduled_delete_at
) VALUES (..., now(), now() + interval '30 days');

-- Insert the consent record (only on first photo of this brief)
INSERT INTO brief_consent (
  brief_id, consent_type, consent_text_version,
  consent_text_hash, signed_at, ip_address
) VALUES (..., 'photo_upload', 'v1', ..., now(), '...')
ON CONFLICT (brief_id, consent_type) DO NOTHING;

-- Activity log
INSERT INTO activity_log (event_type, customer_id, brief_id, payload)
VALUES ('photo_uploaded', ..., '{"photo_index": 1, "size_bytes": 2456789}');
```

### Idempotency

Unique on `(brief_id, photo_index)`. Re-uploading photo_index = 1 OVERWRITES the storage file and UPDATEs the brief_photos row in place. The activity log gets a new entry showing the replacement.

### Response

```json
{
  "ok": true,
  "photo_id": "uuid",
  "storage_path": "...",
  "scheduled_delete_at": "2026-06-02T03:00:00Z",
  "quality_check_summary": {
    "face_detected": true,
    "sharpness_ok": true,
    "brightness_ok": false,
    "advisories": ["This photo looks a bit dark — try one in natural light if you can."]
  }
}
```

## Linking to a brief at submission

When the customer submits the form (step 7), we look for any `brief_photos` rows belonging to this customer with `brief_id IS NULL` and link them to the new brief:

```sql
UPDATE brief_photos
SET brief_id = $1
WHERE customer_id = $2 AND brief_id IS NULL AND uploaded_at > now() - interval '24 hours';
```

The 24-hour window prevents accidentally claiming photos from a much older orphan upload.

## Reading photos for AI analysis

When the AI brief analysis service needs the photos, it:

1. Queries `brief_photos WHERE brief_id = $1 AND deleted_at IS NULL ORDER BY photo_index`.
2. For each, downloads the file from Supabase Storage using service-role.
3. Base64-encodes for the Claude vision block.
4. Reads quality_check fields. If a photo had a quality flag overridden, includes that fact in the prompt for Claude to comment on.

If a photo's deleted_at is set (i.e., it's been deleted), we skip it. Brief analysis runs with whatever photos remain — or text-only if all are gone.

## Reading photos for the CRM

When the founder views an order in CRM and wants to see the photos:

1. Frontend requests a signed URL via `/v1/admin/photo-signed-url?photo_id=X`.
2. Backend verifies the founder is authenticated and on the allowlist.
3. Backend creates a signed URL with 5-minute expiry: `supabase.storage.from('customer-photos').createSignedUrl(path, 300)`.
4. Frontend renders the URL in an `<img>` tag. After 5 minutes, the URL stops working.

We do not cache signed URLs. Every view generates a new one.

## Retention

### Default schedule

- On upload: `scheduled_delete_at = uploaded_at + 30 days`.
- On `orders.delivered_at` being set (Phase 2): `scheduled_delete_at = delivered_at + 90 days`.
- On manual override (founder clicks "Delete now"): `scheduled_delete_at = now()`.
- On customer deletion request (manually handled): same as override.

### The daily sweep

`supabase/functions/photo-retention-sweep/index.ts`. Runs at 03:00 WAT every day.

```typescript
// Sketch
const expired = await supabase
  .from('brief_photos')
  .select('id, storage_path')
  .lte('scheduled_delete_at', new Date().toISOString())
  .is('deleted_at', null);

for (const photo of expired.data) {
  await supabase.storage.from('customer-photos').remove([photo.storage_path]);
  await supabase
    .from('brief_photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', photo.id);
  await activityLog({ event_type: 'photo_deleted_executed', payload: { photo_id: photo.id } });
}
```

### What "deleted" means

When a photo is deleted:

- The storage file is gone (Supabase Storage deletes the actual bytes).
- `brief_photos.deleted_at` is set. The row is NOT removed — we keep the metadata for audit (we can prove the photo existed and was deleted on time).
- `storage_path` remains in the row but no longer points to a real file.
- Activity log entry for `photo_deleted_executed`.

If the same customer comes back and uploads a new photo for a new brief, that's a new `brief_photos` row, not a re-link of the deleted one.

### What is NOT covered by retention

- Brief metadata (analysis output, edits, the customer's form responses): retained indefinitely.
- Activity log entries: retained indefinitely (anonymised on deletion request).
- We retain enough to prove we processed valid orders and to support tax / audit obligations. Photo retention rules apply only to the photos themselves.

## Deletion on request

A customer can request deletion of their photos (or all their data) by emailing `privacy@operscale.cloud`.

Phase 1 handles this manually:

1. Founder receives the email. Acknowledges within 24 hours.
2. Founder runs the deletion procedure (see `docs/security.md` incident response section).
3. Founder confirms back to the customer with a deletion timestamp.
4. The deletion is logged to `privacy_actions` (separate from `activity_log` because the customer's `activity_log` rows are also being deleted).

Target SLA: 72 hours from request to confirmation.

## What if the customer requests deletion mid-production?

Phase 1 doesn't have production yet. Phase 2 will. The policy:

- If photos are still in storage but production hasn't started: delete photos. Production proceeds with stock AI presenter (we may need to ask the customer; they may want a refund).
- If production has started but the avatar hasn't been generated yet: delete photos. Production proceeds with stock AI presenter from this point.
- If production is mid-render with an avatar already generated: delete photos. The current rendered videos use the avatar; future videos in the calendar use the stock presenter. Customer is informed; can request a refund or accept the mixed delivery.

This is documented in the privacy policy.

## Backups — important

Photos are NOT backed up by Operscale. By design.

If we backed up photos, we'd be retaining them beyond the 90-day window we promised. So:

- Daily Postgres backups include the `brief_photos` metadata (paths, hashes, etc.) but NOT the actual files.
- Supabase Storage's internal redundancy is what we rely on for durability.
- If a photo file is lost (storage corruption, accidental delete), we don't recover it. We notify the customer and (in Phase 2) re-prompt for upload or fall back to stock presenter.

## Security boundaries

- **Anon role:** no access to `customer-photos` bucket. Period.
- **Authenticated role (admin):** no direct access. Must go through the agent API which uses service-role to generate signed URLs.
- **Service role:** full access (used by the agent for analysis and signed URL generation).
- **No public URLs ever.** Every photo access is via a 5-minute signed URL.

## Failure modes

- **Customer uploads a photo that's actually a logo or product image** (not a face): face detection rejects (0 faces). Customer sees an advisory. Can override; founder will catch in CRM.
- **Customer uploads a meme or something inappropriate:** face detection probably passes (memes often have faces). Founder catches in CRM and either discards the brief or asks for re-upload.
- **Storage bucket policy mis-configured:** if RLS is incorrectly set, photos could leak via the public bucket URL. Mitigation: an integration test on every deploy verifies that the anon role gets 401 when accessing any path in `customer-photos`.
- **Signed URL leaks** (e.g., founder pastes one into a public chat): URL expires in 5 minutes. Damage is bounded.
- **Database loses link between photo and brief** (orphan): orphans get cleaned by the daily sweep at 30 days. Photo is deleted, no business impact.
- **Storage write succeeds but DB write fails:** the file exists but no row points to it. Orphan. The daily sweep won't catch this (because it queries by row). Mitigation: on every photo upload, we wrap storage write + DB write in a try/catch; storage write is rolled back (via delete) if DB write fails.
- **Customer deletes themselves before order is paid:** photos auto-delete at the 30-day mark. We do NOT retain photos past 30 days for unpaid customers.

## Cost

Storage: ~3 photos × ~3 MB × 100 customers/month = ~900 MB/month new storage.
After 30 days, retention sweep deletes orphans → steady state is about 200 MB.

Supabase Storage cost at this volume: negligible (well under any free tier).

## What's NOT in this spec

- Phase 2 avatar creation from photos. That's a separate spec.
- Phase 2 use of photos in production renders. Same.
- Customer-facing self-service deletion endpoint. Phase 1 is manual.
- Watermarking photos (we don't).
- Photo redaction tools (faces in background, etc.). The customer is responsible for what they upload.

## Where to look next

- `docs/data-model.md` — `brief_photos`, `brief_consent` schema.
- `docs/security.md` — RLS policies, signed URL pattern.
- `docs/specs/ai-brief-analysis.md` — how photos feed into the AI analysis vision blocks.
- `docs/specs/ndpc-compliance.md` — the broader compliance context.
- `apps/agent/src/api/v1/brief/upload-photo/route.ts` — the implementation.
- `supabase/functions/photo-retention-sweep/` — the daily cron.
