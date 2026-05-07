// Render-and-assert smoke tests for AutoAckEmail + SaveTokenEmail. We don't
// snapshot the full HTML (brittle); we verify that the customer's
// non-trivial substrings make it through React Email's renderer.

import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import AutoAckEmail from './AutoAckEmail';
import SaveTokenEmail from './SaveTokenEmail';

describe('AutoAckEmail', () => {
  it('renders with all the spec-required tier info inline', async () => {
    const html = await render(
      AutoAckEmail({
        firstName: 'Akin',
        brandName: 'Akin Tailoring',
        tierDisplayName: 'Standard',
        videoCount: 14,
        carouselCount: 7,
        deliveryWindow: '36 hours',
        watTimestamp: '2026-05-07 10:24',
        founderWhatsappNumber: '+2348012345678',
        founderName: 'Akinwunmi',
      }),
    );
    expect(html).toContain('Akin');
    expect(html).toContain('Akin Tailoring');
    expect(html).toContain('Standard');
    // Check the values are present individually — react-email's renderer can
    // split static text around interpolated children into separate nodes.
    expect(html).toContain('14');
    expect(html).toContain('videos and');
    expect(html).toContain('carousels');
    expect(html).toContain('36 hours');
    expect(html).toContain('2026-05-07 10:24');
    expect(html).toContain('https://wa.me/2348012345678');
    expect(html).toContain('Akinwunmi');
  });
});

describe('SaveTokenEmail', () => {
  it('renders the resume URL twice (button + plain text fallback)', async () => {
    const url = 'https://operscale.cloud/brief/abcDEF1234567890XYZW0123';
    const html = await render(
      SaveTokenEmail({
        firstName: 'Akin',
        resumeUrl: url,
        tierDisplayName: 'Standard',
      }),
    );
    expect(html).toContain('Akin');
    expect(html).toContain('Standard');
    // Once in the <a href>, once in the body fallback.
    const occurrences = html.split(url).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    expect(html).toContain('7 days');
  });
});
