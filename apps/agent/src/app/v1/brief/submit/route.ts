// POST /v1/brief/submit
// Spec: docs/specs/founder-review-flow.md, docs/customer-journey.md (SUBMITTED state).
// AGENT.md state: SUBMITTED → AI_ANALYSIS_RUNNING.
//
// Required behaviour (Day 7 of docs/implementation.md):
//   1. Validate form payload with zod schema
//   2. Upsert customer (by email_lower)
//   3. Insert brief with form_payload + tier_intent
//   4. Insert order(status='pending_founder_review')
//   5. Link any photos uploaded earlier (brief_photos.brief_id IS NULL → SET to brief.id)
//   6. Insert activity_log: form_submitted
//   7. Fire auto-ack email (Resend) — sync, blocking, <30s
//   8. Queue AI analysis (POST self → /v1/brief/analyze with brief_id)
//   9. Return { brief_id, order_id }
//
// Idempotency: briefs.save_token UNIQUE; resubmit with same token returns existing IDs.

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/founder-review-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/founder-review-flow.md' },
    { status: 501 },
  );
}
