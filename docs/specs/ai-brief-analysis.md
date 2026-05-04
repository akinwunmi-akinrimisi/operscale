# AI brief analysis service

**Status:** Authoritative for Phase 1 (V2 content migration).
**Owner:** Akinwunmi.
**Last updated:** 2026-05-04.

This document specifies the AI brief analysis service — the asynchronous worker that turns a submitted form payload into a founder-ready analysis. It is the central content-generation surface of the platform and the place where the no-fabrication rule (`docs/specs/content-types-allowed.md`), the framework × archetype banks (`docs/specs/script-frameworks.md`, `docs/specs/angle-archetypes.md`), the deterministic seeding system (`docs/specs/non-duplication-system.md`), and the four-lens research methodology (`docs/specs/research-methodology.md`) all converge.

If you change anything in those five files, this spec is the integration surface and must be updated in the same commit.

## 1. What this service does

When a customer submits the intake form, the form-submission endpoint enqueues an `ai_analysis_job`. The agent service (port 3002) picks the job up within seconds and runs the analysis, which produces a structured JSON output the founder reviews in the CRM.

Concretely the service:

1. Loads the brief, photos, niche brief, framework bank, and archetype bank.
2. Computes a deterministic per-customer seed (per `docs/specs/non-duplication-system.md`) and selects N frameworks and N archetypes for the tier.
3. Constructs a four-layer prompt (system framing, customer corpus, selection inputs, generation instructions).
4. Calls Claude Opus 4.7 with vision blocks for any uploaded photos.
5. Validates the structured JSON output against the schema, runs a fabrication-risk audit, and writes the run to `analysis_runs`.
6. Emits an `ai_analysis_completed` event so the CRM realtime subscription updates.

The service does not produce final scripts — it produces a *brief analysis* the founder reviews. Phase 2 production agents take the founder-approved analysis and turn it into shootable scripts, image prompts, and renders.

## 2. Inputs to the service

For every analysis run, the service has access to:

| Input | Source | Required |
|---|---|---|
| Form payload (7 steps) | `briefs.form_payload` JSONB | Yes |
| Reference posts (text + URLs) | Form step 6 | Optional |
| Reference photos | Supabase Storage `customer-photos` bucket | Optional |
| Brand logo | Supabase Storage `customer-logos` bucket | Optional |
| Niche brief markdown | `niche-briefs/<niche>.md` on disk | Yes |
| Framework bank | `docs/specs/script-frameworks.md` (excerpts loaded by slot) | Yes |
| Archetype bank | `docs/specs/angle-archetypes.md` (excerpts loaded by slot) | Yes |
| Framework seed | Computed pre-prompt per `docs/specs/non-duplication-system.md` | Yes |
| Customer history (for repeat customers) | `customer_framework_history` table | Yes for repeat |
| Re-analysis context (if applicable) | `analysis_runs.founder_note`, prior run output | Conditional |

Photos enter the prompt as vision blocks. URLs in reference-posts are fetched server-side and the page text is included verbatim (subject to a 50KB-per-URL truncation cap, per `docs/security.md`).

## 3. The four-layer prompt structure

V2 organises the prompt as four named layers, in order. The layers are concatenated into the `system` and `user` messages sent to Claude.

```
LAYER 1 — System framing      (Claude `system` parameter)
LAYER 2 — Customer corpus      (first `user` message content)
LAYER 3 — Selection inputs     (second `user` message content)
LAYER 4 — Generation instructions (third `user` message content)
```

Each layer is documented below with its full rendered template. The `{{double_brace}}` markers indicate values the application substitutes before the call.

### 3.1 Layer 1 — System framing

This is the Claude `system` parameter. It establishes role, constraints, and the schema the model must obey.

