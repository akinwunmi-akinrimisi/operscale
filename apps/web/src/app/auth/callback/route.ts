// /auth/callback — top-level Route Handler (outside the /admin/:path* matcher
// so the middleware does NOT redirect before the token exchange).
//
// As of commit-after-1aa4912 this route is the landing page for OUR own
// server-generated magic-link emails (apps/agent /v1/auth/send-magic-link).
// The link the user clicks is:
//   https://operscale.cloud/auth/callback?token_hash=<hash>&type=magiclink
// — same origin as the CRM, no Supabase /verify hop, no PKCE state.
//
// Flow here:
//   1. Read token_hash + type from URL.
//   2. supabase.auth.verifyOtp({token_hash, type}) → session.
//   3. SDK writes the founder cookies via @supabase/ssr's setAll callback.
//   4. activity_log founder_signed_in (best-effort).
//   5. 302 → /admin/pending-review.
//
// On failure or missing token: 302 → /admin?reason=expired&detail=...
//
// Spec: docs/specs/v2-phase-5-design.md §7 "Auth flow" (post-PKCE rewrite).

import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/lib/supabase-server';

const ALLOWED_OTP_TYPES: ReadonlySet<EmailOtpType> = new Set([
  'magiclink',
  'email',
  'signup',
  'recovery',
  'invite',
  'email_change',
]);

/**
 * Build a redirect URL that respects upstream proxy headers (Cloudflare → Traefik
 * → Next). In Docker standalone mode Next sees host=0.0.0.0:3001; without this
 * helper, redirects would bounce the browser to a non-routable internal address.
 */
function proxyAwareUrl(req: NextRequest): URL {
  const url = req.nextUrl.clone();
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) {
    // Split host[:port] cleanly. Setting url.host to a value without a port
    // does NOT clear the existing port (URL spec quirk), so we set hostname
    // and port separately.
    const colonIdx = fwdHost.indexOf(':');
    url.hostname = colonIdx === -1 ? fwdHost : fwdHost.slice(0, colonIdx);
    url.port = colonIdx === -1 ? '' : fwdHost.slice(colonIdx + 1);
  }
  if (fwdProto) url.protocol = `${fwdProto}:`;
  return url;
}

export async function GET(req: NextRequest) {
  const url = proxyAwareUrl(req);
  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type') ?? 'magiclink';
  const type: EmailOtpType = ALLOWED_OTP_TYPES.has(rawType as EmailOtpType)
    ? (rawType as EmailOtpType)
    : 'magiclink';

  if (!tokenHash) {
    url.pathname = '/admin';
    url.search = '?reason=expired&detail=missing_token_hash';
    return NextResponse.redirect(url);
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error || !data?.session) {
    console.error('[auth/callback] verifyOtp failed:', {
      hashPrefix: tokenHash.slice(0, 8),
      type,
      hasSession: Boolean(data?.session),
      errorName: error?.name ?? null,
      errorMessage: error?.message ?? null,
      errorStatus: (error as { status?: number } | null)?.status ?? null,
    });
    url.pathname = '/admin';
    url.search = `?reason=expired&detail=${encodeURIComponent(error?.message ?? 'no_session')}`;
    return NextResponse.redirect(url);
  }

  // Best-effort breadcrumb. Migration 0009 enables this INSERT under the
  // founder JWT; if RLS still blocks (regression), fall through to redirect.
  try {
    const userAgent = req.headers.get('user-agent') ?? null;
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null;
    await supabase.from('activity_log').insert({
      event_type: 'founder_signed_in',
      actor: 'founder',
      payload: {
        actor_email: data.session.user.email ?? null,
        actor_sub: data.session.user.id,
        ip,
        user_agent: userAgent,
      },
    });
  } catch (logErr) {
    console.error('[auth/callback] founder_signed_in log insert failed:', logErr);
  }

  url.pathname = '/admin/pending-review';
  url.search = '';
  return NextResponse.redirect(url);
}
