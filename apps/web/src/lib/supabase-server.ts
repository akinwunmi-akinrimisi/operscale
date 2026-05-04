// apps/web/src/lib/supabase-server.ts
//
// Server-side Supabase clients used by:
//   * Server components and Server Actions in apps/web/src/app/admin/*
//   * The middleware that gates /admin/* on role=founder
//
// Two factory functions:
//   * getSupabaseServer()      — for Server Components / Route Handlers (cookies via next/headers)
//   * getSupabaseMiddleware()  — for middleware.ts (cookies via NextRequest/NextResponse)
//
// CLAUDE.md "API keys and secrets" rule 3: this file uses the ANON key only.
// The service-role key lives in apps/agent — never in apps/web.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

type CookieSet = { name: string; value: string; options: CookieOptions };

function readEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
  return { url, anonKey };
}

/**
 * Server Component / Route Handler client. Reads cookies via next/headers.
 * Uses dynamic import so this module can be safely bundled for middleware too.
 */
export async function getSupabaseServer() {
  const { url, anonKey } = readEnv();
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Ignore — middleware handles refresh.
        }
      },
    },
  });
}

/**
 * Middleware client. Reads cookies from the incoming request, sets them on the
 * outgoing response so refreshed sessions persist across the redirect chain.
 */
export function getSupabaseMiddleware(req: NextRequest, res: NextResponse) {
  const { url, anonKey } = readEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: CookieSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        }
      },
    },
  });
}
