// POST /v1/brief/submit
// Spec: docs/customer-journey.md §2.6 (SUBMITTED state).
// AGENT.md state: SUBMITTED → AI_ANALYSIS_RUNNING.
//
// Behaviour (Phase 6.1):
//   1. Validate body (brief_id, customer_id, terms consent hash) via zod.
//   2. Verify terms consent hash matches the canonical text at v1.
//   3. Load brief + customer; verify ownership.
//   4. Idempotency: if briefs.submitted_at IS NOT NULL, return existing
//      {brief_id, order_id} without rewriting anything.
//   5. Validate the persisted briefs.form_payload has all required keys
//      from steps 1, 2, 3, 6 (+ optional step 4) via FullFormPayloadSchema.
//   6. Multi-statement update sequence (no single SQL transaction — the
//      existing approve/discard routes set this precedent):
//        a) UPDATE customers (touch updated_at, default source).
//        b) UPDATE briefs SET current_step=7, submitted_at=now().
//        c) INSERT orders (status='pending_founder_review', amount_ngn from
//           tier lookup).
//        d) INSERT brief_consent (consent_type='terms', v1, hash, ip, ua).
//        e) UPDATE brief_photos SET brief_id=$brief WHERE customer_id=$cust
//           AND brief_id IS NULL  — relink orphan photos uploaded before
//           this brief existed.
//        f) INSERT activity_log: form_submitted.
//   7. Send auto-ack email synchronously, best-effort.
//   8. INSERT ai_analysis_jobs (status='queued', trigger_type='initial')
//      so the worker picks it up.
//   9. Return {brief_id, order_id}.
//
// Public endpoint — no JWT required. CORS allowed for the CRM origin.

import { NextResponse, type NextRequest } from 'next/server';
import * as React from 'react';
import { render } from '@react-email/render';
import AutoAckEmail from '@operscale-calendar/web/emails/AutoAckEmail';
import {
  TERMS_CONSENT_TEXT_V1,
  consentTextHash,
} from '@operscale-calendar/web/lib/consent';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { sendEmail, EmailSendError } from '@/lib/email';
import { corsPreflight, withCors } from '@/lib/cors';
import {
  SubmitBodySchema,
  FullFormPayloadSchema,
} from '@/lib/form-payload-schema';
import { priceForTier, deliverableForTier, type Tier } from '@/lib/tiers';
import { computeIdempotencyKey } from '@/lib/idempotency-key';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const OPTIONS = corsPreflight;

const FOUNDER_NAME = 'Akinwunmi';

