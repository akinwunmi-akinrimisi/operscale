// Validates the model's structured output against ai-brief-analysis.md §3.4.
// Pure: only depends on zod + the AiOutput type.

import { z } from 'zod';
import { FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, type AiOutput } from './types/v2';

const sentenceRhythm = z.enum(['short_punchy', 'mid_length', 'dense']);
const corpusQuality = z.enum(['thick', 'thin', 'absent']);
const energyRegister = z.enum(['calm', 'urgent', 'playful', 'authoritative', 'irreverent', 'warm']);
const slotFormat = z.enum(['ugc_30s', 'ugc_60s', 't2v_quality', 't2v_budget', 'carousel']);
const fabricationRiskCheck = z.enum(['passed', 'escalate']);

const frameworkSlotEnum = z.enum(FRAMEWORK_SLOTS);
const archetypeSlotEnum = z.enum(ARCHETYPE_SLOTS);

const brandVoice = z.object({
  voice_phrases: z.array(z.string()),
  sentence_rhythm: sentenceRhythm,
  avoid_words: z.array(z.string()),
  energy_register: energyRegister,
  voice_corpus_quality: corpusQuality,
});

const specificityInventory = z.object({
  numbers: z.array(z.string()),
  proper_nouns: z.array(z.string()),
  process_steps: z.array(z.string()),
  specificity_corpus_quality: corpusQuality,
});

const expertiseNugget = z.object({
  nugget: z.string(),
  framework_affinity: z.array(z.string()),
});

const visualAesthetic = z.object({
  lighting: z.string(),
  setting: z.string(),
  wardrobe_props: z.string(),
  photo_quality_summary: z.string(),
  photos_present: z.boolean(),
});

const calendarSlot = z.object({
  slot_index: z.number().int(),
  day: z.number().int(),
  format: slotFormat,
  framework_slot: frameworkSlotEnum,
  archetype_slot: archetypeSlotEnum,
  topic: z.string(),
  hook: z.string(),
  core_beats: z.array(z.string()),
  cta: z.string(),
  fabrication_risk_check: fabricationRiskCheck,
});

const violation = z.object({
  slot_index: z.number().int(),
  line: z.string(),
  violation: z.string(),
});

const fabricationAudit = z.object({
  lines_checked: z.number().int(),
  violations_found: z.array(violation),
  audit_passed: z.boolean(),
});

const reviewFlag = z.object({
  reason: z.string(),
  detail: z.string(),
});

export const aiOutputSchema = z.object({
  brand_voice: brandVoice,
  specificity_inventory: specificityInventory,
  expertise_map: z.array(expertiseNugget),
  visual_aesthetic: visualAesthetic,
  calendar_plan: z.array(calendarSlot),
  fabrication_audit: fabricationAudit,
  flags_for_review: z.array(reviewFlag),
}) satisfies z.ZodType<AiOutput>;
