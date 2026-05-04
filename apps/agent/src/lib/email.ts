// apps/agent/src/lib/email.ts
//
// Resend wrapper for transactional emails.
// SOURCE OF TRUTH: docs/specs/email-templates.md.
//
// All email JSX components live in apps/web/src/emails/* and are rendered
// to HTML/text via @react-email/render at send time.

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

export async function sendEmail(_input: SendEmailInput): Promise<SendEmailResult> {
  // TODO(Operscale): implement per docs/specs/email-templates.md
  //   1. resend.emails.send({ from: 'noreply@operscale.cloud', to, subject, html, text })
  //   2. Insert email_log row with resend_message_id (UNIQUE catches retries)
  //   3. Insert activity_log: email_<template_key>_sent
  //   4. Idempotency: check email_log for recent send to (customer_id, template_key)
  //      within the spec window (1h for confirmations, 24h for recovery)
  throw new Error('sendEmail not implemented');
}
