import type { BriefAnalyzerInput } from '@/lib/types/v2';

// Deterministic fixture for the first L2 cassette.
// Tier "standard" = 14 video + 7 carousel = 21 calendar slots.
// No photos: keeps the first cassette small + cheap.
// brief_id and customer_id are stable so seed_hash is stable across re-records.
export const initialFashionTier2: BriefAnalyzerInput = {
  brief_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  submitted_at_iso: '2026-05-04T09:00:00Z',
  submission_week_iso: '2026-W18',
  order_index: 1,
  tier: 'standard',

  niche_slug: 'fashion',
  niche_label: 'Fashion e-commerce',

  brand_name: 'Tola Studios',
  owner_name: 'Tola Adekunle',
  phone_e164: '+2348012345678',
  email: 'tola@example.com',

  one_line_description: 'Bespoke ankara tailoring for Lagos professionals, three-week guaranteed turnaround.',
  offer_description:
    'Womenswear bespoke pieces — fitted dresses, two-piece sets, and tailored blazers in ankara, adire, and aso-oke. Each piece is hand-finished over 14 hours by a team of three. Studio in Lekki Phase 1.',
  price_point_band: 'NGN 80k – 250k per piece',

  primary_audience_description:
    'Lagos women, 28-45, established professionals who want bespoke without bridal-tailoring delays.',
  audience_age_range: '28-45',
  audience_location: 'Lagos (primary), Abuja, UK diaspora',
  audience_belief: 'Custom tailoring in Lagos is unreliable; pieces will arrive late or be poorly finished.',
  audience_belief_target:
    'Three-week guaranteed turnaround on bespoke is real, and the finishing standard is visible in every piece.',

  logo_uploaded_yes_no: 'no',
  brand_colours: 'rust, ivory, deep navy',
  instagram_handle: '@tolastudios',

  photo_count: 0,
  photo_consent_yes_no: 'no',

  stated_voice: 'crafted, direct, no-nonsense — speaks to time and labour, not luxury cliché',
  reference_posts_block: [
    '— Post 1: "14 hours of hand-finishing per piece. We do not rush. We do not compromise the seam."',
    '— Post 2: "If you have ever had ankara shrink in the wash, the fabric is not the issue. The wash is."',
    '— Post 3: "Three-week turnaround means three weeks. Not six. Not eight. Three."',
  ].join('\n  '),
  customer_backstory_verbatim: '',

  video_count: 14,
  carousel_count: 7,
};
