// apps/agent/src/worker/sweep.ts
//
// Stuck-job sweep per design §6.4. Jobs in status='running' whose started_at
// is older than 5 minutes are reclaimed (queued again) up to 3 attempts;
// after that they fail with reason='orphaned_by_restart'.

import type { SupabaseClient } from '@supabase/supabase-js';
import { writeActivityLog } from '../lib/supabase-admin.js';

const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
const MAX_RECLAIM_ATTEMPTS = 3;

export async function sweepStuckJobs(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
  const { data: stuck, error } = await supabase
    .from('ai_analysis_jobs')
    .select('id, attempt_count')
    .eq('status', 'running')
    .lt('started_at', cutoff);

  if (error) {
    throw new Error(`sweepStuckJobs: query failed: ${error.message}`);
  }
  if (!stuck || stuck.length === 0) return;

  for (const job of stuck) {
    const attemptCount = job.attempt_count ?? 0;
    if (attemptCount < MAX_RECLAIM_ATTEMPTS) {
      await supabase
        .from('ai_analysis_jobs')
        .update({
          status: 'queued',
          started_at: null,
          attempt_count: attemptCount + 1,
        })
        .eq('id', job.id);
      await writeActivityLog(
        {
          eventType: 'ai_analysis_orphan_reclaimed',
          actor: 'system',
          payload: { job_id: job.id, attempt_count: attemptCount + 1 },
        },
        supabase,
      );
    } else {
      await supabase
        .from('ai_analysis_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_detail: { reason: 'orphaned_by_restart', attempts: MAX_RECLAIM_ATTEMPTS },
        })
        .eq('id', job.id);
      await writeActivityLog(
        {
          eventType: 'ai_analysis_failed',
          actor: 'system',
          payload: { job_id: job.id, reason: 'orphaned_by_restart' },
        },
        supabase,
      );
    }
  }
}
