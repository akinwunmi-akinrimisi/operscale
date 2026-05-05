import { describe, it, expect, vi } from 'vitest';
import { processJob } from './process-job';
import type { ClaimedJob } from './claim';
import type { AnalyzeResult } from '../lib/claude';

const SAMPLE_JOB: ClaimedJob = {
  id: 'job1',
  brief_id: 'brief1',
  trigger_type: 'initial',
  founder_note: null,
  prior_run_id: null,
  attempt_count: 1,
  idempotency_key: 'brief1::initial::0',
  enqueued_at: '2026-05-04T09:00:00Z',
  started_at: '2026-05-04T09:00:01Z',
};

// Real schema: briefs has form_payload jsonb + metadata columns.
// BriefAnalyzerInput fields are projected from form_payload + brief metadata.
const FAKE_BRIEF_ROW = {
  id: 'brief1',
  customer_id: 'cust1',
  submitted_at: '2026-05-04T09:00:00Z',
  tier_intent: 'starter',
  form_payload: {
    submission_week_iso: '2026-W18',
    order_index: 1,
    niche_slug: 'fashion',
    niche_label: 'Fashion e-commerce',
    brand_name: 'Acme',
    owner_name: 'Owner',
    phone_e164: '+2348000000000',
    email: 'o@example.com',
    one_line_description: 'desc',
    offer_description: 'offer',
    price_point_band: 'NGN 80k',
    primary_audience_description: 'aud',
    audience_age_range: '28-45',
    audience_location: 'Lagos',
    audience_belief: 'belief',
    audience_belief_target: 'target',
    logo_uploaded_yes_no: 'no',
    brand_colours: 'rust',
    instagram_handle: '@a',
    photo_count: 0,
    photo_consent_yes_no: 'no',
    stated_voice: 'crafted',
    reference_posts_block: '',
    customer_backstory_verbatim: '',
    video_count: 7,
    carousel_count: 3,
  },
};

function makeSuccessAnalyzeResult(): AnalyzeResult {
  return {
    ok: true,
    superset: {
      brand_voice: { voice_phrases: ['v'], sentence_rhythm: 'mid_length', avoid_words: [], energy_register: 'authoritative', voice_corpus_quality: 'thick' },
      specificity_inventory: { numbers: [], proper_nouns: [], process_steps: [], specificity_corpus_quality: 'thick' },
      expertise_map: [],
      visual_aesthetic: { lighting: '', setting: '', wardrobe_props: '', photo_quality_summary: '', photos_present: false },
      calendar_plan: [],
      fabrication_audit: { lines_checked: 0, violations_found: [], audit_passed: true },
      flags_for_review: [],
      brief_summary: 'summary',
      upsell_recommendation: { should_upsell: false, recommended_tier: null, reasoning: '', upsell_price_delta: 0 },
      estimated_brief_quality_score: 1.0,
    } as any,
    seed: {
      seed_hash: 'h',
      seed_inputs: { customer_id: 'cust1', niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
      selected_frameworks: ['DR_FORMULA'],
      selected_archetypes: ['PRICING_BREAKDOWN'],
      selected_pairs: [{ framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 }],
      exhaustion_warning: false,
      lru_fallback_used: false,
    },
    postHocViolations: [],
    telemetry: { input_tokens: 1000, output_tokens: 500, cost_usd: 0.05, duration_ms: 1234, attempt_count: 1 },
  };
}

function makeFakeSupabase(briefRow: any) {
  const inserts: any[] = [];
  const updates: any[] = [];
  const supabase: any = {
    from: vi.fn((table: string) => {
      if (table === 'briefs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: briefRow, error: null }),
            }),
          }),
        };
      }
      if (table === 'brief_photos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === 'analysis_runs') {
        return {
          insert: vi.fn().mockImplementation((row: any) => {
            inserts.push({ table, row });
            return {
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run1' }, error: null }),
              }),
            };
          }),
        };
      }
      return {
        insert: vi.fn().mockImplementation(async (row: any) => {
          inserts.push({ table, row });
          return { error: null };
        }),
        update: vi.fn().mockImplementation((row: any) => {
          return { eq: vi.fn().mockImplementation(async (col: string, val: any) => {
            updates.push({ table, row, where: { [col]: val } });
            return { error: null };
          }) };
        }),
      };
    }),
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
    _inserts: () => inserts,
    _updates: () => updates,
  };
  return supabase;
}