function jsonOk(body: Record<string, unknown>): Response {
  return NextResponse.json(body, { status: 200 });
}
function jsonErr(error: string, status: number, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

function nowWatString(d = new Date()): string {
  // Africa/Lagos is UTC+1 with no DST.
  const utcMs = d.getTime();
  const wat = new Date(utcMs + 60 * 60 * 1000);
  return wat.toISOString().replace('T', ' ').slice(0, 16) + ' WAT';
}

async function handler(req: NextRequest): Promise<Response> {
  // 1) Parse + validate envelope
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('invalid_json', 400);
  }
  const parsed = SubmitBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr('validation', 400, {
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  const { brief_id, customer_id, terms_consent_text_hash } = parsed.data;

  // 2) Verify terms consent hash
  const expectedHash = await consentTextHash(TERMS_CONSENT_TEXT_V1);
  if (terms_consent_text_hash !== expectedHash) {
    return jsonErr('terms_consent_hash_mismatch', 400);
  }

  const supabase = getSupabaseAdmin();

  // 3) Load brief + verify ownership
  const { data: brief, error: briefErr } = await supabase
    .from('briefs')
    .select('id, customer_id, tier_intent, form_payload, submitted_at, current_step')
    .eq('id', brief_id)
    .maybeSingle();
  if (briefErr) return jsonErr('brief_load_failed', 500, { detail: briefErr.message });
  if (!brief) return jsonErr('brief_not_found', 404);
  if (brief.customer_id !== customer_id) return jsonErr('customer_brief_mismatch', 403);

  // 4) Idempotent re-submit
  if (brief.submitted_at) {
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('brief_id', brief.id)
      .maybeSingle();
    return jsonOk({
      brief_id: brief.id,
      order_id: existingOrder?.id ?? null,
      already_submitted: true,
    });
  }

  // 5) Validate the FULL persisted form_payload
  const fullParse = FullFormPayloadSchema.safeParse(brief.form_payload);
  if (!fullParse.success) {
    return jsonErr('form_payload_incomplete', 400, {
      issues: fullParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  const payload = fullParse.data;
  const tier = payload.tier_intent as Tier;
  const amountNgn = priceForTier(tier);
  const tierMeta = deliverableForTier(tier);

  // 6a) Touch customers row (defaults source if it's still NULL)
  const { error: custErr } = await supabase
    .from('customers')
    .update({
      source: 'direct',
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', customer_id);
  if (custErr) return jsonErr('customer_touch_failed', 500, { detail: custErr.message });

  // 6b) Submit the brief
  const submittedAt = new Date().toISOString();
  const { error: submitBriefErr } = await supabase
    .from('briefs')
    .update({
      current_step: 7,
      submitted_at: submittedAt,
      last_updated_at: submittedAt,
    })
    .eq('id', brief.id);
  if (submitBriefErr) {
    return jsonErr('brief_submit_failed', 500, { detail: submitBriefErr.message });
  }

  // 6c) Create the order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_id,
      brief_id: brief.id,
      tier,
      amount_ngn: amountNgn,
      status: 'pending_founder_review',
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    // The brief is already marked submitted but no order exists. The CRM
    // queue won't show the row (it filters by orders.status); this surfaces
    // as an alarming "missing order" if it ever fires. Log heavily; manual
    // intervention required (run /v1/brief/analyze + insert orders row).
    return jsonErr('order_create_failed', 500, { detail: orderErr?.message });
  }

  // 6d) Record terms consent
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent') ?? null;
  await supabase.from('brief_consent').insert({
    brief_id: brief.id,
    consent_type: 'terms',
    consent_text_version: 'v1',
    consent_text_hash: terms_consent_text_hash,
    ip_address: ip,
    user_agent: userAgent,
  });

  // 6e) Re-link any orphan photos uploaded before the brief was created.
  // brief_photos.brief_id can be NULL during step-5 → step-7 transitions
  // (master plan §6.2 — photo upload supports brief_id=null).
  await supabase
    .from('brief_photos')
    .update({ brief_id: brief.id })
    .eq('customer_id', customer_id)
    .is('brief_id', null);

  // 6f) Activity log
  await writeActivityLog(
    {
      eventType: 'form_submitted',
      actor: 'customer',
      customerId: customer_id,
      briefId: brief.id,
      orderId: order.id,
      payload: { tier, amount_ngn: amountNgn },
    },
    supabase,
  );

  // 7) Auto-ack email — best effort
  const { data: customer } = await supabase
    .from('customers')
    .select('email, full_name, business_name, whatsapp_number')
    .eq('id', customer_id)
    .maybeSingle();

  if (customer?.email && !customer.email.endsWith('@stub.operscale.local')) {
    const firstName = (customer.full_name ?? '').split(/\s+/)[0] || 'there';
    const founderWhatsapp = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP ?? '+2348000000000';
    try {
      const element = React.createElement(AutoAckEmail, {
        firstName,
        brandName: customer.business_name ?? 'your brand',
        tierDisplayName: tierMeta.display_name,
        videoCount: tierMeta.videos,
        carouselCount: tierMeta.carousels,
        deliveryWindow: tierMeta.delivery_window,
        watTimestamp: nowWatString(),
        founderWhatsappNumber: founderWhatsapp,
        founderName: FOUNDER_NAME,
      });
      const html = await render(element);
      const text = await render(element, { plainText: true });
      await sendEmail({
        to: customer.email,
        templateKey: 'auto-ack',
        subject: 'Got your Operscale brief — personalised version coming within an hour',
        html,
        text,
        customerId: customer_id,
        briefId: brief.id,
        orderId: order.id,
      });
    } catch (e) {
      const detail = e instanceof EmailSendError ? e.message : String(e);
      await writeActivityLog(
        {
          eventType: 'email_failed',
          actor: 'system',
          customerId: customer_id,
          briefId: brief.id,
          orderId: order.id,
          payload: { template: 'auto-ack', detail },
        },
        supabase,
      );
    }
  }

  // 8) Enqueue AI analysis. The ai_analysis_jobs table has a UNIQUE
  // idempotency_key (migration 0006) that the worker uses to drop duplicate
  // re-enqueues; the canonical key is computeIdempotencyKey({brief_id,
  // trigger_type:'initial'}) which both /v1/brief/analyze and /submit must
  // produce identically.
  const { error: jobErr } = await supabase.from('ai_analysis_jobs').insert({
    brief_id: brief.id,
    status: 'queued',
    trigger_type: 'initial',
    idempotency_key: computeIdempotencyKey({
      brief_id: brief.id,
      trigger_type: 'initial',
    }),
  });
  if (jobErr) {
    // Submission succeeded but the worker won't auto-pick this up. Founder
    // can hit Re-analyze in the CRM. Log loudly.
    await writeActivityLog(
      {
        eventType: 'ai_analysis_queue_failed',
        actor: 'system',
        customerId: customer_id,
        briefId: brief.id,
        orderId: order.id,
        payload: { detail: jobErr.message },
      },
      supabase,
    );
  }

  return jsonOk({ brief_id: brief.id, order_id: order.id });
}

export const POST = withCors(handler);
