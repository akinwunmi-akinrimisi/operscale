// Derives the three CRM-facing fields per design doc Q1:
// brief_summary, upsell_recommendation, estimated_brief_quality_score.
// Pure; deterministic given inputs.

import type { AiOutput, CorpusQuality, NicheSlug, SupersetOutput, Tier } from './types/v2.js';

// docs/pricing-and-packages.md tier prices in NGN.
export const TIER_PRICES_NGN: Record<Tier, number> = {
  starter: 80_000,
  standard: 200_000,
  calendar: 400_000,
};

const NICHE_LABELS: Record<NicheSlug, string> = {
  beauty: 'beauty',
  real_estate: 'real estate',
  fashion: 'fashion',
  fintech: 'fintech',
  health: 'health',
  food: 'food',
  education: 'education',
};

const QUALITY_SCORES: Record<CorpusQuality, number> = {
  thick: 1.0,
  thin: 0.6,
  absent: 0.2,
};

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function nextTier(current: Tier): Tier | null {
  if (current === 'starter') return 'standard';
  if (current === 'standard') return 'calendar';
  return null;
}

function deriveBriefSummary(aiOutput: AiOutput, niche: NicheSlug): string {
  const nicheLabel = NICHE_LABELS[niche];
  const topic = aiOutput.calendar_plan[0]?.topic ?? '(no topic derived)';
  const expertise = aiOutput.expertise_map[0]?.nugget;
  const second = expertise
    ? `Anchor expertise: ${expertise}`
    : `Voice corpus quality is ${aiOutput.brand_voice.voice_corpus_quality}.`;
  return `Customer is in ${nicheLabel}; opening slot covers: ${topic}. ${second}`;
}

function deriveUpsell(aiOutput: AiOutput, tier: Tier): SupersetOutput['upsell_recommendation'] {
  const recommended = nextTier(tier);
  if (!recommended) {
    return {
      should_upsell: false,
      recommended_tier: null,
      reasoning: 'Customer is already on the top tier (calendar).',
      upsell_price_delta: 0,
    };
  }

  const voiceThick = aiOutput.brand_voice.voice_corpus_quality === 'thick';
  const specificityThick = aiOutput.specificity_inventory.specificity_corpus_quality === 'thick';
  const expertiseRich = aiOutput.expertise_map.length >= 4;

  const should = voiceThick && specificityThick && expertiseRich;

  if (!should) {
    return {
      should_upsell: false,
      recommended_tier: null,
      reasoning:
        'Upsell signals not met: requires thick voice + thick specificity + >=4 expertise nuggets.',
      upsell_price_delta: 0,
    };
  }

  const delta = TIER_PRICES_NGN[recommended] - TIER_PRICES_NGN[tier];
  return {
    should_upsell: true,
    recommended_tier: recommended,
    reasoning: `Voice and specificity corpora are thick and ${aiOutput.expertise_map.length} expertise nuggets surfaced; the ${recommended} tier covers more of the discoverable surface area.`,
    upsell_price_delta: delta,
  };
}

function deriveQualityScore(args: {
  aiOutput: AiOutput;
  hasPhotos: boolean;
  postHocViolations: number;
}): number {
  const voiceQ = QUALITY_SCORES[args.aiOutput.brand_voice.voice_corpus_quality];
  const specQ = QUALITY_SCORES[args.aiOutput.specificity_inventory.specificity_corpus_quality];
  const photoQ = args.hasPhotos ? 1 : 0;
  const violationFactor = 1 - clamp01(args.postHocViolations / 10);
  const score = 0.5 * voiceQ + 0.3 * specQ + 0.1 * photoQ + 0.1 * violationFactor;
  return clamp01(score);
}

export function postProcess(args: {
  aiOutput: AiOutput;
  niche: NicheSlug;
  tier: Tier;
  hasPhotos: boolean;
  reanalyzed: boolean;
  postHocViolations: number;
}): SupersetOutput {
  return {
    ...args.aiOutput,
    brief_summary: deriveBriefSummary(args.aiOutput, args.niche),
    upsell_recommendation: deriveUpsell(args.aiOutput, args.tier),
    estimated_brief_quality_score: deriveQualityScore({
      aiOutput: args.aiOutput,
      hasPhotos: args.hasPhotos,
      postHocViolations: args.postHocViolations,
    }),
  };
}
