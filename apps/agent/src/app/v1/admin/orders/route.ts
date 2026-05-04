// GET /v1/admin/orders
// Spec: docs/specs/founder-review-flow.md (CRM list views).
//
// Required behaviour:
//   1. Verify founder JWT claim
//   2. Query orders with filters: status, paginate
//   3. Return { orders: [...], cursor }
//
// CRM-internal endpoint. Realtime channel handles live updates; this is for
// initial load + pagination beyond the realtime window.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // TODO(Operscale): implement per docs/specs/founder-review-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/founder-review-flow.md' },
    { status: 501 },
  );
}
