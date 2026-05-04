import { describe, it, expect } from 'vitest';
import { renderLayer1, renderLayer2Text } from './prompt-builder';
import type { BriefAnalyzerInput } from './types/v2';

describe('renderLayer1', () => {
  it('returns the system framing as a non-empty string', () => {
    const out = renderLayer1();
    expect(out.length).toBeGreaterThan(500);
  });

  it('opens with the role definition from ai-brief-analysis.md §3.1', () => {
    const out = renderLayer1();
    expect(out).toMatch(/^You are a senior content strategist at a Lagos-based SMB content agency\./);
  });

  it('encodes the three rules in order', () => {
    const out = renderLayer1();
    const r1 = out.indexOf('RULE 1 — NO FABRICATION.');
    const r2 = out.indexOf('RULE 2 — FRAMEWORKS BY NAME OF FRAMEWORK, NOT BY NAME OF MARKETER.');
    const r3 = out.indexOf('RULE 3 — DETERMINISTIC SELECTION.');
    expect(r1).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });

  it('forbids prose preamble around the JSON', () => {
    const out = renderLayer1();
    expect(out).toContain('No prose outside the JSON');
    expect(out).toContain('No preamble');
    expect(out).toContain('Just the JSON object.');
  });

  it('is stable across calls (pure function)', () => {
    expect(renderLayer1()).toEqual(renderLayer1());
  });
});

const SAMPLE_BRIEF: BriefAnalyzerInput = {
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
  reference_posts_block: '— Post 1: "14 hours of hand-finishing per piece..."',
  customer_backstory_verbatim: '',
  video_count: 14,
  carousel_count: 7,
};

const SAMPLE_NICHE_BRIEF = '# Niche brief: Fashion (test)\n\nFashion is craft-substantiated.';

describe('renderLayer2Text', () => {
  it('starts with the # CUSTOMER CORPUS header', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('# CUSTOMER CORPUS');
  });

  it('substitutes step 1 fields (brand, owner, phone, email)', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Brand name: Acme Ankara');
    expect(out).toContain('- Owner name: Akinwunmi');
    expect(out).toContain('- WhatsApp: +2348165799032');
    expect(out).toContain('- Email: owner@example.com');
  });

  it('substitutes step 2 fields (niche slug + label, offer, price band)', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Niche: fashion (Fashion e-commerce)');
    expect(out).toContain('- One-line description: Custom ankara dresses for Lagos professionals.');
    expect(out).toContain('- What they sell: Bespoke ankara womenswear, three-week turnaround.');
    expect(out).toContain('- Price point band: NGN 80k–250k per piece');
  });

  it('substitutes step 3 audience fields', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Primary audience: Lagos women, 28–45, established professionals.');
    expect(out).toContain('- Audience age range: 28–45');
    expect(out).toContain('- Audience location: Lagos, Abuja');
    expect(out).toContain('- What audience already believes: Custom takes too long and is unreliable.');
    expect(out).toContain('- What audience needs to believe to buy: Three-week guaranteed turnaround on bespoke is real.');
  });

  it('substitutes step 4 brand asset fields', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Logo uploaded: yes');
    expect(out).toContain('- Brand colours (if stated): rust, ivory, navy');
    expect(out).toContain('- Existing IG handle: @acmeankara');
  });

  it('substitutes step 5 photo fields with the count', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Photos uploaded: 3 (see vision blocks above)');
    expect(out).toContain('- Photo consent: yes');
  });

  it('substitutes step 6 voice + reference posts + backstory verbatim', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Stated brand voice: crafted, direct, no-nonsense');
    expect(out).toContain('— Post 1: "14 hours of hand-finishing per piece..."');
  });

  it('renders empty backstory verbatim as a literal empty marker, not the string "undefined"', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).not.toContain('undefined');
    expect(out).toContain('What customer wrote about their backstory (verbatim, may be empty):');
  });

  it('substitutes step 7 calendar choice (tier, video_count, carousel_count)', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('- Tier: standard');
    expect(out).toContain('- Number of videos: 14');
    expect(out).toContain('- Number of carousels: 7');
  });

  it('appends the niche brief verbatim under ## Niche brief', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    expect(out).toContain('## Niche brief');
    expect(out).toContain('# Niche brief: Fashion (test)');
    expect(out).toContain('Fashion is craft-substantiated.');
  });

  it('mentions vision blocks above the text portion', () => {
    const out = renderLayer2Text(SAMPLE_BRIEF, SAMPLE_NICHE_BRIEF);
    // The text refers to "see vision blocks above" — the vision blocks themselves are added
    // by buildPromptMessages, not by renderLayer2Text.
    expect(out).toContain('see vision blocks above');
  });
});

import { renderLayer3 } from './prompt-builder';
import type { BankCatalog, FrameworkSeedResult } from './types/v2';

