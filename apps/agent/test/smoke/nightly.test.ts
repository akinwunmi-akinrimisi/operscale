import { describe, it, expect, beforeAll } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { loadBankCatalog } from '@/lib/bank-catalog';
import { createBriefAnalyzer, type AnalyzeResult } from '@/lib/claude';
import { initialFashionTier2 } from '../fixtures/briefs/initial-fashion-tier-2';

const enabled = process.env.SMOKE === '1';

describe.skipIf(!enabled)('L3 nightly smoke — initial / fashion / tier-standard', () => {
  let result: AnalyzeResult;

  beforeAll(async () => {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
    const catalog = await loadBankCatalog();   // real signature — no args

    const supabase: any = {
      from: () => ({
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
        insert: async () => ({ error: null }),
      }),
    };
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const logger = { info: () => {}, error: console.error };
    const analyzer = createBriefAnalyzer({ client: client as any, supabase, catalog, logger });
    result = await analyzer.analyze({
      brief: initialFashionTier2,
      photos: [],
      trigger_type: 'initial',
    });
  }, 240_000);

  it('orchestrator returns ok=true', () => {
    expect(result.ok).toBe(true);
  });

  it('calendar_plan has the tier-standard slot count (14 + 7 = 21)', () => {
    if (!result.ok) throw new Error('precondition failed');
    expect(result.superset.calendar_plan).toHaveLength(21);
  });

  it('cost_usd is within the spec budget (< $1.00 — design §5)', () => {
    if (!result.ok) throw new Error('precondition failed');
    expect(result.telemetry.cost_usd).toBeLessThan(1.0);
  });
});
