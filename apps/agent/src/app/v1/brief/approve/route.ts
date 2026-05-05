// POST /v1/brief/approve
// Phase 4 scope: founder auth → read brief's is_current analysis_runs row →
// INSERT customer_framework_history rows for each selected_pair → flip
// orders.status='founder_approved'.
//
// Paystack initialise + Resend brief-email send are Phase 4.5 (separate plan).
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
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';

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
    .select('id, brief_id, customer_id, status')
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
    .select('id, framework_seed')
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
  // Phase 4.5 will subsequently send the brief email and flip to 'brief_sent'.
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

  return NextResponse.json(
    { order_id: order.id, framework_history_rows_written: historyRows.length },
    { status: 200 },
  );
}
