import { describe, it, expect } from 'vitest';
import { auditFabrication } from './fabrication-audit';
import type { AiOutput } from './types/v2';

const BASE_AI_OUTPUT: AiOutput = {
  brand_voice: {
    voice_phrases: [],
    sentence_rhythm: 'mid_length',
    avoid_words: [],
    energy_register: 'authoritative',
    voice_corpus_quality: 'thick',
  },
  specificity_inventory: { numbers: [], proper_nouns: [], process_steps: [], specificity_corpus_quality: 'thick' },
  expertise_map: [],
  visual_aesthetic: { lighting: '', setting: '', wardrobe_props: '', photo_quality_summary: '', photos_present: false },
  calendar_plan: [],
  fabrication_audit: { lines_checked: 0, violations_found: [], audit_passed: true },
  flags_for_review: [],
};

function withSlot(idx: number, hook: string, beats: string[] = [], cta = ''): AiOutput['calendar_plan'][number] {
  return {
    slot_index: idx,
    day: idx,
    format: 'ugc_30s',
    framework_slot: 'DR_FORMULA',
    archetype_slot: 'PRICING_BREAKDOWN',
    topic: 'topic',
    hook,
    core_beats: beats,
    cta,
    fabrication_risk_check: 'passed',
  };
}

describe('auditFabrication', () => {
  it('returns no violations for a clean calendar_plan', () => {
    const out: AiOutput = {
      ...BASE_AI_OUTPUT,
      calendar_plan: [withSlot(1, '14 hours of hand-finishing — what that buys you')],
    };
    const v = auditFabrication(out, '');
    expect(v).toEqual([]);
  });

  it('flags "my grandmother taught me" via §8 regex 1', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(2, 'My grandmother taught me to sew.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ slot_index: 2, line: 'My grandmother taught me to sew.' });
    expect(v[0]!.violation).toMatch(/grandmother|family heritage/i);
  });

  it('flags "I started this business because" via §8 regex 2', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(3, 'I started this business because customers deserved better.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
    expect(v[0]!.slot_index).toBe(3);
  });

  it('does NOT flag "I started this business because" when present in customer_backstory_verbatim', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(3, 'I started this business because customers deserved better.')] };
    const backstory = 'I started this business because customers deserved better. That was 2019.';
    const v = auditFabrication(out, backstory);
    expect(v).toEqual([]);
  });

  it('flags "customer transformation" via §8 regex 3', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(4, 'Watch a real customer transformation in 30 seconds.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
  });

  it('flags "in the style of First Last" via §8 regex 4', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(5, 'Bestseller copy in the style of David Ogilvy lands harder.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
  });

  it('flags violations from core_beats and cta, not just hook', () => {
    const slot = withSlot(
      6,
      'fine hook',
      ['my mum used to run the shop', 'second clean beat'],
      'in the style of Gary Halbert — get yours.',
    );
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [slot] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.line)).toEqual(
      expect.arrayContaining([
        'my mum used to run the shop',
        'in the style of Gary Halbert — get yours.',
      ]),
    );
  });

  it('flags backstory-verb lines that are NOT in customer_backstory_verbatim', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(7, 'I learned from my old tailor that fabric weight matters.')] };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(1);
    expect(v[0]!.violation).toMatch(/backstory verb/i);
  });

  it('does NOT flag backstory-verb lines that ARE present in customer_backstory_verbatim (case-insensitive)', () => {
    const out = { ...BASE_AI_OUTPUT, calendar_plan: [withSlot(7, 'I LEARNED from my old tailor that fabric weight matters.')] };
    const backstory = 'i learned from my old tailor that fabric weight matters.';
    const v = auditFabrication(out, backstory);
    expect(v).toEqual([]);
  });

  it('returns violations for multiple slots without short-circuiting', () => {
    const out: AiOutput = {
      ...BASE_AI_OUTPUT,
      calendar_plan: [
        withSlot(1, 'My mum told me'),
        withSlot(2, 'fine hook'),
        withSlot(3, 'customer transformation'),
      ],
    };
    const v = auditFabrication(out, '');
    expect(v).toHaveLength(2);
    expect(v.map((x) => x.slot_index)).toEqual([1, 3]);
  });
});
