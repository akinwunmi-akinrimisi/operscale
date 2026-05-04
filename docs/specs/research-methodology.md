# Research methodology

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt.
**Last updated:** 2026-05-04.

This document specifies how the AI brief-analysis system extracts grounded material from each customer's intake — form data, reference posts, uploaded photos, niche briefs — to ensure every framework + archetype combination produces content that is *specific* to the customer and *honest* about the source.

It pairs with `docs/specs/script-frameworks.md` (the structures), `docs/specs/angle-archetypes.md` (the topics), `docs/specs/non-duplication-system.md` (the selection mechanism), and `docs/specs/content-types-allowed.md` (the no-fabrication rule).

The principle: the deterministic seeding picks *what* the AI talks about, but the research methodology determines *how grounded* the talking is. A perfectly-selected framework × archetype combination on a customer with no usable material produces hollow content. The methodology is what makes the substrate worth selecting from.

## 1. The intake corpus

For every brief, the AI has access to four primary sources of material:

### 1.1 Form payload (always present)

The structured fields from the 7-step form. Specifically:

- **Step 1**: tier intent.
- **Step 2**: business basics — name, niche, business description, target audience, primary product/service, stated pricing.
- **Step 3**: content direction — goals for the calendar, what they want to emphasise, what they don't want to emphasise.
- **Step 4**: brand assets — uploaded logo, brand colours, optional moodboard images.
- **Step 5**: reference photos (optional) + consent.
- **Step 6**: founder voice — questions about how they talk, who they sound like, what's "on-brand" vs "off-brand", any explicit anecdotes they want featured (with consent), founder origin story (if they choose to share, with consent — see edge case 5.2 in `content-types-allowed.md`).
- **Step 7**: reference content — pasted captions, social handles, links to existing content.

### 1.2 Reference content (often present)

