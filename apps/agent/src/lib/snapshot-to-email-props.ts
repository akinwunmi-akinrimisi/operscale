// apps/agent/src/lib/snapshot-to-email-props.ts
//
// Pure mapping: SupersetOutput (analysis_runs.ai_output) + Order + Customer
// → BriefEmailProps. Consumed by /v1/brief/approve to render BriefEmail.tsx.
//
// AiOutput → email-prop divergence (see plan Decision A): the email-templates.md
// spec describes email-friendly fields (angles, scriptSeed, visualStyle.*)
// that are not first-class on AiOutput. We derive them here from
// calendar_plan[0..2], visual_aesthetic, and brand_voice.

import type { SupersetOutput, Tier } from './types/v2.js';
import { TIER_PRICES_NGN } from './post-processor.js';

export type BriefEmailProps = {
  firstName: string;
  briefSummary: string;
  angles: Array<{ title: string; hook: string; whyItFits: string }>;
  scriptSeed: { topic: string; openingHook: string; outline: string[] };
  visualStyle: { recommendedCameraTreatment: string; recommendedCaptionStyle: string };
  photoAesthetic: { recommendedAvatarTreatment: string } | null;
  tierName: string;
  priceNgn: number;
  videoCount: number;
  carouselCount: number;
  ugcCount: number;
  t2vCount: number;
  carouselPages: number;
  deliveryWindow: string;
  upsell: {
    recommendedTier: string;
    reasoning: string;
    priceDeltaNgn: number;
    recommendedTierPriceNgn: number;
  } | null;
  paymentLink: string;
  founderName: string;
  brandName: string;
};

interface TierDisplay {
  tierName: string;
  videoCount: number;
  carouselCount: number;
  ugcCount: number;
  t2vCount: number;
  carouselPages: number;
  deliveryWindow: string;
}

// Display strings only. Prices live in TIER_PRICES_NGN (post-processor.ts) — single source of truth.
export const TIER_DISPLAY: Record<Tier, TierDisplay> = {
  starter: {
    tierName: 'Starter',
    videoCount: 7,
    carouselCount: 3,
    ugcCount: 4,
    t2vCount: 3,
    carouselPages: 18,
    deliveryWindow: '5-7 business days',
  },
  standard: {
    tierName: 'Standard',
    videoCount: 14,
    carouselCount: 7,
    ugcCount: 8,
    t2vCount: 6,
    carouselPages: 42,
    deliveryWindow: '7-10 business days',
  },
  calendar: {
    tierName: 'Calendar',
    videoCount: 30,
    carouselCount: 14,
    ugcCount: 16,
    t2vCount: 14,
    carouselPages: 84,
    deliveryWindow: '10-14 business days',
  },
};

const RHYTHM_LABEL: Record<SupersetOutput['brand_voice']['sentence_rhythm'], string> = {
  short_punchy: 'short, punchy lines',
  mid_length:   'measured, mid-length lines',
  dense:        'dense, layered lines',
};

const REGISTER_LABEL: Record<SupersetOutput['brand_voice']['energy_register'], string> = {
  calm:           'calm authority',
  urgent:         'urgent edge',
  playful:        'playful energy',
  authoritative:  'firm authority',
  irreverent:     'irreverent bite',
  warm:           'warm tone',
};

function deriveFirstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0]!;
}

export function snapshotToEmailProps(
  run: { ai_output: SupersetOutput },
  order: { id: string; tier: Tier; amount_ngn: number; customer_id: string; brief_id: string },
  customer: { full_name: string | null; email: string },
  paymentLink: string,
): BriefEmailProps {
  const ai = run.ai_output;
  const tierD = TIER_DISPLAY[order.tier];

  const slots = ai.calendar_plan.slice(0, 3);
  const angles = slots.map((slot) => ({
    title: slot.topic,
    hook:  slot.hook,
    whyItFits: slot.core_beats[0] ?? slot.cta,
  }));

  const seed = ai.calendar_plan[0]!;
  const scriptSeed = {
    topic: seed.topic,
    openingHook: seed.hook,
    outline: seed.core_beats,
  };

  const va = ai.visual_aesthetic;
  const visualStyle = {
    recommendedCameraTreatment: `${va.lighting}; ${va.setting}; ${va.wardrobe_props}`,
    recommendedCaptionStyle:    `${RHYTHM_LABEL[ai.brand_voice.sentence_rhythm]} with ${REGISTER_LABEL[ai.brand_voice.energy_register]}`,
  };

  const photoAesthetic = va.photos_present
    ? { recommendedAvatarTreatment: va.photo_quality_summary }
    : null;

  const ur = ai.upsell_recommendation;
  const upsell = ur.should_upsell && ur.recommended_tier
    ? {
        recommendedTier: TIER_DISPLAY[ur.recommended_tier].tierName,
        reasoning: ur.reasoning,
        priceDeltaNgn: ur.upsell_price_delta,
        recommendedTierPriceNgn: TIER_PRICES_NGN[ur.recommended_tier],
      }
    : null;

  return {
    firstName: deriveFirstName(customer.full_name),
    briefSummary: ai.brief_summary,
    angles,
    scriptSeed,
    visualStyle,
    photoAesthetic,
    tierName: tierD.tierName,
    priceNgn: order.amount_ngn,
    videoCount: tierD.videoCount,
    carouselCount: tierD.carouselCount,
    ugcCount: tierD.ugcCount,
    t2vCount: tierD.t2vCount,
    carouselPages: tierD.carouselPages,
    deliveryWindow: tierD.deliveryWindow,
    upsell,
    paymentLink,
    founderName: process.env.NEXT_PUBLIC_FOUNDER_NAME ?? 'Akinwunmi',
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Operscale',
  };
}
