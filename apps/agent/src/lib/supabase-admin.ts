// apps/agent/src/lib/supabase-admin.ts
//
// Service-role Supabase client. SERVER-ONLY.
//
// CLAUDE.md "API keys and secrets" rule 3: never imported from apps/web/src/app/.
// The CRM at apps/web/src/app/admin/* uses the supabase-browser client with the
// founder JWT. Service-role usage lives here only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Defence-in-depth: throws if this module is loaded from a browser-side bundle.
 * Called at module load (just below) so the very first import anywhere fires
 * the check; production callers (worker.ts, API route handlers, etc.) get the
 * guard for free without needing to remember to invoke anything.
 *
 * Tests verify the throw via `await expect(import('./supabase-admin')).rejects.toThrow(...)`.
 */
export function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      'supabase-admin.ts must NOT be imported from browser/client code; ' +
        'service-role keys are server-side only (CLAUDE.md secrets rule 3). ' +
        'For client-side Supabase access use supabase-browser with the founder JWT.',
    );
  }
}

assertServerSide();

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

// activity_log writer — best-effort per CLAUDE.md gotcha #11.
// Caller may pass a Supabase client (worker uses its own; routes use getSupabaseAdmin()).
export interface ActivityLogInput {
  eventType: string;
  actor: 'customer' | 'founder' | 'system' | 'webhook';
  customerId?: string;
  briefId?: string;
  orderId?: string;
  payload?: Record<string, unknown>;
}

export async function writeActivityLog(
  input: ActivityLogInput,
  client?: SupabaseClient,
): Promise<void> {
  const sb = client ?? getSupabaseAdmin();
  const row = {
    event_type: input.eventType,
    actor: input.actor,
    customer_id: input.customerId ?? null,
    brief_id: input.briefId ?? null,
    order_id: input.orderId ?? null,
    payload: input.payload ?? {},
  };
  // Best-effort: do not throw if the insert fails. The orchestrator's try/finally
  // calls this from a finally block; throwing would mask the real error.
  const { error } = await sb.from('activity_log').insert(row);
  if (error) {
    // Swallow the throw so callers' try/finally is not masked, but log to stderr
    // so Loki/container logs capture failed observability writes — otherwise an
    // oncall engineer has no signal when activity_log silently goes dark.
    // eslint-disable-next-line no-console
    console.error('[supabase-admin] activity_log insert failed (best-effort):', error.message ?? error);
  }
}
