import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { POST } from './route';
import { EmailSendError } from '@/lib/email';

const SECRET = 'sk_test_dummy';
const ORIGINAL_SECRET = process.env.PAYSTACK_SECRET_KEY;

let paymentsRows: any[];
let ordersRow: any;
let customerRow: any;
let activityLogs: any[];
let ordersUpdates: any[];
let paymentsInserts: any[];
let paymentsInsertOverride: { error: { code?: string; message: string } } | null;
let sendEmailMock: ReturnType<typeof vi.fn>;

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => {
      if (table === 'payments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: paymentsRows[0] ?? null, error: null })),
            }),
          }),
          insert: vi.fn().mockImplementation(async (row: any) => {
            paymentsInserts.push(row);
            if (paymentsInsertOverride) return paymentsInsertOverride;
            return { error: null };
          }),
        };
      }
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: ordersRow, error: null })),
            }),
          }),
          update: vi.fn().mockImplementation((row: any) => ({
            eq: vi.fn().mockImplementation(async (col: string, val: any) => {
              ordersUpdates.push({ row, where: { [col]: val } });
              return { error: null };
            }),
          })),
        };
      }
      if (table === 'customers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: customerRow, error: null })),
            }),
          }),
        };
      }
      return {};
    }),
  }),
  writeActivityLog: vi.fn().mockImplementation(async (entry: any) => { activityLogs.push(entry); }),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: (...args: any[]) => sendEmailMock(...args),
  EmailSendError: class extends Error { constructor(public detail: any) { super('email_send_failed'); } },
}));

vi.mock('@operscale-calendar/web/emails/PaymentConfirmation', () => ({
  PaymentConfirmation: () => null,
  default: () => null,
}));

vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>payment</html>'),
}));

function makeEvent(overrides: any = {}): any {
  return {
    event: 'charge.success',
    data: {
      id: 12345,
      reference: 'ops-cal-order-1-1714742400',
      amount: 27_500_000,
      currency: 'NGN',
      paid_at: '2026-05-05T10:00:00Z',
      channel: 'card',
      customer: { email: 'tola@example.com' },
      metadata: { order_id: 'order-1' },
      ...overrides,
    },
  };
}

function makeReq(rawBody: string, signature: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== null) headers['x-paystack-signature'] = signature;
  return new Request('http://x/v1/webhook/paystack', { method: 'POST', headers, body: rawBody });
}

function sign(rawBody: string): string {
  return createHmac('sha512', SECRET).update(rawBody).digest('hex');
}

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = SECRET;
  paymentsRows = [];
  ordersRow = { id: 'order-1', customer_id: 'cust-1', brief_id: 'brief-1', status: 'brief_sent', tier: 'standard', amount_ngn: 275_000, paystack_tx_ref: 'ops-cal-order-1-1714742400' };
  customerRow = { full_name: 'Tola', email: 'tola@example.com' };
  activityLogs = [];
  ordersUpdates = [];
  paymentsInserts = [];
  paymentsInsertOverride = null;
  sendEmailMock = vi.fn().mockResolvedValue({ resendMessageId: 'pc-msg-1' });
});

afterEach(() => {
  process.env.PAYSTACK_SECRET_KEY = ORIGINAL_SECRET;
  vi.clearAllMocks();
});

