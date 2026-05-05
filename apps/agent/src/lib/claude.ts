// apps/agent/src/lib/claude.ts
//
// V2 brief-analysis orchestrator. Composes Phase 1 (selector + catalog)
// and Phase 2 (prompt-builder + output-validator + fabrication-audit +
// post-processor) into a single analyze(input) method.
//
// SOURCE OF TRUTH: docs/specs/ai-brief-analysis.md (the prompt itself)
// + docs/specs/v2-pipeline-implementation-design.md (the pipeline).
//
// Pure-ish: takes injected client + supabase + catalog so it's unit-testable.
// The IO it does: Anthropic call (via injected client) + customer history fetch
// (via injected supabase) + llm_calls write (via injected supabase).

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type AiOutput,
  type BankCatalog,
  type BriefAnalyzerInput,
  type FrameworkSeedResult,
  type PhotoBlock,
  type PriorRunContext,
  type SupersetOutput,
  type ValidationFailure,
  type Violation,
} from './types/v2';
import { selectFrameworksForBrief, type HistoryRow } from './framework-selector';
import { buildPromptMessages } from './prompt-builder';
import { validateAiOutput } from './output-validator';
import { auditFabrication } from './fabrication-audit';
import { postProcess } from './post-processor';

export const CLAUDE_MODEL = 'claude-opus-4-7' as const;
export const MAX_TOKENS = 16384;

export type AnalyzeFailureReason =
  | ValidationFailure['reason']
  | 'photo_missing'
  | 'claude_4xx'
  | 'claude_5xx_max_retries'
  | 'niche_brief_missing';

export interface AnalyzeInput {
  brief: BriefAnalyzerInput;
  photos: PhotoBlock[];
  logo?: PhotoBlock;
  trigger_type: 'initial' | 're_analyze_same_frameworks' | 're_analyze_new_frameworks';
  prior?: PriorRunContext;
  prior_run_index?: number;
  priorSeed?: FrameworkSeedResult;
}

export interface AnalyzeTelemetry {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
  attempt_count: number;
}

export type AnalyzeResult =
  | { ok: true; superset: SupersetOutput; seed: FrameworkSeedResult; postHocViolations: Violation[]; telemetry: AnalyzeTelemetry }
  | { ok: false; failure: { reason: AnalyzeFailureReason; detail: string } };

export interface AnthropicLikeClient {
  messages: { create: (req: any) => Promise<any> };
}

export interface BriefAnalyzerDeps {
  client: AnthropicLikeClient;
  supabase: SupabaseClient;
  catalog: BankCatalog;
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void };
}

export interface BriefAnalyzer {
  analyze(input: AnalyzeInput): Promise<AnalyzeResult>;
}

const COST_INPUT_PER_MTOK = 15.0;
const COST_OUTPUT_PER_MTOK = 75.0;

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * COST_INPUT_PER_MTOK + (outputTokens / 1_000_000) * COST_OUTPUT_PER_MTOK;
}

async function fetchHistoryFromSupabase(supabase: SupabaseClient, customer_id: string): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from('customer_framework_history')
    .select('framework_slot, archetype_slot, last_used_at')
    .eq('customer_id', customer_id);
  if (error) {
    throw new Error(`customer_framework_history fetch failed: ${error.message}`);
  }
  if (!data) return [];
  return data.map((row: any) => ({
    framework: row.framework_slot,
    archetype: row.archetype_slot,
    last_used_at: row.last_used_at,
  }));
}

function extractTextFromResponse(response: any): string {
  if (!Array.isArray(response?.content)) return '';
  return response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');
}

export function createBriefAnalyzer(deps: BriefAnalyzerDeps): BriefAnalyzer {
  return {
    async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
      const { brief, photos, logo, trigger_type, prior, prior_run_index } = input;
      const start = Date.now();

      // Photo presence check (design §7 photo_missing failure).
      for (const p of [...photos, ...(logo ? [logo] : [])]) {
        if (!p.base64 || p.base64.trim().length === 0) {
          return { ok: false, failure: { reason: 'photo_missing', detail: 'a photo block has empty base64' } };
        }
      }

      let mode: 'same_frameworks' | 'new_frameworks' | undefined;
      if (trigger_type === 're_analyze_same_frameworks') mode = 'same_frameworks';
      else if (trigger_type === 're_analyze_new_frameworks') mode = 'new_frameworks';

      const seed = await selectFrameworksForBrief({
        inputs: {
          customer_id: brief.customer_id,
          niche: brief.niche_slug,
          order_index: brief.order_index,
          submission_week_iso: brief.submission_week_iso,
        },
        tier: brief.tier,
        catalog: deps.catalog,
        fetchHistory: (customer_id) => fetchHistoryFromSupabase(deps.supabase, customer_id),
        mode,
        priorSeed: input.priorSeed,
        runIndex: prior_run_index,
      });

      let built;
      try {
        built = buildPromptMessages({ brief, seed, catalog: deps.catalog, photos, logo, prior });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/niche brief.*missing|niches\[/i.test(msg)) {
          return { ok: false, failure: { reason: 'niche_brief_missing', detail: msg } };
        }
        // re-throw for any other unexpected build error — these are programmer bugs
        // and should fail loud rather than silently mapping.
        throw err;
      }

      const response = await deps.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: built.system,
        messages: built.messages,
      });

      const text = extractTextFromResponse(response);
      const validation = validateAiOutput(text, seed, brief.tier);
      if (!validation.ok) {
        return { ok: false, failure: { reason: validation.failure.reason, detail: validation.failure.detail } };
      }

      const postHocViolations = auditFabrication(validation.value, brief.customer_backstory_verbatim);

      const mergedAi: AiOutput = {
        ...validation.value,
        fabrication_audit: {
          ...validation.value.fabrication_audit,
          violations_found: [...validation.value.fabrication_audit.violations_found, ...postHocViolations],
          audit_passed:
            validation.value.fabrication_audit.audit_passed &&
            postHocViolations.length === 0,
        },
      };

      const superset = postProcess({
        aiOutput: mergedAi,
        niche: brief.niche_slug,
        tier: brief.tier,
        hasPhotos: photos.length > 0,
        reanalyzed: trigger_type !== 'initial',
        postHocViolations: postHocViolations.length,
      });

      const telemetry: AnalyzeTelemetry = {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
        cost_usd: estimateCostUsd(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0),
        duration_ms: Date.now() - start,
        attempt_count: 1,
      };

      return { ok: true, superset, seed, postHocViolations, telemetry };
    },
  };
}
