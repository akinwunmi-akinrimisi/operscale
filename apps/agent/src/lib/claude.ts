// apps/agent/src/lib/claude.ts
//
// Anthropic Claude Opus 4.7 brief analysis wrapper.
// SOURCE OF TRUTH: docs/specs/ai-brief-analysis.md (the prompt itself is the spec).
//
// CLAUDE.md file ownership: this file is owned by docs/specs/ai-brief-analysis.md.
// Changes here without a corresponding spec update are forbidden.
//
// Concurrency: cap at 5 in-flight (CLAUDE.md gotcha #8).

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-opus-4-7' as const;
export const MAX_TOKENS = 4000;
export const RETRY_ATTEMPTS = 5;
export const CONCURRENT_CAP = 5;

export interface AnalyzeBriefInput {
  briefId: string;
  formPayload: Record<string, unknown>;
  niche: string;
  nicheBrief: string;
  photos: { mimeType: 'image/jpeg' | 'image/png'; base64: string }[];
  founderNote?: string;
  triggerType: 'initial' | 're_analyze_with_note';
}

export interface AnalyzeBriefOutput {
  brief_summary: string;
  recommended_angles: { angle: string; hook: string; why_it_fits: string }[];
  sample_script_seed: { video_1_topic: string; video_1_hook: string; video_1_outline: string[] };
  brand_voice: {
    tone_summary: string;
    vocabulary_pattern: string;
    sentence_rhythm: string;
    emotional_register: string;
    do_say: string[];
    do_not_say: string[];
  };
  photo_aesthetic: {
    face_quality_summary: string;
    styling_observations: string;
    setting_hints: string;
    recommended_avatar_treatment: string;
    flags: string[];
  } | null;
  visual_style: {
    recommended_palette: string[];
    recommended_palette_rationale: string;
    recommended_typography: string;
    recommended_camera_treatment: string;
    recommended_caption_style: string;
  };
  upsell_recommendation: {
    should_upsell: boolean;
    recommended_tier: 'starter' | 'standard' | 'calendar' | null;
    reasoning: string;
    upsell_price_delta: number;
  };
  flags: { type: string; detail: string }[];
  estimated_brief_quality_score: number;
}

export interface AnalyzeBriefResult {
  output: AnalyzeBriefOutput;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export async function analyzeBrief(_input: AnalyzeBriefInput): Promise<AnalyzeBriefResult> {
  // TODO(Operscale): implement per docs/specs/ai-brief-analysis.md
  //   1. Build system prompt (~800 tokens) from spec template
  //   2. Build user prompt (~1400 tokens) with form payload + niche brief
  //   3. Attach photo blocks (~700 tokens each, max 3)
  //   4. anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS })
  //   5. Validate output JSON against zod schema
  //   6. Compute cost from token counts (Anthropic pricing in spec)
  //   7. Retry up to 5x with exp backoff on 5xx; fail-soft to template on validation error
  throw new Error('analyzeBrief not implemented — see docs/specs/ai-brief-analysis.md');
}

// Lazily-instantiated client. Do NOT export the instance directly; force callers
// to go through analyzeBrief() so the concurrency cap and logging are uniform.
let _client: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  _client = new Anthropic({ apiKey });
  return _client;
}
