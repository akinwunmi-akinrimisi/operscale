// apps/agent/src/worker/process-job.ts
//
// End-to-end processing of one claimed ai_analysis_jobs row.
// design §6.1 (initial) + §6.2 (re-analysis, Task 12).
//
// Schema adaptation (confirmed via 0001_init_schema.sql):
//   - briefs has id, customer_id, submitted_at, tier_intent, form_payload (jsonb).
//   - All BriefAnalyzerInput fields except brief_id/customer_id/submitted_at/tier
//     are projected from form_payload (the rest of the form steps 1-7).
//   - analysis_runs requires a `model` column (0001 §3.5) — we set CLAUDE_MODEL.
//   - analysis_runs.framework_seed added by migration 0005.

import type { SupabaseClient } from '@supabase/supabase-js';
import { type BriefAnalyzer, type AnalyzeResult, CLAUDE_MODEL } from '../lib/claude.js';
import type { BriefAnalyzerInput, PhotoBlock, PriorRunContext, FrameworkSeedResult } from '../lib/types/v2.js';
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

  // 1b. Re-analysis: load the prior run + its edits to materialise prior + priorSeed.
  let priorContext: PriorRunContext | undefined;
  let priorSeed: FrameworkSeedResult | undefined;
  let priorRunIndex: number | undefined;
  if (job.trigger_type !== 'initial') {
    if (!job.prior_run_id) {
      await failJob(supabase, job.id, job.brief_id, 'prior_run_id_required', `trigger_type=${job.trigger_type} but no prior_run_id`, logger);
      return;
    }
    const { data: priorRow, error: priorErr } = await supabase
      .from('analysis_runs')
      .select('id, run_index, framework_seed')
      .eq('id', job.prior_run_id)
      .maybeSingle();
    if (priorErr || !priorRow) {
      await failJob(supabase, job.id, job.brief_id, 'prior_run_missing', priorErr?.message ?? 'no row', logger);
      return;
    }
    priorRunIndex = priorRow.run_index;
    priorSeed = priorRow.framework_seed as FrameworkSeedResult;

    // analysis_edits is a Phase-4 surface; for Phase 3 we read empty array gracefully.
    const { data: edits } = await supabase
      .from('analysis_edits')
      .select('field_path, before, after')
      .eq('analysis_run_id', job.prior_run_id);

    const mode = job.trigger_type === 're_analyze_same_frameworks' ? 'same_frameworks' : 'new_frameworks';
    priorContext = {
      prior_run_id: priorRow.id,
      prior_run_index: priorRow.run_index,
      mode,
      founder_note: job.founder_note ?? '',
      edits: (edits ?? []).map((e: any) => ({ field_path: e.field_path, before: e.before, after: e.after })),
    };
  }

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

  // 3. Pre-analyze activity_log — emit ai_reanalyze_requested first on re-analysis.
  if (job.trigger_type !== 'initial') {
    await writeActivityLog(
      {
        eventType: 'ai_reanalyze_requested',
        actor: 'system',
        briefId: job.brief_id,
        payload: {
          job_id: job.id,
          mode: priorContext?.mode,
          prior_run_id: job.prior_run_id,
          founder_note: job.founder_note,
        },
      },
      supabase,
    );
  }

  await writeActivityLog(
    {
      eventType: 'ai_analysis_started',
      actor: 'system',
      briefId: job.brief_id,
      payload: { trigger_type: job.trigger_type, attempt_count: job.attempt_count },
    },
    supabase,
  );

  // 4. Analyze — pass trigger_type + prior context through to the orchestrator.
  const result: AnalyzeResult = await analyzer.analyze({
    brief: briefInput,
    photos,
    logo,
    trigger_type: job.trigger_type,
    prior: priorContext,
    priorSeed,
    prior_run_index: priorRunIndex !== undefined ? priorRunIndex + 1 : undefined,
  });

  if (!result.ok) {
    await failJob(supabase, job.id, job.brief_id, result.failure.reason, result.failure.detail, logger);
    return;
  }

  // 5a. On re-analysis: flip prior run's is_current to false before inserting new row.
  if (priorContext) {
    await supabase
      .from('analysis_runs')
      .update({ is_current: false })
      .eq('id', priorContext.prior_run_id);
  }

  // 5b. INSERT analysis_runs.
  // analysis_runs.model is required (0001 §3.5); analysis_runs.framework_seed added by 0005.
  const newRunIndex = priorRunIndex !== undefined ? priorRunIndex + 1 : 1;
  const runTriggerLabel = job.trigger_type === 'initial' ? 'initial' : 're_analyze_with_note';
  const runRow = {
    brief_id: job.brief_id,
    run_index: newRunIndex,
    trigger_type: runTriggerLabel,
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
