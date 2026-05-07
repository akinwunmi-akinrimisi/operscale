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
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// RESEND_ERROR_CODES_BY_KEY is declared in resend's .d.ts but NOT exported from
// the compiled JS bundles (0 occurrences in index.js / index.mjs at v4.8.0) —
// importing it at runtime produces undefined. RESEND_ERROR_CODE_KEY is likewise
// only a local type alias in the .d.ts, not exported. We replicate the mapping
// here verbatim from the type declaration so we can classify 4xx vs 5xx without
// an `as any` cast or a runtime import that silently resolves to undefined.
// Verified against node_modules/resend/dist/index.d.ts @ resend v4.8.0.
const RESEND_STATUS_BY_ERROR_NAME: Record<string, number> = {
  missing_required_field: 422,
  invalid_idempotency_key: 400,
  invalid_idempotent_request: 409,
  concurrent_idempotent_requests: 409,
  invalid_access: 422,
  invalid_parameter: 422,
  invalid_region: 422,
  rate_limit_exceeded: 429,
  missing_api_key: 401,
  invalid_api_Key: 403,
  invalid_from_address: 403,
  validation_error: 403,
  not_found: 404,
  method_not_allowed: 405,
  application_error: 500,
  internal_server_error: 500,
};

export type TemplateKey =
  | 'auto-ack'
  | 'save-token'
  | 'brief-email'
  | 'payment-confirmation'
  | 'recovery-form'
  | 'recovery-brief'
  | 'recovery-payment';

// Dedup windows per template (minutes). recovery-* run on a 30-min cron and
// must not re-fire for the same brief/order within the recovery cooldown.
const DEDUP_WINDOW_MINUTES: Record<TemplateKey, number> = {
  'auto-ack': 60,
  'save-token': 60,
  'brief-email': 60,
  'payment-confirmation': 60,
  'recovery-form': 24 * 60,
  'recovery-brief': 24 * 60,
  'recovery-payment': 4 * 60,
};

// Templates that key idempotency by brief_id (no order exists yet, or the
// email is brief-scoped not order-scoped).
const BRIEF_SCOPED_TEMPLATES = new Set<TemplateKey>([
  'auto-ack',
  'save-token',
  'recovery-form',
]);

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

const SUPPORTED_TEMPLATES: ReadonlyArray<TemplateKey> = [
  'brief-email',
  'payment-confirmation',
  'auto-ack',
  'save-token',
  'recovery-form',
];

async function checkIdempotencyCache(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  templateKey: TemplateKey,
  scope: { briefId?: string; orderId?: string },
): Promise<string | null> {
  const eventType = `${templateKey.replace(/-/g, '_')}_sent`; // 'brief_email_sent'
  const windowMs = (DEDUP_WINDOW_MINUTES[templateKey] ?? 60) * 60 * 1000;
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const briefScoped = BRIEF_SCOPED_TEMPLATES.has(templateKey);
  const lookupId = briefScoped ? scope.briefId : scope.orderId;
  if (!lookupId) return null; // can't dedup without a key — caller will send
  const lookupCol = briefScoped ? 'brief_id' : 'order_id';
  const { data } = await supabase
    .from('activity_log')
    .select('payload')
    .eq('event_type', eventType)
    .eq(lookupCol, lookupId)
    .gt('occurred_at', cutoff)
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

  // Idempotency cache: skip Resend entirely on hit. Brief-scoped templates
  // (auto-ack, save-token, recovery-form) dedup by briefId; everything else
  // dedups by orderId. Window varies per template (see DEDUP_WINDOW_MINUTES).
  const cached = await checkIdempotencyCache(supabase, input.templateKey, {
    briefId: input.briefId,
    orderId: input.orderId,
  });
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
      });
    } catch (e) {
      lastErr = { status: 0, message: e instanceof Error ? e.message : 'network_error' };
      continue;
    }
    if (response.error) {
      // Resend v4 ErrorResponse is { message: string; name: RESEND_ERROR_CODE_KEY }.
      // There is no statusCode field — (response.error as any).statusCode is always
      // undefined at runtime. Use RESEND_ERROR_CODES_BY_KEY to look up the real HTTP
      // status from the error name (the authoritative source in the Resend SDK).
      const name = response.error.name;
      const status = RESEND_STATUS_BY_ERROR_NAME[name] ?? 0;
      const message = response.error.message;
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
