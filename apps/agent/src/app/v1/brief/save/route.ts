// POST /v1/brief/save
// Spec: docs/customer-journey.md §2 (per-step writes) + Phase 6.1 sub-plan.
// AGENT.md state: STARTED_FORM through FORM_STEP_3+ (pre-SUBMITTED).
//
// Behaviour:
//   - Step 1 (no brief_id): create stub customers + briefs rows, set
//     os_brief_session cookie, return {brief_id, customer_id}.
//   - Step 1 (with brief_id): re-save tier choice (idempotent).
//   - Step 2: update customers (email, name, phone, business, niche, source)
//     + merge step-2 keys into briefs.form_payload.
//   - Step 3: merge step-3 keys + issue save_token + send save-token email
//     synchronously (best-effort).
//   - Step 4 / Step 6: merge into form_payload, advance current_step.
//
// Every step writes activity_log:form_step_completed (idempotent on
// (brief_id, step)). Step 3 also writes form_saved. Step 1 first-save also
// writes form_started.
//
// Public endpoint — no JWT required. CORS allowed for the CRM origin
// (matches the auth flow). Rate limiting is left to upstream layers
// (Resend per-recipient + Cloudflare WAF + master plan §7 Q2).

import { NextResponse, type NextRequest } from 'next/server';
import * as React from 'react';
import { render } from '@react-email/render';
import { z } from 'zod';
import SaveTokenEmail from '@operscale-calendar/web/emails/SaveTokenEmail';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { sendEmail, EmailSendError } from '@/lib/email';
import { corsPreflight, withCors } from '@/lib/cors';
import {
  SaveBodySchema,
  type SaveBody,
  generateSaveToken,
  briefSessionCookieAttributes,
} from '@/lib/form-payload-schema';
import { deliverableForTier, type Tier } from '@/lib/tiers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const OPTIONS = corsPreflight;

interface BriefRow {
  id: string;
  customer_id: string;
  current_step: number;
  form_payload: Record<string, unknown>;
  save_token: string | null;
}

async function loadBrief(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  briefId: string,
): Promise<BriefRow | null> {
  const { data, error } = await supabase
    .from('briefs')
    .select('id, customer_id, current_step, form_payload, save_token')
    .eq('id', briefId)
    .maybeSingle();
  if (error) throw new Error(`brief_load_failed: ${error.message}`);
  return data as BriefRow | null;
}

