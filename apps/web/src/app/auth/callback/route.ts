// /auth/callback — top-level Route Handler (outside the /admin/:path* matcher
// so the middleware does NOT redirect before the code exchange).
//
// Magic-link flow lands here with ?code=... after the user clicks the email.
// We exchange code → session, write founder_signed_in activity_log, redirect
// to /admin/pending-review.
//
// Spec: docs/specs/v2-phase-5-design.md §7 "Auth flow".

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

/**
 * Build a redirect URL that respects upstream proxy headers (Cloudflare → Traefik
 * → Next). In Docker standalone mode Next sees host=0.0.0.0:3001; without this
 * helper, redirects would bounce the browser to a non-routable internal address.
 */
function proxyAwareUrl(req: NextRequest): URL {
  const url = req.nextUrl.clone();
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) url.host = fwdHost;
  if (fwdProto) url.protocol = `${fwdProto}:`;
  return url;
}

export async function GET(req: NextRequest) {
  const url = proxyAwareUrl(req);
  const code = url.searchParams.get('code');

  if (!code) {
    url.pathname = '/admin';
    url.search = '?reason=expired';
    return NextResponse.redirect(url);
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    url.pathname = '/admin';
    url.search = '?reason=expired';
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