URLs and pasted content from step 7. The AI may follow URLs (within the agent service's network policy) and parse pasted content. This is the highest-signal source for tone, register, and linguistic patterns.

### 1.3 Uploaded photos (optional, ~40% of customers)

If the customer uploaded photos in step 5, the AI uses Claude's vision capability to extract:

- Wardrobe and styling cues.
- Lighting register.
- Setting / environment.
- Subject positioning and energy.
- Brand-relevant visual signals (palette, texture, mood).

The vision pass produces structured output that feeds the `photo_aesthetic` block of the brief analysis.

### 1.4 Niche brief (always present)

The relevant niche brief from `niche-briefs/<niche>.md`. This is the AI's domain context — what kind of language works in this niche, what's restricted, what the typical audience cares about, what sample tone anchors look like.

## 2. The four research lenses

The AI applies four lenses to the corpus, each surfacing a different kind of grounding:

| Lens | Surfaces | Used by |
|---|---|---|
| Voice extraction | Tone, register, vocabulary, sentence rhythm | `brand_voice` block |
| Specificity hunt | Concrete numbers, names, products, services | Framework hooks, archetype topics |
| Expertise mapping | What the customer claims to know | Archetype selection grounding |
| Visual cataloguing | Aesthetic, palette, setting | `visual_style` and `photo_aesthetic` blocks |

Each lens has its own methodology.

## 3. Lens 1 — Voice extraction

The objective: produce a `brand_voice` block that, when injected into a script generator's prompt, makes scripts sound like the customer.

### 3.1 Inputs

In order of decreasing weight:

1. **Customer's pasted reference posts (step 7).** Highest weight. This is voice in the wild.
2. **Customer's URLs to social handles (step 7).** AI fetches and parses recent captions — typically 5-10 posts.
3. **Customer's free-text answers in steps 3 and 6.** Medium weight. The way customers describe their own brand often differs from how they post in public.
4. **Customer's business description in step 2.** Low weight — usually polished marketing language, not natural voice.
5. **Niche brief sample reference fallbacks.** Used only if 1-4 are thin. Anchors the voice block to niche-typical patterns.

### 3.2 Methodology

The AI runs four passes:

**Pass 1 — Tonal classification.** Read all available material. Classify on three axes:
- Formal ↔ Casual (where on the spectrum?)
- Reserved ↔ Expressive (how much energy?)
- Authoritative ↔ Conversational (which posture?)

Output: a 1-2 sentence tone summary. Example: *"Warm and conversational, with light expert framing. Comfortable using Pidgin interjections naturally. Neither overly formal nor performatively casual."*

**Pass 2 — Vocabulary patterning.** Extract recurring words, phrases, sentence openers, and structural patterns. Identify:
- Cultural/local language markers (Pidgin, Yoruba/Igbo/Hausa phrasing, specific Nigerian references).
- Field-specific vocabulary the customer uses comfortably.
- Idiosyncratic phrases ("trust me, baby", "no wahala", "the thing is").
- Sentence-opening patterns ("Let me tell you", "Here's the thing", "OK so").

Output: structured lists.
- `do_say` — phrases the customer naturally uses.
- `do_not_say` — phrases that feel off-brand for them (e.g. corporate jargon for a casual founder; unfiltered slang for a clinical educator).

**Pass 3 — Structural patterning.** How the customer constructs ideas:
- Sentence length distribution (short and punchy? long and considered?).
- Argument structure (claim-first vs setup-first?).
- Where do CTAs land?
- Use of questions, lists, repetition, contrast.

Output: structural notes that the script generator uses for pacing.

**Pass 4 — Edge case and red-flag check.** Look for:
- Biographical claims appearing repeatedly across posts (5+ times — these become usable; once-off mentions are not).
- Restricted-niche language patterns (medical claims, financial guarantees, etc.).
- Unsubstantiated outcome claims that the customer might want repeated but the AI flags.

Output: flags for founder review.

### 3.3 The brand_voice block format

```json
{
  "tone_summary": "1-2 sentences describing the overall register",
  "register_axes": {
    "formal_casual": 0.3,           // 0 = fully formal, 1 = fully casual
    "reserved_expressive": 0.6,
    "authoritative_conversational": 0.5
  },
  "do_say": ["specific phrase 1", "specific phrase 2", ...],
  "do_not_say": ["jargon to avoid 1", "register mismatch 2", ...],
  "structural_notes": "1-3 sentences on sentence rhythm and argument flow",
  "established_biographical_facts": [
    "facts mentioned 5+ times across reference material — usable as customer-stated"
  ],
  "voice_confidence": 0.85,         // how confident the AI is in this profile
  "voice_source_count": 7,          // how many distinct reference items contributed
  "fabrication_risk_flags": []
}
```

### 3.4 Voice confidence

If `voice_source_count < 3`, the AI sets `voice_confidence < 0.6` and flags the brief for founder attention with: *"Voice extraction was based on limited reference material. Consider re-analyzing after asking the customer for more reference posts."*

## 4. Lens 2 — Specificity hunt

The objective: surface concrete specifics the AI can use as hooks, examples, and grounding details.

### 4.1 Inputs

All form fields and reference material. The AI extracts every:

- **Number** with context (price, count, duration, percentage).
- **Named product or service** the customer offers.
- **Named location** the customer operates in (specific neighbourhoods, markets, venues).
- **Stated process step** with detail (timeline, tools, methods).
- **Specific competitor mention** (used as category context, not as direct attack target).
- **Cited regulation or industry body** (CBN, NAFDAC, NDPC, FIRS, ICAN, etc.).

### 4.2 Methodology

The AI builds a `specificity_inventory` of every concrete detail it found, with provenance:

```json
{
  "specificity_inventory": [
    {
      "type": "price",
      "value": "₦85,000",
      "context": "signature ankara dress",
      "source": "form_step_2",
      "confidence": "stated"
    },
    {
      "type": "duration",
      "value": "14 hours",
      "context": "hand-finishing one piece",
      "source": "form_step_6",
      "confidence": "stated"
    },
    {
      "type": "count",
      "value": "220",
      "context": "inspections in 4 years",
      "source": "form_step_3",
      "confidence": "stated"
    },
    ...
  ]
}
```

`confidence` values:
- `stated` — customer typed it explicitly.
- `referenced` — appeared in reference posts repeatedly.
- `inferred` — AI inferred from context (lowest confidence; flag for founder).

### 4.3 How specifics feed scripts

The script generator (Phase 2) consumes the specificity inventory. When it composes a hook for a Specificity Stack framework, it picks from the `stated` items first. When it needs a hook for a Cost Reveal, it pulls the price item. When it needs a Quality Tells example, it draws from the stated process steps.

If the inventory is thin (< 5 items), the AI flags: *"Specificity hunt produced limited grounding. Consider re-analyzing after asking the customer for more concrete details (specific prices, timelines, methodologies)."*

## 5. Lens 3 — Expertise mapping

The objective: identify what the customer claims to know — their domain expertise — so that archetype selection is grounded.

### 5.1 Inputs

Steps 2, 3, 6 of the form (where the customer describes themselves and their work). Reference content where the customer demonstrates knowledge.

### 5.2 Methodology

The AI extracts an `expertise_map`:

```json
{
  "expertise_map": {
    "stated_credentials": ["e.g. 'real estate agent', 'NAFDAC-registered formulator'"],
    "stated_experience_scope": ["e.g. '4 years', '200+ inspections', '800+ students'"],
    "stated_specialisms": ["e.g. 'Lekki and Ikoyi properties', 'sensitive skin formulations'"],
    "stated_methodology": ["e.g. 'I use a 7-point pre-purchase audit'", "'My ingredient screen rules out X'"],
    "implied_competence": ["e.g. 'casually references CBN circular dates' = financial regulatory awareness"],
    "knowledge_gaps_flagged": ["areas where the customer didn't claim expertise that AI shouldn't infer"]
  }
}
```

This map drives archetype selection in two ways:

**Direct grounding.** An archetype like Insider Checklist requires expertise to draw on. The expertise map confirms whether the customer has stated enough to ground that archetype.

**Avoidance.** If the customer's expertise map shows no claimed credentials in a particular sub-area, the AI avoids archetypes that would require that expertise. Example: a fashion designer who didn't claim sourcing knowledge shouldn't get Sourcing Breakdown content (which requires it).

### 5.3 Knowledge gap handling

When an archetype's grounding requires expertise the customer hasn't demonstrated, the AI has three options:

1. **Skip the archetype** — pick the next-best from the available pool (handled by the non-duplication system's affinity scoring).
2. **Flag for founder** — *"This selection would benefit from the customer providing more detail on [topic]. Re-analyze after asking?"*
3. **Use industry-level grounding** — fall back to public knowledge from the niche brief instead of customer expertise. Lower-trust, but valid. Flag in the analysis output.

The default is option 1 unless the seed has forced an otherwise-deprioritized archetype.

## 6. Lens 4 — Visual cataloguing

The objective: extract aesthetic signals from photos, brand assets, and reference content to populate the `visual_style` and `photo_aesthetic` blocks.

### 6.1 Inputs

- Customer-uploaded reference photos (step 5).
- Customer-uploaded logo and brand colours (step 4).
- Customer-uploaded moodboard images (step 4, optional).
- Visual content from referenced URLs.

### 6.2 Methodology — Photos

For each uploaded photo, Claude vision extracts:

- **Wardrobe details** — colour palette, style register (formal/casual/athletic/etc.), specific notable items.
- **Lighting register** — natural daylight, golden hour, indoor warm, indoor cool, fluorescent, mixed.
- **Setting** — indoor home, outdoor urban, studio, kitchen, office, natural environment.
- **Subject energy** — posed/candid, smiling/serious, action/static.
- **Composition** — close-up/mid/wide, framing tendencies.
- **Background palette** — dominant colours.

These feed the `photo_aesthetic` block, which is used by:
- The HeyGen avatar generation pipeline (informs avatar wardrobe and lighting).
- The visual style recommendation block.
- The brief email's "visual direction preview" content.

### 6.3 Methodology — Brand assets

The customer's logo and brand colours feed directly into the `visual_style` block:

```json
{
  "visual_style": {
    "recommended_palette": ["#hex1", "#hex2", "#hex3"],
    "recommended_typography": "Inter / Poppins / etc. (matched to niche)",
    "recommended_camera_treatment": "warm natural daylight, mid-shot framing, shallow depth of field",
    "recommended_caption_style": "large bold word-by-word kinetic / lower-third subtitle / etc.",
    "logo_url": "...",
    "brand_colour_dominance": ["primary", "secondary", "accent"],
    "moodboard_signals": [...] // if customer uploaded moodboard
  }
}
```

### 6.4 No-fabrication checks on visual lens

Things the visual lens *cannot* do:

- Cannot infer biographical details from photos. ("This looks like the customer in their childhood kitchen" → no, we don't know.)
- Cannot infer outcomes from photos. ("Customer's skin looks better than typical" → no, we don't have before/after consent.)
- Cannot identify named individuals other than the customer themselves. (If a photo includes other people, we treat them as background — never reference them.)

The AI flags any photo that contains likely-non-customer faces with: *"Photo contains additional people. Will not be used for avatar generation; will not be referenced in scripts."*

## 7. The synthesis — composing the brief analysis

After all four lenses run, the AI synthesises a single coherent brief analysis output:

```json
{
  "brief_summary": "1-2 paragraphs",
  "brand_voice": { ... lens 1 output ... },
  "specificity_inventory": [ ... lens 2 output ... ],
  "expertise_map": { ... lens 3 output ... },
  "visual_style": { ... lens 4 output ... },
  "photo_aesthetic": { ... lens 4 output ... },
  "framework_seed": { ... from non-duplication-system.md ... },
  "recommended_angles": [
    {
      "framework": "DR_FORMULA",
      "archetype": "PRICING_BREAKDOWN",
      "hook": "specific hook line drawn from grounded specifics",
      "core_message": "1-2 sentences",
      "specifics_used": ["from specificity_inventory"],
      "expertise_grounding": ["from expertise_map"]
    },
    ... one per slot ...
  ],
  "sample_script_seed": {
    "framework": "<one of the selected>",
    "archetype": "<one of the selected>",
    "draft_30s_script": "...",
    "specifics_grounded_in": [...],
    "no_fabrication_check": "passed | flagged"
  },
  "should_upsell": false,
  "upsell_recommendation": null,
  "flags": [
    { "type": "fabrication_risk", "concern": "...", "where": "..." },
    { "type": "voice_confidence", "concern": "...", "recommendation": "..." },
    { "type": "expertise_gap", "concern": "...", "fallback_used": "..." },
    { "type": "bank_exhaustion_warning", ... }
  ],
  "no_fabrication_summary": "All grounding verified. No biographical claims used beyond customer-stated facts.",
  "cost_usd": 0.18,
  "duration_ms": 47000
}
```

The `recommended_angles` array has one entry per slot from the framework_seed. Each entry's hook and core_message draw from the specificity inventory and expertise map, ensuring every angle is grounded.

The `sample_script_seed` is one fully-drafted 30s script, used for the brief email's "what your content might look like" preview. Always uses one of the selected pairs, always grounded.

## 8. The fabrication-risk audit

After synthesis, the AI runs a final pass that audits its own output against the no-fabrication rule. For each line of script seed and each hook in `recommended_angles`, it checks:

- Does this line claim a specific event? If yes, is the event in the customer-provided material?
- Does this line claim a specific person? If yes, did the customer provide consent?
- Does this line use "I" plus a biographical claim? If yes, can the claim be found in the material?
- Does this line cite a specific number? If yes, is it in the specificity_inventory?

Any line that fails the audit is either rewritten or flagged. The output's `no_fabrication_summary` field reflects the audit result.

The founder review screen surfaces all `fabrication_risk` flags prominently. A brief with unresolved flags cannot be auto-approved; the founder must explicitly clear each flag.

## 9. Voice mimicry vs voice channeling

A subtle distinction worth being explicit about.

**Voice mimicry** is producing text that sounds like a specific named person. We don't do this — see ADR 0012 on frameworks-by-name-of-framework, not by name-of-marketer.

**Voice channeling** is producing text that sounds like the customer themselves, based on extracted patterns from their own material. This is exactly what we do.

The script generator never receives instructions like "write this in the style of [famous marketer]". It receives the customer's own voice block, anchored to their own reference material.

## 10. When the corpus is thin

If a customer submits a brief with:

- Short business description (< 100 words).
- No reference posts pasted.
- No URLs to social accounts.
- No reference photos.
- Brief or generic answers in steps 3 and 6.

…then all four lenses produce thin output. The AI's response:

1. Mark `voice_confidence` < 0.5.
2. Mark `specificity_inventory` length < 5.
3. Mark `expertise_map.stated_experience_scope` empty or thin.
4. Set the brief's overall `corpus_thinness_warning = true`.
5. Flag for founder review with: *"Customer corpus is thin. Recommended actions: (a) proceed with niche-brief-anchored fallback content, accepting lower personalisation, OR (b) reach out to customer for more reference material before approving."*

The founder decides path (a) or (b). Path (b) involves a manual outreach email — the CRM has a "request more material" action that sends a templated email asking for reference posts and a longer business description.

## 11. Re-analyze with note — how research methodology adapts

When the founder re-analyzes (either same-frameworks or new-frameworks mode), the AI receives the founder note and adapts its research:

- **"Customer wants more focus on [X]"** — AI re-runs lenses 2 and 3 with X as a priority, surfacing X-related specifics and expertise.
- **"Voice block was off — too formal"** — AI re-runs lens 1, weighting reference posts even more heavily over form-text answers (which tend to be more polished).
- **"Pricing breakdown angle missed the point"** — AI re-runs lens 2 specifically on pricing-related material, surfacing more cost components.
- **"Add more cultural specificity"** — AI re-runs lens 1 with focus on cultural language markers.

The founder's note shapes the research, and the research shapes the output.

## 12. Cost and latency

- A complete brief analysis run with all 4 lenses uses approximately 8-15K input tokens (form + reference posts + niche brief + system prompt) and produces 3-5K output tokens. At Claude Opus 4.7 pricing this lands at roughly $0.12-0.18 per call.
- Vision passes on photos add ~2-4K tokens per photo. Three photos add roughly $0.02-0.04.
- Total cost per analysis is typically $0.15-0.22.
- Latency is 60-180 seconds depending on photo count and reference post count.

These numbers feed `docs/runbooks/cost-monitoring.md`.

## 13. Cross-references

- `docs/specs/script-frameworks.md` — what the research grounds.
- `docs/specs/angle-archetypes.md` — what the research grounds.
- `docs/specs/non-duplication-system.md` — selects which framework × archetype combinations get grounded.
- `docs/specs/content-types-allowed.md` — the rule the methodology enforces.
- `docs/specs/ai-brief-analysis.md` — the prompt that orchestrates this methodology.
- `docs/specs/founder-review-flow.md` — the CRM that surfaces flags from this methodology.
- `niche-briefs/*.md` — domain-specific context for each niche.
