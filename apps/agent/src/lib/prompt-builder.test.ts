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
