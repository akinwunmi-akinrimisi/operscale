// apps/agent/src/lib/tiers.ts
//
// Canonical tier metadata. Single source of truth for prices, deliverables,
// and delivery windows used by:
//   - /v1/brief/submit (sets orders.amount_ngn)
//   - AutoAckEmail / BriefEmail / PaymentConfirmation templates
//   - apps/web pricing page + tier picker (imports via @operscale-calendar/agent/lib/tiers)
//
// Numbers verbatim from docs/pricing-and-packages.md §"Three tiers".
// Any change here requires a corresponding spec update — these are the
// authoritative values customers see in the email and on the receipt.

export type Tier = 'starter' | 'standard' | 'calendar';

export const TIER_PRICES_NGN: Record<Tier, number> = {
  starter: 150_000,
  standard: 275_000,
  calendar: 525_000,
};

export interface TierDeliverable {
  display_name: string;
  videos: number;
  carousels: number;
  delivery_window: string; // e.g. "24 hours"
}

export const TIER_DELIVERABLES: Record<Tier, TierDeliverable> = {
  starter: {
    display_name: 'Starter',
    videos: 7,
    carousels: 3,
    delivery_window: '24 hours',
  },
  standard: {
    display_name: 'Standard',
    videos: 14,
    carousels: 7,
    delivery_window: '36 hours',
  },
  calendar: {
    display_name: 'Calendar',
    videos: 30,
    carousels: 14,
    delivery_window: '48 hours',
  },
};

/** Defensive lookup — throws on unknown tier so caller doesn't silently use wrong amount. */
export function priceForTier(tier: Tier): number {
  const price = TIER_PRICES_NGN[tier];
  if (price === undefined) throw new Error(`unknown_tier: ${tier}`);
  return price;
}

/** Same defensive lookup for deliverable metadata. */
export function deliverableForTier(tier: Tier): TierDeliverable {
  const d = TIER_DELIVERABLES[tier];
  if (!d) throw new Error(`unknown_tier: ${tier}`);
  return d;
}
