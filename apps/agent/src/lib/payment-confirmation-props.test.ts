import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { paymentConfirmationProps } from './payment-confirmation-props';
import type { PaystackChargeSuccessEvent } from './paystack';

const ORIGINAL_WA = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP;
const ORIGINAL_NAME = process.env.NEXT_PUBLIC_FOUNDER_NAME;
const ORIGINAL_BRAND = process.env.NEXT_PUBLIC_BRAND_NAME;

function restoreEnv(key: string, original: string | undefined): void {
  if (original === undefined) delete process.env[key];
  else process.env[key] = original;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP = '+2348165799032';
  delete process.env.NEXT_PUBLIC_FOUNDER_NAME;
  delete process.env.NEXT_PUBLIC_BRAND_NAME;
});
afterEach(() => {
  restoreEnv('NEXT_PUBLIC_FOUNDER_WHATSAPP', ORIGINAL_WA);
  restoreEnv('NEXT_PUBLIC_FOUNDER_NAME', ORIGINAL_NAME);
  restoreEnv('NEXT_PUBLIC_BRAND_NAME', ORIGINAL_BRAND);
});

const baseEvent: PaystackChargeSuccessEvent = {
  event: 'charge.success',
  data: {
    id: 12345,
    reference: 'ops-cal-order-1-1714742400',
    amount: 27500000,
    currency: 'NGN',
    paid_at: '2026-05-05T10:00:00Z',
    channel: 'card',
    customer: { email: 'tola@example.com' },
    metadata: { order_id: 'order-1', tier: 'standard' },
  },
};

const baseOrder = { id: 'order-1', tier: 'standard' as const, amount_ngn: 275_000 };
const baseCustomer = { full_name: 'Tola Adekunle', email: 'tola@example.com' };

describe('paymentConfirmationProps', () => {
  it('maps the happy path: standard tier, card payment', () => {
    const props = paymentConfirmationProps(baseEvent, baseOrder, baseCustomer);
    expect(props.firstName).toBe('Tola');
    expect(props.amountNgn).toBe(275_000);
    expect(props.paymentMethod).toBe('card');
    expect(props.paidAtIso).toBe('2026-05-05T10:00:00Z');
    expect(props.tierName).toBe('Standard');
    expect(props.videoCount).toBe(14);
    expect(props.carouselCount).toBe(7);
    expect(props.deliveryWindow).toBe('7-10 business days');
    expect(props.founderWhatsappLink).toBe('https://wa.me/2348165799032');
    expect(props.founderName).toBe('Akinwunmi');
    expect(props.brandName).toBe('Operscale');
  });

  it('falls back to "there" when full_name is null', () => {
    const props = paymentConfirmationProps(baseEvent, baseOrder, { full_name: null, email: 'x@y.z' });
    expect(props.firstName).toBe('there');
  });

  it('divides kobo to NGN correctly', () => {
    const e = { ...baseEvent, data: { ...baseEvent.data, amount: 15_000_000 } };
    const props = paymentConfirmationProps(e, { ...baseOrder, amount_ngn: 150_000 }, baseCustomer);
    expect(props.amountNgn).toBe(150_000);
  });

  it('passes payment method through unchanged', () => {
    const e = { ...baseEvent, data: { ...baseEvent.data, channel: 'bank_transfer' as const } };
    const props = paymentConfirmationProps(e, baseOrder, baseCustomer);
    expect(props.paymentMethod).toBe('bank_transfer');
  });

  it('maps starter tier counts and delivery window', () => {
    const props = paymentConfirmationProps(baseEvent, { ...baseOrder, tier: 'starter', amount_ngn: 150_000 }, baseCustomer);
    expect(props.videoCount).toBe(7);
    expect(props.carouselCount).toBe(3);
    expect(props.deliveryWindow).toBe('5-7 business days');
    expect(props.tierName).toBe('Starter');
  });

  it('maps calendar tier counts and delivery window', () => {
    const props = paymentConfirmationProps(baseEvent, { ...baseOrder, tier: 'calendar', amount_ngn: 525_000 }, baseCustomer);
    expect(props.videoCount).toBe(30);
    expect(props.carouselCount).toBe(14);
    expect(props.deliveryWindow).toBe('10-14 business days');
    expect(props.tierName).toBe('Calendar');
  });

  it('strips leading + from founder WhatsApp env var', () => {
    process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP = '+2348165799032';
    const props = paymentConfirmationProps(baseEvent, baseOrder, baseCustomer);
    expect(props.founderWhatsappLink).toBe('https://wa.me/2348165799032');
    expect(props.founderWhatsappLink).not.toContain('+');
  });

  it('uses env-var overrides for founderName and brandName when set', () => {
    process.env.NEXT_PUBLIC_FOUNDER_NAME = 'Femi';
    process.env.NEXT_PUBLIC_BRAND_NAME = 'Acme';
    const props = paymentConfirmationProps(baseEvent, baseOrder, baseCustomer);
    expect(props.founderName).toBe('Femi');
    expect(props.brandName).toBe('Acme');
  });
});
