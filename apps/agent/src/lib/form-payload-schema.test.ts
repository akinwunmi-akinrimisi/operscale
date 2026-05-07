import { describe, expect, it } from 'vitest';
import {
  Step1Schema,
  Step2Schema,
  Step3Schema,
  Step4Schema,
  Step6Schema,
  SaveBodySchema,
  SubmitBodySchema,
  FullFormPayloadSchema,
  generateSaveToken,
  BRIEF_SESSION_COOKIE,
  briefSessionCookieAttributes,
} from './form-payload-schema';

describe('Step1Schema', () => {
  it('accepts the three valid tiers', () => {
    expect(Step1Schema.parse({ tier_intent: 'starter' }).tier_intent).toBe('starter');
    expect(Step1Schema.parse({ tier_intent: 'standard' }).tier_intent).toBe('standard');
    expect(Step1Schema.parse({ tier_intent: 'calendar' }).tier_intent).toBe('calendar');
  });
  it('rejects invalid tiers', () => {
    expect(() => Step1Schema.parse({ tier_intent: 'pro' })).toThrow();
    expect(() => Step1Schema.parse({ tier_intent: 'STARTER' })).toThrow();
  });
});

describe('Step2Schema', () => {
  const valid = {
    brand_name: 'Akin Tailoring',
    owner_name: 'Akin O',
    phone_e164: '+2348012345678',
    email: 'akin@example.com',
    niche_slug: 'fashion-ecom',
    niche_label: 'Fashion / e-commerce',
    one_line_description: 'Bespoke menswear in Lagos.',
    offer_description: 'Hand-stitched Ankara suits, made-to-measure within 14 days.',
    price_point_band: '25k_100k' as const,
  };
  it('accepts a complete payload', () => {
    expect(() => Step2Schema.parse(valid)).not.toThrow();
  });
  it('rejects malformed phone (no +)', () => {
    expect(() => Step2Schema.parse({ ...valid, phone_e164: '2348012345678' })).toThrow();
  });
  it('rejects malformed phone (leading 0)', () => {
    expect(() => Step2Schema.parse({ ...valid, phone_e164: '+02348012345678' })).toThrow();
  });
  it('rejects too-short one_line_description', () => {
    expect(() => Step2Schema.parse({ ...valid, one_line_description: 'short' })).toThrow();
  });
  it('rejects unknown price_point_band', () => {
    expect(() => Step2Schema.parse({ ...valid, price_point_band: 'free' })).toThrow();
  });
});

describe('Step3Schema', () => {
  it('accepts a complete payload', () => {
    expect(() =>
      Step3Schema.parse({
        primary_audience_description: 'Young professionals 25-35 in Lagos.',
        audience_age_range: '25-35',
        audience_location: 'Lagos, Nigeria',
        audience_belief: "They think bespoke is too expensive.",
        audience_belief_target: 'Bespoke at ready-to-wear prices is possible.',
      }),
    ).not.toThrow();
  });
});

describe('Step4Schema', () => {
  it('accepts the minimum (required logo flag only)', () => {
    expect(() => Step4Schema.parse({ logo_uploaded_yes_no: 'yes' })).not.toThrow();
  });
  it('accepts optional fields populated', () => {
    expect(() =>
      Step4Schema.parse({
        logo_uploaded_yes_no: 'no',
        brand_colours: '#0F172A, off-white',
        instagram_handle: '@akin_tailors',
      }),
    ).not.toThrow();
  });
});

describe('Step6Schema (verbatim discipline)', () => {
  it('preserves byte-for-byte content including newlines, smart quotes, emojis', () => {
    const verbatim = 'I started this in 2019.\n\nMy grandfather was a tailor — “the best” — and I 🪡 carry his work forward.';
    const parsed = Step6Schema.parse({
      stated_voice: 'Warm but precise.',
      reference_posts_block: 'Reference 1\nhttps://instagram.com/p/abc\nGood post about durability.',
      customer_backstory_verbatim: verbatim,
    });
    // Critical assertion: parsing does NOT mutate the string.
    expect(parsed.customer_backstory_verbatim).toBe(verbatim);
    expect(parsed.customer_backstory_verbatim.length).toBe(verbatim.length);
  });
  it('accepts empty backstory and empty references (per customer-journey.md §2.4: "may be empty")', () => {
    expect(() =>
      Step6Schema.parse({
        stated_voice: 'Friendly.',
        reference_posts_block: '',
        customer_backstory_verbatim: '',
      }),
    ).not.toThrow();
  });
});

