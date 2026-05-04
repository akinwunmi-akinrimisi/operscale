// POST /v1/payment/initialize
// Spec: docs/specs/paystack-integration.md "Initialize Transaction".
//
// Required behaviour:
//   1. Read order_id from body
//   2. Verify auth: founder JWT claim (called from /v1/brief/approve flow)
//   3. Pre-generate paystack_tx_ref: 'ops-cal-{order_id}-{unix_ts}'
//   4. UPDATE orders SET paystack_tx_ref = ... (idempotency anchor BEFORE Paystack call)
//   5. POST Paystack /transaction/initialize with email, amount (NGN × 100 = kobo),
//      currency='NGN', reference, callback_url, metadata, channels
//   6. Return { authorization_url, reference }

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/paystack-integration.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/paystack-integration.md' },
    { status: 501 },
  );
}