describe('processJob (initial trigger)', () => {
  it('happy path: reads brief, calls analyzer, writes analysis_runs, marks job completed', async () => {
    const sb = makeFakeSupabase(FAKE_BRIEF_ROW);
    const analyzer = { analyze: vi.fn().mockResolvedValue(makeSuccessAnalyzeResult()) };
    await processJob({ job: SAMPLE_JOB, analyzer: analyzer as any, supabase: sb, logger: { info: vi.fn(), error: vi.fn() } });

    expect(analyzer.analyze).toHaveBeenCalledOnce();
    const ins = sb._inserts();
    const runInserts = ins.filter((i: any) => i.table === 'analysis_runs');
    expect(runInserts).toHaveLength(1);
    expect(runInserts[0].row.brief_id).toBe('brief1');
    expect(runInserts[0].row.trigger_type).toBe('initial');
    expect(runInserts[0].row.is_current).toBe(true);
    expect(runInserts[0].row.run_index).toBe(1);
    expect(runInserts[0].row.framework_seed).toBeTruthy();
    expect(runInserts[0].row.ai_output).toBeTruthy();

    const upd = sb._updates();
    const jobUpd = upd.filter((u: any) => u.table === 'ai_analysis_jobs');
    expect(jobUpd).toHaveLength(1);
    expect(jobUpd[0].row.status).toBe('completed');
    expect(jobUpd[0].where.id).toBe('job1');

    const logs = ins.filter((i: any) => i.table === 'activity_log');
    const logEvents = logs.map((l: any) => l.row.event_type);
    expect(logEvents).toContain('ai_analysis_started');
    expect(logEvents).toContain('ai_analysis_completed');
  });

  it('analyzer failure: marks job failed with error_detail.reason', async () => {
    const sb = makeFakeSupabase(FAKE_BRIEF_ROW);
    const analyzer = {
      analyze: vi.fn().mockResolvedValue({ ok: false, failure: { reason: 'claude_5xx_max_retries', detail: '502 bad gateway' } }),
    };
    await processJob({ job: SAMPLE_JOB, analyzer: analyzer as any, supabase: sb, logger: { info: vi.fn(), error: vi.fn() } });

    const ins = sb._inserts();
    const upd = sb._updates();
    const jobUpd = upd.filter((u: any) => u.table === 'ai_analysis_jobs');
    expect(jobUpd).toHaveLength(1);
    expect(jobUpd[0].row.status).toBe('failed');
    expect(jobUpd[0].row.error_detail).toEqual({ reason: 'claude_5xx_max_retries', detail: '502 bad gateway' });

    const logs = ins.filter((i: any) => i.table === 'activity_log');
    const logEvents = logs.map((l: any) => l.row.event_type);
    expect(logEvents).toContain('ai_analysis_failed');

    expect(ins.filter((i: any) => i.table === 'analysis_runs')).toHaveLength(0);
  });

  it('marks job failed when the brief row is missing', async () => {
    const sb = makeFakeSupabase(null);
    const analyzer = { analyze: vi.fn() };
    await processJob({ job: SAMPLE_JOB, analyzer: analyzer as any, supabase: sb, logger: { info: vi.fn(), error: vi.fn() } });
    expect(analyzer.analyze).not.toHaveBeenCalled();
    const upd = sb._updates();
    const jobUpd = upd.filter((u: any) => u.table === 'ai_analysis_jobs');
    expect(jobUpd[0].row.status).toBe('failed');
    expect(jobUpd[0].row.error_detail.reason).toBe('brief_row_missing');
  });
});

const SAMPLE_REANALYZE_JOB: ClaimedJob = {
  ...SAMPLE_JOB,
  id: 'job-reanalyze',
  trigger_type: 're_analyze_new_frameworks',
  founder_note: 'tighten the hooks',
  prior_run_id: 'prior-run-id',
};

