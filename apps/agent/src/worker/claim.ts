// apps/agent/src/worker/claim.ts
//
// Claim one queued ai_analysis_jobs row at a time.
//
// Implementation note: design §6.1 calls for FOR UPDATE SKIP LOCKED, which
// the Supabase JS client doesn't expose natively. We use a two-step pattern:
//   1) SELECT one queued id, ordered by enqueued_at.
//   2) UPDATE WHERE id = ... AND status = 'queued' RETURNING *.
// The conditional UPDATE is the race-safety primitive: if a concurrent worker
// already flipped status='running', our UPDATE matches no row and returns null.
// We then poll again on the next tick — no double-claim.
//
// This is sufficient for replicas: 1 (current production layout). If we ever
// scale workers > 1, swap this for a Postgres RPC that uses FOR UPDATE SKIP
// LOCKED in a single statement (would require a new migration 0007_claim_rpc.sql).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ClaimedJob {
  id: string;
  brief_id: string;
  trigger_type: 'initial' | 're_analyze_same_frameworks' | 're_analyze_new_frameworks';
  founder_note: string | null;
  prior_run_id: string | null;
  attempt_count: number;
  idempotency_key: string;
  enqueued_at: string;
  started_at: string;
}

export async function claimNextJob(supabase: SupabaseClient): Promise<ClaimedJob | null> {
  const { data: queued, error: selectErr } = await supabase
    .from('ai_analysis_jobs')
    .select('id, attempt_count')
    .eq('status', 'queued')
    .order('enqueued_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectErr) {
    throw new Error(`claimNextJob: queue peek failed: ${selectErr.message}`);
  }
  if (!queued) return null;

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('ai_analysis_jobs')
    .update({
      status: 'running',
      started_at: nowIso,
      attempt_count: (queued.attempt_count ?? 0) + 1,
    })
    .eq('id', queued.id)
    .eq('status', 'queued')
    .select('id, brief_id, trigger_type, founder_note, prior_run_id, attempt_count, idempotency_key, enqueued_at, started_at')
    .maybeSingle();

  if (updateErr) {
    throw new Error(`claimNextJob: claim update failed: ${updateErr.message}`);
  }
  if (!updated) return null;
  return updated as ClaimedJob;
}