```
You are a senior content strategist at a Lagos-based SMB content agency. You have eight years
of experience producing short-form social-video calendars for African and global SMBs across
beauty, real-estate, fashion, fintech, health, food, and education. You are technically literate
in copywriting frameworks, you read brand voice as a researcher rather than a fan, and you write
briefs that another senior producer could shoot from without you.

Your job in this conversation is to produce a structured brief analysis for ONE customer's
content calendar. The output is reviewed by the agency founder before anything is sent to the
customer; you are the analyst, not the final approver.

Three rules govern everything you produce. Internalise them; they override every other instinct.

RULE 1 — NO FABRICATION.
You produce content ABOUT the customer's business — never invented content FROM the customer's
biography. Specifically:
  - You do NOT invent founder origin stories. If the customer typed "I started this business in
    2019 because I couldn't find good products" in form step 6, you may use that. If the customer
    did not write a backstory, you do not produce one.
  - You do NOT invent customer testimonials, transformations, or named-customer narratives.
    Outcomes are spoken at the category level ("clients commonly see X"), never with invented
    individual names.
  - You do NOT invent family or cultural background ("my grandmother taught me", "my mum's
    recipe") unless the customer explicitly stated it.
  - First-person opinion IS allowed ("In my experience X..."). Generic authority numbers ARE
    allowed ("After hundreds of inspections..."). The line is between opinion the customer
    plausibly holds and biographical claims that would be lies if challenged.
  - Full taxonomy: see docs/specs/content-types-allowed.md.

RULE 2 — FRAMEWORKS BY NAME OF FRAMEWORK, NOT BY NAME OF MARKETER.
You reference structural patterns by their canonical names (DR Formula, PAS, AIDA, Value
Equation, Hook Stack, Open Loop, Pattern Interrupt, Myth-Buster, etc.). You do NOT write "in the
style of [marketer's name]". The frameworks are tools; the names of the people who taught them
are not part of the customer's deliverable.

RULE 3 — DETERMINISTIC SELECTION.
The frameworks and archetypes you may use have already been selected by a deterministic seed
(passed to you in Layer 3). You do NOT pick from outside that selection. If a framework or
archetype is not in the selection list, it is not available for this customer for this order.

You produce output in valid JSON matching the schema in Layer 4. No prose outside the JSON. No
preamble. No "here is the analysis" line. Just the JSON object.
```

### 3.2 Layer 2 — Customer corpus

This is the first `user` message. It contains everything the model needs to know about the customer. Photos enter as vision blocks before the text.

```
[Vision blocks: 1 to N customer reference photos, each as a base64 image_url block]
[Vision block: customer brand logo if present]

# CUSTOMER CORPUS

## Form payload

The customer submitted this form on {{submitted_at_iso}} (WAT).

### Step 1 — Who they are
- Brand name: {{brand_name}}
- Owner name: {{owner_name}}
- WhatsApp: {{phone_e164}}
- Email: {{email}}

### Step 2 — Niche and offer
- Niche: {{niche_slug}} ({{niche_label}})
- One-line description: {{one_line_description}}
- What they sell: {{offer_description}}
- Price point band: {{price_point_band}}

### Step 3 — Audience
- Primary audience: {{primary_audience_description}}
- Audience age range: {{audience_age_range}}
- Audience location: {{audience_location}}
- What audience already believes: {{audience_belief}}
- What audience needs to believe to buy: {{audience_belief_target}}

### Step 4 — Brand assets
- Logo uploaded: {{logo_uploaded_yes_no}}
- Brand colours (if stated): {{brand_colours}}
- Existing IG handle: {{instagram_handle}}

### Step 5 — Photos
- Photos uploaded: {{photo_count}} (see vision blocks above)
- Photo consent: {{photo_consent_yes_no}}

### Step 6 — Voice and references
- Stated brand voice: {{stated_voice}}
- Reference posts (verbatim text and URL-fetched bodies):
  {{reference_posts_block}}
- What customer wrote about their backstory (verbatim, may be empty):
  {{customer_backstory_verbatim}}

### Step 7 — Calendar choice
- Tier: {{tier}}
- Number of videos: {{video_count}}
- Number of carousels: {{carousel_count}}

## Niche brief

The following is the agency's niche brief for {{niche_slug}}. Use it as authoritative context on
audience, voice, restricted claims, and topic library — but never substitute it for the customer's
own stated voice or facts.

{{niche_brief_full_text}}
```

### 3.3 Layer 3 — Selection inputs

This is the second `user` message. It carries the deterministic selection and the relevant excerpts of the framework and archetype banks.

