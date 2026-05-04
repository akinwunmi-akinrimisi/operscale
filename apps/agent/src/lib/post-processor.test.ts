import { describe, it, expect } from 'vitest';
import { postProcess, TIER_PRICES_NGN } from './post-processor';
import type { AiOutput } from './types/v2';

const BASE: AiOutput = {
  brand_voice: {
    voice_phrases: ['hand-finished', '14 hours'],
    sentence_rhythm: 'mid_length',
    avoid_words: ['timeless'],
    energy_register: 'authoritative',
    voice_corpus_quality: 'thick',
  },
  specificity_inventory: {
    numbers: ['14 hours', 'NGN 80k'],
    proper_nouns: ['Lagos', 'ankara'],
    process_steps: ['cutting', 'construction', 'finishing'],
    specificity_corpus_quality: 'thick',
  },
  expertise_map: [
    { nugget: "Customers don't realise good ankara takes 14h hand-finishing.", framework_affinity: ['EDUCATIONAL_BREAKDOWN'] },
    { nugget: 'Customers underestimate the role of fabric weight.', framework_affinity: ['MYTH_BUSTER'] },
    { nugget: 'Customers think bespoke is always slower than ready-to-wear.', framework_affinity: ['COMPARISON'] },
    { nugget: 'Customers conflate price with quality of finishing.', framework_affinity: ['COST_REVEAL'] },
  ],
  visual_aesthetic: { lighting: 'warm', setting: 'studio', wardrobe_props: 'garments', photo_quality_summary: 'consistent', photos_present: true },
  calendar_plan: [
    {
      slot_index: 1,
      day: 1,
      format: 'ugc_30s',
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
      topic: 'why custom ankara is priced the way it is',
      hook: 'hook',
      core_beats: [],
      cta: 'cta',
      fabrication_risk_check: 'passed',
    },
  ],
  fabrication_audit: { lines_checked: 1, violations_found: [], audit_passed: true },
  flags_for_review: [],
};

describe('postProcess.brief_summary', () => {
  it('produces a 1-2 sentence summary mentioning the niche label and the slot-1 topic', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.brief_summary).toMatch(/fashion/i);
    expect(r.brief_summary).toMatch(/why custom ankara is priced the way it is/);
  });
});

describe('postProcess.upsell_recommendation', () => {
  it('recommends standard when current tier is starter and signals are thick + ≥4 expertise nuggets', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'starter', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(true);
    expect(r.upsell_recommendation.recommended_tier).toBe('standard');
    expect(r.upsell_recommendation.upsell_price_delta).toBe(TIER_PRICES_NGN.standard - TIER_PRICES_NGN.starter);
  });

  it('recommends calendar when current tier is standard and signals are thick + ≥4 expertise', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(true);
    expect(r.upsell_recommendation.recommended_tier).toBe('calendar');
    expect(r.upsell_recommendation.upsell_price_delta).toBe(TIER_PRICES_NGN.calendar - TIER_PRICES_NGN.standard);
  });

  it('does NOT upsell when current tier is calendar (top tier)', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'calendar', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(false);
    expect(r.upsell_recommendation.recommended_tier).toBeNull();
    expect(r.upsell_recommendation.upsell_price_delta).toBe(0);
  });

  it('does NOT upsell when voice corpus is thin', () => {
    const ai = { ...BASE, brand_voice: { ...BASE.brand_voice, voice_corpus_quality: 'thin' as const } };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'starter', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(false);
  });

  it('does NOT upsell when expertise_map has fewer than 4 nuggets', () => {
    const ai = { ...BASE, expertise_map: BASE.expertise_map.slice(0, 3) };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'starter', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.upsell_recommendation.should_upsell).toBe(false);
  });
});

describe('postProcess.estimated_brief_quality_score', () => {
  it('is 1.0 when all signals are maxed (thick voice, thick specificity, photos, no violations)', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.estimated_brief_quality_score).toBeCloseTo(1.0, 3);
  });

  it('drops when voice corpus is absent', () => {
    const ai = { ...BASE, brand_voice: { ...BASE.brand_voice, voice_corpus_quality: 'absent' as const } };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    // 0.5*0.2 + 0.3*1.0 + 0.1*1.0 + 0.1*1.0 = 0.6
    expect(r.estimated_brief_quality_score).toBeCloseTo(0.6, 3);
  });

  it('drops further when no photos', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: false, reanalyzed: false, postHocViolations: 0 });
    // 0.5*1.0 + 0.3*1.0 + 0.1*0 + 0.1*1.0 = 0.9
    expect(r.estimated_brief_quality_score).toBeCloseTo(0.9, 3);
  });

  it('clamps the violation impact at 10 violations', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 25 });
    // 0.5+0.3+0.1+0.0 = 0.9 (violation factor is 1 - 1 = 0)
    expect(r.estimated_brief_quality_score).toBeCloseTo(0.9, 3);
  });

  it('is always between 0 and 1', () => {
    const ai = { ...BASE, brand_voice: { ...BASE.brand_voice, voice_corpus_quality: 'absent' as const }, specificity_inventory: { ...BASE.specificity_inventory, specificity_corpus_quality: 'absent' as const } };
    const r = postProcess({ aiOutput: ai, niche: 'fashion', tier: 'standard', hasPhotos: false, reanalyzed: false, postHocViolations: 999 });
    expect(r.estimated_brief_quality_score).toBeGreaterThanOrEqual(0);
    expect(r.estimated_brief_quality_score).toBeLessThanOrEqual(1);
  });
});

describe('postProcess returns a SupersetOutput', () => {
  it('preserves every AiOutput field unchanged', () => {
    const r = postProcess({ aiOutput: BASE, niche: 'fashion', tier: 'standard', hasPhotos: true, reanalyzed: false, postHocViolations: 0 });
    expect(r.brand_voice).toEqual(BASE.brand_voice);
    expect(r.calendar_plan).toEqual(BASE.calendar_plan);
    expect(r.fabrication_audit).toEqual(BASE.fabrication_audit);
  });
});
