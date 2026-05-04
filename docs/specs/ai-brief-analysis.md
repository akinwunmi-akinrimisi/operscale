# Spec: AI brief analysis service

The most novel piece of Phase 1. Reads the customer's intake form (and photos if uploaded) and produces structured output that drives both the customer-facing brief email and the founder's CRM review. This document is the single source of truth for the prompt, the schema, the failure handling, and the cost expectations.

If you (Claude) are implementing or modifying the analysis service, this document is the contract. If `apps/agent/src/lib/claude.ts` disagrees with this doc, the code is wrong — fix the code.

## What this service is and is not

The AI brief analysis service:

- Reads a brief from the database (`briefs` row + linked `brief_photos` + niche markdown).
- Calls Claude Opus 4.7 (with vision when photos exist) to produce a structured JSON output.
- Validates the output against a strict schema.
- Writes the result to `analysis_runs` with `is_current = true`.
- Updates the order to `pending_founder_review`.

The AI brief analysis service does NOT:

- Send any customer-facing email. (That happens after founder approval — see `email-templates.md`.)
- Mutate the original `briefs` row. The form is immutable once submitted.
- Generate scripts, captions, or any production-ready content. (That's Phase 2.)
- Decide whether to upsell — it recommends; the founder decides.

## Inputs

### Form payload

The full `briefs.form_payload` JSON. This includes:

- Tier intent (Starter / Standard / Calendar)
- Business info (name, niche, website, description, customer name, WhatsApp, email)
- Direction & goals (angles, calendar goal, topics, things to avoid, posting platforms)
- Brand voice (tone, 3 reference posts, brand colors, logo URL)
- Photo metadata (presence indicator, count, paths, quality flags, consent timestamp)
- Visual character lock (on-camera choice, setting/vibe)
- Niche-specific follow-up answers
- Source attribution
- Save token (for audit only — not part of the prompt)

### Niche brief markdown

Loaded from `niche-briefs/<niche>.md` based on `business.niche`. Each niche file contains:

- Audience profile
- Top 5-10 content angles known to perform in that niche
- Common objections we hear from that audience
- Tone do's and don'ts
- Restricted-content flags (e.g., medical advice claims, MLM disclosures)

If the niche file doesn't exist, we fall back to `niche-briefs/_default.md` and flag the analysis with `flags.unknown_niche`.

### Tier scope

Looked up from a static config:

```typescript
const TIER_SCOPE = {
  starter:  { videos: 7,  carousels: 3,  ugc_count: 4,  t2v_count: 3,  length_mix: '7×30s' },
  standard: { videos: 14, carousels: 7,  ugc_count: 8,  t2v_count: 6,  length_mix: '10×30s + 4×60s' },
  calendar: { videos: 30, carousels: 14, ugc_count: 18, t2v_count: 12, length_mix: '20×30s + 10×60s' },
};
```

### Photos (when uploaded)

Photos are downloaded from Supabase Storage (private bucket, service-role read) and base64-encoded. Each photo becomes a content block in the Claude API call:

```typescript
{
  type: 'image',
  source: {
    type: 'base64',
    media_type: 'image/jpeg',  // or image/png
    data: base64String,
  }
}
```

Photos are only passed if their quality check passed (or if the customer explicitly overrode quality flags). A flagged-and-overridden photo is still sent, but the prompt includes "the customer overrode quality flags on photo N" so Claude can comment.

## Output schema

Claude returns one JSON object matching this exact schema. We validate. Any deviation triggers a retry.

```typescript
{
  "brief_summary": string,                    // 2-3 sentences, written as if speaking to the customer
  "recommended_angles": [
    {
      "angle": string,                        // 1-line angle name
      "hook": string,                         // First 1.5 seconds of a Reels/TikTok — must work as voiceover
      "why_it_fits": string                   // 1-2 sentences referencing their actual business
    },
    // exactly 3 items
  ],
  "sample_script_seed": {
    "video_1_topic": string,
    "video_1_hook": string,                   // First 1.5 seconds
    "video_1_outline": string[]               // 3-5 bullet points
  },
  "brand_voice": {
    "tone_summary": string,                   // 1 sentence
    "vocabulary_pattern": string,             // 1-2 sentences
    "sentence_rhythm": string,                // 1-2 sentences
    "emotional_register": string,             // 1 sentence
    "do_say": string[],                       // 3-5 phrases
    "do_not_say": string[]                    // 3-5 phrases
  },
  "photo_aesthetic": {                        // Only present if photos were uploaded
    "face_quality_summary": string,
    "styling_observations": string,
    "setting_hints": string,
    "recommended_avatar_treatment": string,
    "flags": string[]                         // e.g. ["sunglasses_present", "low_resolution"]
  } | null,
  "visual_style": {
    "recommended_palette": string[],          // hex codes, 3-5 colors
    "recommended_palette_rationale": string,
    "recommended_typography": string,
    "recommended_camera_treatment": string,
    "recommended_caption_style": string
  },
  "upsell_recommendation": {
    "should_upsell": boolean,
    "recommended_tier": "starter" | "standard" | "calendar" | null,
    "reasoning": string,
    "upsell_price_delta": number              // NGN, 0 if should_upsell is false
  },
  "flags": [
    {
      "type": "restricted_niche" | "unknown_niche" | "low_form_quality" | "photo_concerns" | "language_mismatch",
      "detail": string
    }
  ],
  "estimated_brief_quality_score": number     // 0.0 to 1.0, Claude's self-assessment
}
```

If `photos.uploaded == false` in the form payload, `photo_aesthetic` is `null`.

## The prompt

Constructed in `apps/agent/src/lib/claude.ts`. Three parts: system, user, content blocks.

### System prompt (fixed, ~800 tokens)

```
You are Operscale's brief analyst. You read SMB content briefs from Nigerian small
business customers and produce structured JSON output that drives a personalised
email and an internal CRM card.

CONTEXT:
- Operscale sells short-form content calendars (7, 14, or 30 videos + bundled carousels).
- Customers are Nigerian SMBs in beauty, real estate, fashion, fintech, health, food,
  or education niches.
- The output you produce is reviewed by a founder before it reaches the customer.
- The customer pays after they receive your output — so quality matters.

RULES:
- Be specific. Generic suggestions lose customers.
- Reference the customer's actual words back to them in `brief_summary`.
- For Nigerian SMBs, use local context where relevant (Lagos, Nigerian English,
  cultural references that land).
- Only recommend an upsell when the brief actually justifies it. Don't push.
- Flag restricted niches: medical advice claims, fintech without NDPC mention,
  gambling, alcohol, MLM. The founder will decide whether to proceed.
- The 3 sample angles must be DIFFERENT — not 3 variations of the same idea.
- The video_1_hook must work as the first 1.5 seconds of a Reels/TikTok video,
  spoken aloud or shown on screen as a hook.
- Do NOT invent facts about the customer's business. If the form doesn't say it,
  don't claim it.

BRAND VOICE ANALYSIS:
- Read the 3 reference posts the customer shared.
- Read their `tone` selection and one-liner business description.
- Capture: vocabulary patterns, sentence rhythm, emotional register, DO-SAY and
  DO-NOT-SAY lists.
- This output drives the script generation in Phase 2.

PHOTO AESTHETIC ANALYSIS (only when photos provided):
- Look at each photo. Comment on face quality, styling, lighting, setting.
- Recommend an avatar treatment that respects the existing photo mood.
- Flag any quality issues that may need re-shooting (low resolution, motion blur,
  sunglasses, group photo where the subject is unclear).
- If the customer overrode a quality flag during upload, comment on whether the
  override is workable or whether re-uploading would help.

VISUAL STYLE RECOMMENDATION:
- Derive a palette from the customer's stated brand colors AND the photo tones
  (if photos were provided).
- Recommend typography (a typeface family, e.g. "warm sans-serif like Inter").
- Recommend camera treatment (shot framing, lighting, depth of field).
- Recommend caption style (kinetic, static, position, color).
- This output drives the production register selection in Phase 2.

OUTPUT FORMAT:
- Respond with a single JSON object matching the schema below.
- Do not include any prose outside the JSON.
- Do not wrap the JSON in markdown code fences.
- Do not include comments in the JSON.

[SCHEMA HERE — full TypeScript type literal as in `Output schema` section]
```

### User prompt (per-call, varies)

```
Niche brief context:
[full content of niche-briefs/<niche>.md]

Tier scope:
[JSON of TIER_SCOPE entry for the chosen tier]

Customer's form responses:
[full briefs.form_payload as JSON]

[If photos were uploaded:]
Photos uploaded by the customer. Treat each as a face reference photo for a
Phase 2 custom AI avatar. Comment on each in the photo_aesthetic block.
[N image content blocks follow]

Generate the brief analysis now. Return only the JSON.
```

### API call shape

```typescript
const response = await anthropic.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 4000,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: userPromptText },
        ...photoBlocks,  // one image content block per uploaded photo
      ],
    },
  ],
});
```

We do not stream the response (the JSON is structured; partial output is not useful). The full response arrives in 60-120 seconds with vision blocks; 40-80 seconds without.

## Validation

Output passes through a Zod schema (or equivalent) that enforces:

- All required fields present
- All field types correct
- `recommended_angles` has exactly 3 items
- `recommended_palette` has 3-5 hex codes
- `do_say` and `do_not_say` each have 3-5 items
- `estimated_brief_quality_score` is between 0 and 1
- `upsell_recommendation.upsell_price_delta` is 0 if `should_upsell` is false
- If photos were uploaded, `photo_aesthetic` is non-null. If not, `photo_aesthetic` is null.

If validation fails, we retry once with the original prompt + an addendum: "Your previous response did not validate. Specifically: [validation error]. Respond with valid JSON matching the schema exactly."

If the retry also fails, we fall back to a generic-template `analysis_run` with `flags = [{ type: 'low_form_quality', detail: 'AI output validation failed twice' }]` and surface this loudly in the CRM. Founder reviews and either edits the placeholder or re-runs manually.

## Retry and failure handling

| Failure | Retry strategy | Final fallback |
| --- | --- | --- |
| HTTP 5xx from Anthropic | Exponential backoff: 1s, 2s, 4s, 8s, 16s (5 attempts) | Set `ai_analysis_failed`, founder WhatsApp alert |
| Rate limit (HTTP 429) | Same exponential, but cap concurrent in-flight at 5 | Same |
| Timeout (>180s) | Retry with same prompt | Same |
| Malformed JSON | Retry with stricter prompt | Generic template |
| Schema validation failure | Retry with validation error in addendum | Generic template |
| Photo download failure | Retry photo fetch 3 times, then run analysis text-only | Run text-only with flag |
| Vision block parse error (corrupt image) | Drop offending photo, retry without it | Run text-only with flag |
| Output exceeds 4000 tokens | Truncate at JSON boundary, accept | Founder review catches issues |

All failures are logged to `activity_log` with `event_type` like `ai_analysis_retry_attempt_3` or `ai_analysis_failed_validation`.

## Cost and latency

### Per-call cost (target)

- Input tokens: ~3,200 (system: 800, user: 1,400, photos: ~700 token equivalent for 3 photos)
- Output tokens: ~1,400
- At Claude Opus 4.7 pricing: ~$0.12 per call

### Per-day cost (target at 30 briefs/day)

- 30 briefs × $0.12 = $3.60/day
- + ~25% overhead for re-analyses = ~$4.50/day
- Monthly: ~$135

### Latency

| Scenario | p50 | p95 |
| --- | --- | --- |
| Text-only (no photos) | 60s | 90s |
| With 1 photo | 75s | 110s |
| With 3 photos | 90s | 130s |
| Re-analysis (with founder note) | same as above | same |

Latency target for the customer-facing flow: brief lands in CRM `pending_review` within 3 minutes of submission (p95). This gives the founder a 1-hour budget to review and approve before the brief email lands in the customer's inbox.

## Observability

Every Claude call writes to a `llm_calls` table:

```sql
CREATE TABLE llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES briefs(id),
  analysis_run_id uuid REFERENCES analysis_runs(id),
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  duration_ms integer NOT NULL,
  cost_usd decimal(8,6) NOT NULL,
  retry_count integer DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success','failed','validation_failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);
```

We use this for cost monitoring (alert if any single brief exceeds $0.50 — suggests prompt issue, not photo issue), latency monitoring, retry-rate monitoring (high retry rate = upstream problem).

## Prompt engineering — what we've learned

These are insights from prior Vision GridAI prompt work that apply here.

### Be explicit about output format

Claude is much more reliable when you specify "respond with valid JSON only, no prose, no markdown fences" in the system prompt AND repeat it at the end of the user prompt. Don't rely on a single instruction.

### Give negative examples sparingly

Saying "do not be generic" works. Saying "do not say things like X" works for X up to ~5 examples — beyond that, Claude starts treating the negative examples as positive.

### Reference the customer's words

The most-loved feedback we got in beta was "you actually read what I wrote". The way we get that is the explicit instruction `Reference the customer's actual words back to them in brief_summary`. This produces output like "You mentioned wanting your moisturiser to feel premium without being overpriced — that tension is the whole calendar."

### Ground photo analysis in concrete observations

Saying "comment on lighting" is too vague. Saying "describe the lighting as natural-vs-studio, warm-vs-cool, soft-vs-harsh, in 1-2 sentences" produces grounded comments. We've embedded these qualifiers in the prompt.

### Quality score as self-check

The `estimated_brief_quality_score` field forces Claude to evaluate its own output before returning. We see this calibrate well — outputs that score below 0.6 typically have problems the founder catches.

## Re-analysis with founder note

When the founder clicks "Re-analyze with note" in the CRM, we re-call Claude with the original form + photos + a new prompt addendum:

```
[Standard system prompt]
[Standard user prompt with form, niche, tier]
[Standard photo blocks if applicable]

ADDITIONAL CONTEXT FROM THE FOUNDER:
The founder reviewed the previous analysis and asked for this revision:
"[founder_note]"

Generate a new analysis taking this guidance into account. Return only JSON.
```

The previous `analysis_runs` row is set `is_current = false`. The new row is inserted with incremented `run_index` and `trigger_type = 're_analyze_with_note'`.

We can re-analyze multiple times. There's no hard cap on the number of re-runs per brief, but a soft signal: if a single brief has > 5 runs, we flag it in the CRM as "this brief may need a different intervention" — usually means the form data is inadequate or the niche is wrong.

## Inline edit handling

Inline edits are tracked separately from re-analyses. They don't trigger a new Claude call — they directly edit the current `analysis_runs.ai_output` JSON.

When the founder approves a brief that has been edited inline, the edit-applied state is materialised: we deep-merge `analysis_edits` (in chronological order) onto the original `ai_output` to produce the snapshot used for the customer email.

```typescript
// Sketch
function materialiseEdits(run: AnalysisRun, edits: AnalysisEdit[]): typeof run.ai_output {
  let result = structuredClone(run.ai_output);
  for (const edit of sortBy(edits, 'edited_at')) {
    setByPath(result, edit.field_path, edit.value_after);
  }
  return result;
}
```

This snapshot is what the brief email uses. The original `ai_output` is preserved in the DB for audit.

## Where to look next

- `apps/agent/src/lib/claude.ts` — the implementation.
- `docs/data-model.md` — `analysis_runs`, `analysis_edits`, `llm_calls` schema.
- `docs/specs/founder-review-flow.md` — how the CRM consumes the output of this service.
- `docs/specs/email-templates.md` — how the brief email renders the materialised snapshot.
- `niche-briefs/*.md` — the niche context loaded into the prompt.
