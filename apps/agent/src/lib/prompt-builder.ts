// Renders the four-layer V2 prompt verbatim from
// docs/specs/ai-brief-analysis.md §3.
// Pure: no I/O, no Claude calls. Phase 3 worker calls buildPromptMessages and
// passes the result to the Anthropic SDK.

import type {
  BankCatalog,
  BriefAnalyzerInput,
  BuiltPrompt,
  FrameworkSeedResult,
  PhotoBlock,
  PriorRunContext,
  PromptUserContentBlock,
  PromptUserMessage,
} from './types/v2';

// ─── Layer 1 — System framing (ai-brief-analysis.md §3.1) ───────────────────
const LAYER_1 = `You are a senior content strategist at a Lagos-based SMB content agency. You have eight years
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

You produce output in valid JSON matching the schema in Layer 4. No prose outside the JSON. No preamble. No "here is the analysis" line. Just the JSON object.`;

export function renderLayer1(): string {
  return LAYER_1;
}

// ─── Layer 2 — Customer corpus (ai-brief-analysis.md §3.2) ──────────────────
// Photos and brand logo enter as image blocks at message-assembly time
// (buildPromptMessages). This function returns only the text portion.
export function renderLayer2Text(input: BriefAnalyzerInput, nicheBriefMarkdown: string): string {
  return `# CUSTOMER CORPUS

## Form payload

The customer submitted this form on ${input.submitted_at_iso} (WAT).

### Step 1 — Who they are
- Brand name: ${input.brand_name}
- Owner name: ${input.owner_name}
- WhatsApp: ${input.phone_e164}
- Email: ${input.email}

### Step 2 — Niche and offer
- Niche: ${input.niche_slug} (${input.niche_label})
- One-line description: ${input.one_line_description}
- What they sell: ${input.offer_description}
- Price point band: ${input.price_point_band}

### Step 3 — Audience
- Primary audience: ${input.primary_audience_description}
- Audience age range: ${input.audience_age_range}
- Audience location: ${input.audience_location}
- What audience already believes: ${input.audience_belief}
- What audience needs to believe to buy: ${input.audience_belief_target}

### Step 4 — Brand assets
- Logo uploaded: ${input.logo_uploaded_yes_no}
- Brand colours (if stated): ${input.brand_colours}
- Existing IG handle: ${input.instagram_handle}

### Step 5 — Photos
- Photos uploaded: ${input.photo_count} (see vision blocks above)
- Photo consent: ${input.photo_consent_yes_no}

### Step 6 — Voice and references
- Stated brand voice: ${input.stated_voice}
- Reference posts (verbatim text and URL-fetched bodies):
  ${input.reference_posts_block || '(none provided)'}
- What customer wrote about their backstory (verbatim, may be empty):
  ${input.customer_backstory_verbatim || '(empty)'}

### Step 7 — Calendar choice
- Tier: ${input.tier}
- Number of videos: ${input.video_count}
- Number of carousels: ${input.carousel_count}

## Niche brief

The following is the agency's niche brief for ${input.niche_slug}. Use it as authoritative context on
audience, voice, restricted claims, and topic library — but never substitute it for the customer's
own stated voice or facts.

${nicheBriefMarkdown}`;
}

// ─── Layer 3 — Selection inputs (ai-brief-analysis.md §3.3) ─────────────────
function renderHistoryBlock(seed: FrameworkSeedResult): string {
  if (!seed.lru_fallback_used || !seed.lru_pairs_reused || seed.lru_pairs_reused.length === 0) {
    return '(no historical pairs to exclude — first-time customer or fresh bank)';
  }
  return seed.lru_pairs_reused
    .map((p) => `- ${p.framework} × ${p.archetype} (last used ${p.last_used_at})`)
    .join('\n');
}

function renderExhaustionBlock(seed: FrameworkSeedResult): string {
  if (!seed.exhaustion_warning) {
    return 'Not exhausted. Selection drew from the unused bank for this customer.';
  }
  return [
    "EXHAUSTED — this customer has run through the unused bank. The selection above",
    "used least-recently-used pairs as fallback. Flag this for the founder in your",
    "output's `flags_for_review` field with reason 'bank_exhausted_lru_fallback'.",
  ].join('\n');
}

