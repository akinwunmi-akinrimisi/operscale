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

const RETRY_DELAYS_MS = [500, 1000, 2000];

export class PaystackInitError extends Error {
  constructor(public detail: { status: number; message: string }) {
    super(`paystack_init_failed: ${detail.status} ${detail.message}`);
    this.name = 'PaystackInitError';
  }
}

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

interface PaystackEnvelope<T> {
  status: boolean;
  message?: string;
  data?: T;
}

interface InitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

async function paystackPost<T>(path: string, body: unknown, secret: string): Promise<{ status: number; envelope: PaystackEnvelope<T> | null }> {
  const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let envelope: PaystackEnvelope<T> | null = null;
  try { envelope = (await res.json()) as PaystackEnvelope<T>; } catch { /* non-json upstream errors */ }
  return { status: res.status, envelope };
}

async function paystackGet<T>(path: string, secret: string): Promise<{ status: number; envelope: PaystackEnvelope<T> | null }> {
  const res = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  });
  let envelope: PaystackEnvelope<T> | null = null;
  try { envelope = (await res.json()) as PaystackEnvelope<T>; } catch { /* non-json upstream errors */ }
  return { status: res.status, envelope };
}

const DEFAULT_CHANNELS: NonNullable<InitializeTransactionInput['channels']> = ['card', 'bank_transfer', 'ussd', 'qr', 'mobile_money', 'bank'];

export async function initializeTransaction(
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new PaystackInitError({ status: 0, message: 'missing PAYSTACK_SECRET_KEY' });
  }

  const body = {
    email: input.email,
    amount: ngnToKobo(input.amountNgn),
    currency: 'NGN' as const,
    reference: input.reference,
    callback_url: input.callbackUrl,
    metadata: input.metadata ?? {},
    channels: input.channels ?? DEFAULT_CHANNELS,
  };

  let lastErr: { status: number; message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    let result;
    try {
      result = await paystackPost<InitData>('/transaction/initialize', body, secret);
    } catch (e) {
      lastErr = { status: 0, message: e instanceof Error ? e.message : 'network_error' };
      continue;
    }
    const { status, envelope } = result;
    if (status >= 200 && status < 300 && envelope?.status === true && envelope.data) {
      return {
        authorizationUrl: envelope.data.authorization_url,
        accessCode: envelope.data.access_code,
        reference: envelope.data.reference,
      };
    }
    if (status >= 400 && status < 500) {
      const msg = envelope?.message ?? 'unknown_4xx';
      // Duplicate-reference fallback: re-fetch the existing transaction.
      if (msg.toLowerCase().includes('duplicate transaction reference')) {
        const verify = await paystackGet<InitData>(`/transaction/verify/${input.reference}`, secret);
        if (verify.status >= 200 && verify.status < 300 && verify.envelope?.status === true && verify.envelope.data) {
          // The /transaction/verify response may omit access_code (only the
          // authorization_url is guaranteed). '' here is intentional — Phase
          // 4.5 callers don't read accessCode (Paystack inline widget would).
          return {
            authorizationUrl: verify.envelope.data.authorization_url,
            accessCode: verify.envelope.data.access_code ?? '',
            reference: verify.envelope.data.reference,
          };
        }
      }
      throw new PaystackInitError({ status, message: msg });
    }
    lastErr = { status, message: envelope?.message ?? 'upstream_5xx' };
  }
  throw new PaystackInitError(lastErr ?? { status: 0, message: 'init_failed_no_response' });
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

export interface PaystackChargeSuccessEvent {
  event: 'charge.success';
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: 'NGN';
    paid_at: string;
    channel: 'card' | 'bank_transfer' | 'ussd' | 'qr' | 'mobile_money' | 'bank';
    customer: { email: string };
    metadata?: {
      order_id?: string;
      customer_id?: string;
      brief_id?: string;
      tier?: string;
    };
    [key: string]: unknown;
  };
}

export interface PaystackChargeFailureEvent {
  event: 'charge.failure';
  data: {
    id: number;
    reference: string;
    gateway_response?: string;
    [key: string]: unknown;
  };
}
