// apps/agent/src/app/v1/webhook/paystack/route.ts
//
// Paystack webhook handler. Phase 4.6 implementation per
// docs/specs/paystack-integration.md and docs/specs/v2-phase-4-6-design.md.
//
// CRITICAL ordering (do NOT change):
//   1. Read raw body via req.text() — DO NOT JSON.parse first
//   2. Read header x-paystack-signature
//   3. verifyWebhookSignature(rawBody, sig, secret) using HMAC-SHA512
//   4. ON MISMATCH: 401, log security event, no body parse
//   5. ON MATCH: JSON.parse, dispatch by event.event
//
// Cloudflare proxy MUST be off for api.operscale.cloud (DNS-only) so the raw
// body bytes reach us unmodified. See docs/deployment.md.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyWebhookSignature } from '@/lib/paystack';
import type { PaystackChargeSuccessEvent, PaystackChargeFailureEvent } from '@/lib/paystack';
import { sendEmail, EmailSendError } from '@/lib/email';
import { paymentConfirmationProps } from '@/lib/payment-confirmation-props';
import { PaymentConfirmation } from '@operscale-calendar/web/emails/PaymentConfirmation';
import { render } from '@react-email/render';
import * as React from 'react';
import { webhookGetExplainer } from '@/lib/webhook-405';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = () =>
  webhookGetExplainer({ caller: 'Paystack', spec: 'docs/specs/paystack-integration.md' });

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    return NextResponse.json({ error: 'missing_secret' }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    const supabase = getSupabaseAdmin();
    await writeActivityLog(
      {
        eventType: 'webhook_signature_failed',
        actor: 'system',
        payload: {
          provided_signature: signature ?? null,
          ip: req.headers.get('x-forwarded-for') ?? null,
        },
      },
      supabase,
    );
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'malformed_json' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  switch (event?.event) {
    case 'charge.success':
      await handleChargeSuccess(event as PaystackChargeSuccessEvent, supabase);
      break;
    case 'charge.failure':
      await handleChargeFailure(event as PaystackChargeFailureEvent, supabase);
      break;
    case 'transfer.success':
      await writeActivityLog(
        { eventType: 'webhook_transfer_success_skipped', actor: 'system', payload: { event_id: event.data?.id } },
        supabase,
      );
      break;
    default:
      await writeActivityLog(
        { eventType: 'webhook_unhandled_event', actor: 'system', payload: { event_type: event?.event } },
        supabase,
      );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleChargeSuccess(
  event: PaystackChargeSuccessEvent,
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<void> {
  const eventId = String(event.data.id);
  const txRef = event.data.reference;

  // Idempotency: skip if we've processed this event before.
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('paystack_event_id', eventId)
    .maybeSingle();
  if (existing) return;

  // Find the order by tx_ref.
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, brief_id, status, tier, amount_ngn, paystack_tx_ref')
    .eq('paystack_tx_ref', txRef)
    .maybeSingle();
  if (!order) {
    await writeActivityLog(
      { eventType: 'webhook_unknown_tx_ref', actor: 'system', payload: { tx_ref: txRef, event_id: eventId } },
      supabase,
    );
    return;
  }

  const expectedKobo = order.amount_ngn * 100;
  if (event.data.amount !== expectedKobo) {
    await writeActivityLog(
      {
        eventType: 'webhook_amount_mismatch',
        actor: 'system',
        orderId: order.id,
        payload: { expected_kobo: expectedKobo, actual_kobo: event.data.amount, tx_ref: txRef },
      },
      supabase,
    );
    // Still process — record under-payment for founder reconciliation.
  }

  await supabase.from('payments').insert({
    order_id: order.id,
    paystack_event_id: eventId,
    event_type: 'charge.success',
    amount_ngn: Math.round(event.data.amount / 100),
    raw_payload: event.data,
  });

  const nowIso = new Date().toISOString();
  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: nowIso, production_ready_at: nowIso })
    .eq('id', order.id);

  await writeActivityLog(
    {
      eventType: 'payment_succeeded',
      actor: 'system',
      orderId: order.id,
      briefId: order.brief_id,
      payload: {
        tx_ref: txRef,
        event_id: eventId,
        amount_ngn: Math.round(event.data.amount / 100),
        payment_method: event.data.channel,
      },
    },
    supabase,
  );

  // Fetch customer + send confirmation email (best-effort).
  const { data: customer } = await supabase
    .from('customers')
    .select('full_name, email')
    .eq('id', order.customer_id)
    .maybeSingle();
  if (!customer || !customer.email) {
    await writeActivityLog(
      { eventType: 'payment_confirmation_email_failed', actor: 'system', orderId: order.id, payload: { error: 'customer_or_email_missing' } },
      supabase,
    );
    return;
  }

  try {
    const props = paymentConfirmationProps(event, { id: order.id, tier: order.tier, amount_ngn: order.amount_ngn }, customer);
    const subject = `Payment received — your ${props.brandName} calendar is now in production`;
    const element = React.createElement(PaymentConfirmation, props);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    await sendEmail({
      to: customer.email,
      templateKey: 'payment-confirmation',
      subject, html, text,
      customerId: order.customer_id, briefId: order.brief_id, orderId: order.id,
    });
  } catch (e) {
    const detail = e instanceof EmailSendError ? e.message : String(e);
    await writeActivityLog(
      { eventType: 'payment_confirmation_email_failed', actor: 'system', orderId: order.id, briefId: order.brief_id, payload: { error: detail, tx_ref: txRef, event_id: eventId } },
      supabase,
    );
  }
}

async function handleChargeFailure(
  event: PaystackChargeFailureEvent,
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<void> {
  const txRef = event.data.reference;
  const eventId = String(event.data.id);
  await writeActivityLog(
    {
      eventType: 'payment_failed',
      actor: 'system',
      payload: { tx_ref: txRef, event_id: eventId, gateway_response: event.data.gateway_response ?? null },
    },
    supabase,
  );
}
