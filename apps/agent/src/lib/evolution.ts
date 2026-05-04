// apps/agent/src/lib/evolution.ts
//
// Evolution API (WhatsApp) wrapper.
// SOURCE OF TRUTH: docs/specs/whatsapp-flow.md.
//
// Number normalisation handles 080..., +234..., 234..., spaced variants — all
// must produce the same E.164-ish form before sending or matching.

export interface SendWhatsAppInput {
  toNumber: string; // any common Nigerian format
  body: string;
  templateKey?: string; // for activity_log + idempotency lookups
  customerId?: string;
  orderId?: string;
}

export interface SendWhatsAppResult {
  evolutionMessageId: string;
  toNumber: string; // normalised E.164
}

export async function sendWhatsApp(_input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  // TODO(Operscale): implement per docs/specs/whatsapp-flow.md
  //   1. Normalise toNumber via normaliseNigerianMsisdn
  //   2. POST {EVOLUTION_API_BASE}/message/sendText/{EVOLUTION_INSTANCE_NAME}
  //      header apikey: EVOLUTION_API_KEY
  //   3. Retry 3x with exp backoff on 5xx; no retry on 4xx
  //   4. Log to whatsapp_log + activity_log
  //   5. Idempotency: check activity_log for recent send (1h window)
  throw new Error('sendWhatsApp not implemented');
}

/**
 * Normalise common Nigerian phone formats to E.164 (+234XXXXXXXXXX).
 *
 * Accepted inputs:
 *   "08012345678"      → "+2348012345678"
 *   "+2348012345678"   → "+2348012345678"
 *   "2348012345678"    → "+2348012345678"
 *   "234 801 234 5678" → "+2348012345678"
 *   "0801-234-5678"    → "+2348012345678"
 *
 * Returns null if the input does not match a recognisable Nigerian MSISDN.
 */
export function normaliseNigerianMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `+234${digits}`;
  return null;
}
