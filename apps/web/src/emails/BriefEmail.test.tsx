import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { BriefEmail } from './BriefEmail';
import type { BriefEmailProps } from '@operscale-calendar/agent/lib/snapshot-to-email-props';

const baseProps: BriefEmailProps = {
  firstName: 'Tola',
  briefSummary: 'Bespoke ankara tailoring with three-week guaranteed turnaround for Lagos professionals.',
  angles: [
    { title: 'Three-week turnaround', hook: 'You think bespoke means waiting six weeks?', whyItFits: 'Three weeks. Not six. Three.' },
    { title: 'Inside the hand-finishing process',  hook: 'Why your last ankara dress fell apart',         whyItFits: 'Cheap thread' },
    { title: 'Real customer outcome',                hook: 'She wore this to her promotion dinner',         whyItFits: 'Brief' },
  ],
  scriptSeed: { topic: 'Three-week turnaround', openingHook: 'You think bespoke means waiting six weeks?', outline: ['Three weeks.', 'Hand-finishing', 'Lekki studio'] },
  visualStyle: { recommendedCameraTreatment: 'natural daylight; studio in Lekki; ankara fabric rolls', recommendedCaptionStyle: 'short, punchy lines with calm authority' },
  photoAesthetic: null,
  tierName: 'Standard',
  priceNgn: 350_000,
  videoCount: 14,
  carouselCount: 7,
  ugcCount: 8,
  t2vCount: 6,
  carouselPages: 42,
  deliveryWindow: '7-10 business days',
  upsell: null,
  paymentLink: 'https://checkout.paystack.com/abc',
  founderName: 'Akinwunmi',
  brandName: 'Operscale', // fixture value only — not a locked-brand reference
};

describe('BriefEmail render', () => {
  it('renders the briefSummary, all 3 angles, and the payment link', async () => {
    const html = await render(<BriefEmail {...baseProps} />);
    expect(html).toContain(baseProps.briefSummary);
    for (const angle of baseProps.angles) {
      expect(html).toContain(angle.title);
      expect(html).toContain(angle.hook);
    }
    expect(html).toContain(baseProps.paymentLink);
    expect(html).toContain(baseProps.tierName);
  });

  it('omits the photos block when photoAesthetic is null', async () => {
    const html = await render(<BriefEmail {...baseProps} />);
    expect(html).not.toContain('A note on your reference photos');
  });

  it('renders the photos block when photoAesthetic is provided', async () => {
    const html = await render(<BriefEmail {...baseProps} photoAesthetic={{ recommendedAvatarTreatment: 'sharp, well-lit' }} />);
    expect(html).toContain('A note on your reference photos');
    expect(html).toContain('sharp, well-lit');
  });

  it('omits the upsell block when upsell is null', async () => {
    const html = await render(<BriefEmail {...baseProps} />);
    expect(html).not.toContain('would the');
  });

  it('renders the upsell block when upsell is provided', async () => {
    const html = await render(<BriefEmail {...baseProps} upsell={{ recommendedTier: 'Calendar', reasoning: 'Audience belief gap is wide.', priceDeltaNgn: 200_000, recommendedTierPriceNgn: 750_000 }} />);
    expect(html).toContain('Calendar');
    expect(html).toContain('200,000');
    expect(html).toContain('750,000');
    expect(html).toContain('Audience belief gap is wide.');
  });

  it('renders plain-text version with conditional blocks honored', async () => {
    const text = await render(<BriefEmail {...baseProps} />, { plainText: true });
    expect(text).toContain(baseProps.briefSummary);
    expect(text).not.toContain('<');
  });

  it('renders plain-text headings in ALL CAPS per email-templates.md', async () => {
    const text = await render(<BriefEmail {...baseProps} />, { plainText: true });
    expect(text).toContain('WHAT WE HEARD');
    expect(text).toContain('3 ANGLES WE\'D OPEN THE CALENDAR WITH');
    expect(text).toContain('A TASTE OF HOW THE FIRST VIDEO WOULD LAND');
    expect(text).toContain('THE VISUAL DIRECTION WE HAVE IN MIND');
    expect(text).toContain('YOUR PACKAGE');
    expect(text).toContain('NEXT STEP');
    // The upsell heading is intentionally hybrid case — only the upsell test (which
    // passes upsell={...}) can verify the full string; this one omits.
  });
});
