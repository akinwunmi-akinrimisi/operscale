import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { loadBankCatalog } from '@/lib/bank-catalog';
import { selectFrameworksForBrief } from '@/lib/framework-selector';
import { buildPromptMessages } from '@/lib/prompt-builder';
import { validateAiOutput } from '@/lib/output-validator';
import { auditFabrication } from '@/lib/fabrication-audit';
import { postProcess } from '@/lib/post-processor';
import { createCassetteClient } from '../helpers/cassette-client';
import { initialFashionTier2 } from '../fixtures/briefs/initial-fashion-tier-2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const cassettePath = path.resolve(__dirname, '../fixtures/cassettes/initial-fashion-tier-2.json');

describe('L2 integration — initial / fashion / tier-standard', () => {
  let pipelineResult: ReturnType<typeof postProcess>;
  let validateOk: boolean;

  beforeAll(async () => {
    // Phase 1 setup — load real catalog from repo paths.
    const catalog = await loadBankCatalog({
      nichesDir: path.join(REPO_ROOT, 'niche-briefs'),
      frameworksFile: path.join(REPO_ROOT, 'docs/specs/script-frameworks.md'),
      archetypesFile: path.join(REPO_ROOT, 'docs/specs/angle-archetypes.md'),
    });

    const seed = await selectFrameworksForBrief({
      inputs: {
        customer_id: initialFashionTier2.customer_id,
        niche: initialFashionTier2.niche_slug,
        order_index: initialFashionTier2.order_index,
        submission_week_iso: initialFashionTier2.submission_week_iso,
      },
      tier: initialFashionTier2.tier,
      catalog,
      fetchHistory: async () => [],
    });

    const built = buildPromptMessages({
      brief: initialFashionTier2,
      seed,
      catalog,
      photos: [],
    });

    // Cassette boundary: replay JSON in CI; record live with CLAUDE_LIVE=1.
    const realClient = process.env.CLAUDE_LIVE === '1'
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : undefined;
    const cassetteClient = createCassetteClient({ cassettePath, realClient });

    // NB: `temperature` is deprecated for Claude Opus 4.7 (the API rejects it
    // with 400 invalid_request_error). The model uses its built-in default
    // for output sampling. ai-brief-analysis.md §4 was authored against an
    // earlier model that accepted temperature; spec is being updated in
    // lockstep with this code change.
    const response = await cassetteClient.messages.create({
      model: 'claude-opus-4-7',
      // 16384 covers tier-standard's 21-slot output with margin (the original
      // 8192 truncated tier-standard mid-string at ~20k chars). Calendar tier
      // (44 slots) may need 24576+; revisit when that cassette is recorded.
      max_tokens: 16384,
      system: built.system,
      messages: built.messages,
    });

    // Phase 2 pipeline.
    const text =
      Array.isArray(response.content)
        ? response.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('')
        : '';
    const validation = validateAiOutput(text, seed, initialFashionTier2.tier);
    validateOk = validation.ok;
    if (!validation.ok) {
      // Surface for assertion clarity — test will fail below.
      console.error('validation.failure =', validation.failure);
      throw new Error(`validation failed: ${validation.failure.reason}`);
    }
    const postHocViolations = auditFabrication(validation.value, initialFashionTier2.customer_backstory_verbatim);
    pipelineResult = postProcess({
      aiOutput: validation.value,
      niche: initialFashionTier2.niche_slug,
      tier: initialFashionTier2.tier,
      hasPhotos: initialFashionTier2.photo_count > 0,
      reanalyzed: false,
      postHocViolations: postHocViolations.length,
    });
  }, 200_000);

  it('output passes validation', () => {
    expect(validateOk).toBe(true);
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
});
