// apps/agent/src/lib/idempotency-key.ts
//
// Deterministic key for ai_analysis_jobs.idempotency_key (UNIQUE constraint
// in migration 0006). Conflict-on-key in the analyze route returns the
// existing job rather than enqueuing a new one — makes the route safe to
// retry from any caller.

export type TriggerType =
  | 'initial'
  | 're_analyze_same_frameworks'
  | 're_analyze_new_frameworks';

export interface IdempotencyKeyInput {
  brief_id: string;
  trigger_type: TriggerType;
  prior_run_index?: number;
}

export function computeIdempotencyKey(input: IdempotencyKeyInput): string {
  if (input.trigger_type === 'initial') {
    return `${input.brief_id}::initial::0`;
  }
  if (typeof input.prior_run_index !== 'number') {
    throw new Error(
      `computeIdempotencyKey: trigger_type=${input.trigger_type} requires prior_run_index`,
    );
  }
  return `${input.brief_id}::${input.trigger_type}::${input.prior_run_index}`;
}
