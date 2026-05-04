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

import { validateAiOutput } from './output-validator';
import type { FrameworkSeedResult } from './types/v2';

const SAMPLE_SEED: FrameworkSeedResult = {
  seed_hash: 'a3f9e2d18c4b7a05',
  seed_inputs: {
    customer_id: '11111111-1111-1111-1111-111111111111',
    niche: 'fashion',
    order_index: 1,
    submission_week_iso: '2026-W18',
  },
  selected_frameworks: ['DR_FORMULA', 'PAS'],
  selected_archetypes: ['PRICING_BREAKDOWN', 'PROCESS_TOUR'],
  selected_pairs: [
    { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
    { framework: 'PAS', archetype: 'PROCESS_TOUR', affinity: 4 },
  ],
  exhaustion_warning: false,
  lru_fallback_used: false,
};

describe('validateAiOutput', () => {
  it('returns ok=true for a valid output that matches seed + tier', () => {
    // Tier "starter" wants 7 videos + 3 carousels = 10 calendar slots.
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx % 2 === 0 ? 'DR_FORMULA' : 'PAS',
      archetype_slot: idx % 2 === 0 ? 'PRICING_BREAKDOWN' : 'PROCESS_TOUR',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(true);
  });

  it('returns ok=false reason=malformed_json on a non-JSON-parseable string input', () => {
    const result = validateAiOutput('this is not json', SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('malformed_json');
    }
  });

  it('parses a JSON-string input on the happy path', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx % 2 === 0 ? 'DR_FORMULA' : 'PAS',
      archetype_slot: idx % 2 === 0 ? 'PRICING_BREAKDOWN' : 'PROCESS_TOUR',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(JSON.stringify(out), SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(true);
  });

  it('returns ok=false reason=schema_mismatch when shape is wrong', () => {
    const bad = { ...VALID_OUTPUT, brand_voice: { ...VALID_OUTPUT.brand_voice, energy_register: 'angsty' } };
    const result = validateAiOutput(bad, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('schema_mismatch');
      // @ts-expect-error narrowed by reason
      expect(result.failure.zodIssues.length).toBeGreaterThan(0);
    }
  });

  it('returns ok=false reason=slot_count_mismatch when calendar_plan length != video+carousel', () => {
    // Tier "starter" wants 7 + 3 = 10. We supply 9.
    const calendarPlan = Array.from({ length: 9 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('slot_count_mismatch');
      // @ts-expect-error narrowed by reason
      expect(result.failure.expected).toBe(10);
      // @ts-expect-error narrowed
      expect(result.failure.actual).toBe(9);
    }
  });

  it('returns ok=false reason=unauthorized_slot when a calendar slot uses a framework outside the seed', () => {
    // Tier "starter" wants 10 slots. Use AIDA which is NOT in selected_frameworks.
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx === 5 ? 'AIDA' : 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('unauthorized_slot');
      // @ts-expect-error narrowed
      expect(result.failure.offenders).toEqual(expect.arrayContaining(['framework:AIDA']));
    }
  });

  it('returns ok=false reason=unauthorized_slot when an archetype is outside the seed', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: 'DR_FORMULA',
      archetype_slot: idx === 4 ? 'INSIDER_CHECKLIST' : 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('unauthorized_slot');
      // @ts-expect-error narrowed
      expect(result.failure.offenders).toEqual(expect.arrayContaining(['archetype:INSIDER_CHECKLIST']));
    }
  });

  it('does NOT reject when fabrication_audit.audit_passed is false (per §6 #4)', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx % 2 === 0 ? 'DR_FORMULA' : 'PAS',
      archetype_slot: idx % 2 === 0 ? 'PRICING_BREAKDOWN' : 'PROCESS_TOUR',
    }));
    const out = {
      ...VALID_OUTPUT,
      calendar_plan: calendarPlan,
      fabrication_audit: {
        lines_checked: 30,
        violations_found: [{ slot_index: 1, line: 'something', violation: 'biographical' }],
        audit_passed: false,
      },
    };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(true);
  });

  it('reports multiple offenders when more than one slot is unauthorized', () => {
    const calendarPlan = Array.from({ length: 10 }, (_, idx) => ({
      ...VALID_OUTPUT.calendar_plan[0],
      slot_index: idx + 1,
      day: idx + 1,
      framework_slot: idx === 0 ? 'AIDA' : idx === 1 ? 'PAIPS' : 'DR_FORMULA',
      archetype_slot: 'PRICING_BREAKDOWN',
    }));
    const out = { ...VALID_OUTPUT, calendar_plan: calendarPlan };
    const result = validateAiOutput(out, SAMPLE_SEED, 'starter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // @ts-expect-error narrowed
      expect(result.failure.offenders).toEqual(expect.arrayContaining(['framework:AIDA', 'framework:PAIPS']));
    }
  });
});