describe('POST /v1/webhook/paystack', () => {
  it('returns 401 on bad HMAC signature; raw body never parsed', async () => {
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, 'wrong-sig'));
    expect(res.status).toBe(401);
    expect(activityLogs.find((e) => e.eventType === 'webhook_signature_failed')).toBeDefined();
    expect(paymentsInserts).toHaveLength(0);
    expect(ordersUpdates).toHaveLength(0);
  });

  it('returns 200 + skip on duplicate paystack_event_id', async () => {
    paymentsRows = [{ id: 'existing-payment-1' }];
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(0);
    expect(ordersUpdates).toHaveLength(0);
  });

  it('happy path: charge.success → payments INSERT + orders flipped to paid + activity log + email sent', async () => {
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(1);
    expect(paymentsInserts[0]).toMatchObject({ order_id: 'order-1', paystack_event_id: '12345', event_type: 'charge.success', amount_ngn: 275_000 });
    expect(ordersUpdates).toHaveLength(1);
    const finalOrderUpdate = ordersUpdates[ordersUpdates.length - 1];
    expect(finalOrderUpdate.row).toMatchObject({ status: 'paid' });
    expect(finalOrderUpdate.row.paid_at).toBeDefined();
    expect(finalOrderUpdate.row.production_ready_at).toBeDefined();
    expect(activityLogs.find((e) => e.eventType === 'payment_succeeded')).toBeDefined();
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: 'payment-confirmation',
      to: 'tola@example.com',
    }));
  });

  it('Resend failure does NOT throw or roll back; logs payment_confirmation_email_failed and returns 200', async () => {
    sendEmailMock.mockRejectedValueOnce(new (EmailSendError as any)({ status: 422, message: 'Bad email' }));
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(1);
    expect(activityLogs.find((e) => e.eventType === 'payment_confirmation_email_failed')).toBeDefined();
  });

  it('charge.failure: logs payment_failed; no orders status change; no payments INSERT; no email', async () => {
    const event = { event: 'charge.failure', data: { id: 999, reference: 'ops-cal-order-1-x', gateway_response: 'declined' } };
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'payment_failed')).toBeDefined();
    expect(ordersUpdates).toHaveLength(0);
    expect(paymentsInserts).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('amount mismatch: logs webhook_amount_mismatch AND still flips orders to paid', async () => {
    const event = makeEvent({ amount: 1_000_000 }); // Paystack reports 10,000 NGN; order is 275,000
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_amount_mismatch')).toBeDefined();
    expect(paymentsInserts).toHaveLength(1);
    expect(ordersUpdates).toHaveLength(1);
    const finalOrderUpdate = ordersUpdates[ordersUpdates.length - 1];
    expect(finalOrderUpdate.row.status).toBe('paid');
  });

  it('unknown paystack_tx_ref: logs webhook_unknown_tx_ref; no payments INSERT; 200', async () => {
    ordersRow = null;
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_unknown_tx_ref')).toBeDefined();
    expect(paymentsInserts).toHaveLength(0);
  });

  it('transfer.success event: log + skip + 200', async () => {
    const event = { event: 'transfer.success', data: { id: 555, reference: 'tr-x' } };
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(paymentsInserts).toHaveLength(0);
    expect(ordersUpdates).toHaveLength(0);
  });

  it('unknown event type: log webhook_unhandled_event + 200', async () => {
    const event = { event: 'invoice.create', data: { id: 777 } };
    const rawBody = JSON.stringify(event);
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_unhandled_event')).toBeDefined();
  });

  it('returns 500 if PAYSTACK_SECRET_KEY env is missing', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, 'any-sig'));
    expect(res.status).toBe(500);
  });

  it('returns 500 + logs webhook_handler_failed when payments INSERT fails (non-constraint)', async () => {
    paymentsInsertOverride = { error: { code: '40001', message: 'serialization_failure' } };
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(500);
    expect(activityLogs.find((e) => e.eventType === 'webhook_handler_failed')).toBeDefined();
    // No orders UPDATE because handler threw before reaching the UPDATE.
    expect(ordersUpdates).toHaveLength(0);
  });

  it('returns 200 + idempotent skip on 23505 race (concurrent webhook for same event)', async () => {
    paymentsInsertOverride = { error: { code: '23505', message: 'unique_violation on paystack_event_id' } };
    const rawBody = JSON.stringify(makeEvent());
    const res = await POST(makeReq(rawBody, sign(rawBody)));
    expect(res.status).toBe(200);
    expect(activityLogs.find((e) => e.eventType === 'webhook_idempotency_race_skipped')).toBeDefined();
    // Concurrent worker already wrote the row + flipped orders; we must NOT
    // re-attempt the UPDATE to avoid clobbering paid_at/production_ready_at.
    expect(ordersUpdates).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
