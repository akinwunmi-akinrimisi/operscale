// apps/web/src/middleware.ts
//
// Defense-in-depth gate for /admin/*. Even though the Supabase auth hook in
// supabase/migrations/0004_edge_function_helpers.sql restricts magic-link
// issuance to the three founder emails, the middleware re-checks role=founder
// on every /admin/* request. Two layers, two failure modes.
//
// Behaviour:
//   * /admin (sign-in page) — always allowed, no redirect.
//   * /admin/* (other admin routes) — require an authenticated session AND
//     a JWT app_metadata or claims field where role='founder'. If absent,
//     redirect to /admin?reason=not_authorized.
//
// Edge runtime compatible: uses @supabase/ssr (no node:* imports).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseMiddleware } from '@/lib/supabase-server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Sign-in page is always reachable.
  if (pathname === '/admin' || pathname === '/admin/') {
    return res;
  }

  if (!pathname.startsWith('/admin')) {
    return res;
  }

  const supabase = getSupabaseMiddleware(req, res);

  // getUser() forces a token refresh + signature verification (vs getSession()
  // which only inspects the cookie). We want the verified version on a gate.
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/admin';
    signInUrl.searchParams.set('reason', 'not_authenticated');
    return NextResponse.redirect(signInUrl);
  }

  // The auth.custom_access_token_hook in migration 0004 stamps
  //   claims := jsonb_set(claims, '{role}', to_jsonb('founder'::text), true)
  // i.e. role lives as a TOP-LEVEL JWT claim, not on auth.users — so it never
  // reaches data.user.app_metadata. Read it from the access_token directly
  // (already signature-verified by getUser above; we just decode the payload).
  // app_metadata / user_metadata are kept as fallbacks for any future hook
  // change that mirrors the role into the user row.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token ?? null;
  let jwtRole: string | undefined;
  if (accessToken) {
    try {
      const payloadB64 = accessToken.split('.')[1] ?? '';
      // base64url → base64; pad to multiple of 4 for atob.
      const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
      const claims = JSON.parse(atob(padded)) as { role?: string };
      jwtRole = claims.role;
    } catch {
      // Malformed token — fall through; checks below will redirect to sign-in.
    }
  }

  const role =
    jwtRole ??
    (userData.user.app_metadata as { role?: string } | null)?.role ??
    (userData.user.user_metadata as { role?: string } | null)?.role;

  if (role !== 'founder') {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/admin';
    signInUrl.searchParams.set('reason', 'not_authorized');
    return NextResponse.redirect(signInUrl);
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
