# Spec: NDPC compliance

The Nigeria Data Protection Commission (NDPC, formerly NITDA NDPB) regulates personal data processing in Nigeria under the Nigeria Data Protection Act 2023 (NDPA) and the NDPC's regulations and guidelines.

We process personal data: customer names, emails, WhatsApp numbers, business details, face photos. We must comply.

This document is the operational compliance plan: what we register as, what rights we surface, how we honour them, what we retain and for how long, what happens on a breach.

## Why we care

Compliance isn't optional. Penalties under the NDPA range from N250k for minor breaches to 2% of global revenue for severe violations. More important: customer trust. Operscale's brand depends on customers feeling safe handing over their data. A privacy breach in 2026, in Nigeria, is brand-ending.

## Registration

### Status

We register Operscale Limited as a Data Controller with the NDPC.

### When

Day 3 of the build plan, NOT Day 22. NDPC processing time is typically 14 working days. Filing on Day 3 puts the deadline around Day 17, which leaves a 5-day buffer before the Day 22 launch.

### What we file

The DCO (Data Controller of Sensitive Personal Data Categories) registration form. Required documents:

- CAC certificate of incorporation for Operscale Limited.
- Memorandum and Articles of Association.
- TIN (Tax Identification Number).
- Registered business address proof (utility bill or rent agreement).
- Founder's national ID (NIN slip or passport).
- Designated DPO contact info (Phase 1: founder is also acting DPO).
- A description of data processing activities.

### Fee

NDPC registration fee varies by data controller category. As of 2026, micro-businesses pay around N10,000-N20,000 annually. Confirm current fee at filing time.

### What we tell NDPC about our processing

The summary we submit:

```
Operscale Limited operates a content calendar service for Nigerian SMBs.
We collect from each customer:
  - Name, business name, email, WhatsApp number (for service delivery)
  - Brand details: logo, brand colours, sample posts (for content production)
  - Optionally: face photos for custom AI avatar generation
  - Payment metadata via Paystack (we do not store card data)

Purposes:
  - Producing the customer's content calendar (lawful basis: contract performance)
  - Customer communications (lawful basis: contract performance + consent for photos)
  - Compliance with tax and accounting obligations (lawful basis: legal obligation)

Retention:
  - Customer records: indefinite (subject to deletion request)
  - Photos: 90 days post-delivery, or 30 days if no order
  - Payment records: 7 years (tax obligation)
  - Activity logs: indefinite (audit purposes)

Sharing: We do not sell or rent customer data. We share with processors only
where necessary for service delivery (Paystack, Resend, Anthropic, Supabase).

Cross-border transfers: Some processors (Anthropic, Resend) operate from
the United States. We rely on standard contractual clauses for these transfers.

Data Protection Officer: Akinwunmi Akinrimisi (acting), email: dpo@operscale.cloud.
```

### After filing

- Track the filing reference number.
- Once registration is granted, the registration number is added to the privacy policy.
- Annual renewal is required.

## Customer rights (under NDPA Section 26-39)

Phase 1 surfaces these rights in the privacy policy and handles them manually.

### 1. Right to access

Customer requests an export of all data we hold about them.

Phase 1 process:
1. Customer emails `privacy@operscale.cloud`.
2. Founder verifies the request is from the customer (matches email on record).
3. Founder runs an export query:
   ```sql
   SELECT row_to_json(c) FROM customers c WHERE id = $1
   UNION ALL
   SELECT row_to_json(b) FROM briefs b WHERE customer_id = $1
   UNION ALL
   SELECT row_to_json(o) FROM orders o WHERE customer_id = $1
   -- ... etc for payments, brief_photos (metadata only), activity_log (filtered to this customer)
   ```
4. Result is sent as a JSON file to the customer's email.
5. Action logged in `privacy_actions` audit table.

SLA: 30 days (NDPA standard); we target 7 days.

### 2. Right to delete (right to erasure)

Customer requests deletion of all their data.

Phase 1 process:
1. Customer emails `privacy@operscale.cloud`.
2. Founder verifies.
3. Founder confirms back to customer with deletion timestamp commitment.
4. Founder runs the deletion procedure:
   ```sql
   -- Delete files from storage (loop over brief_photos.storage_path entries)
   -- Then DELETE FROM customers WHERE id = $1
   --   This cascades to briefs, brief_photos, brief_consent, analysis_runs,
   --   analysis_edits, orders, payments, customer_messages.
   -- activity_log rows are NOT deleted but are anonymised:
   UPDATE activity_log
   SET customer_id = NULL, order_id = NULL,
       payload = '{"anonymised": true}'
   WHERE customer_id = $1 OR order_id IN (SELECT id FROM orders WHERE customer_id = $1);
   ```
5. Confirms back to customer with timestamp.
6. Action logged in `privacy_actions`.

SLA: 30 days (NDPA standard); we target 72 hours.

Edge case: if there are unresolved tax obligations (paid order in current tax year), we retain payment metadata only (anonymised) for the 7-year tax window. Other data is deleted.

### 3. Right to correct (rectification)

Customer requests correction of any data we hold.

Phase 1 process: customer emails the correction. Founder runs targeted UPDATE. Confirms back.

SLA: 7 days.

### 4. Right to data portability

Same as access (we provide JSON, which is portable).

### 5. Right to withdraw consent

Specific to consent-based processing. The main case: photo storage consent.

