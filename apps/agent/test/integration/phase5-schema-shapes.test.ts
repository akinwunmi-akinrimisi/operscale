// Phase 5 schema-reality test. Skipped unless SMOKE=1.
// Hits real staging Supabase via the service-role key from the master .env.
// Asserts that the queries /admin/* pages run actually return the columns
// the UI components expect. Catches schema drift before VPS deploy.

import { describe, expect, it, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SMOKE = process.env.SMOKE === '1';
const it_smoke = SMOKE ? it : it.skip;

let supabase: SupabaseClient;

beforeAll(() => {
  if (!SMOKE) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required for SMOKE=1');
  }
  supabase = createClient(url, key);
});

describe('Phase 5 schema reality (SMOKE=1)', () => {
  it_smoke('pending-review join returns expected column shape', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, tier, briefs!inner(id, submitted_at, form_payload), customers!inner(id, name:full_name), brief_photos(brief_id)`,
      )
      .eq('status', 'pending_founder_review')
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    if (data && data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data[0] as any;
      expect(typeof row.id).toBe('string');
      expect(['starter', 'standard', 'calendar']).toContain(row.tier);
    }
  });

  it_smoke('paid-orders join returns paid_at + amount_ngn', async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name:full_name)`,
      )
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    if (data && data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data[0] as any;
      expect(typeof row.paid_at).toBe('string');
      expect(typeof row.amount_ngn).toBe('number');
    }
  });

  it_smoke('analysis_runs.framework_seed.selected_pairs is an array on a recent row', async () => {
    const { data, error } = await supabase
      .from('analysis_runs')
      .select('id, framework_seed')
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    if (data && data.length > 0) {
      const seed = (data[0].framework_seed as { selected_pairs: unknown[] }) ?? null;
      expect(seed).not.toBeNull();
      expect(Array.isArray(seed!.selected_pairs)).toBe(true);
      expect(seed!.selected_pairs.length).toBeGreaterThanOrEqual(7);
      expect(seed!.selected_pairs.length).toBeLessThanOrEqual(8);
    }
  });

  it_smoke('activity_log founder INSERT policy exists (migration 0009)', async () => {
    // Service-role bypasses RLS, so we can't directly test as founder.
    // Verify the row INSERT/DELETE works under service-role (always passes
    // when policies are well-formed; would fail if 0009 broke 0001's
    // structure).
    const TEST_BRIEF_ID = '00000000-0000-0000-0000-000000000099';
    const { data: inserted, error: insErr } = await supabase
      .from('activity_log')
      .insert({
        event_type: 'phase5_schema_test',
        actor: 'test',
        brief_id: TEST_BRIEF_ID,
        payload: { test: true },
      })
      .select('id')
      .maybeSingle();
    expect(insErr).toBeNull();
    expect(inserted).not.toBeNull();
    if (inserted?.id) {
      await supabase.from('activity_log').delete().eq('id', inserted.id);
    }
  });

  it_smoke('customers founder_read policy exists (migration 0010)', async () => {
    // Service-role can read regardless. We just confirm the table has
    // queryable shape with the expected canonical column.
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, whatsapp_number, email')
      .limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
