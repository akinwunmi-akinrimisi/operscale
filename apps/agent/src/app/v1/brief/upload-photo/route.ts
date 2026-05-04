// POST /v1/brief/upload-photo
// Spec: docs/specs/photo-upload-and-retention.md.
// AGENT.md state: PHOTO_UPLOADED.
//
// Required behaviour:
//   1. Verify multipart/form-data with file + brief_id + customer_id +
//      photo_index + quality_check JSON + consent_signed_at + consent_text_version
//      + consent_text_hash
//   2. Verify consent_text_hash matches canonical SHA-256 (apps/web/src/lib/consent.ts)
//   3. Validate MIME (image/jpeg or image/png) AND magic bytes
//   4. Re-encode to JPEG quality 92, no exif, max 2048px long edge
//   5. Write to Supabase Storage 'customer-photos' bucket at
//      {customer_id}/{brief_id_or_null}/photo_{photo_index}.jpg
//   6. INSERT brief_photos with scheduled_delete_at = uploaded_at + 30 days
//   7. INSERT brief_consent on first photo (idempotent on (brief_id, consent_type))
//   8. INSERT activity_log: photo_uploaded
//   9. Rate limit: 10 photos / IP / 5 min (in-memory or Redis later)

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/photo-upload-and-retention.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/photo-upload-and-retention.md' },
    { status: 501 },
  );
}
