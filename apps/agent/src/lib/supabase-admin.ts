// apps/agent/src/lib/supabase-admin.ts
//
// Service-role Supabase client. SERVER-ONLY.
//
// CLAUDE.md "API keys and secrets" rule 3: never imported from apps/web/src/app/.
// The CRM at apps/web/src/app/admin/* uses the supabase-browser client with the
// founder JWT. Service-role usage lives here only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('SUPABASE_URL not set');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');

  _client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-operscale-component': 'agent' },
    },
  });

  return _client;
}

// Convenience helper for the activity_log "scene-by-scene" write pattern
// (CLAUDE.md gotcha #11). Every state transition writes here BEFORE side-effects.
export interface ActivityLogInput {
  eventType: string;
  actor: 'customer' | 'founder' | 'system' | 'webhook';
  customerId?: string;
  briefId?: string;
  orderId?: string;
  payload?: Record<string, unknown>;
}

export async function writeActivityLog(_input: ActivityLogInput): Promise<void> {
  // TODO(Operscale): implement
  //   const sb = getSupabaseAdmin();
  //   await sb.from('activity_log').insert({ ... })
  throw new Error('writeActivityLog not implemented');
}
