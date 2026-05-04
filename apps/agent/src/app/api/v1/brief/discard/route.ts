// POST /api/v1/brief/discard
// Spec: docs/specs/founder-review-flow.md "Discard Action".
// AGENT.md state: PENDING_FOUNDER_REVIEW → DISCARDED (terminal).
//
// Required behaviour:
//   1. Read order_id + optional reason
//   2. Verify auth: founder JWT claim
//   3. UPDATE orders SET status='discarded', updated_at=now()
//   4. INSERT activity_log: founder_discarded with payload.reason
//   5. NO further emails fire (customer keeps their auto-ack only).

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/founder-review-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/founder-review-flow.md' },
    { status: 501 },
  );
}
