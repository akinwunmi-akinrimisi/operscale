# Niche brief: Restricted (V2)

**Status:** Authoritative for Phase 1.
**Used by:** AI brief analysis prompt as a pre-check. CRM founder review. Form business-niche selection logic.
**Last updated:** 2026-05-04.

This is a meta-document — it doesn't describe a niche we serve, but the categories of business we **do not serve**, **conditionally serve**, or **flag for founder pre-approval**. It pairs with `docs/specs/content-types-allowed.md` for the no-fabrication rule and the seven niche-specific briefs for in-scope work.

The intake form's business-niche selection presents only the seven supported niches (beauty, real-estate, fashion-ecom, fintech, health, food, education). When a customer's business description in step 2 reveals they belong to a category in this document, the system handles them per the routing below — not by silently rejecting.

## 1. Hard-blocked categories

These businesses cannot be served by Operscale Calendar at any tier. The form-submission flow rejects them at the founder review stage, with a polite redirect email.

### 1.1 Adult content and services

Any business whose product or service involves adult content, escort services, or sexually explicit material. Hard-blocked regardless of legal status in the customer's jurisdiction.

Reasoning: AI tooling restrictions (HeyGen, Claude, fal.ai) prohibit adult content; customer audience expectations for the wider Operscale brand; payment processor constraints.

### 1.2 Gambling and betting

Sports betting, online casinos, lottery, prediction markets, anything where the customer's business is gambling-product-led.

Reasoning: regulatory exposure (Nigerian gambling licensing), audience-protection concerns, risk of fabricated win-rate claims.

Edge case that's still blocked: "responsible gambling education" content from a gambling brand.

### 1.3 Multi-level marketing / pyramid recruitment

Any business whose primary revenue model depends on recruiting other sellers rather than selling to end users.

Reasoning: regulatory exposure, audience-protection concerns, content would inevitably involve recruitment-promise claims that violate the no-fabrication rule.

### 1.4 High-yield investment / get-rich-quick

Any business promising specific returns, "passive income systems", trading signals with implied performance, or forex/crypto programmes claiming guaranteed outcomes.

Reasoning: regulatory exposure (SEC Nigeria), high fraud rate in this category, content would require fabrication or misleading claims.

This is distinct from in-scope fintech: a regulated savings app that publishes its actual interest rate is in-scope; a "trading signals" service promising 20% monthly returns is not.

### 1.5 Cure / treatment claims for serious disease

Any business marketing products or services that claim to cure, treat, or prevent serious medical conditions (cancer, HIV, fertility, diabetes-as-cure).

Reasoning: NAFDAC and advertising-standards exposure, direct audience-harm risk, content would necessarily involve fabricated medical claims.

This is distinct from in-scope health: a registered nutritionist talking about general wellness practices is in-scope; a supplement claiming to cure infertility is not.

### 1.6 Weapons, surveillance, illegal goods

Self-explanatory. Hard-blocked.

### 1.7 Bleaching products

Skin-bleaching products marketed as lightening, regardless of how they're framed. Hard-blocked.

Distinct from in-scope beauty: brightening / even-tone framing on a non-bleaching product is in-scope; bleaching products are not.

### 1.8 Specific deceptive practices

Any business whose business model depends on:
- Selling certificates / accreditations the customer isn't authorised to issue.
- Marketing impersonation services or deepfake creation services.
- Fake-engagement / fake-followers services.
- Document forgery services regardless of legal-grey framing.

Reasoning: direct audience-harm risk, content would necessarily involve deception.

## 2. Conditionally-served categories (founder pre-approval required)

These businesses *may* be served, but require explicit founder approval before the AI brief analysis runs. The form-submission flow flags these and the CRM displays a "compliance pre-check needed" banner.

### 2.1 Loan apps and credit products

Loan apps marketed to consumers. Conditional on:
- Customer is licensed (CBN approval visible).
- Content does not promise specific approval rates or amounts.
- Content does not target audiences with predatory framing (e.g. emergency-cash desperation messaging).

If approved, content lanes are limited to: educational explainers about credit health, regulatory snapshots, transparent fee disclosure, decision frameworks for borrowing decisions. No "instant cash now" framing.

### 2.2 Cryptocurrency education and services

Crypto-related businesses. Conditional on:
- Customer is providing education or services that comply with current SEC Nigeria guidance.
- No specific coin recommendations.
- No specific return promises.
- No "trading signals" content.

If approved, content lanes are limited to: educational explainers, regulatory snapshots, decision frameworks. Defensible opinion is allowed.

### 2.3 Fertility and reproductive wellness

Reproductive-health brands and educators. Conditional on:
- Customer is licensed where licensing is required.
- No specific outcome claims around conception, treatment success, or cycle outcomes.
- Content stays in educational and supportive framing, never diagnostic.

If approved, content lanes follow the health niche brief with extra restrictions on outcome claims.

### 2.4 Children's products and services

