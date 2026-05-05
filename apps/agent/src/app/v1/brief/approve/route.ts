// POST /v1/brief/approve
// Phase 4 scope: founder auth → read brief's is_current analysis_runs row →
// INSERT customer_framework_history rows for each selected_pair → flip
// orders.status='founder_approved'.
//
// Phase 4.5 scope: after founder_approved, initialise Paystack transaction,
// render BriefEmail, send via Resend, flip orders.status='brief_sent'.
// Failure paths: paystack_init_failed → 502 (stays founder_approved);
// brief_email_failed → 502 + status='brief_email_failed' (retryable).
//
// Spec: docs/specs/v2-pipeline-implementation-design.md §3.4 + §9.
//
// Schema notes (verified 2026-05-05 against migrations):
//   - orders.status CHECK was extended in 0007_orders_founder_approved_status.sql
//     to include 'founder_approved' and 'brief_email_failed'.
//   - customer_framework_history PK is (customer_id, framework_slot, archetype_slot).
//     order_id is a regular column, not part of the PK.
//   - analysis_runs.framework_seed is JSONB with selected_pairs array.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as React from 'react';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';
import { initializeTransaction, paystackReference, PaystackInitError } from '@/lib/paystack';
import { sendEmail, EmailSendError } from '@/lib/email';
import { snapshotToEmailProps } from '@/lib/snapshot-to-email-props';
import { BriefEmail } from '@operscale-calendar/web/emails/BriefEmail';
import { render } from '@react-email/render';

const BodySchema = z.object({ order_id: z.string().min(1) });

const APPROVABLE_STATUSES = ['pending_founder_review', 'brief_email_failed'] as const;

