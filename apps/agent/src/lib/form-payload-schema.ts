// apps/agent/src/lib/form-payload-schema.ts
//
// Single source-of-truth for the customer brief form's wire schema. Used by
// /v1/brief/save (per-step partial validation), /v1/brief/submit (full payload
// validation), and shared with apps/web at runtime via NEXT_PUBLIC_*-safe
// re-exports if needed. Do NOT duplicate these schemas anywhere else.
//
// Source spec: docs/specs/ai-brief-analysis.md §3.2 (Layer 2 form payload),
//              docs/customer-journey.md §2 (per-step writes).
//
// Critical invariant: customer_backstory_verbatim and reference_posts_block
// are NEVER trimmed, normalised, or transformed — the AI brief analyzer's
// fabrication-blocking regex compares against the customer's exact bytes.
// Schema validates length only.

import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { NICHE_SLUGS } from './types/v2.js';

// The customer-facing form's niche dropdown sends one of the canonical worker
// slugs. Adding `_default` for the master-plan-§7-Q6 "Other (describe)" path
// — a customer typing their niche freely is mapped to _default.md by the AI
// brief analyzer with a niche_unmapped flag (catalog never errors).
const FORM_NICHE_SLUGS = [...NICHE_SLUGS, '_default'] as const;

// ---------------------------------------------------------------------------
// Per-step schemas
// ---------------------------------------------------------------------------

export const Step1Schema = z.object({
  tier_intent: z.enum(['starter', 'standard', 'calendar']),
});
export type Step1Payload = z.infer<typeof Step1Schema>;

export const Step2Schema = z.object({
  brand_name: z.string().min(1).max(120),
  owner_name: z.string().min(1).max(120),
  // Strict E.164: leading + then 7-15 digits, first digit not 0.
  phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/, 'phone must be E.164 (e.g. +2348012345678)'),
  email: z.string().email().max(254),
  // Must match the worker's NICHE_SLUGS catalog (apps/agent/src/lib/types/v2.ts)
  // or the analyzer fails with niche_brief_missing at job-execution time. The
  // form dropdown should expose the same set; "Other" maps to '_default'.
  niche_slug: z.enum(FORM_NICHE_SLUGS),
  niche_label: z.string().min(1).max(120),
  one_line_description: z.string().min(10).max(280),
  offer_description: z.string().min(10).max(2000),
  price_point_band: z.enum([
    'under_5k',
    '5k_25k',
    '25k_100k',
    '100k_500k',
    'over_500k',
  ]),
});
export type Step2Payload = z.infer<typeof Step2Schema>;

export const Step3Schema = z.object({
  primary_audience_description: z.string().min(10).max(1000),
  audience_age_range: z.string().min(1).max(40),
  audience_location: z.string().min(1).max(200),
  audience_belief: z.string().min(10).max(1000),
  audience_belief_target: z.string().min(10).max(1000),
});
export type Step3Payload = z.infer<typeof Step3Schema>;

export const Step4Schema = z.object({
  logo_uploaded_yes_no: z.enum(['yes', 'no']),
  brand_colours: z.string().max(280).optional(),
  instagram_handle: z.string().max(60).optional(),
});
export type Step4Payload = z.infer<typeof Step4Schema>;

// Step 5 (photos) is handled by /v1/brief/upload-photo (sub-phase 6.2).
// The submit endpoint reads photo_count by joining brief_photos.

export const Step6Schema = z.object({
  // No string transformations — the AI prompt regex requires byte-equality
  // with what the customer typed (docs/specs/ai-brief-analysis.md line 333).
  stated_voice: z.string().min(1).max(2000),
  reference_posts_block: z.string().max(20000),
  customer_backstory_verbatim: z.string().max(20000),
});
export type Step6Payload = z.infer<typeof Step6Schema>;

// ---------------------------------------------------------------------------
// Save endpoint body (discriminated union by step)
// ---------------------------------------------------------------------------

// Step 1 has optional brief_id/customer_id because the FIRST save call (no
// prior session) is what creates the customer + brief stub rows. Subsequent
// step-1 saves (e.g. customer changes their mind) require both.
const Step1SaveBody = z.object({
  step: z.literal(1),
  brief_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  payload: Step1Schema,
});
const Step2SaveBody = z.object({
  step: z.literal(2),
  brief_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  payload: Step2Schema,
});
const Step3SaveBody = z.object({
  step: z.literal(3),
  brief_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  payload: Step3Schema,
});
const Step4SaveBody = z.object({
  step: z.literal(4),
  brief_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  payload: Step4Schema,
});
const Step6SaveBody = z.object({
  step: z.literal(6),
  brief_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  payload: Step6Schema,
});

export const SaveBodySchema = z.discriminatedUnion('step', [
  Step1SaveBody,
  Step2SaveBody,
  Step3SaveBody,
  Step4SaveBody,
  Step6SaveBody,
]);
export type SaveBody = z.infer<typeof SaveBodySchema>;

// ---------------------------------------------------------------------------
// Submit endpoint body
// ---------------------------------------------------------------------------

export const SubmitBodySchema = z.object({
  brief_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  // Customer ticked the terms checkbox at step 7. The hash is verified
  // server-side against the canonical text in apps/web/src/lib/consent.ts —
  // identical mechanism to the photo consent (sub-phase 6.2).
  terms_consent_text_version: z.literal('v1'),
  terms_consent_text_hash: z.string().regex(/^[a-f0-9]{64}$/, 'terms_consent_text_hash must be 64-char lowercase hex SHA-256'),
});
export type SubmitBody = z.infer<typeof SubmitBodySchema>;

// ---------------------------------------------------------------------------
// Aggregate validator for submit (briefs.form_payload at submit time)
//
// At /v1/brief/submit the briefs.form_payload JSONB must contain every key
// from Steps 1, 2, 3, and 6 (Step 4 fields are mostly optional; logo + IG +
// colours can all be null). This is the schema we run against the persisted
// payload BEFORE inserting the order.
// ---------------------------------------------------------------------------

export const FullFormPayloadSchema = Step1Schema.merge(Step2Schema)
  .merge(Step3Schema)
  .merge(Step4Schema.partial())
  .merge(Step6Schema);
export type FullFormPayload = z.infer<typeof FullFormPayloadSchema>;

// ---------------------------------------------------------------------------
// Save token (issued at step 3 boundary)
//
// 24-char URL-safe per docs/customer-journey.md §2.4. We use base64url over
// 18 random bytes which yields exactly 24 characters (18 * 4 / 3).
// ---------------------------------------------------------------------------

export function generateSaveToken(): string {
  return randomBytes(18).toString('base64url');
}

// ---------------------------------------------------------------------------
// Browser session cookie (anonymous customer linkage before email is captured)
//
// Set on the FIRST save response to bind the browser to the customer_id row.
// Defence-in-depth — clients also persist {brief_id, customer_id} in
// localStorage and pass them in subsequent save calls.
// ---------------------------------------------------------------------------

export const BRIEF_SESSION_COOKIE = 'os_brief_session';
export const BRIEF_SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export function briefSessionCookieAttributes(): {
  name: string;
  attributes: string;
} {
  // Domain matches the cookie scope used everywhere else in the auth stack
  // (see apps/web/src/lib/supabase-server.ts SHARED_COOKIE_OPTIONS).
  const parts = [
    `Path=/`,
    `Max-Age=${BRIEF_SESSION_MAX_AGE_S}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Domain=.operscale.cloud',
  ];
  return { name: BRIEF_SESSION_COOKIE, attributes: parts.join('; ') };
}