```
# SELECTION INPUTS

## Framework seed

The deterministic seed for this analysis was computed as:

  seed_inputs:
    customer_id: {{customer_id}}
    niche: {{niche_slug}}
    order_index: {{order_index}}
    submission_week_iso: {{submission_week_iso}}
  seed_hash: {{seed_hash_hex}}

## Selected frameworks (for this {{tier}} order)

You will use these {{n_frameworks}} frameworks, no others:

{{framework_excerpts_block}}

## Selected archetypes (for this {{tier}} order)

You will use these {{n_archetypes}} archetypes, no others:

{{archetype_excerpts_block}}

## Selected pairs

The deterministic pairing assigns each video slot a (framework, archetype) pair as follows:

{{pair_assignments_table}}

## Customer history (repeat customers only)

The following (framework, archetype) pairs have been delivered to this customer in prior orders
and are excluded from re-use unless the bank is exhausted:

{{customer_history_excluded_pairs_block}}

## Bank exhaustion flag

{{bank_exhaustion_block}}
  // Either: "Not exhausted. Selection drew from the unused bank for this customer."
  // Or:     "EXHAUSTED — this customer has run through the unused bank. The selection above
  //         used least-recently-used pairs as fallback. Flag this for the founder in your
  //         output's `flags_for_review` field with reason 'bank_exhausted_lru_fallback'."

## Re-analysis context

{{reanalysis_context_block}}
  // Only present when trigger_type = 're_analyze_with_note'. Contains the founder's note and
  // a summary of the prior run's output (whichever fields the founder marked as needing change).
```

### 3.4 Layer 4 — Generation instructions

This is the third `user` message. It is the operational instruction set for the analysis: the four lenses to run, the output shape, and the audit step.

```
# GENERATION INSTRUCTIONS

Run the following process in order. Do not skip steps. Each lens informs the next.

## Lens 1 — Voice extraction

Read the customer's reference posts (Layer 2 step 6) and stated voice. Identify:
  - Two to four phrases the customer uses repeatedly that are theirs (not generic).
  - The customer's typical sentence rhythm (short and punchy / mid-length / dense).
  - Words the customer would NOT use (terms that would feel out of register).
  - Energy register (calm, urgent, playful, authoritative, irreverent, warm).

If reference posts are absent or thin, fall back to the niche brief defaults but flag the
thinness in `flags_for_review` with reason 'thin_voice_corpus'.

## Lens 2 — Specificity inventory

Read the customer's offer description, audience description, and any URL-fetched bodies. Extract:
  - Concrete numbers (price points, time-to-result, quantities).
  - Concrete proper nouns (brand names, neighbourhood names, product line names).
  - Concrete process steps the customer described (do not invent — only extract).

These specifics will be re-used across scripts so the calendar reads as informed, not generic.
If the corpus is empty of specifics, flag 'thin_specificity_corpus'.

## Lens 3 — Expertise mapping

Read the offer description and identify what the customer KNOWS that their audience does not.
Phrase each expertise nugget as: "Customers in this niche often don't realise that {{X}}."
These nuggets seed Educational / Myth-Buster / Decoded-Jargon scripts.

## Lens 4 — Visual aesthetic

If photos are present (vision blocks in Layer 2), describe:
  - Lighting register (warm/cool/neutral; soft/harsh).
  - Setting type (studio, home, retail, outdoor).
  - Wardrobe and prop register.
  - Photo quality and confidence (do NOT critique — describe).

If no photos, infer from the niche brief's photo-aesthetic notes and the customer's stated voice;
flag 'no_photos_uploaded' so the founder knows to set Phase 2 production toward stock-presenter.

## Compose the analysis

Produce a single JSON object with this exact shape:

{
  "brand_voice": {
    "voice_phrases": ["string", ...],
    "sentence_rhythm": "short_punchy | mid_length | dense",
    "avoid_words": ["string", ...],
    "energy_register": "calm | urgent | playful | authoritative | irreverent | warm",
    "voice_corpus_quality": "thick | thin | absent"
  },
  "specificity_inventory": {
    "numbers": ["string", ...],
    "proper_nouns": ["string", ...],
    "process_steps": ["string", ...],
    "specificity_corpus_quality": "thick | thin | absent"
  },
  "expertise_map": [
    {"nugget": "string", "framework_affinity": ["framework_slot", ...]}
  ],
  "visual_aesthetic": {
    "lighting": "string",
    "setting": "string",
    "wardrobe_props": "string",
    "photo_quality_summary": "string",
    "photos_present": true | false
  },
  "calendar_plan": [
    {
      "slot_index": 1,
      "day": 1,
      "format": "ugc_30s | ugc_60s | t2v_quality | t2v_budget | carousel",
      "framework_slot": "string (must be in selected_frameworks)",
      "archetype_slot": "string (must be in selected_archetypes)",
      "topic": "string (the angle this slot covers, derived from the lenses above)",
      "hook": "string (one-line opener that obeys the framework's hook style)",
      "core_beats": ["string", ...],
      "cta": "string",
      "fabrication_risk_check": "passed | escalate"
    }
  ],
  "fabrication_audit": {
    "lines_checked": "integer",
    "violations_found": [
      {"slot_index": "integer", "line": "string", "violation": "string"}
    ],
    "audit_passed": true | false
  },
  "flags_for_review": [
    {"reason": "string (e.g. 'bank_exhausted_lru_fallback', 'thin_voice_corpus')", "detail": "string"}
  ]
}

## Run the fabrication audit

After composing `calendar_plan`, walk every `hook`, every entry in `core_beats`, and every `cta`.
For each line, ask:
  - Does this line claim a biographical fact about the customer? If yes, is that fact in
    `customer_backstory_verbatim` from Layer 2? If not, the line FAILS.
  - Does this line attribute a story to a named individual customer? If yes, the line FAILS.
  - Does this line use a phrase like "in the style of [marketer]"? If yes, the line FAILS.

Set `fabrication_risk_check` per slot. If any slot fails, populate `fabrication_audit.violations_found`
and set `audit_passed = false`. Re-write the offending slots BEFORE finalising the JSON. Do not
emit a JSON with `audit_passed = false` unless you have rewritten and the violations persist —
in which case the founder review will catch it.

## Output

Emit ONLY the JSON object. No prose. No code fence. No preamble.
```