describe('SaveBodySchema discriminated union', () => {
  it('routes step=1 through Step1 schema', () => {
    const parsed = SaveBodySchema.parse({
      step: 1,
      payload: { tier_intent: 'standard' },
    });
    expect(parsed.step).toBe(1);
    if (parsed.step === 1) expect(parsed.payload.tier_intent).toBe('standard');
  });
  it('rejects step=2 without brief_id', () => {
    expect(() =>
      SaveBodySchema.parse({
        step: 2,
        payload: {
          brand_name: 'X',
          owner_name: 'Y',
          phone_e164: '+2348012345678',
          email: 'a@b.co',
          niche_slug: 's',
          niche_label: 'l',
          one_line_description: 'a description that meets length',
          offer_description: 'an offer description that meets length',
          price_point_band: '25k_100k',
        },
      }),
    ).toThrow();
  });
  it('rejects unknown step number', () => {
    expect(() => SaveBodySchema.parse({ step: 9, payload: {} })).toThrow();
  });
});

describe('SubmitBodySchema', () => {
  it('accepts a 64-char hex hash', () => {
    expect(() =>
      SubmitBodySchema.parse({
        brief_id: '11111111-1111-4111-a111-111111111111',
        customer_id: '22222222-2222-4222-a222-222222222222',
        terms_consent_text_version: 'v1',
        terms_consent_text_hash: 'a'.repeat(64),
      }),
    ).not.toThrow();
  });
  it('rejects uppercase hex', () => {
    expect(() =>
      SubmitBodySchema.parse({
        brief_id: '11111111-1111-4111-a111-111111111111',
        customer_id: '22222222-2222-4222-a222-222222222222',
        terms_consent_text_version: 'v1',
        terms_consent_text_hash: 'A'.repeat(64),
      }),
    ).toThrow();
  });
  it('rejects wrong-length hash', () => {
    expect(() =>
      SubmitBodySchema.parse({
        brief_id: '11111111-1111-4111-a111-111111111111',
        customer_id: '22222222-2222-4222-a222-222222222222',
        terms_consent_text_version: 'v1',
        terms_consent_text_hash: 'a'.repeat(63),
      }),
    ).toThrow();
  });
});

describe('FullFormPayloadSchema (submit-time validator)', () => {
  it('accepts a complete payload with optional Step4 fields omitted', () => {
    expect(() =>
      FullFormPayloadSchema.parse({
        // Step 1
        tier_intent: 'standard',
        // Step 2
        brand_name: 'Akin Tailoring',
        owner_name: 'Akin O',
        phone_e164: '+2348012345678',
        email: 'akin@example.com',
        niche_slug: 'fashion-ecom',
        niche_label: 'Fashion',
        one_line_description: 'Bespoke menswear in Lagos.',
        offer_description: 'Hand-stitched Ankara suits, MTM 14 days.',
        price_point_band: '25k_100k',
        // Step 3
        primary_audience_description: 'Young professionals 25-35 in Lagos.',
        audience_age_range: '25-35',
        audience_location: 'Lagos, Nigeria',
        audience_belief: "Bespoke is too expensive.",
        audience_belief_target: 'Bespoke at RTW prices is possible.',
        // Step 4 — partial allowed
        // Step 6
        stated_voice: 'Warm but precise.',
        reference_posts_block: 'Reference 1...',
        customer_backstory_verbatim: '',
      }),
    ).not.toThrow();
  });
  it('rejects when a Step 1-3 or Step 6 key is missing', () => {
    expect(() =>
      FullFormPayloadSchema.parse({
        tier_intent: 'standard',
        // brand_name missing
        owner_name: 'Akin',
        phone_e164: '+2348012345678',
        email: 'a@b.co',
        niche_slug: 'x',
        niche_label: 'X',
        one_line_description: 'short description that fits',
        offer_description: 'a longer offer description',
        price_point_band: '25k_100k',
        primary_audience_description: 'long enough audience desc',
        audience_age_range: '25-35',
        audience_location: 'Lagos',
        audience_belief: 'long enough belief text',
        audience_belief_target: 'long enough target text',
        stated_voice: 'OK',
        reference_posts_block: '',
        customer_backstory_verbatim: '',
      }),
    ).toThrow();
  });
});

describe('generateSaveToken', () => {
  it('produces exactly 24 URL-safe characters', () => {
    for (let i = 0; i < 50; i++) {
      const t = generateSaveToken();
      expect(t).toHaveLength(24);
      expect(t).toMatch(/^[A-Za-z0-9_-]{24}$/);
    }
  });
  it('produces unique tokens', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateSaveToken());
    expect(seen.size).toBe(200);
  });
});

describe('briefSessionCookieAttributes', () => {
  it('uses the expected name', () => {
    expect(briefSessionCookieAttributes().name).toBe(BRIEF_SESSION_COOKIE);
  });
  it('has the security flags + domain scope expected by Phase 6.1', () => {
    const a = briefSessionCookieAttributes().attributes;
    expect(a).toMatch(/HttpOnly/);
    expect(a).toMatch(/Secure/);
    expect(a).toMatch(/SameSite=Lax/);
    expect(a).toMatch(/Domain=\.operscale\.cloud/);
    expect(a).toMatch(/Path=\//);
    expect(a).toMatch(/Max-Age=\d+/);
  });
});
