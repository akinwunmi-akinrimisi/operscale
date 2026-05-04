// POST /v1/webhook/paystack
// Spec: docs/specs/paystack-integration.md "Webhook Handler (CRITICAL)".
// AGENT.md state: PAYMENT_INITIATED → PAID (on charge.success).
//
// CRITICAL ordering (do NOT change):
//   1. Read raw body via req.text() — DO NOT JSON.parse first
//   2. Read header x-paystack-signature
//   3. Compute HMAC-SHA512(secret, raw_body) and constant-time-compare via
//      crypto.timingSafeEqual against the header
//   4. ON MISMATCH: 401, log security event, no body parse
//   5. ON MATCH: JSON.parse, dispatch by event type
//
// Idempotency: payments.paystack_event_id UNIQUE catches retries.
// On charge.success:
//   * Insert payments row (UNIQUE protects against double processing)
//   * UPDATE orders SET status='paid', paid_at=now()
//   * Fire payment confirmation email + WhatsApp
//   * Set production_ready_at (Phase 2 handoff)
//
// On charge.failure:
//   * Log only, no status change. Recovery cron handles re-engagement.
//
// Cloudflare proxy MUST be off for api.operscale.cloud (DNS-only) so the raw
// body bytes reach us unmodified — see docs/deployment.md.

import { NextResponse } from 'next/server';
import { webhookGetExplainer } from '@/lib/webhook-405';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // node:crypto needed for timingSafeEqual

export const GET = () =>
  webhookGetExplainer({ caller: 'Paystack', spec: 'docs/specs/paystack-integration.md' });

export async function POST() {
  // TODO(Operscale): implement per docs/specs/paystack-integration.md
  // CRITICAL: read raw body BEFORE any JSON.parse; verify signature first.
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/paystack-integration.md' },
    { status: 501 },
  );
}
