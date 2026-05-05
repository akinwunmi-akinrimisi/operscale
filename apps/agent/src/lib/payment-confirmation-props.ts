// apps/agent/src/lib/payment-confirmation-props.ts
//
// Pure mapping: Paystack charge.success event + Order + Customer →
// PaymentConfirmationProps. Consumed by /v1/webhook/paystack to render
// PaymentConfirmation.tsx.
//
// Carry-forward from Phase 4.5: this file is route-consumed only (the
// worker doesn't import it), so it uses plain relative imports and is
// excluded from tsconfig.worker.json.

import type { PaystackChargeSuccessEvent } from './paystack';
import type { Tier } from './types/v2';
import { TIER_DISPLAY } from './snapshot-to-email-props';

export type PaymentConfirmationProps = {
  firstName: string;
  amountNgn: number;
  paymentMethod: string;
  paidAtIso: string;
  tierName: string;
  videoCount: number;
  carouselCount: number;
  deliveryWindow: string;
  founderWhatsappLink: string;
  founderName: string;
  brandName: string;
};

function deriveFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0]!;
}

function buildWhatsappLink(): string {
  const phone = process.env.NEXT_PUBLIC_FOUNDER_WHATSAPP ?? '+2348165799032';
  return `https://wa.me/${phone.replace(/^\+/, '')}`;
}

export function paymentConfirmationProps(
  event: PaystackChargeSuccessEvent,
  order: { id: string; tier: Tier; amount_ngn: number },
  customer: { full_name: string | null; email: string },
): PaymentConfirmationProps {
  const tierD = TIER_DISPLAY[order.tier]!;
  return {
    firstName: deriveFirstName(customer.full_name),
    amountNgn: Math.round(event.data.amount / 100),
    paymentMethod: event.data.channel,
    paidAtIso: event.data.paid_at,
    tierName: tierD.tierName,
    videoCount: tierD.videoCount,
    carouselCount: tierD.carouselCount,
    deliveryWindow: tierD.deliveryWindow,
    founderWhatsappLink: buildWhatsappLink(),
    founderName: process.env.NEXT_PUBLIC_FOUNDER_NAME ?? 'Akinwunmi',
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Operscale',
  };
}
