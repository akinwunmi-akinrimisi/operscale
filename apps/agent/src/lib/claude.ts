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
} from './types/v2.js';
import { selectFrameworksForBrief, type HistoryRow } from './framework-selector.js';
import { buildPromptMessages } from './prompt-builder.js';
import { validateAiOutput } from './output-validator.js';
import { auditFabrication } from './fabrication-audit.js';
import { postProcess } from './post-processor.js';

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

const MAX_5XX_RETRIES = 5;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 8000;

function backoffMs(attempt: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
}

function isRetryable(err: unknown): boolean {
  const status = (err as any)?.status;
  if (typeof status !== 'number') return true;
  if (status === 429) return true;
  return status >= 500 && status < 600;
}

function isNonRetryable4xx(err: unknown): boolean {
  const status = (err as any)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeLlmCall(
  supabase: SupabaseClient,
  args: {
    brief_id: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    duration_ms: number;
    status: 'ok' | 'retry' | 'failed';
    error_message: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('llm_calls').insert({
    purpose: 'brief_analysis',
    brief_id: args.brief_id,
    analysis_run_id: null,
    model: args.model,
    input_tokens: args.input_tokens,
    output_tokens: args.output_tokens,
    cost_usd: args.cost_usd,
    duration_ms: args.duration_ms,
    status: args.status,
    error_message: args.error_message,
  });
  // Best-effort: design §4.3 invariant #9. Swallow but log to stderr so
  // failed cost-telemetry writes still surface in container logs.
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[claude] llm_calls insert failed (best-effort):', error.message ?? error);
  }
}

async function fetchHistoryFromSupabase(supabase: SupabaseClient, customer_id: string): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from('customer_framework_history')
    .select('framework_slot, archetype_slot, used_at')
    .eq('customer_id', customer_id);
  if (error) {
    throw new Error(`customer_framework_history fetch failed: ${error.message}`);
  }
  if (!data) return [];
  return data.map((row: any) => ({
    framework: row.framework_slot,
    archetype: row.archetype_slot,
    last_used_at: row.used_at,    // DB column is used_at, in-memory field stays last_used_at
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

      // 3-4. Anthropic call with retry on 5xx + one retry on validation_failed.
      let response: any;
      let attemptCount = 0;
      let validatedAi: AiOutput | undefined;
      let validationFailedAddendum: string | null = null;

      callLoop: for (let validationAttempt = 0; validationAttempt < 2; validationAttempt++) {
        for (let i = 0; i < MAX_5XX_RETRIES; i++) {
          attemptCount++;
          const attemptStart = Date.now();
          let attemptStatus = 0;
          let attemptError: string | null = null;
          let attemptInputTok = 0;
          let attemptOutputTok = 0;
          const requestMessages = [...built.messages];
          if (validationFailedAddendum) {
            const layer4 = requestMessages[2];
            if (layer4) {
              const layer4Text = (layer4.content[0] as any).text + '\n\n' + validationFailedAddendum;
              requestMessages[2] = { role: 'user', content: [{ type: 'text', text: layer4Text }] };
            }
          }
          try {
            response = await deps.client.messages.create({
              model: CLAUDE_MODEL,
              max_tokens: MAX_TOKENS,
              system: built.system,
              messages: requestMessages,
            });
            attemptStatus = 200;
            attemptInputTok = response.usage?.input_tokens ?? 0;
            attemptOutputTok = response.usage?.output_tokens ?? 0;
            break;
          } catch (err) {
            attemptStatus = (err as any)?.status ?? 0;
            attemptError = err instanceof Error ? err.message : String(err);
            if (isNonRetryable4xx(err)) {
              await writeLlmCall(deps.supabase, {
                brief_id: brief.brief_id,
                model: CLAUDE_MODEL,
                input_tokens: 0,
                output_tokens: 0,
                cost_usd: 0,
                duration_ms: Date.now() - attemptStart,
                status: 'failed',
                error_message: attemptError,
              });
              deps.logger.error('claude.analyze: non-retryable 4xx', { status: attemptStatus, detail: (err as Error).message });
              return { ok: false, failure: { reason: 'claude_4xx', detail: (err as Error).message } };
            }
            if (i < MAX_5XX_RETRIES - 1 && isRetryable(err)) {
              deps.logger.info('claude.analyze: retrying after error', { attempt: i + 1, status: attemptStatus });
              await writeLlmCall(deps.supabase, {
                brief_id: brief.brief_id,
                model: CLAUDE_MODEL,
                input_tokens: 0,
                output_tokens: 0,
                cost_usd: 0,
                duration_ms: Date.now() - attemptStart,
                status: 'retry',
                error_message: attemptError,
              });
              await sleep(backoffMs(i + 1));
              continue;
            }
            await writeLlmCall(deps.supabase, {
              brief_id: brief.brief_id,
              model: CLAUDE_MODEL,
              input_tokens: 0,
              output_tokens: 0,
              cost_usd: 0,
              duration_ms: Date.now() - attemptStart,
              status: 'failed',
              error_message: attemptError,
            });
            deps.logger.error('claude.analyze: 5xx max retries exhausted', { attempts: attemptCount, detail: (err as Error).message });
            return { ok: false, failure: { reason: 'claude_5xx_max_retries', detail: (err as Error).message } };
          } finally {
            if (attemptStatus === 200) {
              await writeLlmCall(deps.supabase, {
                brief_id: brief.brief_id,
                model: CLAUDE_MODEL,
                input_tokens: attemptInputTok,
                output_tokens: attemptOutputTok,
                cost_usd: estimateCostUsd(attemptInputTok, attemptOutputTok),
                duration_ms: Date.now() - attemptStart,
                status: 'ok',
                error_message: null,
              });
            }
          }
        }

        const text = extractTextFromResponse(response);
        const validation = validateAiOutput(text, seed, brief.tier);
        if (validation.ok) {
          validatedAi = validation.value;
          break callLoop;
        }

        if (validationAttempt === 0) {
          validationFailedAddendum =
            'IMPORTANT: your previous output was malformed — prior attempt failed validation with reason "' +
            validation.failure.reason +
            '" — detail: ' +
            validation.failure.detail +
            '. Re-emit the JSON correcting that issue. Do NOT explain the fix; emit only the JSON.';
          deps.logger.info('claude.analyze: validation failed, retrying once with addendum', { reason: validation.failure.reason });
          continue callLoop;
        }
        deps.logger.error('claude.analyze: validation failed on second attempt', { reason: validation.failure.reason, detail: validation.failure.detail });
        return { ok: false, failure: { reason: validation.failure.reason, detail: validation.failure.detail } };
      }

      if (!validatedAi) {
        return { ok: false, failure: { reason: 'schema_mismatch', detail: 'unexpected: no validated output after retry loop' } };
      }

      const postHocViolations = auditFabrication(validatedAi, brief.customer_backstory_verbatim);

      const mergedAi: AiOutput = {
        ...validatedAi,
        fabrication_audit: {
          ...validatedAi.fabrication_audit,
          violations_found: [...validatedAi.fabrication_audit.violations_found, ...postHocViolations],
          audit_passed: validatedAi.fabrication_audit.audit_passed && postHocViolations.length === 0,
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
        attempt_count: attemptCount,
      };

      return { ok: true, superset, seed, postHocViolations, telemetry };
    },
  };
}
