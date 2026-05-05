import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeTransaction, PaystackInitError, paystackReference, ngnToKobo, verifyWebhookSignature } from './paystack';

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_KEY = process.env.PAYSTACK_SECRET_KEY;

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_dummy';
  vi.useFakeTimers();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  process.env.PAYSTACK_SECRET_KEY = ORIGINAL_KEY;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockFetch(impl: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  global.fetch = vi.fn().mockImplementation(impl as any) as any;
}

const validInput = {
  email: 'tola@example.com',
  amountNgn: 150_000,
  reference: 'ops-cal-order-1-1714742400',
  callbackUrl: 'https://operscale.cloud/payment/return?order_id=order-1',
  metadata: { order_id: 'order-1', brief_id: 'brief-1' },
};

describe('initializeTransaction', () => {
  it('returns authorizationUrl on 200 happy path', async () => {
    mockFetch(async (url, init) => {
      expect(url).toBe('https://api.paystack.co/transaction/initialize');
      const body = JSON.parse(init.body as string);
      expect(body.amount).toBe(15_000_000); // amountNgn × 100 = kobo
      expect(body.currency).toBe('NGN');
      expect(body.reference).toBe(validInput.reference);
      expect(body.callback_url).toBe(validInput.callbackUrl);
      expect(body.metadata).toEqual(validInput.metadata);
      expect(body.channels).toEqual(['card', 'bank_transfer', 'ussd', 'qr', 'mobile_money', 'bank']);
      expect((init.headers as any).Authorization).toBe('Bearer sk_test_dummy');
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'access-1', reference: validInput.reference } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await initializeTransaction(validInput);
    expect(result).toEqual({ authorizationUrl: 'https://checkout.paystack.com/abc', accessCode: 'access-1', reference: validInput.reference });
  });

  it('throws PaystackInitError on 4xx with parsed message', async () => {
    mockFetch(async () => new Response(JSON.stringify({ status: false, message: 'Invalid amount' }), { status: 400, headers: { 'content-type': 'application/json' } }));
    await expect(initializeTransaction(validInput)).rejects.toMatchObject({
      detail: { status: 400, message: 'Invalid amount' },
    });
  });

  it('throws PaystackInitError when PAYSTACK_SECRET_KEY missing', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    await expect(initializeTransaction(validInput)).rejects.toMatchObject({ detail: { message: expect.stringContaining('missing') } });
  });

  it('retries on 5xx and succeeds on second attempt', async () => {
    let calls = 0;
    mockFetch(async () => {
      calls++;
      if (calls === 1) return new Response('upstream', { status: 503 });
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/y', access_code: 'a2', reference: validInput.reference } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const promise = initializeTransaction(validInput);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/y');
    expect(calls).toBe(2);
  });

  it('throws after 3 5xx retries', async () => {
    mockFetch(async () => new Response('upstream', { status: 502 }));
    // Suppress the unhandled-rejection warning that Vitest emits when
    // advanceTimersByTimeAsync causes the promise to reject before the
    // `await expect().rejects` line runs. The assertion still validates
    // the error type; the .catch() only prevents the false-positive error.
    const promise = initializeTransaction(validInput);
    promise.catch(() => { /* handled below */ });
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
    await expect(promise).rejects.toBeInstanceOf(PaystackInitError);
  });

  it('falls back to verify on duplicate-reference error', async () => {
    let calls = 0;
    mockFetch(async (url) => {
      calls++;
      if (calls === 1) {
        expect(url).toContain('/transaction/initialize');
        return new Response(JSON.stringify({ status: false, message: 'Duplicate Transaction Reference' }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      expect(url).toContain(`/transaction/verify/${validInput.reference}`);
      return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.paystack.com/dup', reference: validInput.reference, access_code: 'access-existing' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await initializeTransaction(validInput);
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/dup');
    expect(calls).toBe(2);
  });

  it('throws on network error after retries', async () => {
    mockFetch(async () => { throw new TypeError('Network down'); });
    // Suppress the unhandled-rejection warning (same pattern as 5xx test above).
    const promise = initializeTransaction(validInput);
    promise.catch(() => { /* handled below */ });
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
    await expect(promise).rejects.toBeInstanceOf(PaystackInitError);
  });
});

describe('paystackReference', () => {
  it('produces ops-cal-{order_id}-{unix_ts}', () => {
    const ref = paystackReference('abc-123');
    expect(ref).toMatch(/^ops-cal-abc-123-\d{10}$/);
  });
});

describe('ngnToKobo', () => {
  it('multiplies whole NGN by 100', () => {
    expect(ngnToKobo(150_000)).toBe(15_000_000);
  });
  it('throws on non-positive integer', () => {
    expect(() => ngnToKobo(0)).toThrow();
    expect(() => ngnToKobo(-10)).toThrow();
    expect(() => ngnToKobo(1.5)).toThrow();
  });
});

describe('verifyWebhookSignature', () => {
  const SECRET = 'sk_test_dummy';
  it('returns true on valid HMAC-SHA512', () => {
    const body = '{"event":"charge.success"}';
    const sig = require('node:crypto').createHmac('sha512', SECRET).update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
  });
  it('returns false on mismatched HMAC', () => {
    expect(verifyWebhookSignature('{"event":"x"}', 'aaaa', SECRET)).toBe(false);
  });
  it('returns false on missing signature', () => {
    expect(verifyWebhookSignature('{}', null, SECRET)).toBe(false);
  });
});