async function activityLogHasStep(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  briefId: string,
  step: number,
): Promise<boolean> {
  const { data } = await supabase
    .from('activity_log')
    .select('id')
    .eq('brief_id', briefId)
    .eq('event_type', 'form_step_completed')
    .filter('payload->>step', 'eq', String(step))
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

function maxStep(a: number, b: number): number {
  return a > b ? a : b;
}

function jsonOk(body: Record<string, unknown>, init?: ResponseInit): Response {
  return NextResponse.json(body, init);
}

function jsonErr(error: string, status: number, extra?: Record<string, unknown>): Response {
  return NextResponse.json({ error, ...(extra ?? {}) }, { status });
}

async function handler(req: NextRequest): Promise<Response> {
  // 1) Parse + validate
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('invalid_json', 400);
  }
  const parsed = SaveBodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonErr('validation', 400, {
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  const body: SaveBody = parsed.data;

  const supabase = getSupabaseAdmin();

  // 2) Step 1 first-save branch (no brief_id) — create stubs.
  if (body.step === 1 && !body.brief_id) {
    return await firstSaveStep1(supabase, body.payload.tier_intent);
  }

  // 3) Subsequent saves require an existing brief.
  if (!body.brief_id || !body.customer_id) {
    return jsonErr('brief_id_and_customer_id_required', 400);
  }
  const brief = await loadBrief(supabase, body.brief_id);
  if (!brief) return jsonErr('brief_not_found', 404);
  if (brief.customer_id !== body.customer_id) {
    return jsonErr('customer_brief_mismatch', 403);
  }

  // 4) Dispatch by step.
  switch (body.step) {
    case 1:
      return saveStep1Update(supabase, brief, body.payload.tier_intent);
    case 2:
      return saveStep2(supabase, brief, body.payload);
    case 3:
      return saveStep3(supabase, brief, body.payload);
    case 4:
      return saveStep4Or6(supabase, brief, body.payload, 4);
    case 6:
      return saveStep4Or6(supabase, brief, body.payload, 6);
  }
}

// ---------------------------------------------------------------------------
// Step 1 — first save (anonymous customer creates a stub)
// ---------------------------------------------------------------------------

async function firstSaveStep1(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tierIntent: Tier,
): Promise<Response> {
  // Create a stub customer with a placeholder email. customers.email is NOT
  // NULL per data-model.md, but at this anonymous stage we don't have one.
  // Use a sentinel that the step-2 update will overwrite. Sentinel is tagged
  // by the customer_id UUID so the email_lower UNIQUE index is safe.
  const stubCustomer = await supabase
    .from('customers')
    .insert({
      email: `stub-${crypto.randomUUID()}@stub.operscale.local`,
      source: 'direct',
    })
    .select('id, email')
    .single();
  if (stubCustomer.error || !stubCustomer.data) {
    return jsonErr('customer_create_failed', 500, { detail: stubCustomer.error?.message });
  }
  const customerId = stubCustomer.data.id as string;

  const newBrief = await supabase
    .from('briefs')
    .insert({
      customer_id: customerId,
      tier_intent: tierIntent,
      form_payload: { tier_intent: tierIntent },
      current_step: 1,
    })
    .select('id')
    .single();
  if (newBrief.error || !newBrief.data) {
    return jsonErr('brief_create_failed', 500, { detail: newBrief.error?.message });
  }
  const briefId = newBrief.data.id as string;

  await writeActivityLog(
    {
      eventType: 'form_started',
      actor: 'customer',
      customerId,
      briefId,
      payload: { tier_intent: tierIntent },
    },
    supabase,
  );

  // Best-effort: writeActivityLog never throws, so this fires alongside.
  await writeActivityLog(
    {
      eventType: 'form_step_completed',
      actor: 'customer',
      customerId,
      briefId,
      payload: { step: 1 },
    },
    supabase,
  );

  const { name, attributes } = briefSessionCookieAttributes();
  const res = jsonOk({ brief_id: briefId, customer_id: customerId });
  res.headers.append('set-cookie', `${name}=${customerId}; ${attributes}`);
  return res;
}

// ---------------------------------------------------------------------------
// Step 1 — re-save (customer changed tier mid-flow)
// ---------------------------------------------------------------------------

async function saveStep1Update(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  brief: BriefRow,
  tierIntent: Tier,
): Promise<Response> {
  const merged = { ...brief.form_payload, tier_intent: tierIntent };
  const { error } = await supabase
    .from('briefs')
    .update({
      tier_intent: tierIntent,
      form_payload: merged,
      current_step: maxStep(brief.current_step, 1),
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', brief.id);
  if (error) return jsonErr('brief_update_failed', 500, { detail: error.message });
  // No new activity_log — already wrote form_step_completed at first save.
  return jsonOk({ brief_id: brief.id, customer_id: brief.customer_id });
}

// ---------------------------------------------------------------------------
// Step 2 — business basics
// ---------------------------------------------------------------------------

async function saveStep2(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  brief: BriefRow,
  payload: z.infer<typeof SaveBodySchema>['payload'] & {
    brand_name: string;
    owner_name: string;
    phone_e164: string;
    email: string;
    niche_slug: string;
    niche_label: string;
    one_line_description: string;
    offer_description: string;
    price_point_band: string;
  },
): Promise<Response> {
  const customerUpdate = await supabase
    .from('customers')
    .update({
      email: payload.email,
      full_name: payload.owner_name,
      whatsapp_number: payload.phone_e164,
      business_name: payload.brand_name,
      niche: payload.niche_slug,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', brief.customer_id);
  if (customerUpdate.error) {
    // Most likely cause: another customer row already owns this email_lower.
    // Surface as 409 so the form can prompt the customer to use their resume
    // link from the prior session.
    if (
      customerUpdate.error.message.includes('duplicate') ||
      customerUpdate.error.code === '23505'
    ) {
      return jsonErr('email_already_in_use', 409, {
        detail: 'Use the resume link from your earlier session, or contact support.',
      });
    }
    return jsonErr('customer_update_failed', 500, { detail: customerUpdate.error.message });
  }

  const merged = { ...brief.form_payload, ...payload };
  const briefUpdate = await supabase
    .from('briefs')
    .update({
      form_payload: merged,
      current_step: maxStep(brief.current_step, 2),
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', brief.id);
  if (briefUpdate.error) {
    return jsonErr('brief_update_failed', 500, { detail: briefUpdate.error.message });
  }

  if (!(await activityLogHasStep(supabase, brief.id, 2))) {
    await writeActivityLog(
      {
        eventType: 'form_step_completed',
        actor: 'customer',
        customerId: brief.customer_id,
        briefId: brief.id,
        payload: { step: 2 },
      },
      supabase,
    );
  }

  return jsonOk({ brief_id: brief.id, customer_id: brief.customer_id });
}

// ---------------------------------------------------------------------------
// Step 3 — audience + save_token + save-token email
// ---------------------------------------------------------------------------

async function saveStep3(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  brief: BriefRow,
  payload: Record<string, unknown>,
): Promise<Response> {
  const merged = { ...brief.form_payload, ...payload };

  const saveToken = brief.save_token ?? generateSaveToken();
  const briefUpdate = await supabase
    .from('briefs')
    .update({
      form_payload: merged,
      save_token: saveToken,
      current_step: maxStep(brief.current_step, 3),
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', brief.id);
  if (briefUpdate.error) {
    return jsonErr('brief_update_failed', 500, { detail: briefUpdate.error.message });
  }

  if (!(await activityLogHasStep(supabase, brief.id, 3))) {
    await writeActivityLog(
      {
        eventType: 'form_step_completed',
        actor: 'customer',
        customerId: brief.customer_id,
        briefId: brief.id,
        payload: { step: 3 },
      },
      supabase,
    );
    await writeActivityLog(
      {
        eventType: 'form_saved',
        actor: 'system',
        customerId: brief.customer_id,
        briefId: brief.id,
        payload: { save_token: saveToken },
      },
      supabase,
    );
  }

  // Send save-token email synchronously, best-effort.
  // Pull customer.email + tier for the template props.
  const { data: customer } = await supabase
    .from('customers')
    .select('email, full_name')
    .eq('id', brief.customer_id)
    .maybeSingle();

  if (customer?.email && !customer.email.endsWith('@stub.operscale.local')) {
    const tier = ((merged as { tier_intent?: string }).tier_intent ?? 'standard') as Tier;
    const tierMeta = deliverableForTier(tier);
    const firstName = (customer.full_name ?? '').split(/\s+/)[0] || 'there';
    const resumeUrl = `https://operscale.cloud/brief/${saveToken}`;
    try {
      const element = React.createElement(SaveTokenEmail, {
        firstName,
        resumeUrl,
        tierDisplayName: tierMeta.display_name,
      });
      const html = await render(element);
      const text = await render(element, { plainText: true });
      await sendEmail({
        to: customer.email,
        templateKey: 'save-token',
        subject: 'Your Operscale brief draft is saved',
        html,
        text,
        customerId: brief.customer_id,
        briefId: brief.id,
      });
    } catch (e) {
      // Spec §2.4: "save token still issued (it's local), email fails
      // silently". Activity_log captures the failure for observability.
      const detail = e instanceof EmailSendError ? e.message : String(e);
      await writeActivityLog(
        {
          eventType: 'email_failed',
          actor: 'system',
          customerId: brief.customer_id,
          briefId: brief.id,
          payload: { template: 'save-token', detail },
        },
        supabase,
      );
    }
  }

  return jsonOk({ brief_id: brief.id, customer_id: brief.customer_id });
}

// ---------------------------------------------------------------------------
// Steps 4 + 6 — straight JSONB merge
// ---------------------------------------------------------------------------

async function saveStep4Or6(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  brief: BriefRow,
  payload: Record<string, unknown>,
  step: 4 | 6,
): Promise<Response> {
  const merged = { ...brief.form_payload, ...payload };
  const { error } = await supabase
    .from('briefs')
    .update({
      form_payload: merged,
      current_step: maxStep(brief.current_step, step),
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', brief.id);
  if (error) return jsonErr('brief_update_failed', 500, { detail: error.message });

  if (!(await activityLogHasStep(supabase, brief.id, step))) {
    await writeActivityLog(
      {
        eventType: 'form_step_completed',
        actor: 'customer',
        customerId: brief.customer_id,
        briefId: brief.id,
        payload: { step },
      },
      supabase,
    );
  }

  return jsonOk({ brief_id: brief.id, customer_id: brief.customer_id });
}

export const POST = withCors(handler);