Phase 1 process:
1. Customer emails withdrawal of photo consent.
2. Founder verifies.
3. Founder triggers photo deletion (separate from full account deletion).
4. If photos were already used in production (Phase 2), founder confirms which renders used the avatar; renders are not retroactively redacted (NDPA permits retention where necessary for service delivery), but no future use of the photos.
5. Action logged.

SLA: 72 hours.

### 6. Right to object to automated decision-making

NDPA gives customers the right to object to automated decisions that significantly affect them. The only "decision" we make automatically is the AI brief analysis — and that's reviewed by a human (founder) before any customer-facing effect. So no automated decision-making in the legal sense applies.

We document this in the privacy policy:

```
We use AI to draft your personalised brief, but every brief is reviewed by a
human team member before it reaches you. No automated decision is made about
you that significantly affects you without human review.
```

### 7. Right to lodge a complaint with NDPC

Surfaced in privacy policy with NDPC contact details.

## Privacy policy structure

The `operscale.cloud/privacy` page contains:

1. **Who we are** — Operscale Limited, address, NDPC registration number, contact email.
2. **What data we collect** — categories listed concretely, not vaguely.
3. **Why we collect it** — lawful basis for each category.
4. **Who we share with** — list of sub-processors (Paystack, Resend, Anthropic, Supabase) with links to their privacy policies.
5. **How long we keep it** — retention periods explicit.
6. **Your rights** — all 7 rights listed with how to exercise.
7. **Cookies and tracking** — Phase 1 uses minimal first-party cookies (session only); no third-party trackers, no advertising pixels.
8. **Cross-border transfers** — disclose that processors operate outside Nigeria.
9. **Children** — we do not knowingly collect data from anyone under 18; service is for adult business owners.
10. **Updates** — policy version + date; how customers will be notified of changes.
11. **Contact** — `privacy@operscale.cloud`, founder name, NDPC complaint contact.

## Sub-processors

We list sub-processors in the privacy policy:

| Sub-processor | Purpose | Country |
| --- | --- | --- |
| Paystack Limited | Payment processing | Nigeria |
| Resend Inc. | Email delivery | United States |
| Anthropic PBC | AI brief analysis (Claude) | United States |
| Supabase Inc. | Database, storage, auth | United States |
| Hostinger | VPS hosting | Lithuania |
| Cloudflare | DNS, CDN | United States |

For each US-based processor, we rely on standard contractual clauses (their published DPAs include them).

## Breach notification

If we have a breach affecting customer data, we must notify NDPC within 72 hours and affected customers without undue delay.

### What constitutes a breach

- Unauthorized access to customer data (e.g., a leaked service-role key being used).
- Accidental disclosure (e.g., wrong customer's data sent to wrong person).
- Loss of data (e.g., backup failure rendering data unrecoverable, when we couldn't otherwise restore).
- Compromise of integrity (e.g., data corruption from a bad migration).

### Response procedure

1. Detect (Sentry alert, customer report, monitoring anomaly).
2. Contain (rotate keys, revoke access, take affected service offline if needed).
3. Assess (what data, how many customers, root cause).
4. Document (incident timeline, affected records, mitigation steps).
5. Notify NDPC within 72 hours via their breach notification form.
6. Notify affected customers without undue delay (target: same calendar day if scope is small, within 7 days if scope is large and analysis is needed).
7. Postmortem within 14 days.

The on-call playbook for breaches lives in `docs/security.md` incident response section.

## Logging for compliance

`privacy_actions` table — every privacy-related action logged:

```sql
CREATE TABLE privacy_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,  -- nullable for anonymisation cases
  customer_email text,
  action_type text NOT NULL CHECK (action_type IN (
    'access_request', 'access_provided', 'access_denied',
    'deletion_request', 'deletion_completed', 'deletion_partial',
    'correction_request', 'correction_completed',
    'consent_withdrawn',
    'objection_raised',
    'breach_notified_to_ndpc',
    'breach_notified_to_customer'
  )),
  details text,
  acted_by text,  -- founder email or 'system'
  acted_at timestamptz DEFAULT now()
);
```

This table is INSERT-only. Never DELETE from it. Required for proving compliance.

## Cookie / tracking minimisation

Phase 1 uses:

- **Session cookies** — for the form save token (first-party, expires in 7 days).
- **Auth cookie** — for admin sessions (Supabase magic link, first-party, expires in 12h).
- NO third-party advertising pixels.
- NO Google Analytics or similar (use Supabase activity_log + Sentry for observability instead).
- NO Meta pixel.
- NO TikTok pixel.

The site does NOT need a cookie banner because we use only strictly necessary first-party cookies. We document this in the privacy policy.

## Phase 1 vs Phase 2 NDPC concerns

This spec covers Phase 1 (intake → payment). Phase 2 introduces:

- Generated avatars from face photos (creates derivative biometric-adjacent data — needs DPIA).
- Long-form video renders that include the customer's likeness — additional consent terms.
- Customer delivery package (Drive folder, signed URLs) — re-evaluate retention of delivery artifacts.

A separate DPIA (Data Protection Impact Assessment) will be done before Phase 2 launches.

## Where to look next

- `docs/security.md` — incident response, broader security context.
- `docs/specs/photo-upload-and-retention.md` — photo lifecycle in detail.
- `apps/web/src/app/privacy/page.tsx` — the published privacy policy.
- `apps/web/src/app/terms/page.tsx` — terms of service (paired with privacy).
