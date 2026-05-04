// apps/agent/src/lib/paystack.ts
//
// Paystack integration: initialize transactions + verify webhook signatures.
// SOURCE OF TRUTH: docs/specs/paystack-integration.md.
//
// CRITICAL: webhook signature verification MUST run on the raw body BEFORE
// any JSON.parse. Cloudflare proxy is OFF for api.operscale.cloud so the
// raw bytes survive. See docs/deployment.md "DNS setup".

import { createHmac, timingSafeEqual } from 'node:crypto';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface InitializeTransactionInput {
  email: string;
  amountNgn: number; // whole NGN, NOT kobo. We multiply ×100 here.
  reference: string; // pre-generated 'ops-cal-{order_id}-{unix_ts}'
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  channels?: ('card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer')[];
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(
  _input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  // TODO(Operscale): implement per docs/specs/paystack-integration.md
  //   POST https://api.paystack.co/transaction/initialize
  //   Authorization: Bearer ${PAYSTACK_SECRET_KEY}
  //   Body: { email, amount: amountNgn * 100, currency: 'NGN', reference, callback_url, metadata, channels }
  throw new Error('initializeTransaction not implemented');
}

/**
 * Verify a Paystack webhook signature.
 *
 * @param rawBody  The raw request body as a string. Read via req.text() BEFORE JSON.parse.
 * @param signature The value of the x-paystack-signature header.
 * @param secretKey PAYSTACK_SECRET_KEY (same key used for API auth; HMAC-SHA512 digest).
 * @returns true if the signature matches, false otherwise. Use constant-time comparison.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secretKey: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');

  // Both buffers must be the same length for timingSafeEqual.
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export function paystackReference(orderId: string): string {
  return `ops-cal-${orderId}-${Math.floor(Date.now() / 1000)}`;
}

export function ngnToKobo(ngn: number): number {
  if (!Number.isInteger(ngn) || ngn <= 0) {
    throw new Error(`ngnToKobo: amount must be a positive integer, got ${ngn}`);
  }
  return ngn * 100;
}

export const PAYSTACK = { API_BASE: PAYSTACK_API_BASE } as const;