const PRIOR_RUN_ROW = {
  id: 'prior-run-id',
  brief_id: 'brief1',
  run_index: 1,
  is_current: true,
  framework_seed: {
    seed_hash: 'prior-h',
    seed_inputs: { customer_id: 'cust1', niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
    selected_frameworks: ['DR_FORMULA'],
    selected_archetypes: ['PRICING_BREAKDOWN'],
    selected_pairs: [{ framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 }],
    exhaustion_warning: false,
    lru_fallback_used: false,
  },
};

function makeFakeSupabaseForReanalyze(briefRow: any, priorRunRow: any) {
  const inserts: any[] = [];
  const updates: any[] = [];
  const supabase: any = {
    from: vi.fn((table: string) => {
      if (table === 'briefs') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: briefRow, error: null }) }) }) };
      }
      if (table === 'brief_photos') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      if (table === 'analysis_runs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: priorRunRow, error: null }),
            }),
          }),
          insert: vi.fn().mockImplementation((row: any) => {
            inserts.push({ table, row });
            return { select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new-run-id' }, error: null }) }) };
          }),
          update: vi.fn().mockImplementation((row: any) => ({
            eq: vi.fn().mockImplementation(async (col: string, val: any) => {
              updates.push({ table, row, where: { [col]: val } });
              return { error: null };
            }),
          })),
        };
      }
      if (table === 'analysis_edits') {
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      return {
        insert: vi.fn().mockImplementation(async (row: any) => {
          inserts.push({ table, row });
          return { error: null };
        }),
        update: vi.fn().mockImplementation((row: any) => ({
          eq: vi.fn().mockImplementation(async (col: string, val: any) => {
            updates.push({ table, row, where: { [col]: val } });
            return { error: null };
          }),
        })),
      };
    }),
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
    _inserts: () => inserts,
    _updates: () => updates,
  };
  return supabase;
}

describe('processJob (re-analysis trigger)', () => {
  it('re_analyze_new_frameworks: reads prior run, calls analyzer with priorSeed + prior context, writes run_index=prior+1', async () => {
    const sb = makeFakeSupabaseForReanalyze(FAKE_BRIEF_ROW, PRIOR_RUN_ROW);
    const analyzer = {
      analyze: vi.fn().mockImplementation(async (input) => {
        expect(input.trigger_type).toBe('re_analyze_new_frameworks');
        expect(input.prior).toBeDefined();
        expect(input.prior.prior_run_id).toBe('prior-run-id');
        expect(input.prior.prior_run_index).toBe(1);
        expect(input.prior.mode).toBe('new_frameworks');
        expect(input.prior.founder_note).toBe('tighten the hooks');
        expect(input.priorSeed).toBeDefined();
        expect(input.priorSeed.seed_hash).toBe('prior-h');
        expect(input.prior_run_index).toBe(2);
        return makeSuccessAnalyzeResult();
      }),
    };
    await processJob({ job: SAMPLE_REANALYZE_JOB, analyzer: analyzer as any, supabase: sb, logger: { info: vi.fn(), error: vi.fn() } });

    const priorFlips = sb._updates().filter((u: any) => u.table === 'analysis_runs' && u.where.id === 'prior-run-id');
    expect(priorFlips).toHaveLength(1);
    expect(priorFlips[0].row.is_current).toBe(false);

    const newRunInserts = sb._inserts().filter((i: any) => i.table === 'analysis_runs');
    expect(newRunInserts).toHaveLength(1);
    expect(newRunInserts[0].row.run_index).toBe(2);
    expect(newRunInserts[0].row.trigger_type).toBe('re_analyze_with_note');
    expect(newRunInserts[0].row.is_current).toBe(true);

    const jobUpd = sb._updates().filter((u: any) => u.table === 'ai_analysis_jobs');
    expect(jobUpd[0].row.status).toBe('completed');
  });

  it('re_analyze_same_frameworks: maps trigger_type and uses mode=same_frameworks', async () => {
    const job = { ...SAMPLE_REANALYZE_JOB, trigger_type: 're_analyze_same_frameworks' as const };
    const sb = makeFakeSupabaseForReanalyze(FAKE_BRIEF_ROW, PRIOR_RUN_ROW);
    let observedInput: any = null;
    const analyzer = {
      analyze: vi.fn().mockImplementation(async (input) => {
        observedInput = input;
        return makeSuccessAnalyzeResult();
      }),
    };
    await processJob({ job, analyzer: analyzer as any, supabase: sb, logger: { info: vi.fn(), error: vi.fn() } });
    expect(observedInput.trigger_type).toBe('re_analyze_same_frameworks');
    expect(observedInput.prior.mode).toBe('same_frameworks');
  });

  it('marks job failed with reason=prior_run_missing when prior_run_id row does not exist', async () => {
    const sb = makeFakeSupabaseForReanalyze(FAKE_BRIEF_ROW, null);
    const analyzer = { analyze: vi.fn() };
    await processJob({ job: SAMPLE_REANALYZE_JOB, analyzer: analyzer as any, supabase: sb, logger: { info: vi.fn(), error: vi.fn() } });
    expect(analyzer.analyze).not.toHaveBeenCalled();
    const jobUpd = sb._updates().filter((u: any) => u.table === 'ai_analysis_jobs');
    expect(jobUpd[0].row.status).toBe('failed');
    expect(jobUpd[0].row.error_detail.reason).toBe('prior_run_missing');
  });
});
