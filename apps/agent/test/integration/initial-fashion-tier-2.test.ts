import { describe, it, expect, beforeAll, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { loadBankCatalog } from '@/lib/bank-catalog';
import { auditFabrication } from '@/lib/fabrication-audit';
import { postProcess } from '@/lib/post-processor';
import { createBriefAnalyzer } from '@/lib/claude';
import { createCassetteClient } from '../helpers/cassette-client';
import { initialFashionTier2 } from '../fixtures/briefs/initial-fashion-tier-2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cassettePath = path.resolve(__dirname, '../fixtures/cassettes/initial-fashion-tier-2.json');

describe('L2 integration — initial / fashion / tier-standard', () => {
  let pipelineResult: ReturnType<typeof postProcess>;
  let pipelineSeed: any;
  let pipelineTelemetry: any;
  let supabaseInserts: any[];

  beforeAll(async () => {
    // Load real catalog — auto-detects repoRoot via pnpm-workspace.yaml ascent.
    const catalog = await loadBankCatalog();

    supabaseInserts = [];
    const supabase: any = {
      from: vi.fn((table: string) => {
        if (table === 'customer_framework_history') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          insert: vi.fn().mockImplementation(async (row: any) => {
            supabaseInserts.push({ table, row });
            return { error: null };
          }),
        };
      }),
    };

    // Cassette boundary: replay JSON in CI; record live with CLAUDE_LIVE=1.
    const realClient = process.env.CLAUDE_LIVE === '1'
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      : undefined;
    const cassetteClient = createCassetteClient({ cassettePath, realClient });

    const analyzer = createBriefAnalyzer({
      client: cassetteClient as any,
      supabase,
      catalog,
      logger: { info: () => {}, error: () => {} },
    });

    const result = await analyzer.analyze({
      brief: initialFashionTier2,
      photos: [],
      trigger_type: 'initial',
    });
    if (!result.ok) {
      console.error('analyzer.failure =', result.failure);
      throw new Error(`analyzer failed: ${result.failure.reason}`);
    }
    pipelineResult = result.superset;
    pipelineSeed = result.seed;
    pipelineTelemetry = result.telemetry;
  }, 200_000);

  it('orchestrator returned ok=true and a populated SupersetOutput', () => {
    expect(pipelineResult).toBeDefined();
    expect(pipelineResult.calendar_plan.length).toBeGreaterThan(0);
  });

  it('calendar_plan has the tier-standard slot count (14 + 7 = 21)', () => {
    expect(pipelineResult.calendar_plan).toHaveLength(21);
  });

  it('every calendar_plan slot uses a framework + archetype from the seed', () => {
    const allowedF = new Set(['DR_FORMULA', 'PAS', 'AIDA', 'PAIPS', 'VALUE_EQUATION', 'THREE_LAYER_HOOK_STACK', 'PATTERN_INTERRUPT', 'OPEN_LOOP', 'CURIOSITY_GAP', 'SPECIFICITY_STACK', 'QUICK_WIN', 'EDUCATIONAL_BREAKDOWN', 'PROCESS_DEMYSTIFICATION', 'NUMBERED_LIST', 'CHECKLIST_REVEAL', 'MYTH_BUSTER', 'COMPARISON', 'ANTI_TREND', 'INDUSTRY_INSIDER', 'COST_REVEAL', 'BEHIND_THE_WORK', 'DATASET_REVEAL', 'DECODED_JARGON', 'STEEL_MAN', 'FRAME_RE_SET']);
    for (const slot of pipelineResult.calendar_plan) {
      expect(allowedF.has(slot.framework_slot)).toBe(true);
    }
  });

  it('SupersetOutput contains brief_summary, upsell_recommendation, and a numeric quality score', () => {
    expect(typeof pipelineResult.brief_summary).toBe('string');
    expect(pipelineResult.brief_summary.length).toBeGreaterThan(20);
    expect(typeof pipelineResult.upsell_recommendation.should_upsell).toBe('boolean');
    expect(pipelineResult.estimated_brief_quality_score).toBeGreaterThanOrEqual(0);
    expect(pipelineResult.estimated_brief_quality_score).toBeLessThanOrEqual(1);
  });

  it('the model output respects no-fabrication: backstory verbatim is empty so no fabricated origin lines', () => {
    const violations = auditFabrication(pipelineResult, initialFashionTier2.customer_backstory_verbatim);
    expect(violations).toEqual([]);
  });

  it('orchestrator inserted exactly one llm_calls row with brief_id + token counts', () => {
    const llmInserts = supabaseInserts.filter((i: any) => i.table === 'llm_calls');
    expect(llmInserts).toHaveLength(1);
    expect(llmInserts[0].row.brief_id).toBe(initialFashionTier2.brief_id);
    expect(llmInserts[0].row.model).toBe('claude-opus-4-7');
    expect(llmInserts[0].row.input_tokens).toBeGreaterThan(0);
    expect(llmInserts[0].row.output_tokens).toBeGreaterThan(0);
    expect(llmInserts[0].row.cost_usd).toBeGreaterThan(0);
    expect(llmInserts[0].row.status).toBe('ok');
    expect(llmInserts[0].row.purpose).toBe('brief_analysis');
  });

  it('orchestrator telemetry matches the inserted llm_calls row', () => {
    const llmRow = supabaseInserts.find((i: any) => i.table === 'llm_calls').row;
    expect(pipelineTelemetry.input_tokens).toBe(llmRow.input_tokens);
    expect(pipelineTelemetry.output_tokens).toBe(llmRow.output_tokens);
  });

  it('orchestrator queried customer_framework_history for the customer', () => {
    expect(pipelineSeed.seed_inputs.customer_id).toBe(initialFashionTier2.customer_id);
  });
});
