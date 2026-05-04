import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  FRAMEWORK_SLOTS,
  ARCHETYPE_SLOTS,
  NICHE_SLUGS,
  TIERS,
  TIER_COUNTS,
  AFFINITY_SCORES,
  type FrameworkSlot,
} from './v2';

describe('V2 canonical types', () => {
  it('exports exactly 25 framework slots', () => {
    expect(FRAMEWORK_SLOTS).toHaveLength(25);
  });

  it('exports exactly 25 archetype slots', () => {
    expect(ARCHETYPE_SLOTS).toHaveLength(25);
  });

  it('exports 7 niche slugs in canonical order', () => {
    expect(NICHE_SLUGS).toHaveLength(7);
    expect([...NICHE_SLUGS]).toEqual([
      'beauty', 'real_estate', 'fashion', 'fintech', 'health', 'food', 'education',
    ]);
  });

  it('TIER_COUNTS provides per-tier framework + archetype + video + carousel counts', () => {
    expect(TIER_COUNTS.starter).toEqual({ frameworks: 3, archetypes: 3, video_count: 7, carousel_count: 3 });
    expect(TIER_COUNTS.standard).toEqual({ frameworks: 5, archetypes: 5, video_count: 14, carousel_count: 7 });
    expect(TIER_COUNTS.calendar).toEqual({ frameworks: 8, archetypes: 8, video_count: 30, carousel_count: 14 });
  });

  it('TIER_COUNTS covers every tier in TIERS', () => {
    for (const tier of TIERS) {
      expect(TIER_COUNTS[tier]).toBeDefined();
    }
  });

  it('AFFINITY_SCORES preserves High > Med > Low ordering', () => {
    expect(AFFINITY_SCORES.High).toBeGreaterThan(AFFINITY_SCORES.Med);
    expect(AFFINITY_SCORES.Med).toBeGreaterThan(AFFINITY_SCORES.Low);
    expect(AFFINITY_SCORES.High).toBe(3);
    expect(AFFINITY_SCORES.Med).toBe(2);
    expect(AFFINITY_SCORES.Low).toBe(1);
  });

  it('framework slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of FRAMEWORK_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });

  it('archetype slot strings follow UPPER_SNAKE_CASE', () => {
    for (const slot of ARCHETYPE_SLOTS) {
      expect(slot).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
    }
  });

  it('FrameworkSlot type narrows to a member of FRAMEWORK_SLOTS', () => {
    const x: FrameworkSlot = 'DR_FORMULA';
    expect(FRAMEWORK_SLOTS).toContain(x);
  });
});

import type {
  PhotoBlock,
  BriefAnalyzerInput,
  PriorRunContext,
  AnalysisEdit,
  BuiltPrompt,
  ValidationFailure,
} from './v2';

describe('Phase 2 types', () => {
  it('PhotoBlock has base64 + mediaType + role', () => {
    const p: PhotoBlock = {
      role: 'reference',
      mediaType: 'image/jpeg',
      base64: 'AAAA',
    };
    expectTypeOf(p.role).toEqualTypeOf<'reference' | 'logo'>();
  });

  it('BriefAnalyzerInput carries the seven form steps + meta', () => {
    const b: BriefAnalyzerInput = {
      brief_id: '00000000-0000-0000-0000-000000000000',
      customer_id: '11111111-1111-1111-1111-111111111111',
      submitted_at_iso: '2026-05-04T09:00:00Z',
      submission_week_iso: '2026-W18',
      order_index: 1,
      tier: 'standard',
      niche_slug: 'fashion',
      niche_label: 'Fashion e-commerce',
      brand_name: 'Acme Ankara',
      owner_name: 'Akinwunmi',
      phone_e164: '+2348165799032',
      email: 'owner@example.com',
      one_line_description: 'Custom ankara dresses for Lagos professionals.',
      offer_description: 'Bespoke ankara womenswear, three-week turnaround.',
      price_point_band: 'NGN 80k–250k per piece',
      primary_audience_description: 'Lagos women, 28–45, established professionals.',
      audience_age_range: '28–45',
      audience_location: 'Lagos, Abuja',
      audience_belief: 'Custom takes too long and is unreliable.',
      audience_belief_target: 'Three-week guaranteed turnaround on bespoke is real.',
      logo_uploaded_yes_no: 'yes',
      brand_colours: 'rust, ivory, navy',
      instagram_handle: '@acmeankara',
      photo_count: 3,
      photo_consent_yes_no: 'yes',
      stated_voice: 'crafted, direct, no-nonsense',
      reference_posts_block: '',
      customer_backstory_verbatim: '',
      video_count: 14,
      carousel_count: 7,
    };
    expectTypeOf(b.tier).toEqualTypeOf<'starter' | 'standard' | 'calendar'>();
  });

  it('PriorRunContext links prior run + edits + founder note', () => {
    const p: PriorRunContext = {
      prior_run_id: '22222222-2222-2222-2222-222222222222',
      prior_run_index: 1,
      mode: 'new_frameworks',
      founder_note: 'The hooks were too generic — push for craft specifics.',
      edits: [
        {
          field_path: 'calendar_plan[0].hook',
          before: 'Five reasons our pieces last',
          after: '14 hours of hand-finishing — this is what that looks like',
        },
      ],
    };
    expectTypeOf(p.mode).toEqualTypeOf<'same_frameworks' | 'new_frameworks'>();
  });

  it('AnalysisEdit has field_path / before / after', () => {
    const e: AnalysisEdit = {
      field_path: 'brand_voice.voice_phrases[0]',
      before: 'timeless',
      after: 'crafted',
    };
    expectTypeOf(e.field_path).toEqualTypeOf<string>();
  });

  it('BuiltPrompt holds system + Anthropic-shaped messages', () => {
    const out: BuiltPrompt = {
      system: 'system text',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      ],
    };
    expectTypeOf(out.system).toEqualTypeOf<string>();
    expectTypeOf(out.messages).toEqualTypeOf<import('./v2').PromptUserMessage[]>();
  });

  it('ValidationFailure has all four reason variants', () => {
    // The const annotations below are the type test — TS rejects an unknown
    // reason literal or a missing reason-specific field at compile time.
    const a: ValidationFailure = { reason: 'malformed_json', detail: 'unexpected token' };
    const b: ValidationFailure = { reason: 'schema_mismatch', detail: 'shape', zodIssues: [] };
    const c: ValidationFailure = { reason: 'slot_count_mismatch', detail: '21 vs 10', expected: 10, actual: 21 };
    const d: ValidationFailure = { reason: 'unauthorized_slot', detail: 'AIDA used', offenders: ['framework:AIDA'] };
    expect([a, b, c, d].map((f) => f.reason)).toEqual([
      'malformed_json',
      'schema_mismatch',
      'slot_count_mismatch',
      'unauthorized_slot',
    ]);
  });
});
