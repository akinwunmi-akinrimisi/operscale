import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, EmailSendError } from './email.js';

const ORIGINAL_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_SENDER = process.env.RESEND_SENDER;

let activityRows: any[];
let supabaseMock: any;
let resendSpy: ReturnType<typeof vi.fn>;

vi.mock('resend', () => ({
  // RESEND_ERROR_CODES_BY_KEY is NOT exported from resend's compiled JS bundles
  // (type-only in index.d.ts). email.ts now uses a local copy RESEND_STATUS_BY_ERROR_NAME
  // so no importOriginal dance is needed — just stub the Resend class.
  Resend: class {
    emails = { send: (...args: any[]) => resendSpy(...args) };
    constructor(_apiKey: string) {}
  },
}));

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => supabaseMock,
  writeActivityLog: vi.fn(),
}));

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test_dummy';
  process.env.RESEND_SENDER = 'noreply@example.com';
  vi.useFakeTimers();
  activityRows = [];
  resendSpy = vi.fn();
  supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === 'activity_log') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: activityRows, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation(async (row: any) => { activityRows.push(row); return { error: null }; }),
        };
      }
      return {};
    }),
  };
});

afterEach(() => {
  process.env.RESEND_API_KEY = ORIGINAL_KEY;
  process.env.RESEND_SENDER = ORIGINAL_SENDER;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const baseInput = {
  to: 'tola@example.com',
  templateKey: 'brief-email' as const,
  subject: 'Your Operscale calendar brief is ready',
  html: '<p>brief</p>',
  text: 'brief',
  customerId: 'cust-1',
  briefId: 'brief-1',
  orderId: 'order-1',
};

describe('sendEmail', () => {
  it('sends via Resend on happy path and INSERTs activity_log', async () => {
    resendSpy.mockResolvedValueOnce({ data: { id: 'resend-msg-1' }, error: null });
    const result = await sendEmail(baseInput);
    expect(result).toEqual({ resendMessageId: 'resend-msg-1' });
    expect(resendSpy).toHaveBeenCalledTimes(1);
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0]).toMatchObject({
      event_type: 'brief_email_sent',
      order_id: 'order-1',
      payload: expect.objectContaining({ resend_message_id: 'resend-msg-1', template_key: 'brief-email' }),
    });
  });

  it('returns cached resend_message_id without calling Resend on idempotency hit', async () => {
    activityRows = [{ payload: { resend_message_id: 'cached-msg', template_key: 'brief-email' } }];
    // Re-mock supabase so its initial select returns the cached row.
    supabaseMock.from = vi.fn((table: string) => {
      if (table === 'activity_log') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: activityRows, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });
    const result = await sendEmail(baseInput);
    expect(result).toEqual({ resendMessageId: 'cached-msg' });
    expect(resendSpy).not.toHaveBeenCalled();
  });

  it('throws EmailSendError on Resend 4xx', async () => {
    // Mock uses the real Resend v4 ErrorResponse shape: {name, message} only — no statusCode field.
    // RESEND_ERROR_CODES_BY_KEY maps 'validation_error' -> 403 (a 4xx), so sendEmail must throw
    // immediately instead of retrying. Prior code used (response.error as any).statusCode which
    // was always undefined (0), so this branch was never taken — that was the bug.
    resendSpy.mockResolvedValueOnce({ data: null, error: { name: 'validation_error', message: 'Invalid email' } });
    await expect(sendEmail(baseInput)).rejects.toBeInstanceOf(EmailSendError);
  });

  it('retries on Resend 5xx and succeeds on second attempt', async () => {
    // 'application_error' maps to 500 in RESEND_ERROR_CODES_BY_KEY — should be retried.
    resendSpy
      .mockResolvedValueOnce({ data: null, error: { name: 'application_error', message: 'upstream' } })
      .mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });
    const promise = sendEmail(baseInput);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result.resendMessageId).toBe('msg-2');
    expect(resendSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after 3 5xx retries', async () => {
    // 'application_error' maps to 500 — retried until exhausted.
    resendSpy.mockResolvedValue({ data: null, error: { name: 'application_error', message: 'upstream' } });
    // Suppress the unhandled-rejection warning that Vitest emits when
    // advanceTimersByTimeAsync causes the promise to reject before the
    // `await expect().rejects` line runs. The assertion still validates
    // the error type; the .catch() only prevents the false-positive error.
    const promise = sendEmail(baseInput);
    promise.catch(() => { /* handled below */ });
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000);
    await expect(promise).rejects.toBeInstanceOf(EmailSendError);
    expect(resendSpy).toHaveBeenCalledTimes(4);
  });

  it('throws on unsupported templateKey', async () => {
    await expect(sendEmail({ ...baseInput, templateKey: 'auto-ack' })).rejects.toBeInstanceOf(EmailSendError);
    expect(resendSpy).not.toHaveBeenCalled();
  });
});