## 4. Model and call configuration

| Setting | Value |
|---|---|
| Model | `claude-opus-4-7` |
| `max_tokens` | 16384 (tier-standard) — bump to 24576+ for tier-calendar's 44-slot output |
| `system` | Layer 1, rendered |
| `messages` | Three `user` messages: Layer 2 (with vision blocks), Layer 3, Layer 4 |
| Streaming | No (we want the complete JSON before writing to `analysis_runs`) |
| Timeout | 180 seconds |
| Retry policy | One retry on 5xx or timeout. Hard fail to `ai_analysis_failed` after second failure. |

Vision blocks are constructed from the `customer-photos` Supabase Storage bucket. Maximum five photos per analysis (form caps at five uploads). Brand logo enters as a separate vision block before the photos.

**Temperature note (2026-05-04 update).** The `temperature` parameter is deprecated for Claude Opus 4.7 — the API returns `400 invalid_request_error: "temperature is deprecated for this model"` if the field is present. The model uses its built-in default for output sampling. An earlier draft of this spec mandated `temperature: 0.4`; that mandate is removed and the field MUST NOT be sent. Output stability is now governed by the deterministic seed system (`docs/specs/non-duplication-system.md`) and the strict Layer 4 schema rather than by client-side temperature shaping.

## 5. Cost and latency

| Metric | Typical | Worst case |
|---|---|---|
| Input tokens | 18,000 to 32,000 | 48,000 (Calendar tier with 5 photos and rich reference posts) |
| Output tokens | 3,500 to 6,500 | 8,000 (Calendar tier) |
| Cost per call (Opus 4.7 pricing as of 2026-05) | $0.30 to $0.55 | $0.85 |
| Latency | 35 to 75 seconds | 140 seconds |

Cost analysis is documented in `docs/runbooks/cost-monitoring.md`. The CRM cost-monitoring view queries `llm_calls` for these metrics live.

## 6. Output validation

Before writing to `analysis_runs.ai_output`, the service validates the model's JSON:

1. **Shape validation.** JSON parse must succeed. The top-level shape must contain all six keys (`brand_voice`, `specificity_inventory`, `expertise_map`, `visual_aesthetic`, `calendar_plan`, `fabrication_audit`, `flags_for_review`). Missing keys → fail to `ai_analysis_failed`.
2. **Slot count validation.** `calendar_plan.length` must equal the tier's video + carousel count. Mismatch → fail.
3. **Selection validation.** Every `framework_slot` and `archetype_slot` referenced in `calendar_plan` must be present in the selection list passed in Layer 3. A reference outside the selection → fail (this catches model drift).
4. **Audit validation.** If `fabrication_audit.audit_passed === false` AND `violations_found.length > 0`, the run is written but flagged for the founder with reason `fabrication_audit_failed`. The founder reviews the flagged slots before approval.

Validation failures write to `activity_log` with event `ai_analysis_failed` and a `payload.reason` field that is one of the four cases above.

## 7. Re-analysis paths

The founder review screen (per `docs/specs/founder-review-flow.md`) exposes two re-analysis buttons:

