// POST /v1/webhook/evolution
// Spec: docs/specs/whatsapp-flow.md "Inbound (Customer Replies)" + delivery status.
//
// Evolution API webhook events handled:
//   * messages.upsert (inbound)   → log to whatsapp_log direction='inbound'
//   * send.message    (outbound)  → set whatsapp_log.delivered_at
//   * messages.update (read)      → set whatsapp_log.read_at
//
// Verify webhook signature per Evolution API docs.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/whatsapp-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/whatsapp-flow.md' },
    { status: 501 },
  );
}
