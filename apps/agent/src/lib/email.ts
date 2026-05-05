// apps/agent/src/lib/email.ts
//
// Resend wrapper for transactional emails. Phase 4.5 implements brief-email
// only. Other template keys throw EmailSendError('not_implemented_template').
//
// SOURCE OF TRUTH: docs/specs/email-templates.md.
//
// Idempotency: before sending, check activity_log for a brief_email_sent on
// this order within the last 1h. If present, reuse the cached resend_message_id
// without calling Resend. After 1h, deliberate retries are allowed (founder
// fixed customer email, etc.).

import { Resend } from 'resend';
import { getSupabaseAdmin } from './supabase-admin.js';

export type TemplateKey =
  | 'auto-ack'
  | 'save-token'
  | 'brief-email'
  | 'payment-confirmation'
  | 'recovery-form'
  | 'recovery-brief'
  | 'recovery-payment';

export interface SendEmailInput {
  to: string;
  templateKey: TemplateKey;
  subject: string;
  html: string;
  text: string;
  customerId: string;
  briefId?: string;
  orderId?: string;
}

export interface SendEmailResult {
  resendMessageId: string;
}

export class EmailSendError extends Error {
  constructor(public detail: string | { status: number; message: string }) {
    const msg = typeof detail === 'string' ? detail : `${detail.status} ${detail.message}`;
    super(`email_send_failed: ${msg}`);
    this.name = 'EmailSendError';
  }
}

const RETRY_DELAYS_MS = [500, 1000, 2000];

const SUPPORTED_TEMPLATES: ReadonlyArray<TemplateKey> = ['brief-email'];

async function checkIdempotencyCache(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateKey: TemplateKey,
  orderId: string | undefined,
): Promise<string | null> {
  if (!orderId) return null;
  const eventType = `${templateKey.replace(/-/g, '_')}_sent`; // 'brief_email_sent'
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('activity_log')
    .select('payload')
    .eq('event_type', eventType)
    .eq('order_id', orderId)
    .gt('occurred_at', oneHourAgo)
    .order('occurred_at', { ascending: false })
    .limit(1);
  const row = (data ?? [])[0];
  if (!row) return null;
  const cached = (row.payload as any)?.resend_message_id;
  return typeof cached === 'string' ? cached : null;
}

async function insertActivityLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateKey: TemplateKey,
  resendMessageId: string,
  briefId: string | undefined,
  orderId: string | undefined,
  customerId: string,
): Promise<void> {
  const eventType = `${templateKey.replace(/-/g, '_')}_sent`;
  const { error } = await supabase.from('activity_log').insert({
    event_type: eventType,
    actor: 'system',
    customer_id: customerId,
    brief_id: briefId ?? null,
    order_id: orderId ?? null,
    occurred_at: new Date().toISOString(),
    payload: { resend_message_id: resendMessageId, template_key: templateKey },
  });
  if (error) {
    // Best-effort per CLAUDE.md gotcha #11; log to stderr but don't throw.
    console.error('[email] activity_log insert failed (best-effort):', error.message);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!SUPPORTED_TEMPLATES.includes(input.templateKey)) {
    throw new EmailSendError(`not_implemented_template: ${input.templateKey}`);
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailSendError('missing RESEND_API_KEY');
  const sender = process.env.RESEND_SENDER ?? 'noreply@operscale.cloud';

  const supabase = getSupabaseAdmin();

  // Idempotency cache: skip Resend entirely on hit.
  const cached = await checkIdempotencyCache(supabase, input.templateKey, input.orderId);
  if (cached) return { resendMessageId: cached };

  const resend = new Resend(apiKey);
  let lastErr: { status: number; message: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    let response;
    try {
      response = await resend.emails.send({
        from: sender,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: [
          { name: 'template', value: input.templateKey },
          ...(input.orderId ? [{ name: 'order_id', value: input.orderId }] : []),
        ],
      } as any);
    } catch (e) {
      lastErr = { status: 0, message: e instanceof Error ? e.message : 'network_error' };
      continue;
    }
    if (response.error) {
      const status = (response.error as any).statusCode ?? 0;
      const message = (response.error as any).message ?? 'unknown_resend_error';
      if (status >= 400 && status < 500) {
        throw new EmailSendError({ status, message });
      }
      lastErr = { status, message };
      continue;
    }
    const id = response.data?.id;
    if (!id) {
      lastErr = { status: 0, message: 'resend_returned_no_id' };
      continue;
    }
    await insertActivityLog(supabase, input.templateKey, id, input.briefId, input.orderId, input.customerId);
    return { resendMessageId: id };
  }

  throw new EmailSendError(lastErr ?? { status: 0, message: 'send_failed_no_response' });
}
