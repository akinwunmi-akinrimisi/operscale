// POST /v1/brief/approve
// Spec: docs/specs/founder-review-flow.md "Approve Action".
// AGENT.md state: PENDING_FOUNDER_REVIEW → FOUNDER_APPROVED → BRIEF_EMAIL_SENT.
//
// Required behaviour (transactional):
//   1. Read order_id from body
//   2. Verify auth: founder JWT claim
//   3. Materialise all analysis_edits (deep-merge onto analysis_runs.ai_output for is_current row)
//   4. UPDATE orders SET approved_analysis_run_id, founder_approved_at, founder_approved_by, status='founder_approved'
//   5. Render brief email body (apps/web/src/emails/BriefEmail.tsx) with personalised content
//   6. Initialize Paystack transaction (POST /v1/payment/initialize) → get authorization_url
//   7. Send brief email via Resend with Paystack link
//   8. UPDATE orders SET status='brief_sent', brief_email_sent_at=now()
//   9. INSERT email_log + activity_log: founder_approved + email_brief_sent
//
// Latency target: <30s end-to-end (CLAUDE.md "What good looks like").

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/founder-review-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/founder-review-flow.md' },
    { status: 501 },
  );
}
