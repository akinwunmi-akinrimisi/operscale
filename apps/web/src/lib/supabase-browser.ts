// apps/web/src/lib/supabase-browser.ts
//
// Anon-key Supabase client for the browser. Used by:
//   * Marketing pages (none currently — supabase isn't called outside CRM)
//   * CRM under apps/web/src/app/admin/* (after magic-link sign-in)
//
// CLAUDE.md "API keys and secrets" rule 3: this file MUST NOT import
// SUPABASE_SERVICE_ROLE_KEY. Service-role usage lives in apps/agent/src/lib/supabase-admin.ts.

import { createBrowserClient, type CookieOptions } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY not set');

  _client = createBrowserClient(url, anonKey, {
    cookieOptions: { sameSite: 'lax', secure: true } satisfies CookieOptions,
  });

  return _client;
}
