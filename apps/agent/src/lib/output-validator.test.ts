import { describe, it, expect } from 'vitest';
import { aiOutputSchema } from './output-validator';
import type { AiOutput } from './types/v2';

const VALID_OUTPUT: AiOutput = {
  brand_voice: {
    voice_phrases: ['hand-finished', '14 hours of work'],
    sentence_rhythm: 'mid_length',
    avoid_words: ['timeless', 'iconic'],
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
    { nugget: "Customers don't realise that good ankara takes 14h hand-finishing.", framework_affinity: ['EDUCATIONAL_BREAKDOWN', 'MYTH_BUSTER'] },
  ],
  visual_aesthetic: {
    lighting: 'warm, soft',
    setting: 'studio',
    wardrobe_props: 'finished garments on wooden hangers',
    photo_quality_summary: 'consistent, high-quality',
    photos_present: true,
  },
  calendar_plan: [
    {
      slot_index: 1,
      day: 1,
      format: 'ugc_30s',
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
      topic: 'why custom ankara costs what it does',
      hook: '14 hours of hand-finishing — this is what that gets you.',
      core_beats: ['fabric cost', 'cutting time', 'construction time', 'finishing time'],
      cta: 'DM "ankara" for our current intake.',
      fabrication_risk_check: 'passed',
    },
  ],
  fabrication_audit: {
    lines_checked: 6,
    violations_found: [],
    audit_passed: true,
  },
  flags_for_review: [],
};

describe('aiOutputSchema', () => {
  it('parses a fully valid AiOutput', () => {
    const result = aiOutputSchema.safeParse(VALID_OUTPUT);
    expect(result.success).toBe(true);
  });

  it('rejects when a top-level key is missing', () => {
    const { calendar_plan, ...rest } = VALID_OUTPUT;
    const result = aiOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid sentence_rhythm enum value', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, sentence_rhythm: 'medium' } };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid energy_register enum value', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, energy_register: 'angsty' } };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid voice_corpus_quality value', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, voice_corpus_quality: 'bountiful' } };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a calendar_plan entry with an invalid format', () => {
    const bad = {
      ...VALID_OUTPUT,
      calendar_plan: [{ ...VALID_OUTPUT.calendar_plan[0], format: 'video' }],
    };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a calendar_plan entry where slot_index is not an integer', () => {
    const bad = {
      ...VALID_OUTPUT,
      calendar_plan: [{ ...VALID_OUTPUT.calendar_plan[0], slot_index: 1.5 }],
    };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects when fabrication_audit.audit_passed is not boolean', () => {
    const bad = {
      ...VALID_OUTPUT,
      fabrication_audit: { ...VALID_OUTPUT.fabrication_audit, audit_passed: 'true' },
    };
    const result = aiOutputSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts an empty expertise_map array', () => {
    const ok = { ...VALID_OUTPUT, expertise_map: [] };
    expect(aiOutputSchema.safeParse(ok).success).toBe(true);
  });

  it('accepts a flags_for_review entry with reason + detail', () => {
    const ok = {
      ...VALID_OUTPUT,
      flags_for_review: [{ reason: 'thin_voice_corpus', detail: 'Reference posts were sparse.' }],
    };
    expect(aiOutputSchema.safeParse(ok).success).toBe(true);
  });
});
