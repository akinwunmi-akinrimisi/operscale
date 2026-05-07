// POST /v1/auth/send-magic-link
//
// Server-generated CRM sign-in link. Replaces the in-browser supabase-js PKCE
// round-trip that was failing because the verifier cookie set on operscale.cloud
// did not survive the cross-host hop through supabase.operscale.cloud (see
// AuthPKCECodeVerifierMissingError captured in the diagnostic on commit 1aa4912).
//
// Flow:
//   1. SignInForm POSTs {email} here. No browser-side Supabase call at all.
//   2. supabase.auth.admin.generateLink(type='magiclink') returns a hashed_token.
//   3. We construct https://operscale.cloud/auth/callback?token_hash=<hash>&type=magiclink
//      ourselves — bypassing Supabase's /verify hop entirely. The user-visible
//      link is same-origin to the CRM, no subdomain involvement.
//   4. Resend sends our own template containing that link.
//   5. /auth/callback (server) calls verifyOtp({token_hash}); SDK exchanges it
//      for a session via service-side traffic and writes the founder cookies
//      via the @supabase/ssr setAll callback. Zero browser state required.
//
// Idempotency / abuse:
//   * No allowlist check here — the JWT custom_access_token_hook (migration
//     0004) gates role='founder' on app.admin_emails, and the apps/web
//     middleware re-checks role='founder' on every /admin/* request. A
//     non-founder can sign in but cannot reach any CRM page. The known
//     downside (anyone-with-an-email gets a magic-link) is the same surface
//     called out in project_state.md "Side effects" §1; matched not widened.
//   * Always returns 200 OK with {ok:true}, regardless of whether a user
//     actually exists in auth.users. This prevents email enumeration and
//     keeps the form UX identical for valid + invalid addresses.
//
// CLAUDE.md secrets rule 3: lives under apps/agent/ which has SUPABASE_SERVICE_ROLE_KEY.

import { type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { corsPreflight, jsonWithCors } from '@/lib/cors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALLBACK_URL = 'https://operscale.cloud/auth/callback';
const SENDER = process.env.AUTH_EMAIL_FROM ?? 'Operscale CRM <noreply@operscale.cloud>';

export function OPTIONS(req: NextRequest): Response {
  return corsPreflight(req);
}

function htmlBody(url: string): string {
  return [
    '<!doctype html><html><body style="font-family:-apple-system,system-ui,sans-serif;max-width:480px;margin:24px auto;color:#111;line-height:1.5">',
    '<h2 style="margin:0 0 16px;font-weight:600">Sign in to Operscale CRM</h2>',
    '<p style="margin:0 0 24px;color:#444">Click the button below to sign in. The link expires in 60 minutes and can only be used once.</p>',
    `<p style="margin:0 0 24px"><a href="${url}" style="background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:500">Sign in to CRM</a></p>`,
    `<p style="margin:0 0 16px;font-size:13px;color:#666">Or copy this URL into your browser:<br><span style="word-break:break-all;color:#888">${url}</span></p>`,
    '<p style="margin:0;font-size:13px;color:#888">If you didn&apos;t request this, you can safely ignore this email.</p>',
    '</body></html>',
  ].join('');
}

function textBody(url: string): string {
  return [
    'Sign in to Operscale CRM',
    '',
    url,
    '',
    'The link expires in 60 minutes and can only be used once.',
    "If you didn't request this, you can safely ignore this email.",
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<Response> {
  const origin = req.headers.get('origin');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithCors({ error: 'invalid_json' }, 400, origin);
  }
  const rawEmail = (body as { email?: unknown })?.email;
  if (typeof rawEmail !== 'string' || !EMAIL_RE.test(rawEmail.trim())) {
    return jsonWithCors({ error: 'invalid_email' }, 400, origin);
  }
  const email = rawEmail.trim().toLowerCase();

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[send-magic-link] RESEND_API_KEY not set');
    // Misconfig: surface to caller so the form shows an error rather than
    // fake-claiming success.
    return jsonWithCors({ error: 'server_misconfigured' }, 500, origin);
  }

  const supabase = getSupabaseAdmin();

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: CALLBACK_URL },
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    // Most common cause: email isn't a registered user in auth.users.
    // Silent 200 (anti-enumeration). Only the server log captures the reason.
    console.warn('[send-magic-link] generateLink failed:', {
      message: linkErr?.message ?? 'no_hashed_token',
      status: (linkErr as { status?: number } | null)?.status ?? null,
    });
    return jsonWithCors({ ok: true }, 200, origin);
  }

  const tokenHash = linkData.properties.hashed_token;
  const callbackUrl =
    `${CALLBACK_URL}?token_hash=${encodeURIComponent(tokenHash)}` +
    `&type=magiclink`;

  const resend = new Resend(apiKey);
  const { data: sendData, error: sendErr } = await resend.emails.send({
    from: SENDER,
    to: email,
    subject: 'Your Operscale CRM sign-in link',
    html: htmlBody(callbackUrl),
    text: textBody(callbackUrl),
    tags: [{ name: 'template', value: 'magic-link' }],
  });

  if (sendErr || !sendData?.id) {
    console.error('[send-magic-link] resend send failed:', {
      message: sendErr?.message ?? 'no_id',
      name: sendErr?.name ?? null,
    });
    // Server-side failure — surface so the founder retries instead of
    // staring at "check your email" with nothing arriving.
    return jsonWithCors({ error: 'send_failed' }, 502, origin);
  }

  return jsonWithCors({ ok: true }, 200, origin);
}
