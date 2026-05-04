// POST /v1/admin/photo-delete
// Spec: docs/specs/photo-upload-and-retention.md "Failure Modes & Mitigations" +
//       docs/specs/ndpc-compliance.md (early customer deletion request).
//
// Required behaviour:
//   1. Verify founder JWT claim
//   2. Read photo_id (or brief_id for bulk) + reason
//   3. Delete file from storage 'customer-photos'
//   4. UPDATE brief_photos SET deleted_at=now()
//   5. INSERT activity_log: photo_deleted_by_customer_request OR founder_override

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/photo-upload-and-retention.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/photo-upload-and-retention.md' },
    { status: 501 },
  );
}