- **Re-analyze (same frameworks).** Reuses the framework_seed from the prior run. The selection list does not change. The model receives a `reanalysis_context_block` containing the founder's note and a summary of the fields the founder flagged as needing change.

- **Re-analyze (new frameworks).** Computes a new framework_seed by appending the run_index to the seed inputs (so the hash changes deterministically). Selects a new framework × archetype set, excluding the prior run's set as well as historical pairs. The model receives a new Layer 3 with the new selection.

In both cases:
- A new row is inserted into `analysis_runs` with `run_index = previous + 1`, `trigger_type = 're_analyze_with_note'`, and the prior run's `is_current` is set to `false`.
- No row is written to `customer_framework_history` until founder approval. Re-analyses that are subsequently discarded never enter the history.

## 8. The fabrication-risk audit — operational notes

The audit step in Layer 4 is the model's self-check, not the only check. Two further checks happen post-call:

- **Application-side regex sweep.** The service runs a regex sweep over every string in `calendar_plan` for forbidden phrases: `/my (mum|grandmother|mother|grandma)/i`, `/i started this (business|brand|company) because/i`, `/customer transformation/i`, `/in the style of [A-Z][a-z]+ [A-Z][a-z]+/`. Any match is appended to `fabrication_audit.violations_found` post-hoc and the run is flagged.

- **Founder review.** The CRM highlights any line in `calendar_plan` that contains first-person backstory verbs (`started`, `learned from`, `taught me`, `inherited`) for the founder's eye. The founder either confirms the line is grounded in `customer_backstory_verbatim` or rewrites it.

The point of three layers (model self-audit, regex sweep, founder review) is that no single layer catches everything. The model sometimes rationalises violations; regex catches the lexical forms; the founder catches semantic drift the regex misses.

## 9. Activity log events

The service writes the following events to `activity_log`:

- `ai_analysis_started` — when the job picks up. `payload` includes `brief_id`, `trigger_type`, `seed_hash`.
- `ai_analysis_completed` — on successful validation. `payload` includes `run_id`, `cost_usd`, `duration_ms`, `audit_passed`, `flags_for_review_count`.
- `ai_analysis_failed` — on any failure. `payload` includes `reason` (one of the validation failure cases) and `error_detail`.
- `ai_reanalyze_requested` — when the founder triggers a re-analysis. `payload` includes `note`, `same_or_new_frameworks`.

These events are subscribed to by the CRM realtime layer, so the founder sees the queue update without refresh.

## 10. What this service is NOT

To prevent scope creep, the AI brief analysis service does NOT:

- Produce final shootable scripts. That is Phase 2.
- Render any video, image, or carousel asset. That is Phase 2.
- Send any customer-facing communication. The founder review screen is the only path to customer messaging.
- Make pricing decisions. Pricing is fixed per `docs/pricing-and-packages.md`.
- Modify the framework or archetype banks. Those are content edits to `docs/specs/script-frameworks.md` and `docs/specs/angle-archetypes.md` and require a deliberate commit.
- Update `customer_framework_history`. That table is written by the founder-approval handler, not by the analysis service.

If a feature request would expand the service into one of these areas, the answer is: it belongs in a different service. Add an ADR.

## 11. Cross-references

- `docs/specs/content-types-allowed.md` — the no-fabrication rule the prompt enforces.
- `docs/specs/script-frameworks.md` — the framework bank Layer 3 draws from.
- `docs/specs/angle-archetypes.md` — the archetype bank Layer 3 draws from.
- `docs/specs/non-duplication-system.md` — the deterministic seeding system.
- `docs/specs/research-methodology.md` — the four-lens methodology Layer 4 runs.
- `docs/specs/founder-review-flow.md` — what happens to this service's output downstream.
- `docs/data-model.md` — the `analysis_runs`, `analysis_edits`, `customer_framework_history`, and `llm_calls` tables.
- `docs/runbooks/cost-monitoring.md` — the operational view onto this service's cost.
- `docs/adr/0010-no-fabrication-content-rule.md` — the architectural decision behind Rule 1.
- `docs/adr/0011-deterministic-per-customer-seeding.md` — the architectural decision behind the seed system.
- `docs/adr/0012-frameworks-by-name-not-by-marketer.md` — the architectural decision behind Rule 2.
- `docs/adr/0013-trending-deferred-to-phase-2.md` — explains the empty `trending_context` slot reserved in Layer 2 for Phase 2.
