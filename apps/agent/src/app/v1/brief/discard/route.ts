// POST /v1/brief/discard
// Spec: docs/specs/founder-review-flow.md "Discard Action".
// Phase 5 implementation.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';

const BodySchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const DISCARDABLE_STATUSES = ['pending_founder_review'] as const;

export async function POST(req: Request): Promise<Response> {
  const claims = verifyJwt(req.headers);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  if (claims.role !== 'founder') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let parsed: z.infer<typeof BodySchema>;
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
    .select('id, brief_id, status')
    .eq('id', parsed.order_id)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  }
  if (!(DISCARDABLE_STATUSES as readonly string[]).includes(order.status)) {
    return NextResponse.json(
      { error: `order_status_not_discardable: ${order.status}`, current_status: order.status },
      { status: 409 },
    );
  }

  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'discarded', updated_at: new Date().toISOString() })
    .eq('id', parsed.order_id);

  if (updErr) {
    // Best-effort breadcrumb; do not throw if this fails (gotcha #11 pattern).
    try {
      await writeActivityLog(
        {
          eventType: 'discard_failed',
          actor: 'founder',
          briefId: order.brief_id,
          orderId: order.id,
          payload: {
            order_id: parsed.order_id,
            error: updErr.message,
          },
        },
        supabase,
      );
    } catch (logErr) {
      console.error('[discard] discard_failed activity_log insert failed:', logErr);
    }
    return NextResponse.json({ error: `discard_failed: ${updErr.message}` }, { status: 500 });
  }

  await writeActivityLog(
    {
      eventType: 'founder_discarded',
      actor: 'founder',
      briefId: order.brief_id,
      orderId: order.id,
      payload: {
        order_id: parsed.order_id,
        reason: parsed.reason ?? null,
        actor_sub: claims.sub,
      },
    },
    supabase,
  );

  return NextResponse.json({ status: 'discarded', order_id: parsed.order_id }, { status: 200 });
}
