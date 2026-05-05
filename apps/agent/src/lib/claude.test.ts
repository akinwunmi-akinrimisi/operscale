import { describe, it, expect, vi } from 'vitest';
import { createBriefAnalyzer } from './claude';
import type { BankCatalog, BriefAnalyzerInput, FrameworkSeedResult, PriorRunContext } from './types/v2';

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

describe('createBriefAnalyzer (re-analysis)', () => {
  it('passes priorSeed through to selectFrameworksForBrief on same_frameworks trigger', async () => {
    const catalog = makeMinimalCatalog();
    const priorSeed: FrameworkSeedResult = {
      seed_hash: 'prior',
      seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
      selected_frameworks: ['VALUE_EQUATION', 'PAIPS', 'AIDA'],
      selected_archetypes: ['WHAT_YOU_GET', 'TIER_COMPARISON', 'PRODUCT_TOUR'],
      selected_pairs: [
        { framework: 'VALUE_EQUATION', archetype: 'WHAT_YOU_GET', affinity: 9 },
        { framework: 'PAIPS', archetype: 'TIER_COMPARISON', affinity: 9 },
        { framework: 'AIDA', archetype: 'PRODUCT_TOUR', affinity: 9 },
      ],
      exhaustion_warning: false,
      lru_fallback_used: false,
    };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    let observedLayer3 = '';
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          observedLayer3 = req.messages[1]?.content?.[0]?.text ?? '';
          return makeFakeAnthropicResponse(priorSeed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const prior: PriorRunContext = {
      prior_run_id: 'prior',
      prior_run_index: 1,
      mode: 'same_frameworks',
      founder_note: 'tighten',
      edits: [],
    };
    const result = await analyzer.analyze({
      brief: SAMPLE_BRIEF,
      photos: [],
      trigger_type: 're_analyze_same_frameworks',
      prior,
      priorSeed,
    });
    expect(result.ok).toBe(true);
    expect(observedLayer3).toContain('### VALUE_EQUATION');
    expect(observedLayer3).toContain('### PAIPS');
  });

  it('returns ok=false reason=photo_missing when a photo has empty base64', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const client = { messages: { create: vi.fn() } };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({
      brief: { ...SAMPLE_BRIEF, photo_count: 1 },
      photos: [{ role: 'reference', mediaType: 'image/jpeg', base64: '   ' }],
      trigger_type: 'initial',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('photo_missing');
    }
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it('returns ok=false reason=niche_brief_missing when catalog has no entry for the brief\'s niche', async () => {
    const catalog: BankCatalog = { ...makeMinimalCatalog(), niches: {} as BankCatalog['niches'] };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const client = { messages: { create: vi.fn() } };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({
      brief: SAMPLE_BRIEF,
      photos: [],
      trigger_type: 'initial',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('niche_brief_missing');
    }
  });
});

describe('createBriefAnalyzer (retry policy)', () => {
  it('retries on a 503 and succeeds on the second attempt', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    let attempt = 0;
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          attempt++;
          if (attempt === 1) {
            const err: any = new Error('503 service unavailable');
            err.status = 503;
            throw err;
          }
          const layer3 = req.messages[1]?.content?.[0]?.text ?? '';
          const fwMatches = [...layer3.matchAll(/### (DR_FORMULA|PAS|AIDA|PAIPS|VALUE_EQUATION)/g)].map((m) => m[1]);
          const aMatches = [...layer3.matchAll(/### (PRICING_BREAKDOWN|SERVICE_ANATOMY|PRODUCT_TOUR|TIER_COMPARISON|WHAT_YOU_GET)/g)].map((m) => m[1]);
          const seed = {
            seed_hash: 'h',
            seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
            selected_frameworks: [...new Set(fwMatches)],
            selected_archetypes: [...new Set(aMatches)],
            selected_pairs: [...new Set(fwMatches)].map((f, i) => ({ framework: f, archetype: [...new Set(aMatches)][i % aMatches.length], affinity: 9 })),
            exhaustion_warning: false,
            lru_fallback_used: false,
          } as FrameworkSeedResult;
          return makeFakeAnthropicResponse(seed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });
    expect(result.ok).toBe(true);
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    if (result.ok) expect(result.telemetry.attempt_count).toBe(2);
  });

  it('returns reason=claude_5xx_max_retries after 5 consecutive 5xx errors', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async () => {
          const err: any = new Error('502 bad gateway');
          err.status = 502;
          throw err;
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('claude_5xx_max_retries');
    expect(client.messages.create).toHaveBeenCalledTimes(5);
  }, 60_000);

  it('returns reason=claude_4xx on a non-retryable 400 immediately (no retries)', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async () => {
          const err: any = new Error('400 invalid_request_error');
          err.status = 400;
          throw err;
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('claude_4xx');
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it('retries once on validation_failed with addendum, then accepts on second attempt', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    let attempt = 0;
    const observedLayer4Lengths: number[] = [];
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          attempt++;
          observedLayer4Lengths.push(req.messages[2]?.content?.[0]?.text?.length ?? 0);
          const layer3 = req.messages[1]?.content?.[0]?.text ?? '';
          const fwMatches = [...layer3.matchAll(/### (DR_FORMULA|PAS|AIDA|PAIPS|VALUE_EQUATION)/g)].map((m) => m[1]);
          const aMatches = [...layer3.matchAll(/### (PRICING_BREAKDOWN|SERVICE_ANATOMY|PRODUCT_TOUR|TIER_COMPARISON|WHAT_YOU_GET)/g)].map((m) => m[1]);
          const seed = {
            seed_hash: 'h',
            seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
            selected_frameworks: [...new Set(fwMatches)],
            selected_archetypes: [...new Set(aMatches)],
            selected_pairs: [...new Set(fwMatches)].map((f, i) => ({ framework: f, archetype: [...new Set(aMatches)][i % aMatches.length], affinity: 9 })),
            exhaustion_warning: false,
            lru_fallback_used: false,
          } as FrameworkSeedResult;
          if (attempt === 1) {
            return { content: [{ type: 'text', text: 'this is not json' }], usage: { input_tokens: 1000, output_tokens: 5 } };
          }
          return makeFakeAnthropicResponse(seed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });
    expect(result.ok).toBe(true);
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(observedLayer4Lengths[1]!).toBeGreaterThan(observedLayer4Lengths[0]!);
    const secondLayer4 = client.messages.create.mock.calls[1][0].messages[2].content[0].text;
    expect(secondLayer4).toMatch(/previous output was malformed|prior attempt failed validation/i);
  });
});

describe('createBriefAnalyzer (llm_calls telemetry)', () => {
  it('inserts an llm_calls row on a successful single-attempt call', async () => {
    const catalog = makeMinimalCatalog();
    const inserts: any[] = [];
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'customer_framework_history') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {
          insert: vi.fn().mockImplementation(async (row: any) => {
            inserts.push({ table, row });
            return { error: null };
          }),
        };
      }),
    };
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          const layer3 = req.messages[1]?.content?.[0]?.text ?? '';
          const fwMatches = [...layer3.matchAll(/### (DR_FORMULA|PAS|AIDA|PAIPS|VALUE_EQUATION)/g)].map((m) => m[1]);
          const aMatches = [...layer3.matchAll(/### (PRICING_BREAKDOWN|SERVICE_ANATOMY|PRODUCT_TOUR|TIER_COMPARISON|WHAT_YOU_GET)/g)].map((m) => m[1]);
          const seed = {
            seed_hash: 'h',
            seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
            selected_frameworks: [...new Set(fwMatches)],
            selected_archetypes: [...new Set(aMatches)],
            selected_pairs: [...new Set(fwMatches)].map((f, i) => ({ framework: f, archetype: [...new Set(aMatches)][i % aMatches.length], affinity: 9 })),
            exhaustion_warning: false,
            lru_fallback_used: false,
          } as FrameworkSeedResult;
          return makeFakeAnthropicResponse(seed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });

    const llmCallInserts = inserts.filter((i) => i.table === 'llm_calls');
    expect(llmCallInserts).toHaveLength(1);
    const row = llmCallInserts[0].row;
    expect(row.brief_id).toBe(SAMPLE_BRIEF.brief_id);
    expect(row.analysis_run_id).toBeNull();
    expect(row.model).toBe('claude-opus-4-7');
    expect(row.input_tokens).toBe(1000);
    expect(row.output_tokens).toBe(500);
    expect(row.cost_usd).toBeGreaterThan(0);
    expect(row.duration_ms).toBeGreaterThanOrEqual(0);
    expect(row.http_status).toBe(200);
    expect(row.error_detail).toBeNull();
  });

  it('inserts ONE llm_calls row per attempt — including failed 5xx attempts', async () => {
    const catalog = makeMinimalCatalog();
    const inserts: any[] = [];
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'customer_framework_history') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return {
          insert: vi.fn().mockImplementation(async (row: any) => {
            inserts.push({ table, row });
            return { error: null };
          }),
        };
      }),
    };
    let attempt = 0;
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          attempt++;
          if (attempt < 3) {
            const err: any = new Error('503 service unavailable');
            err.status = 503;
            throw err;
          }
          const layer3 = req.messages[1]?.content?.[0]?.text ?? '';
          const fwMatches = [...layer3.matchAll(/### (DR_FORMULA|PAS|AIDA|PAIPS|VALUE_EQUATION)/g)].map((m) => m[1]);
          const aMatches = [...layer3.matchAll(/### (PRICING_BREAKDOWN|SERVICE_ANATOMY|PRODUCT_TOUR|TIER_COMPARISON|WHAT_YOU_GET)/g)].map((m) => m[1]);
          const seed = {
            seed_hash: 'h',
            seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
            selected_frameworks: [...new Set(fwMatches)],
            selected_archetypes: [...new Set(aMatches)],
            selected_pairs: [...new Set(fwMatches)].map((f, i) => ({ framework: f, archetype: [...new Set(aMatches)][i % aMatches.length], affinity: 9 })),
            exhaustion_warning: false,
            lru_fallback_used: false,
          } as FrameworkSeedResult;
          return makeFakeAnthropicResponse(seed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });

    const llmCallInserts = inserts.filter((i) => i.table === 'llm_calls');
    expect(llmCallInserts).toHaveLength(3);
    expect(llmCallInserts[0].row.http_status).toBe(503);
    expect(llmCallInserts[1].row.http_status).toBe(503);
    expect(llmCallInserts[2].row.http_status).toBe(200);
    expect(llmCallInserts[0].row.error_detail).toBeTruthy();
    expect(llmCallInserts[2].row.error_detail).toBeNull();
  });

  it('does NOT throw if llm_calls insert fails (best-effort)', async () => {
    const catalog = makeMinimalCatalog();
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'customer_framework_history') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: { message: 'simulated llm_calls insert failure' } }) };
      }),
    };
    const client = {
      messages: {
        create: vi.fn().mockImplementation(async (req: any) => {
          const layer3 = req.messages[1]?.content?.[0]?.text ?? '';
          const fwMatches = [...layer3.matchAll(/### (DR_FORMULA|PAS|AIDA|PAIPS|VALUE_EQUATION)/g)].map((m) => m[1]);
          const aMatches = [...layer3.matchAll(/### (PRICING_BREAKDOWN|SERVICE_ANATOMY|PRODUCT_TOUR|TIER_COMPARISON|WHAT_YOU_GET)/g)].map((m) => m[1]);
          const seed = {
            seed_hash: 'h',
            seed_inputs: { customer_id: SAMPLE_BRIEF.customer_id, niche: 'fashion', order_index: 1, submission_week_iso: '2026-W18' },
            selected_frameworks: [...new Set(fwMatches)],
            selected_archetypes: [...new Set(aMatches)],
            selected_pairs: [...new Set(fwMatches)].map((f, i) => ({ framework: f, archetype: [...new Set(aMatches)][i % aMatches.length], affinity: 9 })),
            exhaustion_warning: false,
            lru_fallback_used: false,
          } as FrameworkSeedResult;
          return makeFakeAnthropicResponse(seed, 10);
        }),
      },
    };
    const logger = { info: vi.fn(), error: vi.fn() };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase: supabase as any, catalog, logger });
    const result = await analyzer.analyze({ brief: SAMPLE_BRIEF, photos: [], trigger_type: 'initial' });
    expect(result.ok).toBe(true);
  });
});