function makeCatalogStub(): BankCatalog {
  // Minimal catalog with only the two slots used by SAMPLE_SEED below.
  return {
    frameworks: {
      DR_FORMULA: {
        slot: 'DR_FORMULA',
        name: 'DR Formula',
        family: 'Family A — Direct response',
        markdown: '### 3.1 DR Formula\n\nProblem → Promise → Proof → CTA.\n\nHook style: blunt promise opener.',
        affinity: { beauty: 'Med', real_estate: 'High', fashion: 'Med', fintech: 'High', health: 'Med', food: 'Med', education: 'Med' },
      },
      PAS: {
        slot: 'PAS',
        name: 'PAS',
        family: 'Family A — Direct response',
        markdown: '### 3.2 PAS\n\nProblem → Agitate → Solution.\n\nHook style: pain-naming opener.',
        affinity: { beauty: 'Low', real_estate: 'Med', fashion: 'Low', fintech: 'High', health: 'High', food: 'Med', education: 'Low' },
      },
    } as BankCatalog['frameworks'],
    archetypes: {
      PRICING_BREAKDOWN: {
        slot: 'PRICING_BREAKDOWN',
        name: 'Pricing Breakdown',
        family: 'Family A — Customer-stated facts',
        markdown: '### 3.1 Pricing Breakdown\n\nWhat goes into the price.',
        affinity: { beauty: 'Med', real_estate: 'High', fashion: 'High', fintech: 'High', health: 'Med', food: 'Med', education: 'Low' },
      },
      PROCESS_TOUR: {
        slot: 'PROCESS_TOUR',
        name: 'Process Tour',
        family: 'Family B — Customer expertise',
        markdown: '### 4.4 Process Tour\n\nThe steps inside how a thing is made.',
        affinity: { beauty: 'High', real_estate: 'Med', fashion: 'High', fintech: 'Low', health: 'Med', food: 'High', education: 'Med' },
      },
    } as BankCatalog['archetypes'],
    niches: { fashion: '# fashion', beauty: '# beauty', real_estate: '# re', fintech: '# ft', health: '# h', food: '# f', education: '# e' } as BankCatalog['niches'],
  };
}

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

describe('renderLayer3', () => {
  const catalog = makeCatalogStub();

  it('starts with # SELECTION INPUTS', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('# SELECTION INPUTS');
  });

  it('renders seed_inputs and seed_hash from §3.3', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('customer_id: 11111111-1111-1111-1111-111111111111');
    expect(out).toContain('niche: fashion');
    expect(out).toContain('order_index: 1');
    expect(out).toContain('submission_week_iso: 2026-W18');
    expect(out).toContain('seed_hash: a3f9e2d18c4b7a05');
  });

  it('emits N selected frameworks under "Selected frameworks (for this <tier> order)"', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Selected frameworks (for this standard order)');
    expect(out).toContain('You will use these 2 frameworks, no others:');
    expect(out).toContain('### DR_FORMULA — DR Formula');
    expect(out).toContain('Problem → Promise → Proof → CTA.');
    expect(out).toContain('### PAS — PAS');
  });

  it('emits N selected archetypes under "Selected archetypes (for this <tier> order)"', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Selected archetypes (for this standard order)');
    expect(out).toContain('You will use these 2 archetypes, no others:');
    expect(out).toContain('### PRICING_BREAKDOWN — Pricing Breakdown');
    expect(out).toContain('### PROCESS_TOUR — Process Tour');
  });

  it('renders the pair-assignments table with all selected_pairs', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Selected pairs');
    expect(out).toContain('| slot | framework | archetype | affinity |');
    expect(out).toContain('|------|-----------|-----------|----------|');
    expect(out).toContain('|    1 | DR_FORMULA | PRICING_BREAKDOWN | 9 |');
    expect(out).toContain('|    2 | PAS | PROCESS_TOUR | 4 |');
  });

  it('renders the customer-history excluded-pairs block (empty when no LRU fallback)', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Customer history (repeat customers only)');
    expect(out).toContain('(no historical pairs to exclude — first-time customer or fresh bank)');
  });

  it('lists LRU-reused pairs when lru_fallback_used is true', () => {
    const seedWithLru: FrameworkSeedResult = {
      ...SAMPLE_SEED,
      lru_fallback_used: true,
      lru_pairs_reused: [
        { framework: 'DR_FORMULA', archetype: 'PRICING_BREAKDOWN', last_used_at: '2026-02-10T00:00:00Z' },
      ],
    };
    const out = renderLayer3(SAMPLE_BRIEF, seedWithLru, catalog);
    expect(out).toContain('## Customer history (repeat customers only)');
    expect(out).toContain('DR_FORMULA × PRICING_BREAKDOWN (last used 2026-02-10');
  });

  it('renders the not-exhausted bank exhaustion message when exhaustion_warning=false', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    expect(out).toContain('## Bank exhaustion flag');
    expect(out).toContain('Not exhausted. Selection drew from the unused bank for this customer.');
  });

  it('renders the exhausted-bank instructions when exhaustion_warning=true', () => {
    const exhaustedSeed: FrameworkSeedResult = { ...SAMPLE_SEED, exhaustion_warning: true, lru_fallback_used: true };
    const out = renderLayer3(SAMPLE_BRIEF, exhaustedSeed, catalog);
    expect(out).toContain('EXHAUSTED — this customer has run through the unused bank.');
    expect(out).toContain("'bank_exhausted_lru_fallback'");
  });

  it('omits the re-analysis context block when no prior context', () => {
    const out = renderLayer3(SAMPLE_BRIEF, SAMPLE_SEED, catalog);
    // Section header still appears, with empty marker
    expect(out).toContain('## Re-analysis context');
    expect(out).toContain('(none — this is the initial analysis for this brief)');
  });

  it('throws when a selected slot is missing from the catalog', () => {
    const seedWithUnknownSlot: FrameworkSeedResult = {
      ...SAMPLE_SEED,
      selected_frameworks: ['DR_FORMULA', 'AIDA'],
      selected_pairs: [
        { framework: 'AIDA', archetype: 'PROCESS_TOUR', affinity: 4 },
      ],
    };
    expect(() => renderLayer3(SAMPLE_BRIEF, seedWithUnknownSlot, catalog)).toThrow(/AIDA/);
  });
});
