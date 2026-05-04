// GET /v1/admin/photo-signed-url?photo_id=...
// Spec: docs/specs/photo-upload-and-retention.md "Reading for CRM".
//
// Required behaviour:
//   1. Verify caller has founder JWT claim
//   2. Resolve brief_photos.storage_path
//   3. Generate 5-minute signed URL via service-role client
//   4. Return { url, expires_at }
//
// No caching (each request gets a fresh URL).

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // TODO(Operscale): implement per docs/specs/photo-upload-and-retention.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/photo-upload-and-retention.md' },
    { status: 501 },
  );
}
