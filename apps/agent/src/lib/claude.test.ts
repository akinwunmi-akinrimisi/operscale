import { describe, it, expect, vi } from 'vitest';
import { createBriefAnalyzer } from './claude';
import type { BankCatalog, BriefAnalyzerInput, FrameworkSeedResult } from './types/v2';

const SAMPLE_BRIEF: BriefAnalyzerInput = {
  brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  submitted_at_iso: '2026-05-04T09:00:00Z',
  submission_week_iso: '2026-W18',
  order_index: 1,
  tier: 'starter',
  niche_slug: 'fashion',
  niche_label: 'Fashion e-commerce',
  brand_name: 'Test Studio',
  owner_name: 'Test',
  phone_e164: '+2348000000000',
  email: 't@example.com',
  one_line_description: 'desc',
  offer_description: 'offer',
  price_point_band: 'NGN 80k',
  primary_audience_description: 'Lagos women 28-45',
  audience_age_range: '28-45',
  audience_location: 'Lagos',
  audience_belief: 'belief',
  audience_belief_target: 'target',
  logo_uploaded_yes_no: 'no',
  brand_colours: 'rust',
  instagram_handle: '@t',
  photo_count: 0,
  photo_consent_yes_no: 'no',
  stated_voice: 'crafted',
  reference_posts_block: '',
  customer_backstory_verbatim: '',
  video_count: 7,
  carousel_count: 3,
};

function makeMinimalCatalog(): BankCatalog {
  const niches: BankCatalog['niches'] = {
    beauty: '#', real_estate: '#', fashion: '# fashion', fintech: '#',
    health: '#', food: '#', education: '#',
  } as BankCatalog['niches'];
  const slotsF = ['DR_FORMULA', 'PAS', 'AIDA', 'PAIPS', 'VALUE_EQUATION'] as const;
  const slotsA = ['PRICING_BREAKDOWN', 'SERVICE_ANATOMY', 'PRODUCT_TOUR', 'TIER_COMPARISON', 'WHAT_YOU_GET'] as const;
  const frameworks = Object.fromEntries(
    slotsF.map((s) => [
      s,
      {
        slot: s, name: s.replace('_', ' '), family: 'Family A — Direct response',
        markdown: `### ${s}\n\nSample.`,
        affinity: { beauty: 'High', real_estate: 'High', fashion: 'High', fintech: 'High', health: 'High', food: 'High', education: 'High' },
      },
    ]),
  );
  const archetypes = Object.fromEntries(
    slotsA.map((s) => [
      s,
      {
        slot: s, name: s, family: 'Family A — Customer-stated facts',
        markdown: `### ${s}\n\nSample.`,
        affinity: { beauty: 'High', real_estate: 'High', fashion: 'High', fintech: 'High', health: 'High', food: 'High', education: 'High' },
      },
    ]),
  );
  return { frameworks, archetypes, niches } as BankCatalog;
}

function makeFakeAnthropicResponse(seed: FrameworkSeedResult, slots: number) {
  const calendar_plan = Array.from({ length: slots }, (_, idx) => {
    const pair = seed.selected_pairs[idx % seed.selected_pairs.length]!;
    return {
      slot_index: idx + 1,
      day: idx + 1,
      format: idx < 7 ? 'ugc_30s' : 'carousel',
      framework_slot: pair.framework,
      archetype_slot: pair.archetype,
      topic: 'topic',
      hook: 'hook',
      core_beats: ['beat'],
      cta: 'cta',
      fabrication_risk_check: 'passed',
    };
  });
  const ai = {
    brand_voice: { voice_phrases: ['v'], sentence_rhythm: 'mid_length', avoid_words: [], energy_register: 'authoritative', voice_corpus_quality: 'thick' },
    specificity_inventory: { numbers: [], proper_nouns: [], process_steps: [], specificity_corpus_quality: 'thick' },
    expertise_map: [],
    visual_aesthetic: { lighting: '', setting: '', wardrobe_props: '', photo_quality_summary: '', photos_present: false },
    calendar_plan,
    fabrication_audit: { lines_checked: 0, violations_found: [], audit_passed: true },
    flags_for_review: [],
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(ai) }],
    usage: { input_tokens: 1000, output_tokens: 500 },
  };
}

describe('createBriefAnalyzer (skeleton)', () => {
  it('returns ok=true on the happy path: select → build → call → validate → audit → post-process', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    let messageCreateCalls = 0;
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          messageCreateCalls++;
          const dummySeed: FrameworkSeedResult = {
            seed_hash: 'h',
            seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
            selected_frameworks: ['DR_FORMULA', 'PAS', 'AIDA'],
            selected_archetypes: ['PRICING_BREAKDOWN', 'SERVICE_ANATOMY', 'PRODUCT_TOUR'],
            selected_pairs: [
              { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', affinity: 9 },
              { framework: 'PAS', archetype: 'SERVICE_ANATOMY', affinity: 9 },
              { framework: 'AIDA', archetype: 'PRODUCT_TOUR', affinity: 9 },
            ],
            exhaustion_warning: false,
            lru_fallback_used: false,
          };
          const layer3 = req.messages[1]?.content?.[0]?.text ?? '';
          const fwMatches = [...layer3.matchAll(/### (DR_FORMULA|PAS|AIDA|PAIPS|VALUE_EQUATION)/g)].map((m) => m[1]);
          const aMatches = [...layer3.matchAll(/### (PRICING_BREAKDOWN|SERVICE_ANATOMY|PRODUCT_TOUR|TIER_COMPARISON|WHAT_YOU_GET)/g)].map((m) => m[1]);
          const seed: FrameworkSeedResult = {
            ...dummySeed,
            selected_frameworks: [...new Set(fwMatches)],
            selected_archetypes: [...new Set(aMatches)],
            selected_pairs: [...new Set(fwMatches)].map((f, i) => ({ framework: f, archetype: [...new Set(aMatches)][i % aMatches.length], affinity: 9 })) as any,
          };
          return makeFakeAnthropicResponse(seed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({
      brief: SAMPLE_BRIEF,
      photos: [],
      trigger_type: 'initial',
    });
    expect(result.ok).toBe(true);
    expect(messageCreateCalls).toBe(1);
    if (result.ok) {
      expect(result.superset.calendar_plan).toHaveLength(10);
      expect(result.telemetry.input_tokens).toBe(1000);
      expect(result.telemetry.output_tokens).toBe(500);
      expect(result.superset.calendar_plan.every(s => typeof s.framework_slot === 'string' && s.framework_slot.length > 0)).toBe(true);
      expect(result.superset.calendar_plan.every(s => typeof s.archetype_slot === 'string' && s.archetype_slot.length > 0)).toBe(true);
    }
  });

  it('returns ok=false reason=schema_mismatch when Claude emits invalid JSON shape', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"brand_voice": null}' }],
          usage: { input_tokens: 100, output_tokens: 5 },
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({
      brief: SAMPLE_BRIEF,
      photos: [],
      trigger_type: 'initial',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['schema_mismatch', 'malformed_json', 'slot_count_mismatch', 'unauthorized_slot']).toContain(result.failure.reason);
    }
  });
});
