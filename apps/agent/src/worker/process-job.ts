// apps/agent/src/worker/process-job.ts
//
// End-to-end processing of one claimed ai_analysis_jobs row.
// design §6.1 (initial). Re-analysis (Task 12) lands later.
//
// Schema adaptation (confirmed via 0001_init_schema.sql):
//   - briefs has id, customer_id, submitted_at, tier_intent, form_payload (jsonb).
//   - All BriefAnalyzerInput fields except brief_id/customer_id/submitted_at/tier
//     are projected from form_payload (the rest of the form steps 1-7).
//   - analysis_runs requires a `model` column (0001 §3.5) — we set CLAUDE_MODEL.
//   - analysis_runs.framework_seed added by migration 0005.

import type { SupabaseClient } from '@supabase/supabase-js';
import { type BriefAnalyzer, type AnalyzeResult, CLAUDE_MODEL } from '../lib/claude.js';
import type { BriefAnalyzerInput, PhotoBlock } from '../lib/types/v2.js';
import { writeActivityLog } from '../lib/supabase-admin.js';
import { fetchBriefPhotos } from './photos.js';
import type { ClaimedJob } from './claim.js';

interface ProcessJobArgs {
  job: ClaimedJob;
  analyzer: BriefAnalyzer;
  supabase: SupabaseClient;
  logger: { info: (...a: any[]) => void; error: (...a: any[]) => void };
}

/**
 * Project a briefs row to BriefAnalyzerInput.
 *
 * The briefs table stores step-form answers in form_payload (jsonb).
 * Metadata columns on the row itself: id, customer_id, submitted_at, tier_intent.
 * All other BriefAnalyzerInput fields come from form_payload.
 */
function projectBriefRowToAnalyzerInput(row: any): BriefAnalyzerInput {
  const fp = row.form_payload ?? {};
  return {
    brief_id: row.id,
    customer_id: row.customer_id,
    submitted_at_iso: row.submitted_at ?? new Date().toISOString(),
    submission_week_iso: fp.submission_week_iso ?? '',
    order_index: fp.order_index ?? 1,
    tier: row.tier_intent ?? fp.tier ?? 'starter',
    niche_slug: fp.niche_slug,
    niche_label: fp.niche_label ?? fp.niche_slug ?? '',
    brand_name: fp.brand_name ?? '',
    owner_name: fp.owner_name ?? '',
    phone_e164: fp.phone_e164 ?? '',
    email: fp.email ?? '',
    one_line_description: fp.one_line_description ?? '',
    offer_description: fp.offer_description ?? '',
    price_point_band: fp.price_point_band ?? '',
    primary_audience_description: fp.primary_audience_description ?? '',
    audience_age_range: fp.audience_age_range ?? '',
    audience_location: fp.audience_location ?? '',
    audience_belief: fp.audience_belief ?? '',
    audience_belief_target: fp.audience_belief_target ?? '',
    logo_uploaded_yes_no: fp.logo_uploaded_yes_no ?? 'no',
    brand_colours: fp.brand_colours ?? '',
    instagram_handle: fp.instagram_handle ?? '',
    photo_count: fp.photo_count ?? 0,
    photo_consent_yes_no: fp.photo_consent_yes_no ?? 'no',
    stated_voice: fp.stated_voice ?? '',
    reference_posts_block: fp.reference_posts_block ?? '',
    customer_backstory_verbatim: fp.customer_backstory_verbatim ?? '',
    video_count: fp.video_count ?? 0,
    carousel_count: fp.carousel_count ?? 0,
  };
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  briefId: string,
  reason: string,
  detail: string,
  logger: ProcessJobArgs['logger'],
): Promise<void> {
  await supabase
    .from('ai_analysis_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_detail: { reason, detail },
    })
    .eq('id', jobId);
  await writeActivityLog(
    {
      eventType: 'ai_analysis_failed',
      actor: 'system',
      briefId,
      payload: { job_id: jobId, reason, detail },
    },
    supabase,
  );
  logger.error('process-job: marked failed', { job_id: jobId, reason });
}

export async function processJob(args: ProcessJobArgs): Promise<void> {
  const { job, analyzer, supabase, logger } = args;

  // 1. Read brief row.
  const { data: briefRow, error: briefErr } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', job.brief_id)
    .maybeSingle();
  if (briefErr || !briefRow) {
    await failJob(supabase, job.id, job.brief_id, 'brief_row_missing', briefErr?.message ?? 'no row', logger);
    return;
  }
  const briefInput = projectBriefRowToAnalyzerInput(briefRow);

  // 2. Fetch photos.
  let photos: PhotoBlock[] = [];
  let logo: PhotoBlock | undefined;
  try {
    const fetched = await fetchBriefPhotos(supabase, job.brief_id);
    photos = fetched.photos;
    logo = fetched.logo;
  } catch (err) {
    await failJob(
      supabase,
      job.id,
      job.brief_id,
      'photo_missing',
      err instanceof Error ? err.message : String(err),
      logger,
    );
    return;
  }

  // 3. Pre-analyze activity_log.
  await writeActivityLog(
    {
      eventType: 'ai_analysis_started',
      actor: 'system',
      briefId: job.brief_id,
      payload: { trigger_type: job.trigger_type, attempt_count: job.attempt_count },
    },
    supabase,
  );

  // 4. Analyze (Phase 3 supports trigger_type='initial' here; Task 12 adds re-analysis).
  const result: AnalyzeResult = await analyzer.analyze({
    brief: briefInput,
    photos,
    logo,
    trigger_type: 'initial',
  });

  if (!result.ok) {
    await failJob(supabase, job.id, job.brief_id, result.failure.reason, result.failure.detail, logger);
    return;
  }

  // 5. INSERT analysis_runs.
  // analysis_runs.model is required (0001 §3.5); analysis_runs.framework_seed added by 0005.
  const runRow = {
    brief_id: job.brief_id,
    run_index: 1,
    trigger_type: 'initial',
    is_current: true,
    model: CLAUDE_MODEL,
    framework_seed: result.seed,
    ai_output: result.superset,
    cost_usd: result.telemetry.cost_usd,
    input_tokens: result.telemetry.input_tokens,
    output_tokens: result.telemetry.output_tokens,
    duration_ms: result.telemetry.duration_ms,
  };
  const { data: insertedRun, error: insErr } = await supabase
    .from('analysis_runs')
    .insert(runRow)
    .select('id')
    .maybeSingle();
  if (insErr || !insertedRun) {
    await failJob(
      supabase,
      job.id,
      job.brief_id,
      'analysis_runs_insert_failed',
      insErr?.message ?? 'no row returned',
      logger,
    );
    return;
  }

  // 6. UPDATE ai_analysis_jobs to completed.
  await supabase
    .from('ai_analysis_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      resulting_run_id: insertedRun.id,
    })
    .eq('id', job.id);

  await writeActivityLog(
    {
      eventType: 'ai_analysis_completed',
      actor: 'system',
      briefId: job.brief_id,
      payload: {
        job_id: job.id,
        run_id: insertedRun.id,
        cost_usd: result.telemetry.cost_usd,
        duration_ms: result.telemetry.duration_ms,
        audit_passed: result.superset.fabrication_audit.audit_passed,
        flags_for_review_count: result.superset.flags_for_review.length,
      },
    },
    supabase,
  );

  logger.info('process-job: completed', { job_id: job.id, run_id: insertedRun.id });
}