export async function POST(req: Request): Promise<Response> {
  const claims = verifyJwt(req.headers);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (claims.role !== 'founder') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    const detail =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : 'invalid json';
    return NextResponse.json({ error: `validation: ${detail}` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, brief_id, customer_id, status, tier, amount_ngn')
    .eq('id', parsed.order_id)
    .maybeSingle();
  if (orderErr || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }
  if (!(APPROVABLE_STATUSES as readonly string[]).includes(order.status)) {
    return NextResponse.json(
      { error: `order_status_not_approvable: ${order.status}` },
      { status: 409 },
    );
  }

  // Read the current analysis_runs row for this brief.
  const { data: run, error: runErr } = await supabase
    .from('analysis_runs')
    .select('id, framework_seed, ai_output')
    .eq('brief_id', order.brief_id)
    .eq('is_current', true)
    .maybeSingle();
  if (runErr || !run) {
    return NextResponse.json({ error: 'no_current_analysis_run' }, { status: 404 });
  }

  const pairs: Array<{ framework: string; archetype: string }> =
    run.framework_seed?.selected_pairs ?? [];
  if (pairs.length === 0) {
    return NextResponse.json({ error: 'analysis_run_has_no_selected_pairs' }, { status: 500 });
  }

  // Write one customer_framework_history row per pair.
  // PK is (customer_id, framework_slot, archetype_slot); order_id is a regular column.
  const historyRows = pairs.map((p) => ({
    customer_id: order.customer_id,
    order_id: order.id,
    framework_slot: p.framework,
    archetype_slot: p.archetype,
  }));
  const { error: histErr } = await supabase
    .from('customer_framework_history')
    .insert(historyRows);
  if (histErr) {
    return NextResponse.json(
      { error: `framework_history_insert_failed: ${histErr.message}` },
      { status: 500 },
    );
  }

  // Flip order status to founder_approved (added in migration 0007).
  await supabase
    .from('orders')
    .update({
      status: 'founder_approved',
      founder_approved_at: new Date().toISOString(),
      founder_approved_by: claims.sub,
      approved_analysis_run_id: run.id,
    })
    .eq('id', order.id);

  await writeActivityLog(
    {
      eventType: 'founder_approved',
      actor: 'founder',
      briefId: order.brief_id,
      orderId: order.id,
      payload: {
        analysis_run_id: run.id,
        framework_history_rows_written: historyRows.length,
      },
    },
    supabase,
  );

  // ─── Phase 4.5: fetch customer ───────────────────────────────────────────
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('full_name, email')
    .eq('id', order.customer_id)
    .maybeSingle();
  if (custErr || !customer || !customer.email) {
    await supabase.from('orders').update({ status: 'brief_email_failed' }).eq('id', order.id);
    await writeActivityLog(
      {
        eventType: 'customer_fetch_failed',
        actor: 'system',
        orderId: order.id,
        briefId: order.brief_id,
        payload: { error: custErr?.message ?? 'customer_or_email_missing' },
      },
      supabase,
    );
    return NextResponse.json({ error: 'customer_not_found_or_no_email' }, { status: 502 });
  }

  // ─── Phase 4.5: narrow Supabase's untyped Record<string,unknown> to known shapes ──
  // supabase.from(...).select(...) returns Record<string,unknown> — tier and
  // amount_ngn are not inferred. Cast once here; no as-any needed downstream.
  const orderTyped = order as {
    id: string;
    brief_id: string;
    customer_id: string;
    status: string;
    tier: import('@/lib/types/v2').Tier;
    amount_ngn: number;
  };
  const runTyped = run as {
    id: string;
    framework_seed: { selected_pairs: Array<{ framework: string; archetype: string }> };
    ai_output: import('@/lib/types/v2').SupersetOutput;
  };

  // ─── Phase 4.5: Paystack initialise ─────────────────────────────────────
  const txRef = paystackReference(orderTyped.id);
  let paystackResult: Awaited<ReturnType<typeof initializeTransaction>>;
  try {
    paystackResult = await initializeTransaction({
      email: customer.email,
      amountNgn: orderTyped.amount_ngn,
      reference: txRef,
      callbackUrl: `https://${process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'operscale.cloud'}/payment/return?order_id=${orderTyped.id}`,
      metadata: { order_id: orderTyped.id, customer_id: orderTyped.customer_id, brief_id: orderTyped.brief_id, tier: orderTyped.tier },
    });
  } catch (e) {
    const detail = e instanceof PaystackInitError ? e.message : String(e);
    await writeActivityLog(
      { eventType: 'paystack_init_failed', actor: 'system', orderId: orderTyped.id, briefId: orderTyped.brief_id, payload: { error: detail } },
      supabase,
    );
    return NextResponse.json({ error: 'paystack_init_failed', detail }, { status: 502 });
  }

  await supabase
    .from('orders')
    .update({
      paystack_tx_ref: paystackResult.reference,
      paystack_authorization: paystackResult,
      payment_initiated_at: new Date().toISOString(),
    })
    .eq('id', orderTyped.id);

  // ─── Phase 4.5: Render BriefEmail + send via Resend ─────────────────────
  const props = snapshotToEmailProps(
    { ai_output: runTyped.ai_output },
    { id: orderTyped.id, tier: orderTyped.tier, amount_ngn: orderTyped.amount_ngn, customer_id: orderTyped.customer_id, brief_id: orderTyped.brief_id },
    { full_name: customer.full_name, email: customer.email },
    paystackResult.authorizationUrl,
  );
  const subject = `Your ${props.brandName} calendar brief is ready — ${props.tierName}, ${props.videoCount} videos`;
  const element = React.createElement(BriefEmail, props);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  let sent: Awaited<ReturnType<typeof sendEmail>>;
  try {
    sent = await sendEmail({
      to: customer.email,
      templateKey: 'brief-email',
      subject,
      html,
      text,
      customerId: orderTyped.customer_id,
      briefId: orderTyped.brief_id,
      orderId: orderTyped.id,
    });
  } catch (e) {
    const detail = e instanceof EmailSendError ? e.message : String(e);
    await supabase.from('orders').update({ status: 'brief_email_failed' }).eq('id', orderTyped.id);
    await writeActivityLog(
      { eventType: 'brief_email_send_failed', actor: 'system', orderId: orderTyped.id, briefId: orderTyped.brief_id, payload: { error: detail, tx_ref: paystackResult.reference } },
      supabase,
    );
    return NextResponse.json({ error: 'email_send_failed', tx_ref: paystackResult.reference, detail }, { status: 502 });
  }

  await supabase
    .from('orders')
    .update({
      status: 'brief_sent',
      brief_email_sent_at: new Date().toISOString(),
    })
    .eq('id', orderTyped.id);

  return NextResponse.json(
    {
      order_id: orderTyped.id,
      framework_history_rows_written: historyRows.length,
      paystack_tx_ref: paystackResult.reference,
      brief_email_sent: true,
      resend_message_id: sent.resendMessageId,
    },
    { status: 200 },
  );
}
