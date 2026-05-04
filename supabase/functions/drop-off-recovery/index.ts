// supabase/functions/drop-off-recovery/index.ts
//
// Every-30-min sweep that identifies form drops + payment drops eligible for
// recovery emails / WhatsApp.
// Source: docs/customer-journey.md + docs/specs/email-templates.md.
//
// Recovery windows (from docs/specs/email-templates.md):
//   * recovery-form     — brief unsubmitted, last_updated_at > 24h ago, current_step >= 3
//   * recovery-brief    — brief sent, unpaid for 6h
//   * recovery-payment  — payment_initiated, unpaid for 24h
//
// Phase 1 ships manually first (per CLAUDE.md "observability before automation").
// Cron schedule (added later via Supabase dashboard):
//   */30 * 7-21 * * *  (every 30 min during business hours WAT)

// deno-lint-ignore-file no-unused-vars
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve((_req) => {
  // TODO(Operscale): implement drop-off recovery per
  // docs/specs/email-templates.md and docs/customer-journey.md.
  //
  // Required behaviour:
  //   1. Find form drops (briefs.briefs_unsubmitted_step3_idx covers this query)
  //   2. Find brief-sent drops (orders.status = 'brief_sent' AND brief_email_sent_at < now() - interval '6 hours')
  //   3. Find payment-init drops (orders.status = 'payment_initiated' AND payment_initiated_at < now() - interval '24 hours')
  //   4. For each: check email_log for prior recovery within window (idempotency)
  //   5. POST to apps/agent /v1/recovery/send (or call Resend directly)
  //   6. Log to activity_log: event_type='email_recovery_sent'
  return new Response(
    JSON.stringify({ status: 'not_implemented', spec: 'docs/specs/email-templates.md' }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
});