Businesses serving children directly (toys, content, education for under-13s). Conditional on:
- Content compliance with child-targeted advertising standards.
- Customer's audience is the parent/guardian, not the child directly.
- No psychological-pressure tactics.

If approved, content runs under whichever in-scope niche fits (typically education or beauty for children's care products).

### 2.5 Religious / faith-based products and services

Faith-based educators, churches with paid programmes, religious-content creators. Conditional on:
- Content stays grounded in the customer's stated faith framing — we don't translate between faiths or make doctrinal claims.
- No outcome promises ("blessing guaranteed", "miracle outcomes").
- No anti-other-faith framing.

If approved, content runs under whichever in-scope niche fits (typically education).

### 2.6 Political and advocacy content

Politicians, political campaigns, advocacy organisations. Conditional on:
- Content stays issue-based, not opposition-targeting.
- No campaign-finance content.
- No election-day mobilisation content (these have specific Nigerian regulatory frames).

If approved, content runs under a custom configuration — neither of the seven in-scope niches fits cleanly.

### 2.7 Cannabis / CBD products

Where legally permitted in customer's jurisdiction and within Nigerian advertising scope. Conditional on:
- Customer's product is legally compliant.
- No medical claims.
- No psychoactive-effect claims.

Most operations get redirected to the health niche brief with extra flagging.

## 3. Niche-misclassification routing

A customer might select "beauty" in the form but their actual business is a cosmetic surgery clinic (which sits at the health/restricted boundary). The AI brief analysis catches these mismatches via the business description in step 2.

The routing logic:

```
1. AI reads form payload.
2. AI compares stated niche to inferred niche from business description.
3. If mismatch → flag for founder review with both niches identified.
4. If inferred niche is in restricted list → route through restricted-pre-check before analysis.
5. If both stated and inferred niche are in scope → proceed normally with the more specific niche brief.
```

Examples:

- Stated niche: beauty. Description: "we do cosmetic surgery consultations and aftercare." Inferred: health-restricted. Route → restricted pre-check. Likely outcome: founder declines politely or routes to a stripped-down health offering with restricted-claim flagging.

- Stated niche: education. Description: "I teach women how to make money online through Amazon dropshipping." Inferred: get-rich-quick boundary. Route → restricted pre-check. Likely outcome: founder declines or requests substantial rewrite of the content scope.

- Stated niche: health. Description: "I'm a yoga instructor running weekly classes." Inferred: health (in-scope). Proceed normally.

## 4. The polite-decline workflow

When a brief is hard-blocked or doesn't pass conditional pre-check, the CRM has a "decline with explanation" action that sends a templated email:

> Subject: About your Operscale Calendar order
>
> Hi [name],
>
> Thanks for reaching out about a content calendar for [business]. After reviewing your brief, I have to let you know that [business category / specific concern] sits outside what Operscale Calendar can produce well, given [our content policies / regulatory considerations / audience-protection requirements / specific reason].
>
> If you've already paid, your refund is on the way and should arrive within [X] business days. If you haven't paid, no charge will go through.
>
> A few alternatives that might be a better fit:
>
> - [If applicable: another agency / platform recommendation]
> - [If applicable: how to resubmit if the customer's business pivots]
>
> Thanks for considering us, and apologies for the friction.
>
> [Founder]

The CRM stores the decline reason in `briefs.decline_reason` and `briefs.decline_category` for analytics.

## 5. The conditional-approval workflow

When a brief passes conditional pre-check (e.g. a licensed loan app), the founder sets a flag in the CRM that's passed to the AI brief analysis prompt:

```json
{
  "restricted_category": "loan_app",
  "approval_conditions": [
    "no specific approval rate claims",
    "no emergency-cash framing",
    "education and transparency content lanes only"
  ],
  "founder_approver": "akinwunmi",
  "approval_timestamp": "..."
}
```

The AI brief analysis includes these conditions in its system prompt, and the founder review screen displays them as a checklist for ongoing enforcement.

## 6. Cross-references

- `docs/specs/content-types-allowed.md` — the no-fabrication rule that interacts with restricted-claim handling.
- `docs/runbooks/crm-runbook.md` — the operator's process for compliance pre-checks and polite declines.
- `docs/data-model.md` — `briefs.decline_reason`, `briefs.restricted_category` columns.
- `docs/specs/founder-review-flow.md` — the CRM flow that surfaces compliance pre-checks.
- The seven in-scope niche briefs (beauty, real-estate, fashion-ecom, fintech, health, food, education).

## 7. Updating this list

When a new restricted category emerges in the wild (a new product type, a new regulatory development), update:

1. This document with the new category and reasoning.
2. The CRM compliance pre-check options list.
3. The polite-decline email template if the decline reason needs new framing.
4. ADR recorded for any addition or change to hard-blocked vs conditional-served lists.

The categorisation should be honest, not arbitrary. We block what we can't serve well — not what we don't like.
