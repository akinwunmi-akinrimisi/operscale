// POST /api/v1/webhook/resend-inbound
// Spec: docs/specs/email-templates.md "Inbound Handling" + "Bounce/Complaint".
//
// Handles three Resend webhook event types:
//   * email.bounced     → mark email_log.bounced_at + bounce_reason
//   * email.complained  → flag customer; never send marketing thereafter
//   * email.delivered   → set email_log.delivered_at
//
// Webhook signing: Resend uses Svix headers (svix-id, svix-timestamp, svix-signature).
// Verify per https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests.
//
// Idempotency: email_log.resend_message_id UNIQUE.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/email-templates.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/email-templates.md' },
    { status: 501 },
  );
}
