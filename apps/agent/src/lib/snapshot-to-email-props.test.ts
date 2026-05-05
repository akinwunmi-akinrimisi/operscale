import { describe, it, expect } from 'vitest';
import { snapshotToEmailProps, TIER_DISPLAY } from './snapshot-to-email-props';
import type { SupersetOutput } from './types/v2.js';

const baseAi: SupersetOutput = {
  brand_voice: { voice_phrases: ['hand-finished'], sentence_rhythm: 'short_punchy', avoid_words: [], energy_register: 'calm', voice_corpus_quality: 'thick' },
  specificity_inventory: { numbers: ['14 hours'], proper_nouns: ['Lagos'], process_steps: ['hand-finishing'], specificity_corpus_quality: 'thick' },
  expertise_map: [],
  visual_aesthetic: { lighting: 'natural daylight', setting: 'studio in Lekki', wardrobe_props: 'ankara fabric rolls', photo_quality_summary: 'clean, well-lit', photos_present: false },
  calendar_plan: [
    { slot_index: 1, day: 1, format: 'ugc_30s', framework_slot: 'AIDA', archetype_slot: 'QUALITY_MOMENT', topic: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', core_beats: ['Three weeks. Not six. Three.', 'Hand-finishing on every seam', 'Lekki studio'], cta: 'Book a fitting', fabrication_risk_check: 'passed' },
    { slot_index: 2, day: 2, format: 'ugc_30s', framework_slot: 'PAS',  archetype_slot: 'PROCESS_TOUR',   topic: 'Inside the hand-finishing process', hook: 'Why your last ankara dress fell apart', core_beats: ['Cheap thread', 'Wrong wash temperature', 'How we differ'], cta: 'See the workshop', fabrication_risk_check: 'passed' },
    { slot_index: 3, day: 3, format: 'ugc_60s', framework_slot: 'COST_REVEAL', archetype_slot: 'OUTCOME_SHOWCASE', topic: 'Real customer outcome', hook: 'She wore this to her promotion dinner', core_beats: ['Brief', 'Fitting', 'Final piece'], cta: 'Submit your brief', fabrication_risk_check: 'passed' },
  ],
  fabrication_audit: { lines_checked: 3, violations_found: [], audit_passed: true },
  flags_for_review: [],
  brief_summary: 'Bespoke ankara tailoring with three-week guaranteed turnaround for Lagos professionals.',
  upsell_recommendation: { should_upsell: false, recommended_tier: null, reasoning: '', upsell_price_delta: 0 },
  estimated_brief_quality_score: 0.82,
};

const baseOrder = { id: 'order-1', tier: 'standard' as const, amount_ngn: 150_000, customer_id: 'cust-1', brief_id: 'brief-1' };
const baseCustomer = { full_name: 'Tola Adekunle', email: 'tola@example.com' };
const paymentLink = 'https://checkout.paystack.com/abc123';

describe('snapshotToEmailProps', () => {
  it('maps the happy path: standard tier, no photos, no upsell', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, baseCustomer, paymentLink);
    expect(props.firstName).toBe('Tola');
    expect(props.briefSummary).toBe(baseAi.brief_summary);
    expect(props.angles).toHaveLength(3);
    expect(props.angles[0]).toEqual({ title: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', whyItFits: 'Three weeks. Not six. Three.' });
    expect(props.scriptSeed).toEqual({ topic: 'Three-week turnaround', openingHook: 'You think bespoke means waiting six weeks?', outline: ['Three weeks. Not six. Three.', 'Hand-finishing on every seam', 'Lekki studio'] });
    expect(props.visualStyle.recommendedCameraTreatment).toBe('natural daylight; studio in Lekki; ankara fabric rolls');
    expect(props.photoAesthetic).toBeNull();
    expect(props.upsell).toBeNull();
    expect(props.tierName).toBe(TIER_DISPLAY.standard.tierName);
    expect(props.videoCount).toBe(14);
    expect(props.carouselCount).toBe(7);
    expect(props.ugcCount).toBe(TIER_DISPLAY.standard.ugcCount);
    expect(props.t2vCount).toBe(TIER_DISPLAY.standard.t2vCount);
    expect(props.priceNgn).toBe(150_000);
    expect(props.paymentLink).toBe(paymentLink);
    expect(props.founderName).toBe('Akinwunmi'); // env fallback default
    expect(props.brandName).toBe('Operscale');
  });

  it('renders photos block when visual_aesthetic.photos_present', () => {
    const ai = { ...baseAi, visual_aesthetic: { ...baseAi.visual_aesthetic, photos_present: true, photo_quality_summary: 'sharp, well-lit, founder visible' } };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.photoAesthetic).toEqual({ recommendedAvatarTreatment: 'sharp, well-lit, founder visible' });
  });

  it('renders upsell block when should_upsell + recommended_tier', () => {
    const ai = { ...baseAi, upsell_recommendation: { should_upsell: true, recommended_tier: 'calendar' as const, reasoning: 'Audience belief gap is wide; calendar tier gives 30 videos to drill.', upsell_price_delta: 200_000 } };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.upsell).toEqual({
      recommendedTier: TIER_DISPLAY.calendar.tierName,
      reasoning: 'Audience belief gap is wide; calendar tier gives 30 videos to drill.',
      priceDeltaNgn: 200_000,
      recommendedTierPriceNgn: TIER_DISPLAY.calendar.priceNgn,
    });
  });

  it('skips upsell block when should_upsell true but recommended_tier null', () => {
    const ai = { ...baseAi, upsell_recommendation: { should_upsell: true, recommended_tier: null, reasoning: 'Mismatch', upsell_price_delta: 0 } };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.upsell).toBeNull();
  });

  it('falls back to "there" when full_name is null', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, { full_name: null, email: 'x@y.z' }, paymentLink);
    expect(props.firstName).toBe('there');
  });

  it('falls back to "there" when full_name is empty string', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, { full_name: '   ', email: 'x@y.z' }, paymentLink);
    expect(props.firstName).toBe('there');
  });

  it('takes first whitespace-split token as firstName', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, { full_name: 'Mary-Jane Watson Smith', email: 'x@y.z' }, paymentLink);
    expect(props.firstName).toBe('Mary-Jane');
  });

  it('uses cta as whyItFits fallback when core_beats is empty', () => {
    const ai = { ...baseAi, calendar_plan: [
      { ...baseAi.calendar_plan[0]!, core_beats: [] as string[] },
      ...baseAi.calendar_plan.slice(1),
    ] as typeof baseAi.calendar_plan };
    const props = snapshotToEmailProps({ ai_output: ai }, baseOrder, baseCustomer, paymentLink);
    expect(props.angles[0]!.whyItFits).toBe(ai.calendar_plan[0]!.cta);
  });

  it('maps starter tier counts and price', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, { ...baseOrder, tier: 'starter', amount_ngn: TIER_DISPLAY.starter.priceNgn }, baseCustomer, paymentLink);
    expect(props.videoCount).toBe(7);
    expect(props.carouselCount).toBe(3);
    expect(props.tierName).toBe(TIER_DISPLAY.starter.tierName);
  });

  it('captionStyle is derived from brand_voice rhythm + register', () => {
    const props = snapshotToEmailProps({ ai_output: baseAi }, baseOrder, baseCustomer, paymentLink);
    expect(props.visualStyle.recommendedCaptionStyle).toMatch(/short, punchy/i);
    expect(props.visualStyle.recommendedCaptionStyle).toMatch(/calm/i);
  });
});
