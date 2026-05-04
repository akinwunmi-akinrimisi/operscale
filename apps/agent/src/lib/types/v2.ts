// V2 canonical types. Source of truth: docs/specs/non-duplication-system.md,
// docs/specs/ai-brief-analysis.md, docs/specs/script-frameworks.md,
// docs/specs/angle-archetypes.md.
//
// Slot constants are the runtime contract between the markdown spec docs
// (which carry HTML-comment frontmatter `<!-- slot: ID -->`) and the
// framework-selector + prompt-builder modules.

export const FRAMEWORK_SLOTS = [
  // Family A — Direct response (5)
  'DR_FORMULA',
  'PAS',
  'AIDA',
  'PAIPS',
  'VALUE_EQUATION',
  // Family B — Hook stack (5)
  'THREE_LAYER_HOOK_STACK',
  'PATTERN_INTERRUPT',
  'OPEN_LOOP',
  'CURIOSITY_GAP',
  'SPECIFICITY_STACK',
  // Family C — Educational (5)
  'QUICK_WIN',
  'EDUCATIONAL_BREAKDOWN',
  'PROCESS_DEMYSTIFICATION',
  'NUMBERED_LIST',
  'CHECKLIST_REVEAL',
  // Family D — Persuasive (5)
  'MYTH_BUSTER',
  'COMPARISON',
  'ANTI_TREND',
  'INDUSTRY_INSIDER',
  'COST_REVEAL',
  // Family E — Narrative (5)
  'BEHIND_THE_WORK',
  'DATASET_REVEAL',
  'DECODED_JARGON',
  'STEEL_MAN',
  'FRAME_RE_SET',
] as const;

export type FrameworkSlot = (typeof FRAMEWORK_SLOTS)[number];

export const ARCHETYPE_SLOTS = [
  // Family A — Customer-stated facts (5)
  'PRICING_BREAKDOWN',
  'SERVICE_ANATOMY',
  'PRODUCT_TOUR',
  'TIER_COMPARISON',
  'WHAT_YOU_GET',
  // Family B — Customer expertise (5)
  'INSIDER_CHECKLIST',
  'COMMON_MISTAKE',
  'PRE_DECISION_AUDIT',
  'PROCESS_TOUR',
  'QUALITY_TELLS',
  // Family C — Industry knowledge (5)
  'DECODED_JARGON',
  'INDUSTRY_PATTERN',
  'CATEGORY_MYTH',
  'MARKET_REALITY',
  'REGULATORY_SNAPSHOT',
  // Family D — Audience pain points (5)
  'SYMPTOM_DIAGNOSIS',
  'COST_OF_INACTION',
  'HIDDEN_TRAP',
  'QUESTION_LOOP',
  'DECISION_FRAMEWORK',
  // Family E — Aspirational direction (5)
  'OUTCOME_SHOWCASE',
  'DAY_IN_THE_OUTPUT',
  'QUALITY_MOMENT',
  'USE_CASE_SPOTLIGHT',
  'ADJACENT_POSSIBILITY',
] as const;

export type ArchetypeSlot = (typeof ARCHETYPE_SLOTS)[number];

export const NICHE_SLUGS = [
  'beauty',
  'real_estate',
  'fashion',
  'fintech',
  'health',
  'food',
  'education',
] as const;

export type NicheSlug = (typeof NICHE_SLUGS)[number];

export const TIERS = ['starter', 'standard', 'calendar'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierCounts {
  frameworks: number;
  archetypes: number;
  video_count: number;
  carousel_count: number;
}

export const TIER_COUNTS: Record<Tier, TierCounts> = {
  starter:  { frameworks: 3, archetypes: 3, video_count: 7,  carousel_count: 0 },
  standard: { frameworks: 5, archetypes: 5, video_count: 14, carousel_count: 0 },
  calendar: { frameworks: 8, archetypes: 8, video_count: 30, carousel_count: 0 },
};

export type AffinityLevel = 'High' | 'Med' | 'Low';

export const AFFINITY_SCORES: Record<AffinityLevel, number> = {
  High: 3,
  Med: 2,
  Low: 1,
};

export interface FrameworkEntry {
  slot: FrameworkSlot;
  name: string;        // human-readable e.g. "DR Formula"
  family: string;      // e.g. "Direct response"
  markdown: string;    // full body of the section
  affinity: Record<NicheSlug, AffinityLevel>;
}

export interface ArchetypeEntry {
  slot: ArchetypeSlot;
  name: string;
  family: string;
  markdown: string;
  affinity: Record<NicheSlug, AffinityLevel>;
}

export interface BankCatalog {
  frameworks: Record<FrameworkSlot, FrameworkEntry>;
  archetypes: Record<ArchetypeSlot, ArchetypeEntry>;
  niches: Record<NicheSlug, string>;  // full markdown text per niche brief
}

export interface FrameworkSeedInputs {
  customer_id: string;
  niche: NicheSlug;
  order_index: number;
  submission_week_iso: string;  // e.g. "2026-W18"
}

export interface SelectedPair {
  framework: FrameworkSlot;
  archetype: ArchetypeSlot;
  affinity: number;  // framework_affinity * archetype_affinity, 1-9
}

export interface FrameworkSeedResult {
  seed_hash: string;
  seed_inputs: FrameworkSeedInputs;
  selected_frameworks: FrameworkSlot[];
  selected_archetypes: ArchetypeSlot[];
  selected_pairs: SelectedPair[];
  exhaustion_warning: boolean;
  lru_fallback_used: boolean;
  lru_pairs_reused?: Array<{
    framework: FrameworkSlot;
    archetype: ArchetypeSlot;
    last_used_at: string;
  }>;
}

export type ReanalyzeMode = 'same_frameworks' | 'new_frameworks';
