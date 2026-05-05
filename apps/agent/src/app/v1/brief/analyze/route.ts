// POST /v1/brief/analyze
// Phase 4 implementation: validate + enqueue. Worker (Phase 3) handles
// the actual analysis async.
//
// Spec: docs/specs/v2-pipeline-implementation-design.md §3.4 + §9.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin, writeActivityLog } from '@/lib/supabase-admin';
import { verifyJwt } from '@/lib/auth/verify-jwt';
import { computeIdempotencyKey } from '@/lib/idempotency-key';

const BodySchema = z
  .object({
    brief_id: z.string().uuid(),
    trigger_type: z
      .enum(['initial', 're_analyze_same_frameworks', 're_analyze_new_frameworks'])
      .optional()
      .default('initial'),
    founder_note: z.string().optional(),
    prior_run_id: z.string().uuid().optional(),
  })
  .refine(
    (v) => v.trigger_type === 'initial' || (v.founder_note && v.prior_run_id),
    {
      message: 'founder_note and prior_run_id required for re_analyze_*',
      path: ['trigger_type'],
    },
  );

export async function POST(req: Request): Promise<Response> {
  const claims = verifyJwt(req.headers);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch (err) {
    const detail =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : 'invalid json';
    return NextResponse.json({ error: `validation: brief_id ${detail}` }, { status: 400 });
  }

  // Re-analysis requires founder OR service_role.
  if (
    parsed.trigger_type !== 'initial' &&
    claims.role !== 'founder' &&
    claims.role !== 'service_role'
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // For re-analysis, look up the prior run's run_index for the idempotency key.
  let prior_run_index: number | undefined;
  if (parsed.trigger_type !== 'initial') {
    const { data: priorRow, error: priorErr } = await supabase
      .from('analysis_runs')
      .select('run_index')
      .eq('id', parsed.prior_run_id)
      .eq('brief_id', parsed.brief_id)
      .maybeSingle();
    if (priorErr || !priorRow) {
      return NextResponse.json({ error: 'prior_run_not_found' }, { status: 404 });
    }
    prior_run_index = priorRow.run_index;
  }

  const idempotency_key = computeIdempotencyKey({
    brief_id: parsed.brief_id,
    trigger_type: parsed.trigger_type,
    prior_run_index,
  });

  const { data: inserted, error: insErr } = await supabase
    .from('ai_analysis_jobs')
    .insert({
      brief_id: parsed.brief_id,
      trigger_type: parsed.trigger_type,
      founder_note: parsed.trigger_type !== 'initial' ? parsed.founder_note : null,
      prior_run_id: parsed.trigger_type !== 'initial' ? parsed.prior_run_id : null,
      idempotency_key,
    })
    .select('id')
    .maybeSingle();

  // 23505 = Postgres unique_violation. Conflict on idempotency_key means
  // we already enqueued this exact (brief, trigger, prior_run_index) tuple.
  // Return the existing job's id + status with HTTP 200 so callers can poll.
  if (insErr?.code === '23505') {
    const { data: existing } = await supabase
      .from('ai_analysis_jobs')
      .select('id, status')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { job_id: existing.id, status: existing.status, idempotency_key },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { error: 'idempotency_conflict_but_no_existing_row' },
      { status: 500 },
    );
  }

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: `enqueue_failed: ${insErr?.message ?? 'no row returned'}` },
      { status: 500 },
    );
  }

  await writeActivityLog(
    {
      eventType: 'ai_analysis_enqueued',
      actor: claims.role === 'service_role' ? 'system' : 'founder',
      briefId: parsed.brief_id,
      payload: {
        job_id: inserted.id,
        trigger_type: parsed.trigger_type,
        idempotency_key,
      },
    },
    supabase,
  );

  return NextResponse.json(
    { job_id: inserted.id, status: 'queued', idempotency_key },
    { status: 202 },
  );
}