function renderFrameworkExcerpt(slot: string, catalog: BankCatalog): string {
  const entry = catalog.frameworks[slot as keyof typeof catalog.frameworks];
  if (!entry) {
    throw new Error(`renderLayer3: framework slot ${slot} not found in catalog`);
  }
  return `### ${entry.slot} — ${entry.name}\n\n${entry.markdown.trim()}`;
}

function renderArchetypeExcerpt(slot: string, catalog: BankCatalog): string {
  const entry = catalog.archetypes[slot as keyof typeof catalog.archetypes];
  if (!entry) {
    throw new Error(`renderLayer3: archetype slot ${slot} not found in catalog`);
  }
  return `### ${entry.slot} — ${entry.name}\n\n${entry.markdown.trim()}`;
}

function renderPairTable(seed: FrameworkSeedResult): string {
  const header = '| slot | framework | archetype | affinity |\n|------|-----------|-----------|----------|';
  const rows = seed.selected_pairs.map(
    (p, idx) => `| ${String(idx + 1).padStart(4, ' ')} | ${p.framework} | ${p.archetype} | ${p.affinity} |`,
  );
  return [header, ...rows].join('\n');
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

export function renderReanalysisContextBlock(prior?: PriorRunContext): string {
  if (!prior) {
    return '(none — this is the initial analysis for this brief)';
  }

  const editsBlock =
    prior.edits.length === 0
      ? '(no edits — note-only re-analysis)'
      : prior.edits
          .map(
            (e) =>
              `Field: ${e.field_path}\n  from: "${escapeQuotes(e.before)}"\n  to:   "${escapeQuotes(e.after)}"`,
          )
          .join('\n\n');

  return `Prior run id: ${prior.prior_run_id}
Prior run index: ${prior.prior_run_index}
Re-analysis mode: ${prior.mode}

### Founder note (verbatim)

${prior.founder_note}

### Edits the founder applied to the prior run

These edits are evidence of founder intent. They are NOT auto-applied to your new output —
treat them as a guide to where the prior run missed the mark, then re-derive the affected
fields from the customer corpus and the lenses.

${editsBlock}`;
}

export function renderLayer3(
  input: BriefAnalyzerInput,
  seed: FrameworkSeedResult,
  catalog: BankCatalog,
  prior?: PriorRunContext,
): string {
  const frameworkExcerpts = seed.selected_frameworks
    .map((slot) => renderFrameworkExcerpt(slot, catalog))
    .join('\n\n');
  const archetypeExcerpts = seed.selected_archetypes
    .map((slot) => renderArchetypeExcerpt(slot, catalog))
    .join('\n\n');

  return `# SELECTION INPUTS

## Framework seed

The deterministic seed for this analysis was computed as:

  seed_inputs:
    customer_id: ${seed.seed_inputs.customer_id}
    niche: ${seed.seed_inputs.niche}
    order_index: ${seed.seed_inputs.order_index}
    submission_week_iso: ${seed.seed_inputs.submission_week_iso}
  seed_hash: ${seed.seed_hash}

## Selected frameworks (for this ${input.tier} order)

You will use these ${seed.selected_frameworks.length} frameworks, no others:

${frameworkExcerpts}

## Selected archetypes (for this ${input.tier} order)

You will use these ${seed.selected_archetypes.length} archetypes, no others:

${archetypeExcerpts}

## Selected pairs

The deterministic pairing assigns each video slot a (framework, archetype) pair as follows:

${renderPairTable(seed)}

## Customer history (repeat customers only)

The following (framework, archetype) pairs have been delivered to this customer in prior orders
and are excluded from re-use unless the bank is exhausted:

${renderHistoryBlock(seed)}

## Bank exhaustion flag

${renderExhaustionBlock(seed)}

## Re-analysis context

${renderReanalysisContextBlock(prior)}`;
}
