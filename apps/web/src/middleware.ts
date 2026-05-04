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
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = '/admin';
    signInUrl.searchParams.set('reason', 'not_authenticated');
    return NextResponse.redirect(signInUrl);
  }

  // The custom access token hook in 0004 stamps role='founder' onto the JWT
  // claims for allowlisted emails. We read it from app_metadata first
  // (canonical for Supabase) and fall back to the raw user_metadata only if
  // the hook hasn't been wired yet (fail closed).
  const role =
    (data.user.app_metadata as { role?: string } | null)?.role ??
    (data.user.user_metadata as { role?: string } | null)?.role;

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
