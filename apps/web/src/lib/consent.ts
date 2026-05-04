// apps/web/src/lib/consent.ts
//
// Canonical consent text + version + SHA-256 hash for the photo upload step.
// Source of truth: docs/specs/photo-upload-and-retention.md "Consent Text (Canonical v1)".
//
// CRITICAL: this file is the single point of authority. The agent's upload
// endpoint re-hashes the text the customer signed and compares against the
// hash submitted from the browser to detect tampering.
//
// If the consent wording ever changes, bump CONSENT_VERSION and add a new
// entry to CONSENT_TEXT_BY_VERSION. The old version stays so historic records
// in brief_consent.consent_text_version can still be re-hashed for audit.

export const CONSENT_VERSION = 'v1' as const;

export const CONSENT_TEXT_V1 = `I understand and agree that the photos I upload will be used by Operscale to create a personalised AI avatar that appears in my video ads. The photos are stored privately, never shared with third parties, and are automatically deleted 90 days after my final delivery. I can request earlier deletion at any time by emailing privacy@operscale.cloud. I confirm that I am the person in these photos, or have explicit permission from the person shown.`;

export const CONSENT_TEXT_BY_VERSION: Record<string, string> = {
  v1: CONSENT_TEXT_V1,
};

/**
 * Compute SHA-256 hex digest of a consent text.
 * Uses the Web Crypto API so this works in both browser and Node.
 */
export async function consentTextHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function currentConsentTextHash(): Promise<string> {
  return consentTextHash(CONSENT_TEXT_V1);
}
