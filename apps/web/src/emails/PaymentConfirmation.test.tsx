import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { PaymentConfirmation } from './PaymentConfirmation';
import type { PaymentConfirmationProps } from '@operscale-calendar/agent/lib/payment-confirmation-props';

const baseProps: PaymentConfirmationProps = {
  firstName: 'Tola',
  amountNgn: 275_000,
  paymentMethod: 'card',
  paidAtIso: '2026-05-05T10:00:00Z',
  tierName: 'Standard',
  videoCount: 14,
  carouselCount: 7,
  deliveryWindow: '7-10 business days',
  founderWhatsappLink: 'https://wa.me/2348165799032',
  founderName: 'Akinwunmi',
  brandName: 'Operscale', // fixture value only — not a locked-brand reference
};

describe('PaymentConfirmation render', () => {
  it('renders all 7 substantive variables in the HTML body', async () => {
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).toContain('Tola');
    expect(html).toContain('275,000'); // formatted NGN
    expect(html).toContain('card');
    expect(html).toContain('Standard');
    expect(html).toContain('14 videos');
    expect(html).toContain('7-10 business days');
    expect(html).toContain('https://wa.me/2348165799032');
  });

  it('renders ALL-CAPS heading "WHAT HAPPENS NEXT" in plain text', async () => {
    const text = await render(<PaymentConfirmation {...baseProps} />, { plainText: true });
    expect(text).toContain('WHAT HAPPENS NEXT');
    expect(text).toContain('275,000');
  });

  it('does NOT include the receipt-attachment line (deferred to Phase 4.7)', async () => {
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).not.toContain('A receipt is attached');
    const text = await render(<PaymentConfirmation {...baseProps} />, { plainText: true });
    expect(text).not.toContain('A receipt is attached');
  });

  it('subject preview matches spec', async () => {
    const html = await render(<PaymentConfirmation {...baseProps} />);
    expect(html).toContain(`Payment received — your ${baseProps.brandName} calendar is now in production`);
  });
});
